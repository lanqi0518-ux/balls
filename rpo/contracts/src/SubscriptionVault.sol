// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/utils/ReentrancyGuard.sol";
import {AllocationBooster} from "./AllocationBooster.sol";
import {RialtoAdapter} from "./adapters/RialtoAdapter.sol";

/// @title SubscriptionVault
/// @notice One vault per IPO. Users deposit USDG during the subscription
///         window; once the Robinhood Stock Token is minted on-chain the
///         registry calls fulfill(), the vault swaps its USDG for the new
///         token via the best available route (Rialto propAMM preferred,
///         Uniswap V3 fallback, 0x RFQ final fallback), and users claim
///         their pro-rata (weighted) allocation.
///
///         If the deadline passes without a launch, the vault flips into
///         refund mode and every user recovers their USDG 1:1.
contract SubscriptionVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------
    // Immutables / config
    // ---------------------------------------------------------------

    string public ticker;
    IERC20 public immutable usdg;
    address public immutable registry;
    AllocationBooster public immutable booster;
    RialtoAdapter public immutable rialtoAdapter;
    address public immutable feeCollector;
    uint256 public immutable subscriptionDeadline;
    uint256 public immutable fulfillmentDeadline;
    uint16 public immutable platformFeeBps;

    // ---------------------------------------------------------------
    // State
    // ---------------------------------------------------------------

    IERC20 public stockToken;              // set on fulfill
    uint256 public totalUSDG;              // gross deposits still in vault
    uint256 public totalWeight;            // sum of boosted weights
    uint256 public totalStockTokenReceived;
    bool public fulfilled;
    bool public refunded;

    mapping(address => uint256) public deposits; // user → USDG deposited
    mapping(address => uint256) public weights;  // user → boosted weight
    mapping(address => bool) public claimed;

    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------

    event Subscribed(address indexed user, uint256 amount, uint256 weight);
    event Cancelled(address indexed user, uint256 amount);
    event Fulfilled(
        address indexed stockToken,
        uint256 usdgSpent,
        uint256 tokenReceived,
        uint256 platformFee
    );
    event Claimed(address indexed user, uint256 tokenAmount);
    event RefundActivated();
    event Refunded(address indexed user, uint256 amount);

    // ---------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------

    error SubscriptionClosed();
    error AlreadyFulfilled();
    error AlreadyRefunded();
    error NotFulfilled();
    error NotRefunded();
    error TooEarly();
    error NothingToClaim();
    error OnlyRegistry();
    error ZeroAmount();

    // ---------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------

    modifier onlyRegistry() {
        if (msg.sender != registry) revert OnlyRegistry();
        _;
    }

    // ---------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------

    constructor(
        string memory _ticker,
        address _usdg,
        address _registry,
        address _booster,
        address _rialtoAdapter,
        address _feeCollector,
        uint256 _subDeadline,
        uint256 _fulDeadline,
        uint16 _platformFeeBps
    ) {
        ticker = _ticker;
        usdg = IERC20(_usdg);
        registry = _registry;
        booster = AllocationBooster(_booster);
        rialtoAdapter = RialtoAdapter(_rialtoAdapter);
        feeCollector = _feeCollector;
        subscriptionDeadline = _subDeadline;
        fulfillmentDeadline = _fulDeadline;
        platformFeeBps = _platformFeeBps;
    }

    // ---------------------------------------------------------------
    // User actions
    // ---------------------------------------------------------------

    /// @notice Subscribe to this IPO with `amount` USDG. Weight = amount ×
    ///         current boost from AllocationBooster (locked at deposit).
    function subscribe(uint256 amount) external nonReentrant {
        if (block.timestamp >= subscriptionDeadline) revert SubscriptionClosed();
        if (fulfilled) revert AlreadyFulfilled();
        if (refunded) revert AlreadyRefunded();
        if (amount == 0) revert ZeroAmount();

        usdg.safeTransferFrom(msg.sender, address(this), amount);

        uint256 boost = booster.getBoost(msg.sender); // 1e18 = 1x
        uint256 weight = (amount * boost) / 1e18;

        deposits[msg.sender] += amount;
        weights[msg.sender] += weight;
        totalUSDG += amount;
        totalWeight += weight;

        emit Subscribed(msg.sender, amount, weight);
    }

    /// @notice Cancel your subscription and get USDG back, only while the
    ///         subscription window is still open.
    function cancel() external nonReentrant {
        if (block.timestamp >= subscriptionDeadline) revert SubscriptionClosed();
        if (fulfilled) revert AlreadyFulfilled();

        uint256 amount = deposits[msg.sender];
        if (amount == 0) revert NothingToClaim();

        totalUSDG -= amount;
        totalWeight -= weights[msg.sender];
        delete deposits[msg.sender];
        delete weights[msg.sender];

        usdg.safeTransfer(msg.sender, amount);
        emit Cancelled(msg.sender, amount);
    }

    /// @notice Claim your share of the acquired Stock Token after fulfill().
    function claim() external nonReentrant {
        if (!fulfilled) revert NotFulfilled();
        if (claimed[msg.sender]) revert NothingToClaim();
        uint256 w = weights[msg.sender];
        if (w == 0) revert NothingToClaim();

        uint256 share = (totalStockTokenReceived * w) / totalWeight;
        claimed[msg.sender] = true;

        stockToken.safeTransfer(msg.sender, share);
        emit Claimed(msg.sender, share);
    }

    /// @notice After refund is activated, withdraw your original USDG.
    function withdrawRefund() external nonReentrant {
        if (!refunded) revert NotRefunded();
        uint256 amount = deposits[msg.sender];
        if (amount == 0) revert NothingToClaim();

        delete deposits[msg.sender];
        delete weights[msg.sender];

        usdg.safeTransfer(msg.sender, amount);
        emit Refunded(msg.sender, amount);
    }

    // ---------------------------------------------------------------
    // Registry-only actions
    // ---------------------------------------------------------------

    /// @notice Route USDG → stock token via best available venue.
    function fulfill(address _stockToken, uint256 minAmountOut)
        external
        nonReentrant
        onlyRegistry
    {
        if (fulfilled) revert AlreadyFulfilled();
        if (refunded) revert AlreadyRefunded();
        if (block.timestamp < subscriptionDeadline) revert TooEarly();

        stockToken = IERC20(_stockToken);

        // Platform fee taken in USDG (transferred to fee collector).
        uint256 fee = (totalUSDG * platformFeeBps) / 10_000;
        uint256 tradeAmount = totalUSDG - fee;
        if (fee > 0) usdg.safeTransfer(feeCollector, fee);

        // Approve and swap through RialtoAdapter (which handles fallbacks).
        usdg.forceApprove(address(rialtoAdapter), tradeAmount);
        uint256 received = rialtoAdapter.buyBestPrice(
            address(usdg),
            _stockToken,
            tradeAmount,
            minAmountOut,
            address(this)
        );

        totalStockTokenReceived = received;
        fulfilled = true;

        emit Fulfilled(_stockToken, tradeAmount, received, fee);
    }

    /// @notice Called by registry when fulfillment window expires.
    function activateRefund() external onlyRegistry {
        if (fulfilled) revert AlreadyFulfilled();
        if (refunded) revert AlreadyRefunded();
        if (block.timestamp < fulfillmentDeadline) revert TooEarly();
        refunded = true;
        emit RefundActivated();
    }

    // ---------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------

    function previewAllocation(address user) external view returns (uint256) {
        if (!fulfilled || totalWeight == 0) return 0;
        return (totalStockTokenReceived * weights[user]) / totalWeight;
    }

    function timeLeftForSubscription() external view returns (uint256) {
        return block.timestamp >= subscriptionDeadline
            ? 0
            : subscriptionDeadline - block.timestamp;
    }
}

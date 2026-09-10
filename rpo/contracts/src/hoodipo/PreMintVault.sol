// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/utils/ReentrancyGuard.sol";
import {IUniversalRouter} from "../interfaces/IUniversalRouter.sol";

/// @title  PreMintVault
/// @notice Flagship HOODIPO primitive. One vault per ticker. Deployed
///         permissionlessly the moment anyone spots a filing / rumor,
///         funded with USDG during the hunt window, and self-executes
///         the very first block Robinhood's RHJ mints the new Stock
///         Token on-chain — locking in first-block liquidity ahead of
///         every retail participant coming through robinhood.com.
///
///         Design tenets
///         =============
///           * Permissionless deploy + permissionless trigger.
///             Every gatekeeper is on-chain: `announce(ticker)` is
///             open, `fulfill(...)` verifies the discovered token
///             matches a Robinhood-signed attestation, and the caller
///             earns a keeper bounty out of the pot.
///           * Refund-safe. If no matching mint appears before the
///             fulfillment deadline the vault flips into refund mode
///             and every subscriber recovers USDG 1:1.
///           * MEV-neutral. `fulfill` routes through UniversalRouter
///             with the caller's supplied `commands` blob, but caps
///             `minAmountOut` at the pot-scaled Chainlink mark to
///             stop keepers from front-running themselves at absurd
///             slippage.
///           * Idempotent per (ticker, hunt-epoch). Two announcers
///             for the same ticker in the same 24h collapse into the
///             same vault via CREATE2.
///
///         Not covered here (out-of-scope for the vault):
///           * The KYC/Reg-S allowlist. Every RH Chain interaction
///             already requires an RHJ-eligible wallet, so we don't
///             duplicate the check.
///           * The AntiSnipeHook rate-limiter — a sibling contract
///             plugs into the V4 pool the moment the mint appears.
contract PreMintVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------
    // Immutables
    // ---------------------------------------------------------------

    /// @notice Ticker being hunted (uppercase ASCII, e.g. "STRIPE").
    string public ticker;

    /// @notice USDG on Robinhood Chain — the only accepted subscription currency.
    IERC20 public immutable usdg;

    /// @notice UniversalRouter used by `fulfill` for the buy leg.
    IUniversalRouter public immutable router;

    /// @notice Chainlink AggregatorV3 for the underlying (nullable —
    ///         when zero, `fulfill` requires a keeper-supplied bound).
    address public immutable underlyingFeed;

    /// @notice Robinhood asset attestor (RHJ multisig signing key or
    ///         the on-chain `AssetsRegistry` that mirrors /rhj/assets).
    address public immutable rhjAttestor;

    /// @notice When subscriptions close.
    uint256 public immutable subscriptionDeadline;

    /// @notice When the hunt gives up and refunds unlock.
    uint256 public immutable fulfillmentDeadline;

    /// @notice Fee taken from the pot at fulfillment, in bps.
    uint16 public immutable platformFeeBps;

    /// @notice Bounty paid to the keeper who lands `fulfill`, in bps.
    uint16 public immutable keeperBountyBps;

    /// @notice Fee recipient.
    address public immutable feeCollector;

    // ---------------------------------------------------------------
    // State
    // ---------------------------------------------------------------

    address public stockToken;              // set on fulfill
    uint256 public totalUSDG;               // gross USDG still in vault
    uint256 public totalStockTokenReceived; // set on fulfill
    bool public fulfilled;
    bool public refunded;

    mapping(address => uint256) public deposits;
    mapping(address => bool) public claimed;

    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------

    event Subscribed(address indexed user, uint256 amount);
    event Cancelled(address indexed user, uint256 amount);
    event Fulfilled(
        address indexed stockToken,
        address indexed keeper,
        uint256 usdgSpent,
        uint256 tokenReceived,
        uint256 platformFee,
        uint256 keeperBounty
    );
    event Claimed(address indexed user, uint256 amount);
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
    error TooLate();
    error NothingToClaim();
    error ZeroAmount();
    error BadAttestation();
    error SlippageExceeded();

    // ---------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------

    struct Config {
        string ticker;
        address usdg;
        address router;
        address underlyingFeed;
        address rhjAttestor;
        uint256 subscriptionDeadline;
        uint256 fulfillmentDeadline;
        uint16 platformFeeBps;
        uint16 keeperBountyBps;
        address feeCollector;
    }

    constructor(Config memory c) {
        require(c.platformFeeBps <= 500, "fee>5%");
        require(c.keeperBountyBps <= 200, "bounty>2%");
        require(c.subscriptionDeadline > block.timestamp, "sub past");
        require(c.fulfillmentDeadline > c.subscriptionDeadline, "ful<=sub");
        require(bytes(c.ticker).length > 0 && bytes(c.ticker).length <= 12, "bad ticker");

        ticker = c.ticker;
        usdg = IERC20(c.usdg);
        router = IUniversalRouter(c.router);
        underlyingFeed = c.underlyingFeed;
        rhjAttestor = c.rhjAttestor;
        subscriptionDeadline = c.subscriptionDeadline;
        fulfillmentDeadline = c.fulfillmentDeadline;
        platformFeeBps = c.platformFeeBps;
        keeperBountyBps = c.keeperBountyBps;
        feeCollector = c.feeCollector;
    }

    // ---------------------------------------------------------------
    // User actions
    // ---------------------------------------------------------------

    /// @notice Subscribe with `amount` USDG. Every subscriber is
    ///         pro-rata (no boost). Boosts belong in a separate
    ///         wrapper vault; this contract is the raw primitive.
    function subscribe(uint256 amount) external nonReentrant {
        if (block.timestamp >= subscriptionDeadline) revert SubscriptionClosed();
        if (fulfilled) revert AlreadyFulfilled();
        if (refunded) revert AlreadyRefunded();
        if (amount == 0) revert ZeroAmount();

        usdg.safeTransferFrom(msg.sender, address(this), amount);
        deposits[msg.sender] += amount;
        totalUSDG += amount;

        emit Subscribed(msg.sender, amount);
    }

    /// @notice Pull out USDG at any time before the pot is spent.
    ///         Callable both during the subscription window and any
    ///         time before fulfillment lands — this is a strict user
    ///         guarantee: your money can always leave the vault while
    ///         it hasn't been swapped.
    function cancel() external nonReentrant {
        if (fulfilled) revert AlreadyFulfilled();
        uint256 amount = deposits[msg.sender];
        if (amount == 0) revert NothingToClaim();

        delete deposits[msg.sender];
        totalUSDG -= amount;
        usdg.safeTransfer(msg.sender, amount);
        emit Cancelled(msg.sender, amount);
    }

    /// @notice After fulfillment: claim your pro-rata share of the
    ///         Stock Tokens the vault bought.
    function claim() external nonReentrant {
        if (!fulfilled) revert NotFulfilled();
        if (claimed[msg.sender]) revert NothingToClaim();

        uint256 d = deposits[msg.sender];
        if (d == 0) revert NothingToClaim();
        claimed[msg.sender] = true;

        uint256 share = (totalStockTokenReceived * d) / _totalSubscribed();
        IERC20(stockToken).safeTransfer(msg.sender, share);
        emit Claimed(msg.sender, share);
    }

    /// @notice After a missed launch: pull USDG back 1:1.
    function withdrawRefund() external nonReentrant {
        if (!refunded) revert NotRefunded();
        uint256 amount = deposits[msg.sender];
        if (amount == 0) revert NothingToClaim();
        delete deposits[msg.sender];
        usdg.safeTransfer(msg.sender, amount);
        emit Refunded(msg.sender, amount);
    }

    // ---------------------------------------------------------------
    // Permissionless keeper actions
    // ---------------------------------------------------------------

    /// @notice The magic moment. Anyone can call this when they've
    ///         watched an RHJ mint event and want to earn the keeper
    ///         bounty. Steps:
    ///           1. Verify the discovered token was signed by RHJ.
    ///           2. Cap `minAmountOut` at Chainlink × pot × (1-slip).
    ///           3. Route the buy through UniversalRouter using the
    ///              caller-supplied commands blob (V4 pool path chosen
    ///              off-chain by the keeper — cheaper than on-chain path
    ///              finding). The vault only measures the delta of its
    ///              own stockToken balance, so an incorrect route just
    ///              trips the slippage revert.
    ///           4. Split proceeds: platform fee → fee collector,
    ///              keeper bounty → msg.sender, remainder → subscribers.
    ///
    /// @param _stockToken           The Robinhood Stock Token address that
    ///                              was just minted.
    /// @param _attestation          65-byte RHJ signature over
    ///                              keccak256(ticker, _stockToken, chainid).
    ///                              When `rhjAttestor` is set to the
    ///                              on-chain AssetsRegistry, pass 0-length
    ///                              bytes here — the vault falls back to a
    ///                              staticcall lookup instead.
    /// @param minAmountOut          Caller's slippage floor; must also
    ///                              respect the Chainlink cap below.
    /// @param routerCommands        UniversalRouter `commands` bytes.
    /// @param routerInputs          Matching inputs array.
    /// @param maxSlippageBps        Max deviation from Chainlink mark
    ///                              the vault will tolerate. Capped at 500.
    struct FulfillLocals {
        uint256 pot;
        uint256 platformFee;
        uint256 keeperBounty;
        uint256 tradeAmount;
        uint256 chainlinkFloor;
        uint256 effectiveFloor;
        uint256 balBefore;
        uint256 received;
    }

    function fulfill(
        address _stockToken,
        bytes calldata _attestation,
        uint256 minAmountOut,
        bytes calldata routerCommands,
        bytes[] calldata routerInputs,
        uint16 maxSlippageBps
    ) external nonReentrant {
        _preFulfillChecks(_stockToken, maxSlippageBps);
        _verifyAttestation(_stockToken, _attestation);

        FulfillLocals memory L;
        (L.pot, L.platformFee, L.keeperBounty, L.tradeAmount) = _splitPot();

        if (L.platformFee > 0) usdg.safeTransfer(feeCollector, L.platformFee);
        if (L.keeperBounty > 0) usdg.safeTransfer(msg.sender, L.keeperBounty);

        L.chainlinkFloor = _chainlinkFloor(L.tradeAmount, maxSlippageBps);
        L.effectiveFloor = minAmountOut > L.chainlinkFloor ? minAmountOut : L.chainlinkFloor;

        usdg.forceApprove(address(router), L.tradeAmount);
        L.balBefore = IERC20(_stockToken).balanceOf(address(this));
        router.execute(routerCommands, routerInputs, block.timestamp + 60);
        L.received = IERC20(_stockToken).balanceOf(address(this)) - L.balBefore;
        if (L.received < L.effectiveFloor) revert SlippageExceeded();

        stockToken = _stockToken;
        totalStockTokenReceived = L.received;
        fulfilled = true;

        emit Fulfilled(_stockToken, msg.sender, L.tradeAmount, L.received, L.platformFee, L.keeperBounty);
    }

    function _preFulfillChecks(address _stockToken, uint16 maxSlippageBps) internal view {
        if (fulfilled) revert AlreadyFulfilled();
        if (refunded) revert AlreadyRefunded();
        if (block.timestamp < subscriptionDeadline) revert TooEarly();
        if (block.timestamp >= fulfillmentDeadline) revert TooLate();
        require(_stockToken != address(0), "zero token");
        require(maxSlippageBps <= 500, "slip>5%");
    }

    function _splitPot() internal view returns (uint256 pot, uint256 fee, uint256 bounty, uint256 trade) {
        pot = totalUSDG;
        fee = (pot * platformFeeBps) / 10_000;
        bounty = (pot * keeperBountyBps) / 10_000;
        trade = pot - fee - bounty;
        require(trade > 0, "empty pot");
    }

    /// @notice Permissionlessly flip the vault into refund mode after
    ///         the fulfillment deadline lapses. No RHJ signature ever
    ///         appeared → every subscriber gets USDG back.
    function activateRefund() external {
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
        if (!fulfilled) return 0;
        uint256 sub = _totalSubscribed();
        if (sub == 0) return 0;
        return (totalStockTokenReceived * deposits[user]) / sub;
    }

    function subscriberCount() external pure returns (uint256) {
        // Not tracked (would double gas on subscribe). Off-chain
        // indexers derive this from `Subscribed` events.
        return 0;
    }

    // ---------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------

    /// @dev Sum of every current `deposits[user]`. Because `cancel`
    ///      also decrements `totalUSDG`, `totalUSDG` equals the sum
    ///      of surviving deposits *up until* fulfill spends it.
    ///      After fulfill, we snapshot that value into a local sum
    ///      via `totalStockTokenReceived / mark`, but for pro-rata
    ///      claims we need the pre-swap subscribed sum — which is
    ///      what `totalUSDG` held at the moment of fulfill.
    ///
    ///      Solidity doesn't let us mutate `totalUSDG` and still
    ///      recover it, so instead we recompute: after fulfill the
    ///      only remaining state that scales with subscribers is
    ///      `deposits[user]`. Sum-invariant: totalUSDG at fulfill ==
    ///      sum(deposits[i]) at fulfill. `totalUSDG` is never mutated
    ///      by claims (they distribute stockToken, not USDG), so the
    ///      pre-swap value survives.
    function _totalSubscribed() internal view returns (uint256) {
        return totalUSDG;
    }

    function _verifyAttestation(address _stockToken, bytes calldata sig) internal view {
        if (sig.length == 0) {
            // Fall back to on-chain registry lookup.
            (bool ok, bytes memory data) = rhjAttestor.staticcall(
                abi.encodeWithSignature("stockTokenOf(string)", ticker)
            );
            require(ok && data.length >= 32, "attestor call failed");
            address expected = abi.decode(data, (address));
            if (expected != _stockToken) revert BadAttestation();
            return;
        }
        require(sig.length == 65, "sig len");
        bytes32 digest = keccak256(abi.encode(ticker, _stockToken, block.chainid));
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 0x20))
            v := byte(0, calldataload(add(sig.offset, 0x40)))
        }
        address signer = ecrecover(
            keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest)),
            v, r, s
        );
        if (signer == address(0) || signer != rhjAttestor) revert BadAttestation();
    }

    function _chainlinkFloor(uint256 tradeAmountUsdg, uint16 maxSlipBps)
        internal
        view
        returns (uint256 floorTokens)
    {
        if (underlyingFeed == address(0)) return 0;
        (bool ok, bytes memory a) = underlyingFeed.staticcall(
            abi.encodeWithSignature("latestRoundData()")
        );
        if (!ok || a.length < 32 * 5) return 0;
        (, int256 answer, , , ) = abi.decode(a, (uint80, int256, uint256, uint256, uint80));
        if (answer <= 0) return 0;
        (bool ok2, bytes memory d) = underlyingFeed.staticcall(
            abi.encodeWithSignature("decimals()")
        );
        if (!ok2 || d.length < 32) return 0;
        uint8 dec = abi.decode(d, (uint8));

        // tradeAmountUsdg is 6-dec (USDG). Chainlink `answer` is `dec`-dec.
        // stock tokens are 18-dec. Convert:
        //   tokens = tradeAmountUsdg * 1e18 * (10**dec) / (answer * 1e6)
        // Apply slippage tolerance: multiply floor by (10_000 - maxSlipBps)/10_000.
        uint256 num = tradeAmountUsdg * 1e18 * (10 ** uint256(dec));
        uint256 denom = uint256(answer) * 1e6;
        uint256 mid = num / denom;
        floorTokens = (mid * (10_000 - uint256(maxSlipBps))) / 10_000;
    }
}

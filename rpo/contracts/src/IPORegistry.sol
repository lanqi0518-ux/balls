// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SubscriptionVault} from "./SubscriptionVault.sol";
import {AllocationBooster} from "./AllocationBooster.sol";
import {RialtoAdapter} from "./adapters/RialtoAdapter.sol";
import {Ownable} from "openzeppelin-contracts/access/Ownable.sol";

/// @title IPORegistry
/// @notice Central registry that (a) announces upcoming Robinhood Stock Token
///         listings, (b) deploys per-IPO SubscriptionVaults with CREATE2, and
///         (c) triggers vault fulfillment once the Stock Token appears
///         on-chain. Managed by an off-chain keeper (Gelato/Chainlink
///         Automation recommended for production).
contract IPORegistry is Ownable {
    // ---------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------

    enum Status {
        NONE,
        ANNOUNCED, // Vault deployed, subscriptions open
        LAUNCHED,  // Stock token deployed & vault fulfilled
        REFUNDED   // Deadline missed, refunds available
    }

    struct IPO {
        string ticker;
        string name;
        address stockToken;         // 0x0 until launched
        address vault;              // corresponding SubscriptionVault
        uint256 subscriptionDeadline;
        uint256 fulfillmentDeadline;
        Status status;
    }

    // ---------------------------------------------------------------
    // State
    // ---------------------------------------------------------------

    AllocationBooster public immutable booster;
    RialtoAdapter public immutable rialtoAdapter;
    address public immutable feeCollector;
    address public immutable usdg;
    address public keeper;

    mapping(bytes32 => IPO) public ipos;      // key = keccak256(ticker)
    bytes32[] public ipoKeys;                 // for enumeration

    uint16 public platformFeeBps = 200;       // 2%

    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------

    event IPOAnnounced(
        bytes32 indexed key,
        string ticker,
        address vault,
        uint256 subscriptionDeadline
    );
    event IPOLaunched(bytes32 indexed key, address stockToken, uint256 timestamp);
    event IPORefundActivated(bytes32 indexed key);
    event KeeperUpdated(address newKeeper);
    event PlatformFeeUpdated(uint16 newBps);

    // ---------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------

    modifier onlyKeeper() {
        require(msg.sender == keeper || msg.sender == owner(), "not keeper");
        _;
    }

    // ---------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------

    constructor(
        address _owner,
        address _keeper,
        address _usdg,
        address _feeCollector,
        AllocationBooster _booster,
        RialtoAdapter _rialtoAdapter
    ) Ownable(_owner) {
        keeper = _keeper;
        usdg = _usdg;
        feeCollector = _feeCollector;
        booster = _booster;
        rialtoAdapter = _rialtoAdapter;
    }

    // ---------------------------------------------------------------
    // Keeper actions
    // ---------------------------------------------------------------

    /// @notice Announce a new IPO and deploy its per-IPO vault.
    /// @param ticker              Stock symbol, e.g. "STRIPE".
    /// @param name                Display name, e.g. "Stripe Inc.".
    /// @param subscriptionWindow  Seconds users have to subscribe.
    /// @param fulfillmentWindow   Extra seconds after deadline before refunds unlock.
    function announceIPO(
        string calldata ticker,
        string calldata name,
        uint256 subscriptionWindow,
        uint256 fulfillmentWindow
    ) external onlyKeeper returns (address vaultAddr) {
        bytes32 key = keccak256(bytes(ticker));
        require(ipos[key].status == Status.NONE, "exists");
        require(subscriptionWindow > 0, "window=0");

        uint256 subDeadline = block.timestamp + subscriptionWindow;
        uint256 fulDeadline = subDeadline + fulfillmentWindow;

        // Deterministic address per ticker via CREATE2.
        SubscriptionVault vault = new SubscriptionVault{salt: key}(
            ticker,
            usdg,
            address(this),
            address(booster),
            address(rialtoAdapter),
            feeCollector,
            subDeadline,
            fulDeadline,
            platformFeeBps
        );
        vaultAddr = address(vault);

        ipos[key] = IPO({
            ticker: ticker,
            name: name,
            stockToken: address(0),
            vault: vaultAddr,
            subscriptionDeadline: subDeadline,
            fulfillmentDeadline: fulDeadline,
            status: Status.ANNOUNCED
        });
        ipoKeys.push(key);

        emit IPOAnnounced(key, ticker, vaultAddr, subDeadline);
    }

    /// @notice Called by keeper once the Robinhood Stock Token is deployed.
    ///         Triggers vault fulfillment (routes USDG → Stock Token).
    /// @param minAmountOut  Slippage floor for the swap.
    function markLaunched(
        string calldata ticker,
        address stockToken,
        uint256 minAmountOut
    ) external onlyKeeper {
        bytes32 key = keccak256(bytes(ticker));
        IPO storage ipo = ipos[key];
        require(ipo.status == Status.ANNOUNCED, "bad status");
        require(stockToken != address(0), "bad token");
        require(
            block.timestamp >= ipo.subscriptionDeadline,
            "subscription open"
        );

        ipo.stockToken = stockToken;
        ipo.status = Status.LAUNCHED;

        SubscriptionVault(ipo.vault).fulfill(stockToken, minAmountOut);
        emit IPOLaunched(key, stockToken, block.timestamp);
    }

    /// @notice Anyone can flip an IPO into REFUNDED after the fulfillment
    ///         deadline has passed without a launch.
    function activateRefund(string calldata ticker) external {
        bytes32 key = keccak256(bytes(ticker));
        IPO storage ipo = ipos[key];
        require(ipo.status == Status.ANNOUNCED, "bad status");
        require(block.timestamp >= ipo.fulfillmentDeadline, "too early");
        ipo.status = Status.REFUNDED;
        SubscriptionVault(ipo.vault).activateRefund();
        emit IPORefundActivated(key);
    }

    // ---------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------

    function ipoCount() external view returns (uint256) {
        return ipoKeys.length;
    }

    function getIPO(string calldata ticker) external view returns (IPO memory) {
        return ipos[keccak256(bytes(ticker))];
    }

    function getActiveIPOs() external view returns (IPO[] memory active) {
        uint256 total = ipoKeys.length;
        uint256 count;
        for (uint256 i; i < total; ++i) {
            if (ipos[ipoKeys[i]].status == Status.ANNOUNCED) count++;
        }
        active = new IPO[](count);
        uint256 j;
        for (uint256 i; i < total; ++i) {
            IPO storage ipo = ipos[ipoKeys[i]];
            if (ipo.status == Status.ANNOUNCED) {
                active[j++] = ipo;
            }
        }
    }

    // ---------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------

    function setKeeper(address newKeeper) external onlyOwner {
        keeper = newKeeper;
        emit KeeperUpdated(newKeeper);
    }

    function setPlatformFeeBps(uint16 newBps) external onlyOwner {
        require(newBps <= 500, "fee>5%");
        platformFeeBps = newBps;
        emit PlatformFeeUpdated(newBps);
    }
}

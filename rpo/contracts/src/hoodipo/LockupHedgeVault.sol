// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/utils/ReentrancyGuard.sol";
import {IChainlinkAggregator} from "../interfaces/IChainlinkAggregator.sol";

/// @title  LockupHedgeVault
/// @notice Every Robinhood Stock Token whose underlying is a
///         recent-IPO name carries a real-world lockup expiry
///         (typically 180 days from listing). When the lockup lifts
///         insiders can dump — and Robinhood's tokenised feed sees
///         the same price shock even though its holders may have
///         been Reg-S retail buyers with zero access to hedging.
///
///         `LockupHedgeVault` is a per-position insurance primitive:
///
///           * A holder deposits some d-TICKER tokens as principal.
///           * They pre-authorise a stop-loss trigger via
///             `armStopLoss(price, slippageBps, router, data)`.
///           * Any keeper can call `trigger(id, ...)` the moment the
///             Chainlink feed prints a price at or below the strike;
///             the vault swaps the position back to USDG and pays
///             the keeper a bounty out of the proceeds.
///           * The holder can `disarm` any time to reclaim the
///             deposit untouched.
///
///         Combined with a Chainlink-supplied lockup-expiry calendar
///         (registered per ticker), the vault becomes a lockup-event
///         hedging product that other on-chain protocols can compose
///         with (e.g. underwriting insurance pools).
contract LockupHedgeVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------

    struct Position {
        address owner;
        address token;
        uint256 amount;              // token principal (18-dec)
        uint256 strikeUsd8;          // stop-loss trigger, 8-decimal USD (Chainlink native)
        uint256 lockupExpiry;         // unix seconds; informational
        uint16  maxSlippageBps;       // executor slippage cap
        bool armed;
        bool triggered;
    }

    // ---------------------------------------------------------------
    // Immutables
    // ---------------------------------------------------------------

    IERC20 public immutable usdg;
    address public immutable feeCollector;
    uint16  public immutable keeperBountyBps; // paid on trigger
    uint16  public immutable platformFeeBps;

    // ---------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------

    mapping(bytes32 => Position) public positions;
    bytes32[] public positionIds;
    /// @notice token → Chainlink feed. Anyone can register; overwrite disallowed.
    mapping(address => address) public feedOf;
    /// @notice ticker keccak → lockup expiry unix; used for UI + composability.
    mapping(bytes32 => uint256) public lockupExpiryOf;

    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------

    event FeedRegistered(address indexed token, address feed);
    event LockupRegistered(bytes32 indexed tickerKey, uint256 expiry);
    event PositionOpened(bytes32 indexed id, address indexed owner, address indexed token, uint256 amount);
    event StopLossArmed(bytes32 indexed id, uint256 strikeUsd8, uint16 slippageBps);
    event StopLossDisarmed(bytes32 indexed id);
    event Triggered(bytes32 indexed id, address indexed keeper, uint256 usdgReceived, uint256 keeperBounty);
    event Withdrawn(bytes32 indexed id, uint256 amount);

    // ---------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------

    error NotOwner();
    error AlreadyArmed();
    error NotArmed();
    error PriceAbove();
    error FeedMissing();
    error Triggered_();
    error NoBalance();

    // ---------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------

    constructor(address _usdg, address _feeCollector, uint16 _keeperBps, uint16 _platformBps) {
        require(_keeperBps <= 200, "bounty>2%");
        require(_platformBps <= 200, "fee>2%");
        usdg = IERC20(_usdg);
        feeCollector = _feeCollector;
        keeperBountyBps = _keeperBps;
        platformFeeBps = _platformBps;
    }

    // ---------------------------------------------------------------
    // Registration
    // ---------------------------------------------------------------

    function registerFeed(address token, address feed) external {
        require(token != address(0) && feed != address(0), "zero");
        require(feedOf[token] == address(0), "set");
        feedOf[token] = feed;
        emit FeedRegistered(token, feed);
    }

    function registerLockup(string calldata ticker, uint256 expiry) external {
        require(expiry > block.timestamp, "past");
        bytes32 k = keccak256(bytes(ticker));
        require(lockupExpiryOf[k] == 0, "set");
        lockupExpiryOf[k] = expiry;
        emit LockupRegistered(k, expiry);
    }

    // ---------------------------------------------------------------
    // Position lifecycle
    // ---------------------------------------------------------------

    function open(address token, uint256 amount, uint256 lockupExpiry) external nonReentrant returns (bytes32 id) {
        require(amount > 0, "amt");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        id = keccak256(abi.encode(msg.sender, token, block.number, positionIds.length));
        positions[id] = Position({
            owner: msg.sender,
            token: token,
            amount: amount,
            strikeUsd8: 0,
            lockupExpiry: lockupExpiry,
            maxSlippageBps: 0,
            armed: false,
            triggered: false
        });
        positionIds.push(id);
        emit PositionOpened(id, msg.sender, token, amount);
    }

    function armStopLoss(bytes32 id, uint256 strikeUsd8, uint16 maxSlippageBps) external {
        Position storage p = positions[id];
        if (p.owner != msg.sender) revert NotOwner();
        if (p.armed) revert AlreadyArmed();
        if (p.triggered) revert Triggered_();
        if (feedOf[p.token] == address(0)) revert FeedMissing();
        require(maxSlippageBps <= 1_000, "slip");
        require(strikeUsd8 > 0, "strike");
        p.strikeUsd8 = strikeUsd8;
        p.maxSlippageBps = maxSlippageBps;
        p.armed = true;
        emit StopLossArmed(id, strikeUsd8, maxSlippageBps);
    }

    function disarm(bytes32 id) external {
        Position storage p = positions[id];
        if (p.owner != msg.sender) revert NotOwner();
        if (!p.armed) revert NotArmed();
        p.armed = false;
        emit StopLossDisarmed(id);
    }

    /// @notice Owner-only exit while unarmed (never any race with keepers).
    function withdraw(bytes32 id) external nonReentrant {
        Position storage p = positions[id];
        if (p.owner != msg.sender) revert NotOwner();
        if (p.armed) revert AlreadyArmed();
        if (p.triggered) revert Triggered_();
        uint256 amt = p.amount;
        if (amt == 0) revert NoBalance();
        p.amount = 0;
        IERC20(p.token).safeTransfer(msg.sender, amt);
        emit Withdrawn(id, amt);
    }

    // ---------------------------------------------------------------
    // Keeper trigger
    // ---------------------------------------------------------------

    function trigger(
        bytes32 id,
        address router,
        bytes calldata swapData,
        uint256 minAmountOut
    ) external nonReentrant {
        Position storage p = positions[id];
        _checkTrigger(p);
        p.triggered = true;
        p.armed = false;

        uint256 got = _swapForUsdg(p, router, swapData, minAmountOut);
        _payoutTrigger(id, p.owner, got);
    }

    function _checkTrigger(Position storage p) internal view {
        if (!p.armed) revert NotArmed();
        if (p.triggered) revert Triggered_();
        address feed = feedOf[p.token];
        if (feed == address(0)) revert FeedMissing();
        (, int256 answer, , , ) = IChainlinkAggregator(feed).latestRoundData();
        require(answer > 0, "feed");
        if (uint256(answer) > p.strikeUsd8) revert PriceAbove();
    }

    function _swapForUsdg(
        Position storage p,
        address router,
        bytes calldata swapData,
        uint256 minAmountOut
    ) internal returns (uint256 got) {
        uint256 amt = p.amount;
        p.amount = 0;
        IERC20(p.token).forceApprove(router, amt);
        uint256 balBefore = usdg.balanceOf(address(this));
        (bool ok, bytes memory ret) = router.call(swapData);
        if (!ok) {
            assembly { revert(add(32, ret), mload(ret)) }
        }
        got = usdg.balanceOf(address(this)) - balBefore;
        require(got >= minAmountOut, "slip");
    }

    function _payoutTrigger(bytes32 id, address owner, uint256 got) internal {
        uint256 bounty = (got * uint256(keeperBountyBps)) / 10_000;
        uint256 fee = (got * uint256(platformFeeBps)) / 10_000;
        uint256 payout = got - bounty - fee;
        if (bounty > 0) usdg.safeTransfer(msg.sender, bounty);
        if (fee > 0) usdg.safeTransfer(feeCollector, fee);
        usdg.safeTransfer(owner, payout);
        emit Triggered(id, msg.sender, got, bounty);
    }

    // ---------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------

    function positionCount() external view returns (uint256) {
        return positionIds.length;
    }

    function isTriggerable(bytes32 id) external view returns (bool, int256) {
        Position storage p = positions[id];
        if (!p.armed || p.triggered) return (false, 0);
        address feed = feedOf[p.token];
        if (feed == address(0)) return (false, 0);
        try IChainlinkAggregator(feed).latestRoundData() returns (
            uint80, int256 answer, uint256, uint256, uint80
        ) {
            return (answer > 0 && uint256(answer) <= p.strikeUsd8, answer);
        } catch {
            return (false, 0);
        }
    }
}

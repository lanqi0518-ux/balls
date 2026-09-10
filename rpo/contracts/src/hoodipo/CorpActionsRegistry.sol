// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/utils/ReentrancyGuard.sol";
import {IERC8056} from "../interfaces/IERC8056.sol";

/// @title  CorpActionsRegistry
/// @notice Programmable reactions to Robinhood Stock Token corporate
///         actions. Robinhood publishes dividends, stock splits and
///         reverse splits *on-chain* via each Stock Token's
///         `uiMultiplier()` (ERC-8056 Scaled UI Amount Extension) —
///         the ratio changes atomically the moment RHJ credits the
///         event. This registry lets any wallet pre-authorise on-chain
///         responses that any keeper can execute the block after
///         the ratio moves, earning a bounty.
///
///         Strategy types shipped in v0
///         ============================
///           * REBALANCE_TO_USDG  — on any drop in uiMultiplier
///             (interpreted as a spinoff / distribution / capital
///             return), sell up to `maxTokens` back to USDG.
///           * TOP_UP             — on any rise in uiMultiplier
///             (dividend reinvestment), pull `topUpAmount` USDG from
///             the wallet and buy more of the same token.
///           * NOTIFY             — no swap, just fire an event; used
///                                   for accounting-only wallets.
///
///         All swaps route through a caller-supplied `router` and
///         `swapData` payload — the registry does not opine on the
///         routing venue, only on whether the strategy is armed and
///         whether the uiMultiplier really moved.
contract CorpActionsRegistry is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------

    enum StrategyKind { REBALANCE_TO_USDG, TOP_UP, NOTIFY }

    struct Strategy {
        address owner;
        address token;               // Robinhood Stock Token to watch
        StrategyKind kind;
        uint256 lastMultiplier;       // snapshot at arm/execute
        uint256 minDeltaBps;          // e.g. 25 = react if |Δ| >= 0.25%
        uint256 maxTokensPerTrigger;  // upper bound on token amount routed
        uint256 topUpAmount;           // USDG (for TOP_UP)
        uint256 nonce;                 // increments per execution
        bool armed;
    }

    // ---------------------------------------------------------------
    // Immutables
    // ---------------------------------------------------------------

    IERC20 public immutable usdg;
    address public immutable feeCollector;
    uint16  public immutable keeperBountyBps; // paid to caller of execute()
    uint16  public immutable platformFeeBps;
    uint256 public constant MULTIPLIER_SCALE = 1e18;

    // ---------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------

    mapping(bytes32 => Strategy) public strategies;
    bytes32[] public strategyIds;

    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------

    event StrategyArmed(bytes32 indexed id, address indexed owner, address indexed token, StrategyKind kind);
    event StrategyDisarmed(bytes32 indexed id);
    event StrategyExecuted(
        bytes32 indexed id,
        address indexed keeper,
        uint256 prevMultiplier,
        uint256 newMultiplier,
        uint256 usdgIn,
        uint256 usdgOut,
        uint256 tokensIn,
        uint256 tokensOut,
        uint256 keeperBounty
    );

    // ---------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------

    error NotOwner();
    error NotArmed();
    error DeltaTooSmall();
    error BadStrategy();

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
    // Owner actions
    // ---------------------------------------------------------------

    /// @notice Arm a new strategy. Idempotent-ish: two arms with the
    ///         same (owner, token, kind, salt) collapse into one.
    function arm(
        address token,
        StrategyKind kind,
        uint256 minDeltaBps,
        uint256 maxTokensPerTrigger,
        uint256 topUpAmount,
        bytes32 salt
    ) external returns (bytes32 id) {
        require(token != address(0), "token=0");
        require(minDeltaBps >= 1 && minDeltaBps <= 5_000, "delta");
        if (kind == StrategyKind.TOP_UP) require(topUpAmount > 0, "topup=0");
        if (kind == StrategyKind.REBALANCE_TO_USDG) require(maxTokensPerTrigger > 0, "max=0");

        id = keccak256(abi.encode(msg.sender, token, kind, salt));
        Strategy storage s = strategies[id];
        require(!s.armed, "armed");

        uint256 mul = _readMultiplier(token);
        strategies[id] = Strategy({
            owner: msg.sender,
            token: token,
            kind: kind,
            lastMultiplier: mul,
            minDeltaBps: minDeltaBps,
            maxTokensPerTrigger: maxTokensPerTrigger,
            topUpAmount: topUpAmount,
            nonce: 0,
            armed: true
        });
        strategyIds.push(id);

        emit StrategyArmed(id, msg.sender, token, kind);
    }

    function disarm(bytes32 id) external {
        Strategy storage s = strategies[id];
        if (s.owner != msg.sender) revert NotOwner();
        if (!s.armed) revert NotArmed();
        s.armed = false;
        emit StrategyDisarmed(id);
    }

    // ---------------------------------------------------------------
    // Keeper execution
    // ---------------------------------------------------------------

    /// @notice Permissionlessly execute a strategy the block after
    ///         its watched `uiMultiplier` moves past `minDeltaBps`.
    ///
    /// @param  id             Strategy id.
    /// @param  router         Swap venue (0x proxy, Uniswap UR, etc).
    /// @param  swapData       Router-specific calldata built off-chain.
    /// @param  minAmountOut   Slippage floor on the router leg.
    function execute(
        bytes32 id,
        address router,
        bytes calldata swapData,
        uint256 minAmountOut
    ) external nonReentrant {
        Strategy storage s = strategies[id];
        if (!s.armed) revert NotArmed();

        (uint256 prev, uint256 newMul) = _requireDelta(s);

        (uint256 usdgIn, uint256 usdgOut, uint256 tokensIn, uint256 tokensOut, uint256 keeperBounty) =
            _dispatch(s, prev, newMul, router, swapData, minAmountOut);

        s.lastMultiplier = newMul;
        s.nonce += 1;
        emit StrategyExecuted(id, msg.sender, prev, newMul, usdgIn, usdgOut, tokensIn, tokensOut, keeperBounty);
    }

    function _requireDelta(Strategy storage s) internal view returns (uint256 prev, uint256 newMul) {
        newMul = _readMultiplier(s.token);
        prev = s.lastMultiplier;
        uint256 diff = newMul > prev ? newMul - prev : prev - newMul;
        uint256 bps = (diff * 10_000) / prev;
        if (bps < s.minDeltaBps) revert DeltaTooSmall();
    }

    function _dispatch(
        Strategy storage s,
        uint256 prev,
        uint256 newMul,
        address router,
        bytes calldata swapData,
        uint256 minAmountOut
    ) internal returns (uint256 usdgIn, uint256 usdgOut, uint256 tokensIn, uint256 tokensOut, uint256 keeperBounty) {
        if (s.kind == StrategyKind.NOTIFY) {
            return (0, 0, 0, 0, 0);
        }
        if (s.kind == StrategyKind.TOP_UP) {
            require(newMul > prev, "dir");
            return _executeTopUp(s, router, swapData, minAmountOut);
        }
        if (s.kind == StrategyKind.REBALANCE_TO_USDG) {
            require(newMul < prev, "dir");
            return _executeRebalance(s, router, swapData, minAmountOut);
        }
        revert BadStrategy();
    }

    struct SwapResult {
        uint256 usdgIn;
        uint256 usdgOut;
        uint256 tokensIn;
        uint256 tokensOut;
        uint256 keeperBounty;
    }

    function _executeTopUp(
        Strategy storage s,
        address router,
        bytes calldata swapData,
        uint256 minAmountOut
    ) internal returns (uint256, uint256, uint256, uint256, uint256) {
        SwapResult memory r;
        r.usdgIn = s.topUpAmount;
        usdg.safeTransferFrom(s.owner, address(this), r.usdgIn);
        r.keeperBounty = (r.usdgIn * uint256(keeperBountyBps)) / 10_000;
        uint256 fee = (r.usdgIn * uint256(platformFeeBps)) / 10_000;
        r.usdgOut = r.usdgIn - r.keeperBounty - fee;
        if (r.keeperBounty > 0) usdg.safeTransfer(msg.sender, r.keeperBounty);
        if (fee > 0) usdg.safeTransfer(feeCollector, fee);
        r.tokensOut = _swapUsdgForToken(s.token, router, swapData, r.usdgOut, minAmountOut);
        IERC20(s.token).safeTransfer(s.owner, r.tokensOut);
        return (r.usdgIn, r.usdgOut, 0, r.tokensOut, r.keeperBounty);
    }

    function _swapUsdgForToken(
        address token,
        address router,
        bytes calldata swapData,
        uint256 spend,
        uint256 minAmountOut
    ) internal returns (uint256 got) {
        uint256 balBefore = IERC20(token).balanceOf(address(this));
        usdg.forceApprove(router, spend);
        _routerCall(router, swapData);
        got = IERC20(token).balanceOf(address(this)) - balBefore;
        require(got >= minAmountOut, "slip");
    }

    function _executeRebalance(
        Strategy storage s,
        address router,
        bytes calldata swapData,
        uint256 minAmountOut
    ) internal returns (uint256, uint256, uint256, uint256, uint256) {
        SwapResult memory r;
        r.tokensIn = s.maxTokensPerTrigger;
        IERC20(s.token).safeTransferFrom(s.owner, address(this), r.tokensIn);
        uint256 got = _swapTokenForUsdg(s.token, router, swapData, r.tokensIn, minAmountOut);
        r.keeperBounty = (got * uint256(keeperBountyBps)) / 10_000;
        uint256 fee = (got * uint256(platformFeeBps)) / 10_000;
        r.usdgOut = got - r.keeperBounty - fee;
        if (r.keeperBounty > 0) usdg.safeTransfer(msg.sender, r.keeperBounty);
        if (fee > 0) usdg.safeTransfer(feeCollector, fee);
        usdg.safeTransfer(s.owner, r.usdgOut);
        return (0, r.usdgOut, r.tokensIn, 0, r.keeperBounty);
    }

    function _swapTokenForUsdg(
        address token,
        address router,
        bytes calldata swapData,
        uint256 amount,
        uint256 minAmountOut
    ) internal returns (uint256 got) {
        uint256 balBefore = usdg.balanceOf(address(this));
        IERC20(token).forceApprove(router, amount);
        _routerCall(router, swapData);
        got = usdg.balanceOf(address(this)) - balBefore;
        require(got >= minAmountOut, "slip");
    }

    // ---------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------

    function strategyCount() external view returns (uint256) {
        return strategyIds.length;
    }

    /// @notice Off-chain keepers scan this to know which strategies
    ///         are ready to execute right now.
    function isTriggerable(bytes32 id) external view returns (bool, uint256, uint256) {
        Strategy storage s = strategies[id];
        if (!s.armed) return (false, s.lastMultiplier, 0);
        uint256 mul = _readMultiplier(s.token);
        if (mul == 0 || s.lastMultiplier == 0) return (false, mul, 0);
        uint256 diff = mul > s.lastMultiplier ? mul - s.lastMultiplier : s.lastMultiplier - mul;
        uint256 bps = (diff * 10_000) / s.lastMultiplier;
        return (bps >= s.minDeltaBps, mul, bps);
    }

    // ---------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------

    /// @dev Every Robinhood Stock Token implements ERC-8056; when the
    ///      call reverts we default to 1e18 (no scaling), which is a
    ///      safe fallback because the delta comparison then fails.
    function _readMultiplier(address token) internal view returns (uint256) {
        try IERC8056(token).uiMultiplier() returns (uint256 v) {
            return v == 0 ? MULTIPLIER_SCALE : v;
        } catch {
            return MULTIPLIER_SCALE;
        }
    }

    function _routerCall(address router, bytes calldata data) internal {
        (bool ok, bytes memory ret) = router.call(data);
        if (!ok) {
            if (ret.length > 0) {
                assembly {
                    revert(add(32, ret), mload(ret))
                }
            }
            revert("router");
        }
    }
}

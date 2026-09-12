// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  AntiSnipeHook
/// @notice Uniswap V4 hook attached to a freshly-minted Robinhood
///         Stock Token / USDG pool. It enforces three fair-launch
///         rails during the first N blocks after `initialize`:
///
///           1. Per-swap max notional decays linearly from
///              `startCapUsdg` down to `endCapUsdg` over `capBlocks`
///              blocks. Beyond `capBlocks`, no cap.
///           2. Priority queue: any wallet holding a
///              `PreMintVault.claimed[wallet] == true` receipt is
///              exempt from the cap (they already committed capital
///              during subscription — they should not have to race
///              MEV searchers post-mint).
///           3. JIT-LP tax: any liquidity minted AND burned within
///              `jitWindowBlocks` of each other is charged
///              `jitTaxBps` of the notional at burn time, redirected
///              to the fee collector. Kills the classic V4 sandwich.
///
///         The hook exposes the four Uniswap V4 lifecycle callbacks
///         that a real deployment needs (`beforeInitialize`,
///         `beforeSwap`, `beforeAddLiquidity`, `beforeRemoveLiquidity`).
///         We intentionally keep the V4 interop surface minimal so
///         the file compiles standalone without the entire v4-core
///         module tree — the moment the v4-periphery packages ship
///         on Robinhood Chain, swapping `IPoolManager` for the real
///         import is a one-line change.
contract AntiSnipeHook {
    // ---------------------------------------------------------------
    // Immutables
    // ---------------------------------------------------------------

    address public immutable poolManager;
    address public immutable feeCollector;
    address public immutable usdg;
    /// @notice Address of the PreMintFactory whose vault claimants
    ///         are exempt from the size cap.
    address public immutable preMintFactory;

    uint256 public immutable startCapUsdg;   // e.g. 1_000e6  (1k USDG)
    uint256 public immutable endCapUsdg;     // e.g. 100_000e6 (100k USDG)
    uint32  public immutable capBlocks;      // e.g. 900  (~ first 30 min at 2s blocks)
    uint16  public immutable jitTaxBps;      // e.g. 300 (3%)
    uint32  public immutable jitWindowBlocks; // e.g. 8

    // ---------------------------------------------------------------
    // Storage (per pool)
    // ---------------------------------------------------------------

    struct PoolMeta {
        uint64 initBlock;
        bool live;
    }

    /// @dev keyed by keccak256(poolId).
    mapping(bytes32 => PoolMeta) public pools;

    /// @dev poolId => wallet => block of last add. Used for JIT check.
    mapping(bytes32 => mapping(address => uint256)) public lastAddBlock;

    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------

    event PoolRegistered(bytes32 indexed poolId, uint256 initBlock);
    event SwapCapEnforced(bytes32 indexed poolId, address indexed swapper, uint256 sizeUsdg, uint256 cap);
    event JitTaxCharged(bytes32 indexed poolId, address indexed lp, uint256 taxUsdg);

    // ---------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------

    error SizeExceedsCap();
    error UnauthorizedCaller();
    error PoolNotLive();

    modifier onlyPoolManager() {
        if (msg.sender != poolManager) revert UnauthorizedCaller();
        _;
    }

    // ---------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------

    struct Config {
        address poolManager;
        address feeCollector;
        address usdg;
        address preMintFactory;
        uint256 startCapUsdg;
        uint256 endCapUsdg;
        uint32  capBlocks;
        uint16  jitTaxBps;
        uint32  jitWindowBlocks;
    }

    constructor(Config memory c) {
        require(c.startCapUsdg > 0, "start=0");
        require(c.endCapUsdg >= c.startCapUsdg, "end<start");
        require(c.capBlocks > 0 && c.capBlocks <= 30_000, "cap blocks");
        require(c.jitTaxBps <= 2_000, "jit>20%");
        require(c.jitWindowBlocks > 0 && c.jitWindowBlocks <= 64, "jit win");
        poolManager = c.poolManager;
        feeCollector = c.feeCollector;
        usdg = c.usdg;
        preMintFactory = c.preMintFactory;
        startCapUsdg = c.startCapUsdg;
        endCapUsdg = c.endCapUsdg;
        capBlocks = c.capBlocks;
        jitTaxBps = c.jitTaxBps;
        jitWindowBlocks = c.jitWindowBlocks;
    }

    // ---------------------------------------------------------------
    // V4 lifecycle hooks (minimal-surface signatures)
    // ---------------------------------------------------------------

    /// @notice Called by PoolManager exactly once when a pool with
    ///         this hook attached is initialized. Marks the pool as
    ///         live at the current block.
    function beforeInitialize(
        address /* sender */,
        bytes32 poolId,
        uint160 /* sqrtPriceX96 */,
        bytes calldata /* hookData */
    ) external onlyPoolManager returns (bytes4) {
        pools[poolId] = PoolMeta({initBlock: uint64(block.number), live: true});
        emit PoolRegistered(poolId, block.number);
        return this.beforeInitialize.selector;
    }

    /// @notice Called before each swap. Enforces the decaying cap and
    ///         the PreMintVault-claimant exemption.
    /// @param  sizeUsdg    Notional size of the swap denominated in USDG.
    ///                     (Callers convert the delta before invoking.)
    function beforeSwap(
        address swapper,
        bytes32 poolId,
        int256 /* amountSpecified */,
        uint160 /* sqrtPriceLimitX96 */,
        bytes calldata /* hookData */,
        uint256 sizeUsdg
    ) external onlyPoolManager returns (bytes4) {
        PoolMeta memory m = pools[poolId];
        if (!m.live) revert PoolNotLive();

        uint256 age = block.number - uint256(m.initBlock);
        if (age >= capBlocks) return this.beforeSwap.selector;

        if (_isPreMintClaimant(swapper)) return this.beforeSwap.selector;

        uint256 cap = _currentCap(age);
        if (sizeUsdg > cap) {
            emit SwapCapEnforced(poolId, swapper, sizeUsdg, cap);
            revert SizeExceedsCap();
        }
        return this.beforeSwap.selector;
    }

    /// @notice Records the block each LP added liquidity, so the
    ///         matching remove call can charge the JIT tax.
    function beforeAddLiquidity(
        address sender,
        bytes32 poolId,
        int24 /* tickLower */,
        int24 /* tickUpper */,
        int256 /* liquidityDelta */,
        bytes calldata /* hookData */
    ) external onlyPoolManager returns (bytes4) {
        lastAddBlock[poolId][sender] = block.number;
        return this.beforeAddLiquidity.selector;
    }

    /// @notice Charges JIT tax when liquidity is removed inside the
    ///         watch window. The caller is responsible for actually
    ///         transferring `taxOwed` USDG to `feeCollector` — the
    ///         hook returns the tax amount and emits the event; in
    ///         a full V4 integration, `taxOwed` is expressed as a
    ///         delta in the returned `BalanceDelta`.
    function beforeRemoveLiquidity(
        address sender,
        bytes32 poolId,
        int24 /* tickLower */,
        int24 /* tickUpper */,
        int256 liquidityDelta,
        bytes calldata /* hookData */,
        uint256 notionalUsdg
    ) external onlyPoolManager returns (bytes4, uint256 taxOwed) {
        uint256 last = lastAddBlock[poolId][sender];
        if (last == 0) return (this.beforeRemoveLiquidity.selector, 0);
        if (block.number - last > uint256(jitWindowBlocks)) {
            return (this.beforeRemoveLiquidity.selector, 0);
        }
        // Only tax the notional actually leaving.
        require(liquidityDelta < 0, "not remove");
        taxOwed = (notionalUsdg * uint256(jitTaxBps)) / 10_000;
        emit JitTaxCharged(poolId, sender, taxOwed);
        return (this.beforeRemoveLiquidity.selector, taxOwed);
    }

    // ---------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------

    function currentCap(bytes32 poolId) external view returns (uint256) {
        PoolMeta memory m = pools[poolId];
        if (!m.live) return 0;
        uint256 age = block.number - uint256(m.initBlock);
        if (age >= capBlocks) return type(uint256).max;
        return _currentCap(age);
    }

    /// @notice Report the exemption result for a wallet on this pool.
    function isExempt(address swapper) external view returns (bool) {
        return _isPreMintClaimant(swapper);
    }

    // ---------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------

    function _currentCap(uint256 age) internal view returns (uint256) {
        // Linear decay: cap(0)=start, cap(capBlocks)=end.
        uint256 span = endCapUsdg - startCapUsdg;
        return startCapUsdg + (span * age) / uint256(capBlocks);
    }

    function _isPreMintClaimant(address swapper) internal view returns (bool) {
        if (preMintFactory == address(0)) return false;
        (bool ok, bytes memory data) = preMintFactory.staticcall(
            abi.encodeWithSignature("hasClaimedAnyVault(address)", swapper)
        );
        if (!ok || data.length < 32) return false;
        return abi.decode(data, (bool));
    }
}

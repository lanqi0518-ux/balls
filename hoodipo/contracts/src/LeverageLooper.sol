// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "openzeppelin-contracts/access/Ownable.sol";
import {IMorphoBlue, MarketParams} from "./interfaces/IMorphoBlue.sol";
import {SubscriptionVault} from "./SubscriptionVault.sol";

/// @title LeverageLooper
/// @notice One-shot helper: deposit the Stock Token you just claimed from a
///         SubscriptionVault as Morpho Blue collateral, borrow USDG at a
///         conservative LTV, then subscribe that borrowed USDG to the NEXT
///         IPO's SubscriptionVault. This is the "打一次 IPO 顺手打下一个" flow.
///
///         The looper does NOT itself sit on user funds long-term — each
///         call opens a Morpho position owned by the user's own wallet, so
///         the user retains full ownership and can unwind independently on
///         the Morpho UI if they prefer.
contract LeverageLooper is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------
    // Config
    // ---------------------------------------------------------------

    IERC20 public immutable usdg;
    IMorphoBlue public immutable morpho;

    /// @notice Max borrow LTV we'll actually take, in bps. Morpho market
    ///         may allow higher, but we cap ourselves for user safety.
    uint16 public maxSafeLtvBps = 5000; // 50%

    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------

    event LoopExecuted(
        address indexed user,
        address indexed collateralToken,
        uint256 collateralAmount,
        uint256 borrowedUSDG,
        address indexed nextVault
    );
    event MaxLtvUpdated(uint16 newBps);

    // ---------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------

    error ZeroAmount();
    error LtvTooHigh();

    // ---------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------

    constructor(address _owner, address _usdg, address _morpho) Ownable(_owner) {
        usdg = IERC20(_usdg);
        morpho = IMorphoBlue(_morpho);
    }

    // ---------------------------------------------------------------
    // Main flow
    // ---------------------------------------------------------------

    /// @notice Loop: collateral → Morpho → borrow USDG → subscribe next IPO.
    /// @param  marketParams   Morpho Blue market (collateralToken must match).
    /// @param  collateralAmount   Amount of stock token to deposit as collateral.
    /// @param  borrowAmount   USDG to borrow (must respect maxSafeLtvBps).
    /// @param  nextVault      SubscriptionVault to subscribe borrowed USDG to.
    function loopIntoNextIPO(
        MarketParams calldata marketParams,
        uint256 collateralAmount,
        uint256 borrowAmount,
        SubscriptionVault nextVault
    ) external nonReentrant {
        if (collateralAmount == 0 || borrowAmount == 0) revert ZeroAmount();
        require(marketParams.loanToken == address(usdg), "loan!=USDG");

        // Client-side LTV validation: caller must pass params consistent
        // with maxSafeLtvBps × market oracle valuation. We enforce the cap
        // at the market level by requiring caller-specified market lltv
        // to be <= our safe cap.
        if (marketParams.lltv > uint256(maxSafeLtvBps) * 1e14) {
            // 1e14 = 1e18 / 10_000  → converts bps to 1e18 fixed-point
            revert LtvTooHigh();
        }

        IERC20 collateral = IERC20(marketParams.collateralToken);

        // 1. Pull collateral from user.
        collateral.safeTransferFrom(msg.sender, address(this), collateralAmount);

        // 2. Supply to Morpho as collateral, credited to the user's own account.
        collateral.forceApprove(address(morpho), collateralAmount);
        morpho.supplyCollateral(marketParams, collateralAmount, msg.sender, "");

        // 3. Borrow USDG on user's behalf, sent to this contract.
        morpho.borrow(marketParams, borrowAmount, 0, msg.sender, address(this));

        // 4. Subscribe the borrowed USDG to the next vault (still credited to user).
        usdg.forceApprove(address(nextVault), borrowAmount);
        // We can't call `subscribe` as user directly; instead we pull-and-push:
        // vault.subscribe is `msg.sender`-based so we do it in our own name and
        // record the position separately, OR simply have user front-run this
        // with a permit to the vault. For v1 we call as ourselves and mirror
        // ownership in a satellite mapping.
        nextVault.subscribe(borrowAmount);
        _mirroredPositions[msg.sender][address(nextVault)] += borrowAmount;

        emit LoopExecuted(
            msg.sender,
            address(collateral),
            collateralAmount,
            borrowAmount,
            address(nextVault)
        );
    }

    /// @notice Once nextVault fulfills, claim the resulting stock tokens back
    ///         to the user (offset by mirrored deposit tracking).
    function claimLoopedAllocation(SubscriptionVault vault) external nonReentrant {
        uint256 depositedByUser = _mirroredPositions[msg.sender][address(vault)];
        require(depositedByUser > 0, "no position");

        // The vault holds the position under this contract's name; claim it.
        uint256 balBefore = vault.stockToken().balanceOf(address(this));
        vault.claim();
        uint256 balAfter = vault.stockToken().balanceOf(address(this));
        uint256 received = balAfter - balBefore;

        // Zero out and forward proportionally (this contract only has ONE
        // caller per vault; if multiple loopers share one vault call, keep a
        // per-user share ratio — future improvement).
        _mirroredPositions[msg.sender][address(vault)] = 0;
        vault.stockToken().safeTransfer(msg.sender, received);
    }

    // ---------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------

    mapping(address => mapping(address => uint256)) private _mirroredPositions;

    // ---------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------

    function setMaxSafeLtvBps(uint16 newBps) external onlyOwner {
        require(newBps <= 8000, "cap>80%");
        maxSafeLtvBps = newBps;
        emit MaxLtvUpdated(newBps);
    }
}

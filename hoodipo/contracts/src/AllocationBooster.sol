// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/utils/ReentrancyGuard.sol";

/// @title AllocationBooster
/// @notice Users lock $IPO to receive an allocation boost (1x – 3x) on any
///         SubscriptionVault. The boost is a smooth sqrt curve of user
///         staking share of the total staked pool, so early stakers gain
///         disproportionate multipliers without a mega-whale being able to
///         monopolize allocation entirely (capped at 3x).
///
///         Stakes are subject to a minimum lock (default 14 days) refreshed
///         on every top-up. Unstake is by request-then-withdraw (matches
///         how veTokens do timelocks).
contract AllocationBooster is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------
    // Config
    // ---------------------------------------------------------------

    IERC20 public immutable ipoToken;
    uint256 public constant MIN_LOCK = 14 days;
    uint256 public constant MAX_BOOST = 3e18;      // 3.0x
    uint256 public constant BASE_BOOST = 1e18;     // 1.0x

    // ---------------------------------------------------------------
    // State
    // ---------------------------------------------------------------

    struct Stake {
        uint256 amount;
        uint256 unlockAt;
    }

    mapping(address => Stake) public stakes;
    uint256 public totalStaked;

    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------

    event Staked(address indexed user, uint256 amount, uint256 unlockAt);
    event Unstaked(address indexed user, uint256 amount);

    // ---------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------

    error ZeroAmount();
    error Locked();
    error InsufficientStake();

    // ---------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------

    constructor(address _ipoToken) {
        ipoToken = IERC20(_ipoToken);
    }

    // ---------------------------------------------------------------
    // User actions
    // ---------------------------------------------------------------

    function stake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        ipoToken.safeTransferFrom(msg.sender, address(this), amount);
        stakes[msg.sender].amount += amount;
        stakes[msg.sender].unlockAt = block.timestamp + MIN_LOCK;
        totalStaked += amount;
        emit Staked(msg.sender, amount, stakes[msg.sender].unlockAt);
    }

    function unstake(uint256 amount) external nonReentrant {
        Stake storage s = stakes[msg.sender];
        if (amount == 0) revert ZeroAmount();
        if (s.amount < amount) revert InsufficientStake();
        if (block.timestamp < s.unlockAt) revert Locked();

        s.amount -= amount;
        totalStaked -= amount;
        ipoToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    // ---------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------

    /// @notice Boost multiplier in 1e18 fixed-point.
    ///         1x for non-stakers, up to 3x for mega-stakers.
    ///
    ///         Formula:
    ///             boost = 1 + 2 × sqrt(share)
    ///         where share ∈ [0, 1] is user stake / total stake.
    ///         (Square-root curve to soften the effect of dominant stakes.)
    function getBoost(address user) public view returns (uint256) {
        uint256 userStake = stakes[user].amount;
        if (userStake == 0 || totalStaked == 0) return BASE_BOOST;

        // share in 1e18 fixed-point
        uint256 share = (userStake * 1e18) / totalStaked;
        // sqrt of share (fixed-point-safe): sqrt(x * 1e18)
        uint256 sqrtShare = _sqrt(share * 1e18);
        uint256 boost = BASE_BOOST + (2 * sqrtShare);

        return boost > MAX_BOOST ? MAX_BOOST : boost;
    }

    function stakedAmount(address user) external view returns (uint256) {
        return stakes[user].amount;
    }

    function unlockTime(address user) external view returns (uint256) {
        return stakes[user].unlockAt;
    }

    // ---------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------

    /// @dev Babylonian sqrt, sufficient for boost curve purposes.
    function _sqrt(uint256 x) internal pure returns (uint256 z) {
        if (x == 0) return 0;
        z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}

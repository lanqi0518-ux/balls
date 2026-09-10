// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockERC20} from "./MockERC20.sol";

/// @notice One-tap testnet faucet: any wallet can call `drip()` and
///         receive a fixed amount of Mock USDG + Mock RPO. Rate-limited
///         to one drip per wallet per DRIP_COOLDOWN (24h) to prevent
///         spam. Only used on Arbitrum Sepolia — never deploy this
///         alongside the real production tokens.
contract Faucet {
    MockERC20 public immutable usdg;
    MockERC20 public immutable rpo;

    uint256 public constant USDG_AMOUNT = 10_000e6;      // 10,000 USDG (6 decimals)
    uint256 public constant RPO_AMOUNT = 25_000e18;      // 25,000 RPO   (18 decimals)
    uint256 public constant DRIP_COOLDOWN = 24 hours;

    mapping(address => uint256) public lastDripAt;

    event Drip(address indexed user, uint256 usdgAmount, uint256 rpoAmount);

    constructor(MockERC20 _usdg, MockERC20 _rpo) {
        usdg = _usdg;
        rpo = _rpo;
    }

    /// @notice Mint a fresh batch of Mock USDG + Mock RPO to `msg.sender`.
    ///         Callable once every DRIP_COOLDOWN per wallet.
    function drip() external {
        require(
            block.timestamp >= lastDripAt[msg.sender] + DRIP_COOLDOWN,
            "cooldown"
        );
        lastDripAt[msg.sender] = block.timestamp;

        usdg.mint(msg.sender, USDG_AMOUNT);
        rpo.mint(msg.sender, RPO_AMOUNT);

        emit Drip(msg.sender, USDG_AMOUNT, RPO_AMOUNT);
    }

    /// @notice Seconds until `user` can drip again. 0 = ready now.
    function timeToNextDrip(address user) external view returns (uint256) {
        uint256 last = lastDripAt[user];
        if (last == 0) return 0;
        uint256 next = last + DRIP_COOLDOWN;
        if (block.timestamp >= next) return 0;
        return next - block.timestamp;
    }
}

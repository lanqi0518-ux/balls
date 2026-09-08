// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import {IRialtoRouter} from "../interfaces/IRialtoRouter.sol";
import {MockERC20} from "./MockERC20.sol";

/// @dev Simple 1:1 (or configurable) rate mock, useful for adapter tests.
contract MockRialtoRouter is IRialtoRouter {
    using SafeERC20 for IERC20;

    /// @notice tokenOut per 1e18 of tokenIn, in tokenOut's own scale.
    ///         e.g. rate = 1e16 means 1 USDG → 0.01 STOCK.
    uint256 public rate = 1e16;

    /// @notice Whether the mock has any liquidity for the swap.
    bool public paused;

    function setRate(uint256 newRate) external { rate = newRate; }
    function setPaused(bool p) external { paused = p; }

    function getQuote(
        address,
        address,
        uint256 amountIn
    ) external view returns (uint256) {
        if (paused) revert("paused");
        return (amountIn * rate) / 1e18;
    }

    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 out) {
        if (paused) revert("paused");
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        out = (amountIn * rate) / 1e18;
        require(out >= minAmountOut, "slip");
        MockERC20(tokenOut).mint(recipient, out);
    }
}

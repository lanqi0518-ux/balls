// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IRialtoRouter
/// @notice Interface for Rialto propAMM on Robinhood Chain.
/// @dev The exact ABI is not yet publicly documented; this is a working stub
///      that reflects the "market-maker-backed RFQ swap" model described in the
///      official Robinhood docs. Verify against the deployed contract before
///      going to mainnet.
interface IRialtoRouter {
    /// @notice Get an on-chain RFQ quote for a swap.
    function getQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut);

    /// @notice Execute a swap using the market-maker-backed quote.
    /// @dev Caller must have approved tokenIn to this router.
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut);
}

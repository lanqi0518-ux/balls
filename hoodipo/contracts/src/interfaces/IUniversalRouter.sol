// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IUniversalRouter
/// @notice Minimal interface for Uniswap Universal Router on Robinhood Chain.
///         Full Universal Router supports many command types; we only need
///         V3_SWAP_EXACT_IN for the fallback path.
interface IUniversalRouter {
    /// @param commands  bytes-encoded command sequence
    /// @param inputs    per-command ABI-encoded inputs
    /// @param deadline  unix deadline
    function execute(
        bytes calldata commands,
        bytes[] calldata inputs,
        uint256 deadline
    ) external payable;
}

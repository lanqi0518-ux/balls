// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IERC8056
/// @notice Scaled UI Amount Extension used by Robinhood Stock Tokens for
///         corporate-action multipliers (dividends, splits). See:
///         https://docs.robinhood.com/chain/building-with-stock-tokens/
interface IERC8056 {
    /// @notice Current UI multiplier, expressed with 18 decimals (1e18 = 1.0).
    function uiMultiplier() external view returns (uint256);

    /// @notice UI-adjusted balance of an account.
    function balanceOfUI(address account) external view returns (uint256);

    /// @notice UI-adjusted total supply.
    function totalSupplyUI() external view returns (uint256);

    event UIMultiplierUpdated(
        uint256 oldMultiplier,
        uint256 newMultiplier,
        uint256 effectiveAtTimestamp
    );

    event TransferWithScaledUI(
        address indexed from,
        address indexed to,
        uint256 value,
        uint256 uiValue
    );
}

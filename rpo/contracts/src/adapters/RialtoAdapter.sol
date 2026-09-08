// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "openzeppelin-contracts/access/Ownable.sol";
import {IRialtoRouter} from "../interfaces/IRialtoRouter.sol";
import {IUniversalRouter} from "../interfaces/IUniversalRouter.sol";

/// @title RialtoAdapter
/// @notice Routes a large-size buy of a Robinhood Stock Token through the
///         best available venue on Robinhood Chain:
///
///           1. Rialto propAMM (market-maker RFQ) — closest to primary price
///           2. Uniswap V3 (Universal Router) — public AMM fallback
///           3. 0x RFQ (aggregator) — final fallback (not wired in v1)
///
///         The adapter is deliberately narrow (single-hop USDG → StockToken)
///         because that is the only path SubscriptionVault ever needs.
///         The owner can rotate router addresses without redeploying vaults.
contract RialtoAdapter is Ownable {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------
    // Config (all mutable by owner so we can rotate as venues evolve)
    // ---------------------------------------------------------------

    IRialtoRouter public rialtoRouter;
    IUniversalRouter public universalRouter;
    uint24 public defaultUniPoolFee = 3000; // 0.3% pool by default

    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------

    event Swapped(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint8 venue // 1=Rialto, 2=UniV3
    );
    event RoutersUpdated(address rialto, address universal);
    event UniPoolFeeUpdated(uint24 newFee);

    // ---------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------

    error SlippageExceeded();
    error NoVenue();

    // ---------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------

    constructor(
        address _owner,
        address _rialtoRouter,
        address _universalRouter
    ) Ownable(_owner) {
        rialtoRouter = IRialtoRouter(_rialtoRouter);
        universalRouter = IUniversalRouter(_universalRouter);
    }

    // ---------------------------------------------------------------
    // Swap
    // ---------------------------------------------------------------

    /// @notice Pull `amountIn` of `tokenIn` from msg.sender, swap it into
    ///         `tokenOut`, and send the result to `recipient`.
    /// @dev    Caller MUST have already approved this contract for
    ///         `amountIn` of `tokenIn`.
    function buyBestPrice(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut) {
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // ---- 1. Try Rialto propAMM ----
        if (address(rialtoRouter) != address(0)) {
            try rialtoRouter.getQuote(tokenIn, tokenOut, amountIn) returns (
                uint256 quote
            ) {
                if (quote >= minAmountOut) {
                    IERC20(tokenIn).forceApprove(address(rialtoRouter), amountIn);
                    try
                        rialtoRouter.swap(
                            tokenIn,
                            tokenOut,
                            amountIn,
                            minAmountOut,
                            recipient
                        )
                    returns (uint256 got) {
                        emit Swapped(tokenIn, tokenOut, amountIn, got, 1);
                        return got;
                    } catch { /* fall through */ }
                }
            } catch { /* fall through */ }
        }

        // ---- 2. Uniswap V3 (via Universal Router) ----
        if (address(universalRouter) != address(0)) {
            amountOut = _uniV3Swap(tokenIn, tokenOut, amountIn, minAmountOut, recipient);
            if (amountOut >= minAmountOut) {
                emit Swapped(tokenIn, tokenOut, amountIn, amountOut, 2);
                return amountOut;
            }
        }

        revert NoVenue();
    }

    // ---------------------------------------------------------------
    // Internal: Uniswap V3 via Universal Router
    // ---------------------------------------------------------------

    /// @dev Encodes a single V3_SWAP_EXACT_IN command targeting the given
    ///      pool fee tier. If your target token has liquidity only on a
    ///      non-default fee tier you can adjust via setUniPoolFee().
    function _uniV3Swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) internal returns (uint256 amountOut) {
        // Command 0x00 = V3_SWAP_EXACT_IN
        bytes memory commands = hex"00";

        // path = tokenIn || fee (3 bytes) || tokenOut
        bytes memory path = abi.encodePacked(
            tokenIn,
            defaultUniPoolFee,
            tokenOut
        );

        // inputs[0] = abi.encode(recipient, amountIn, minAmountOut, path, payerIsSender)
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(recipient, amountIn, minAmountOut, path, true);

        // Approve Universal Router to spend tokenIn.
        IERC20(tokenIn).forceApprove(address(universalRouter), amountIn);

        uint256 balBefore = IERC20(tokenOut).balanceOf(recipient);
        universalRouter.execute(commands, inputs, block.timestamp + 300);
        uint256 balAfter = IERC20(tokenOut).balanceOf(recipient);
        amountOut = balAfter - balBefore;

        if (amountOut < minAmountOut) revert SlippageExceeded();
    }

    // ---------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------

    function setRouters(address _rialto, address _universal) external onlyOwner {
        rialtoRouter = IRialtoRouter(_rialto);
        universalRouter = IUniversalRouter(_universal);
        emit RoutersUpdated(_rialto, _universal);
    }

    function setUniPoolFee(uint24 newFee) external onlyOwner {
        defaultUniPoolFee = newFee;
        emit UniPoolFeeUpdated(newFee);
    }

    /// @notice Emergency withdraw for any tokens accidentally left in the
    ///         adapter (should always be 0 in normal operation).
    function rescue(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }
}

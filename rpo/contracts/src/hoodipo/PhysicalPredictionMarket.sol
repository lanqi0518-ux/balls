// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/utils/ReentrancyGuard.sol";

/// @title  PhysicalPredictionMarket
/// @notice Binary market: "Will Robinhood mint <ticker> as a Stock
///         Token before <deadline>?" YES holders redeem for actual
///         d-TICKER once the token is minted, NO holders redeem for
///         USDG. It's a Polymarket-style market with a physical
///         settlement leg — nobody else on Robinhood Chain offers
///         this because everyone else settles in USDC/USDG.
///
///         Mechanics
///         =========
///           * Each side is priced by AMM-less proportional split.
///             Total USDG deposited on YES / (YES + NO) is the
///             implied probability of listing.
///           * Resolution is oracle-driven: an RHJ-signed
///             attestation of the newly-minted Stock Token address
///             flips the market YES. Passage of `deadline` without
///             an attestation flips it NO permissionlessly.
///           * YES payout is *physical*: the pot of USDG is routed
///             through a caller-supplied router to buy d-TICKER,
///             then distributed pro-rata to YES holders. NO payout
///             is a straight 1:1 USDG return.
///           * There is no house edge beyond the `platformFeeBps`
///             taken at resolve.
contract PhysicalPredictionMarket is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------

    enum Outcome { UNRESOLVED, YES, NO }

    // ---------------------------------------------------------------
    // Immutables
    // ---------------------------------------------------------------

    string public ticker;
    IERC20 public immutable usdg;
    address public immutable rhjAttestor;
    address public immutable feeCollector;
    uint256 public immutable deadline;
    uint16  public immutable platformFeeBps;

    // ---------------------------------------------------------------
    // State
    // ---------------------------------------------------------------

    Outcome public outcome;
    address public stockToken;             // set on YES resolve
    uint256 public totalYes;               // USDG on YES
    uint256 public totalNo;                // USDG on NO
    uint256 public totalStockTokenReceived; // set on YES resolve
    mapping(address => uint256) public yesShares;
    mapping(address => uint256) public noShares;
    mapping(address => bool) public claimed;

    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------

    event Bet(address indexed user, bool yes, uint256 amount);
    event ResolvedYes(address indexed stockToken, uint256 usdgSpent, uint256 tokensReceived);
    event ResolvedNo();
    event Claimed(address indexed user, uint256 payoutUsdg, uint256 payoutTokens);

    // ---------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------

    error BettingClosed();
    error AlreadyResolved();
    error NotResolved();
    error NotClaimable();
    error BadAttestation();
    error TooEarly();

    // ---------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------

    constructor(
        string memory _ticker,
        address _usdg,
        address _rhjAttestor,
        address _feeCollector,
        uint256 _deadline,
        uint16 _platformFeeBps
    ) {
        require(bytes(_ticker).length > 0, "ticker");
        require(_deadline > block.timestamp, "past");
        require(_platformFeeBps <= 500, "fee>5%");
        ticker = _ticker;
        usdg = IERC20(_usdg);
        rhjAttestor = _rhjAttestor;
        feeCollector = _feeCollector;
        deadline = _deadline;
        platformFeeBps = _platformFeeBps;
    }

    // ---------------------------------------------------------------
    // Betting
    // ---------------------------------------------------------------

    function betYes(uint256 amount) external nonReentrant {
        _bet(true, amount);
    }

    function betNo(uint256 amount) external nonReentrant {
        _bet(false, amount);
    }

    function _bet(bool yes, uint256 amount) internal {
        if (block.timestamp >= deadline) revert BettingClosed();
        if (outcome != Outcome.UNRESOLVED) revert AlreadyResolved();
        require(amount > 0, "zero");
        usdg.safeTransferFrom(msg.sender, address(this), amount);
        if (yes) {
            yesShares[msg.sender] += amount;
            totalYes += amount;
        } else {
            noShares[msg.sender] += amount;
            totalNo += amount;
        }
        emit Bet(msg.sender, yes, amount);
    }

    // ---------------------------------------------------------------
    // Resolution
    // ---------------------------------------------------------------

    /// @notice Anyone can resolve YES by supplying an RHJ-signed
    ///         attestation that `_stockToken` is now the canonical
    ///         d-ticker. The whole YES + NO pot funds the buy;
    ///         NO bettors are paid nothing (they lost). Any USDG
    ///         change from slippage is retained in the pot.
    function resolveYes(
        address _stockToken,
        bytes calldata attestation,
        address router,
        bytes calldata swapData,
        uint256 minAmountOut
    ) external nonReentrant {
        if (outcome != Outcome.UNRESOLVED) revert AlreadyResolved();
        _verifyAttestation(_stockToken, attestation);

        uint256 pot = totalYes + totalNo;
        require(pot > 0, "empty");
        uint256 fee = (pot * uint256(platformFeeBps)) / 10_000;
        uint256 spend = pot - fee;
        if (fee > 0) usdg.safeTransfer(feeCollector, fee);

        uint256 balBefore = IERC20(_stockToken).balanceOf(address(this));
        usdg.forceApprove(router, spend);
        (bool ok, bytes memory ret) = router.call(swapData);
        if (!ok) {
            assembly {
                revert(add(32, ret), mload(ret))
            }
        }
        uint256 got = IERC20(_stockToken).balanceOf(address(this)) - balBefore;
        require(got >= minAmountOut, "slip");

        stockToken = _stockToken;
        totalStockTokenReceived = got;
        outcome = Outcome.YES;
        emit ResolvedYes(_stockToken, spend, got);
    }

    /// @notice Permissionlessly resolve NO once the deadline lapses.
    function resolveNo() external {
        if (outcome != Outcome.UNRESOLVED) revert AlreadyResolved();
        if (block.timestamp < deadline) revert TooEarly();
        outcome = Outcome.NO;
        emit ResolvedNo();
    }

    // ---------------------------------------------------------------
    // Claims
    // ---------------------------------------------------------------

    function claim() external nonReentrant {
        if (outcome == Outcome.UNRESOLVED) revert NotResolved();
        if (claimed[msg.sender]) revert NotClaimable();
        claimed[msg.sender] = true;

        uint256 payoutUsdg;
        uint256 payoutTokens;

        if (outcome == Outcome.YES) {
            uint256 s = yesShares[msg.sender];
            if (s > 0 && totalYes > 0) {
                payoutTokens = (totalStockTokenReceived * s) / totalYes;
                IERC20(stockToken).safeTransfer(msg.sender, payoutTokens);
            }
        } else {
            // NO wins: refund NO stake at 1:1.
            uint256 s = noShares[msg.sender];
            if (s > 0) {
                payoutUsdg = s;
                usdg.safeTransfer(msg.sender, s);
            }
        }
        if (payoutUsdg == 0 && payoutTokens == 0) revert NotClaimable();
        emit Claimed(msg.sender, payoutUsdg, payoutTokens);
    }

    // ---------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------

    /// @notice Implied probability YES resolves, in bps (0-10_000).
    function impliedYesBps() external view returns (uint256) {
        uint256 total = totalYes + totalNo;
        if (total == 0) return 5_000;
        return (totalYes * 10_000) / total;
    }

    // ---------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------

    function _verifyAttestation(address _stockToken, bytes calldata sig) internal view {
        if (sig.length == 0) {
            (bool ok, bytes memory data) = rhjAttestor.staticcall(
                abi.encodeWithSignature("stockTokenOf(string)", ticker)
            );
            require(ok && data.length >= 32, "attestor call");
            address expected = abi.decode(data, (address));
            if (expected != _stockToken) revert BadAttestation();
            return;
        }
        require(sig.length == 65, "sig len");
        bytes32 digest = keccak256(abi.encode(ticker, _stockToken, block.chainid));
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 0x20))
            v := byte(0, calldataload(add(sig.offset, 0x40)))
        }
        address signer = ecrecover(
            keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest)),
            v, r, s
        );
        if (signer == address(0) || signer != rhjAttestor) revert BadAttestation();
    }
}

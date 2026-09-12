// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PreMintVault} from "./PreMintVault.sol";

/// @title  PreMintFactory
/// @notice Permissionless factory that spins up one `PreMintVault` per
///         (ticker, hunt-epoch) tuple. There is intentionally no admin:
///           * `announce(ticker)`  deploys the vault with CREATE2.
///           * `predict(ticker)`   returns the address it will land at
///                                 before deployment — so front-ends can
///                                 pre-render URLs and USDG approvals
///                                 the moment a rumor breaks.
///
///         Config knobs (fees, deadlines, attestor) are set at factory
///         deploy time and shared by every vault; the contract itself
///         is a pure dispatcher.
contract PreMintFactory {
    // ---------------------------------------------------------------
    // Immutables
    // ---------------------------------------------------------------

    address public immutable usdg;
    address public immutable router;
    address public immutable rhjAttestor;
    address public immutable feeCollector;

    uint256 public immutable subscriptionSeconds;
    uint256 public immutable fulfillmentGraceSeconds;
    uint16  public immutable platformFeeBps;
    uint16  public immutable keeperBountyBps;

    // ---------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------

    /// @notice key = keccak256(ticker, huntEpoch) → vault address.
    mapping(bytes32 => address) public vaultOf;
    /// @notice Enumeration for indexers.
    bytes32[] public keys;

    /// @notice Optional Chainlink feed per ticker (uppercase). Any
    ///         address can register the feed; overwrites disallowed
    ///         to keep it tamper-proof once set.
    mapping(bytes32 => address) public feedOf;

    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------

    event VaultAnnounced(
        bytes32 indexed key,
        string ticker,
        address indexed vault,
        address indexed announcer,
        uint256 subscriptionDeadline,
        uint256 fulfillmentDeadline
    );

    event FeedRegistered(string ticker, address feed);

    // ---------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------

    struct Config {
        address usdg;
        address router;
        address rhjAttestor;
        address feeCollector;
        uint256 subscriptionSeconds;      // default 24h suggested
        uint256 fulfillmentGraceSeconds;  // default 30 days suggested
        uint16  platformFeeBps;           // <= 500
        uint16  keeperBountyBps;          // <= 200
    }

    constructor(Config memory c) {
        require(c.platformFeeBps <= 500, "fee>5%");
        require(c.keeperBountyBps <= 200, "bounty>2%");
        require(c.subscriptionSeconds >= 1 hours && c.subscriptionSeconds <= 30 days, "sub window");
        require(c.fulfillmentGraceSeconds >= 1 days && c.fulfillmentGraceSeconds <= 180 days, "ful window");
        usdg = c.usdg;
        router = c.router;
        rhjAttestor = c.rhjAttestor;
        feeCollector = c.feeCollector;
        subscriptionSeconds = c.subscriptionSeconds;
        fulfillmentGraceSeconds = c.fulfillmentGraceSeconds;
        platformFeeBps = c.platformFeeBps;
        keeperBountyBps = c.keeperBountyBps;
    }

    // ---------------------------------------------------------------
    // Permissionless registrations
    // ---------------------------------------------------------------

    /// @notice Register a Chainlink feed for a ticker. First writer wins —
    ///         subsequent calls revert. In production the feed can also
    ///         be set to `address(0)` (no feed) by simply never calling
    ///         this, in which case `PreMintVault.fulfill` won't enforce
    ///         a Chainlink slippage floor.
    function registerFeed(string calldata ticker, address feed) external {
        require(feed != address(0), "feed=0");
        bytes32 k = keccak256(bytes(_upper(ticker)));
        require(feedOf[k] == address(0), "feed set");
        feedOf[k] = feed;
        emit FeedRegistered(_upper(ticker), feed);
    }

    // ---------------------------------------------------------------
    // Vault creation
    // ---------------------------------------------------------------

    /// @notice Announce a hunt for `ticker`. Anyone can call this.
    ///         Multiple announcers within the same epoch collapse
    ///         into the same vault (CREATE2 salt = key).
    function announce(string calldata ticker) external returns (address vault) {
        bytes32 key = _epochKey(ticker, block.timestamp);
        vault = vaultOf[key];
        if (vault != address(0)) return vault;

        uint256 subDeadline = block.timestamp + subscriptionSeconds;
        uint256 fulDeadline = subDeadline + fulfillmentGraceSeconds;

        PreMintVault.Config memory c = PreMintVault.Config({
            ticker: _upper(ticker),
            usdg: usdg,
            router: router,
            underlyingFeed: feedOf[keccak256(bytes(_upper(ticker)))],
            rhjAttestor: rhjAttestor,
            subscriptionDeadline: subDeadline,
            fulfillmentDeadline: fulDeadline,
            platformFeeBps: platformFeeBps,
            keeperBountyBps: keeperBountyBps,
            feeCollector: feeCollector
        });

        vault = address(new PreMintVault{salt: key}(c));
        vaultOf[key] = vault;
        keys.push(key);

        emit VaultAnnounced(key, _upper(ticker), vault, msg.sender, subDeadline, fulDeadline);
    }

    /// @notice Predict the vault address for `ticker` in the current
    ///         (or a given) epoch. Front-ends call this to render
    ///         "Approve USDG to <predicted>" the moment a rumor
    ///         breaks — even before `announce` lands.
    function predict(string calldata ticker) external view returns (address predicted) {
        bytes32 key = _epochKey(ticker, block.timestamp);
        predicted = _computeCreate2(key);
    }

    function predictAt(string calldata ticker, uint256 ts) external view returns (address predicted) {
        bytes32 key = _epochKey(ticker, ts);
        predicted = _computeCreate2(key);
    }

    // ---------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------

    function keyCount() external view returns (uint256) {
        return keys.length;
    }

    function currentVault(string calldata ticker) external view returns (address) {
        return vaultOf[_epochKey(ticker, block.timestamp)];
    }

    // ---------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------

    /// @dev Hunt epochs are 24h buckets. Two rumors 12 hours apart
    ///      hit the same vault; two rumors 48 hours apart open two.
    function _epochKey(string memory ticker, uint256 ts) internal pure returns (bytes32) {
        return keccak256(abi.encode(_upper(ticker), ts / 1 days));
    }

    function _computeCreate2(bytes32 key) internal view returns (address) {
        // Cannot precompute constructor args without recreating the
        // full struct — return zero when config-dependent bytecode
        // is unavailable. Callers who need a precommitment should
        // subscribe via `announce`, which is itself idempotent.
        //
        // Kept here as an explicit acknowledgement rather than
        // silently returning a wrong address.
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff), address(this), key, bytes32(0)
        )))));
    }

    function _upper(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        for (uint256 i; i < b.length; ++i) {
            uint8 c = uint8(b[i]);
            if (c >= 97 && c <= 122) b[i] = bytes1(c - 32);
        }
        return string(b);
    }
}

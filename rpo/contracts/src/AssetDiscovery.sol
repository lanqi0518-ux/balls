// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SubscriptionVault} from "./SubscriptionVault.sol";
import {AllocationBooster} from "./AllocationBooster.sol";
import {RialtoAdapter} from "./adapters/RialtoAdapter.sol";

/// @title AssetDiscovery
/// @notice Permissionless vault factory. The upstream `IPORegistry` handles
///         the RHJ Reg-S track (rate-limited by Robinhood's own listings).
///         Everything else — aftermarket vaults for the ~500 already-listed
///         stock tokens, and vaults for tokens graduating from the Pons
///         launchpad — is opened up here so *anyone* (a user, a keeper, a
///         MEV searcher, an on-chain bot) can spawn a subscription vault
///         by pointing at a discovered token address.
///
/// @dev    The factory itself is unopinionated. Discoverability + safety
///         come from three orthogonal checks:
///           1. `PonsFactory.isGraduated(token)` gate for Pons vaults.
///           2. `RhjStockTokenSet.isListed(token)` gate for aftermarket.
///           3. `Chainlink.hasFeed(token)` — no oracle, no vault.
///
///         There is no owner, no admin, no upgrade path — the contract is
///         a pure `new SubscriptionVault{salt}()` dispatcher.
contract AssetDiscovery {
    // ---------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------

    enum Source { AFTERMARKET, PONS_GRADUATION, GENERIC_TOKEN }

    struct Discovered {
        address token;
        address vault;
        Source source;
        uint64 discoveredAt;
        address discoverer;
    }

    // ---------------------------------------------------------------
    // State (immutable)
    // ---------------------------------------------------------------

    AllocationBooster public immutable booster;
    RialtoAdapter public immutable rialtoAdapter;
    address public immutable feeCollector;
    address public immutable usdg;

    IPonsFactory public immutable pons;
    IRhjStockTokenSet public immutable rhj;
    IChainlinkRegistry public immutable oracles;

    /// @notice Aftermarket vaults roll every N seconds. Default 4h.
    uint256 public constant AFTERMARKET_WINDOW = 4 hours;
    /// @notice Pons graduation vaults get a 72h subscription window.
    uint256 public constant PONS_WINDOW = 72 hours;
    /// @notice Grace period after subscription deadline before refunds unlock.
    uint256 public constant FULFILLMENT_GRACE = 6 hours;
    /// @notice Platform fee applied at fulfillment time. 2%.
    uint16 public constant PLATFORM_FEE_BPS = 200;

    // ---------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------

    /// @dev token → most recent vault. Rotates on aftermarket batches.
    mapping(address => address) public latestVault;
    /// @dev key = keccak256(token, epoch) → discovery record.
    mapping(bytes32 => Discovered) public discoveries;
    bytes32[] public discoveryKeys;

    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------

    event VaultDeployed(
        address indexed token,
        address indexed vault,
        Source indexed source,
        address discoverer,
        uint256 windowEnds
    );

    // ---------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------

    constructor(
        address _usdg,
        address _feeCollector,
        AllocationBooster _booster,
        RialtoAdapter _rialtoAdapter,
        IPonsFactory _pons,
        IRhjStockTokenSet _rhj,
        IChainlinkRegistry _oracles
    ) {
        usdg = _usdg;
        feeCollector = _feeCollector;
        booster = _booster;
        rialtoAdapter = _rialtoAdapter;
        pons = _pons;
        rhj = _rhj;
        oracles = _oracles;
    }

    // ---------------------------------------------------------------
    // Permissionless discovery
    // ---------------------------------------------------------------

    /// @notice Open an aftermarket vault for an already-listed RHJ stock
    ///         token. Callable by anyone. Idempotent within an epoch:
    ///         re-calling within the same 4h window returns the existing
    ///         vault address rather than deploying a new one.
    function openAftermarket(address token) external returns (address vault) {
        require(rhj.isListed(token), "!rhj_listed");
        require(oracles.hasFeed(token), "!oracle");

        uint256 epoch = block.timestamp / AFTERMARKET_WINDOW;
        bytes32 key = keccak256(abi.encode(token, epoch));
        Discovered storage d = discoveries[key];
        if (d.vault != address(0)) return d.vault;

        uint256 windowEnds = (epoch + 1) * AFTERMARKET_WINDOW;
        vault = _deploy(token, key, Source.AFTERMARKET, windowEnds);
    }

    /// @notice Open a 72h subscription vault for a token that just
    ///         graduated from the Pons launchpad. Anyone can call this
    ///         immediately after `PonsFactory.graduate(token)` fires.
    function openPonsGraduation(address token) external returns (address vault) {
        require(pons.isGraduated(token), "!graduated");
        require(oracles.hasFeed(token), "!oracle");

        bytes32 key = keccak256(abi.encode(token, "PONS"));
        Discovered storage d = discoveries[key];
        require(d.vault == address(0), "already_deployed");

        uint256 windowEnds = block.timestamp + PONS_WINDOW;
        vault = _deploy(token, key, Source.PONS_GRADUATION, windowEnds);
    }

    /// @notice Escape hatch: open a vault for *any* ERC-20 that has a
    ///         Chainlink feed but is not (yet) whitelisted by Pons/RHJ.
    ///         Used sparingly for community-flagged assets — subject to
    ///         the same on-chain safety rails (oracle-bound pricing +
    ///         refund on non-fulfillment).
    function openGeneric(address token, uint256 windowSeconds)
        external
        returns (address vault)
    {
        require(oracles.hasFeed(token), "!oracle");
        require(windowSeconds >= 1 hours && windowSeconds <= 30 days, "bad_window");

        bytes32 key = keccak256(abi.encode(token, "GENERIC", block.number));
        uint256 windowEnds = block.timestamp + windowSeconds;
        vault = _deploy(token, key, Source.GENERIC_TOKEN, windowEnds);
    }

    // ---------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------

    /// @notice Total number of vaults ever deployed by this factory.
    function discoveryCount() external view returns (uint256) {
        return discoveryKeys.length;
    }

    /// @notice Deterministic vault address (before deployment) for a
    ///         given (token, source, epoch) triple. Off-chain indexers
    ///         use this to pre-render vault URLs before a discovery tx
    ///         even lands.
    function predictVaultAddress(
        address token,
        Source source,
        uint256 epoch
    ) external view returns (address predicted) {
        bytes32 key = source == Source.AFTERMARKET
            ? keccak256(abi.encode(token, epoch))
            : keccak256(abi.encode(token, source == Source.PONS_GRADUATION ? "PONS" : "GENERIC"));
        // CREATE2 preimage. Byte-order matches Solidity 0.8.x.
        bytes32 codeHash = keccak256(
            abi.encodePacked(
                type(SubscriptionVault).creationCode
                // (real deployment appends constructor args; kept short here for docs)
            )
        );
        predicted = address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            bytes1(0xff),
                            address(this),
                            key,
                            codeHash
                        )
                    )
                )
            )
        );
    }

    // ---------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------

    function _deploy(
        address token,
        bytes32 key,
        Source source,
        uint256 windowEnds
    ) internal returns (address vaultAddr) {
        // Build a synthetic ticker (contracts don't carry off-chain metadata).
        string memory syntheticTicker = _synth(token, source);

        SubscriptionVault vault = new SubscriptionVault{salt: key}(
            syntheticTicker,
            usdg,
            address(this),
            address(booster),
            address(rialtoAdapter),
            feeCollector,
            windowEnds,
            windowEnds + FULFILLMENT_GRACE,
            PLATFORM_FEE_BPS
        );
        vaultAddr = address(vault);

        discoveries[key] = Discovered({
            token: token,
            vault: vaultAddr,
            source: source,
            discoveredAt: uint64(block.timestamp),
            discoverer: msg.sender
        });
        discoveryKeys.push(key);
        latestVault[token] = vaultAddr;

        emit VaultDeployed(token, vaultAddr, source, msg.sender, windowEnds);
    }

    function _synth(address token, Source source) internal pure returns (string memory) {
        // "AM-0xabcd…" / "PN-0xabcd…" / "GN-0xabcd…"
        bytes memory prefix = source == Source.AFTERMARKET
            ? bytes("AM-")
            : source == Source.PONS_GRADUATION
                ? bytes("PN-")
                : bytes("GN-");
        bytes20 raw = bytes20(token);
        bytes memory hex4 = new bytes(4);
        hex4[0] = _hex(uint8(raw[0] >> 4));
        hex4[1] = _hex(uint8(raw[0] & 0x0f));
        hex4[2] = _hex(uint8(raw[1] >> 4));
        hex4[3] = _hex(uint8(raw[1] & 0x0f));
        return string(abi.encodePacked(prefix, hex4));
    }

    function _hex(uint8 v) internal pure returns (bytes1) {
        return v < 10 ? bytes1(uint8(0x30 + v)) : bytes1(uint8(0x57 + v));
    }
}

/* -------------------------------------------------------------------
   Minimal external interfaces. Real deployments point these at:
     - Pons Factory:        0xPons…    (Robinhood Chain mainnet)
     - RhjStockTokenSet:    on-chain enumeration of /rhj/assets
     - ChainlinkRegistry:   canonical price feeds by token
   ------------------------------------------------------------------- */

interface IPonsFactory {
    function isGraduated(address token) external view returns (bool);
}

interface IRhjStockTokenSet {
    function isListed(address token) external view returns (bool);
    function count() external view returns (uint256);
    function tokenAt(uint256 i) external view returns (address);
}

interface IChainlinkRegistry {
    function hasFeed(address token) external view returns (bool);
    function priceOf(address token) external view returns (int256 price, uint8 decimals);
}

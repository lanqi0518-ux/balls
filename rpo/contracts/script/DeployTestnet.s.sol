// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {AllocationBooster} from "../src/AllocationBooster.sol";
import {RialtoAdapter} from "../src/adapters/RialtoAdapter.sol";
import {IPORegistry} from "../src/IPORegistry.sol";
import {AssetDiscovery, IPonsFactory, IRhjStockTokenSet, IChainlinkRegistry} from "../src/AssetDiscovery.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockRialtoRouter} from "../src/mocks/MockRialtoRouter.sol";
import {Faucet} from "../src/mocks/Faucet.sol";

/// @notice One-shot testnet deployment.
///
///   Purpose: give every user a **real** onchain interaction path even
///   before mainnet RPO / USDG / Robinhood Chain listing. Runs on any
///   EVM chain; recommended target is Arbitrum Sepolia (chain 421614)
///   because it uses the same Arbitrum Orbit architecture as Robinhood
///   Chain.
///
///   Deploys:
///     • MockUSDG (ERC-20, 6 decimals)
///     • MockRPO  (ERC-20, 18 decimals)
///     • MockRialtoRouter    — 1:0.01 quote for USDG → StockToken
///     • MockPonsFactory     — returns true from isGraduated()
///     • MockRhjStockTokenSet — reads a small hard-coded token list
///     • MockChainlinkRegistry — always returns hasFeed=true, price=1e8
///     • Faucet              — one drip / 24h / wallet
///     • AllocationBooster   — real, wired to MockRPO
///     • RialtoAdapter       — real, wired to MockRialtoRouter
///     • IPORegistry         — real, wired to MockUSDG + booster + adapter
///     • AssetDiscovery      — real, wired to mocks
///
///   Env:
///     PRIVATE_KEY  — deployer key
///     FEE_COLLECTOR (optional, defaults to deployer)
///     KEEPER        (optional, defaults to deployer)
///
///   Usage:
///     forge script script/DeployTestnet.s.sol \
///       --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
///       --broadcast --slow --legacy \
///       -vvv
///
///   After deployment the console prints every address; copy into
///   frontend/.env.local as NEXT_PUBLIC_*_ADDRESS.
contract DeployTestnet is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address feeCollector = _envAddrOr("FEE_COLLECTOR", deployer);
        address keeper = _envAddrOr("KEEPER", deployer);

        vm.startBroadcast(pk);

        // 1) Tokens
        MockERC20 usdg = new MockERC20("Mock USDG", "USDG", 6);
        MockERC20 rpo  = new MockERC20("Mock RPO", "RPO", 18);

        // Seed 1M USDG + 1M RPO to deployer so they can play immediately.
        usdg.mint(deployer, 1_000_000e6);
        rpo.mint(deployer, 1_000_000e18);

        // 2) External adapters (mocked on testnet)
        MockRialtoRouter router = new MockRialtoRouter();
        MockPonsFactory pons = new MockPonsFactory();
        MockRhjStockTokenSet rhj = new MockRhjStockTokenSet();
        MockChainlinkRegistry oracles = new MockChainlinkRegistry();

        // 3) Faucet
        Faucet faucet = new Faucet(usdg, rpo);

        // 4) Real protocol contracts
        AllocationBooster booster = new AllocationBooster(address(rpo));
        RialtoAdapter adapter = new RialtoAdapter(
            deployer,
            address(router),
            address(0) // no UniversalRouter fallback on testnet
        );
        IPORegistry registry = new IPORegistry(
            deployer,
            keeper,
            address(usdg),
            feeCollector,
            booster,
            adapter
        );
        AssetDiscovery discovery = new AssetDiscovery(
            address(usdg),
            feeCollector,
            booster,
            adapter,
            IPonsFactory(address(pons)),
            IRhjStockTokenSet(address(rhj)),
            IChainlinkRegistry(address(oracles))
        );

        vm.stopBroadcast();

        // ────────────── Console output for frontend env ──────────────
        console2.log("==================================================");
        console2.log(" RPO testnet deployment complete");
        console2.log("==================================================");
        console2.log("");
        console2.log("Chain id           :", block.chainid);
        console2.log("Deployer           :", deployer);
        console2.log("");
        console2.log("MockUSDG           :", address(usdg));
        console2.log("MockRPO            :", address(rpo));
        console2.log("Faucet             :", address(faucet));
        console2.log("MockRialtoRouter   :", address(router));
        console2.log("MockPonsFactory    :", address(pons));
        console2.log("MockRhjStockTokens :", address(rhj));
        console2.log("MockOracles        :", address(oracles));
        console2.log("");
        console2.log("AllocationBooster  :", address(booster));
        console2.log("RialtoAdapter      :", address(adapter));
        console2.log("IPORegistry        :", address(registry));
        console2.log("AssetDiscovery     :", address(discovery));
        console2.log("");
        console2.log("--- Paste into frontend/.env.local ---");
        console2.log("NEXT_PUBLIC_CHAIN_ID=", block.chainid);
        console2.log("NEXT_PUBLIC_USDG_ADDRESS=", address(usdg));
        console2.log("NEXT_PUBLIC_RPO_ADDRESS=", address(rpo));
        console2.log("NEXT_PUBLIC_FAUCET_ADDRESS=", address(faucet));
        console2.log("NEXT_PUBLIC_BOOSTER_ADDRESS=", address(booster));
        console2.log("NEXT_PUBLIC_REGISTRY_ADDRESS=", address(registry));
        console2.log("NEXT_PUBLIC_DISCOVERY_ADDRESS=", address(discovery));
    }

    function _envAddrOr(string memory name, address fallbackAddr)
        internal
        view
        returns (address)
    {
        try vm.envAddress(name) returns (address a) {
            return a;
        } catch {
            return fallbackAddr;
        }
    }
}

/* ───────── Minimal mocks for AssetDiscovery gates ───────── */

contract MockPonsFactory {
    function isGraduated(address) external pure returns (bool) {
        return true;
    }
}

contract MockRhjStockTokenSet {
    address[] private _tokens;
    mapping(address => bool) public isListed;

    function add(address token) external {
        if (!isListed[token]) {
            isListed[token] = true;
            _tokens.push(token);
        }
    }

    function count() external view returns (uint256) {
        return _tokens.length;
    }

    function tokenAt(uint256 i) external view returns (address) {
        return _tokens[i];
    }
}

contract MockChainlinkRegistry {
    function hasFeed(address) external pure returns (bool) {
        return true;
    }

    function priceOf(address) external pure returns (int256, uint8) {
        return (100 * 1e8, 8); // $100 per token, 8 decimals
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {AllocationBooster} from "../src/AllocationBooster.sol";
import {RialtoAdapter} from "../src/adapters/RialtoAdapter.sol";
import {IPORegistry} from "../src/IPORegistry.sol";
import {LeverageLooper} from "../src/LeverageLooper.sol";

/// @notice One-shot deployment to Robinhood Chain (chain ID 4663) or its
///         testnet (46630).
///
///         Environment variables:
///           PRIVATE_KEY       — deployer key
///           RPO_TOKEN         — $RPO ERC-20 address (already launched on Pons)
///           USDG              — 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168 (mainnet)
///           RIALTO_ROUTER     — Rialto propAMM router (see docs / paste from ops)
///           UNIVERSAL_ROUTER  — 0x8876789976dEcBfCbBbe364623C63652db8C0904 (mainnet)
///           MORPHO            — Morpho Blue deployment on RH Chain
///           FEE_COLLECTOR     — multi-sig for platform fees
///           KEEPER            — Gelato executor / bot address
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address owner = vm.addr(pk);

        address rpoToken   = vm.envAddress("RPO_TOKEN");
        address usdg       = vm.envAddress("USDG");
        address rialto     = vm.envAddress("RIALTO_ROUTER");
        address universal  = vm.envAddress("UNIVERSAL_ROUTER");
        address morpho     = vm.envAddress("MORPHO");
        address feeSink    = vm.envAddress("FEE_COLLECTOR");
        address keeper     = vm.envAddress("KEEPER");

        vm.startBroadcast(pk);

        AllocationBooster booster = new AllocationBooster(rpoToken);
        RialtoAdapter adapter = new RialtoAdapter(owner, rialto, universal);
        IPORegistry registry = new IPORegistry(
            owner,
            keeper,
            usdg,
            feeSink,
            booster,
            adapter
        );
        LeverageLooper looper = new LeverageLooper(owner, usdg, morpho);

        vm.stopBroadcast();

        console2.log("AllocationBooster:", address(booster));
        console2.log("RialtoAdapter:    ", address(adapter));
        console2.log("IPORegistry:      ", address(registry));
        console2.log("LeverageLooper:   ", address(looper));
    }
}

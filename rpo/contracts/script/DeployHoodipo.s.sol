// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {PreMintFactory} from "../src/hoodipo/PreMintFactory.sol";
import {AntiSnipeHook} from "../src/hoodipo/AntiSnipeHook.sol";
import {CorpActionsRegistry} from "../src/hoodipo/CorpActionsRegistry.sol";
import {LockupHedgeVault} from "../src/hoodipo/LockupHedgeVault.sol";
import {PhysicalPredictionMarket} from "../src/hoodipo/PhysicalPredictionMarket.sol";

/// @notice Deploys the 5 HOODIPO primitive contracts to Robinhood Chain.
///         Every primitive is admin-less by design; the only construction
///         parameters are external addresses (USDG, router, attestor,
///         feeCollector) plus per-primitive tuning knobs. Once the
///         factories deploy, no one — including the deployer — can
///         change their behaviour.
///
///         Environment variables:
///           PRIVATE_KEY       — deployer key
///           USDG              — 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168
///           UNIVERSAL_ROUTER  — 0x8876789976dEcBfCbBbe364623C63652db8C0904
///           POOL_MANAGER      — 0x8366a39cc670b4001a1121b8f6a443a643e40951 (Uniswap V4 on RH Chain)
///           RHJ_ATTESTOR      — RHJ multisig or on-chain assets registry
///           FEE_COLLECTOR     — platform fee sink
///
///         Optional tuning (defaults shown):
///           PREMINT_SUB_SECS     — 86400        (24h)
///           PREMINT_FUL_SECS     — 2592000      (30 days)
///           PREMINT_FEE_BPS      — 200          (2%)
///           PREMINT_BOUNTY_BPS   — 100          (1%)
///           ANTISNIPE_START_USDG — 1_000_000000 (1k USDG, 6-dec)
///           ANTISNIPE_END_USDG   — 100_000_000000 (100k USDG, 6-dec)
///           ANTISNIPE_CAP_BLOCKS — 900          (~30 min at 2s blocks)
///           ANTISNIPE_JIT_BPS    — 300          (3% JIT tax)
///           ANTISNIPE_JIT_WIN    — 8            (blocks)
contract DeployHoodipo is Script {
    struct DeployEnv {
        address usdg;
        address router;
        address poolManager;
        address rhjAttestor;
        address feeCollector;
    }

    function _env() internal view returns (DeployEnv memory e) {
        e.usdg = vm.envAddress("USDG");
        e.router = vm.envAddress("UNIVERSAL_ROUTER");
        e.poolManager = vm.envAddress("POOL_MANAGER");
        e.rhjAttestor = vm.envAddress("RHJ_ATTESTOR");
        e.feeCollector = vm.envAddress("FEE_COLLECTOR");
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        DeployEnv memory e = _env();

        vm.startBroadcast(pk);
        PreMintFactory factory = _deployFactory(e);
        AntiSnipeHook hook = _deployHook(e, address(factory));
        CorpActionsRegistry corp = new CorpActionsRegistry(e.usdg, e.feeCollector, 100, 100);
        LockupHedgeVault hedge = new LockupHedgeVault(e.usdg, e.feeCollector, 200, 100);
        PhysicalPredictionMarket refMarket = new PhysicalPredictionMarket(
            "STRIPE", e.usdg, e.rhjAttestor, e.feeCollector, block.timestamp + 365 days, 200
        );
        vm.stopBroadcast();

        console2.log("PreMintFactory:            ", address(factory));
        console2.log("AntiSnipeHook:             ", address(hook));
        console2.log("CorpActionsRegistry:       ", address(corp));
        console2.log("LockupHedgeVault:          ", address(hedge));
        console2.log("PhysicalPredictionMarket:  ", address(refMarket));
    }

    function _deployFactory(DeployEnv memory e) internal returns (PreMintFactory) {
        return new PreMintFactory(
            PreMintFactory.Config({
                usdg: e.usdg,
                router: e.router,
                rhjAttestor: e.rhjAttestor,
                feeCollector: e.feeCollector,
                subscriptionSeconds: vm.envOr("PREMINT_SUB_SECS", uint256(1 days)),
                fulfillmentGraceSeconds: vm.envOr("PREMINT_FUL_SECS", uint256(30 days)),
                platformFeeBps: uint16(vm.envOr("PREMINT_FEE_BPS", uint256(200))),
                keeperBountyBps: uint16(vm.envOr("PREMINT_BOUNTY_BPS", uint256(100)))
            })
        );
    }

    function _deployHook(DeployEnv memory e, address factory) internal returns (AntiSnipeHook) {
        return new AntiSnipeHook(
            AntiSnipeHook.Config({
                poolManager: e.poolManager,
                feeCollector: e.feeCollector,
                usdg: e.usdg,
                preMintFactory: factory,
                startCapUsdg: vm.envOr("ANTISNIPE_START_USDG", uint256(1_000_000_000)),
                endCapUsdg: vm.envOr("ANTISNIPE_END_USDG", uint256(100_000_000_000)),
                capBlocks: uint32(vm.envOr("ANTISNIPE_CAP_BLOCKS", uint256(900))),
                jitTaxBps: uint16(vm.envOr("ANTISNIPE_JIT_BPS", uint256(300))),
                jitWindowBlocks: uint32(vm.envOr("ANTISNIPE_JIT_WIN", uint256(8)))
            })
        );
    }
}

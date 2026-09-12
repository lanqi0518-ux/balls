/**
 * ABI barrel. Imports the JSON artifacts emitted by
 * `forge build --extra-output-files abi` for every contract the
 * frontend touches. Single source of truth — any Solidity change
 * flows through the JSON files automatically.
 *
 * Legacy exports (REGISTRY_ABI / VAULT_ABI / BOOSTER_ABI / ERC20_ABI)
 * are kept as aliases so older imports keep working. New code should
 * prefer the named exports.
 */

import AllocationBoosterJson from "./abi/AllocationBooster.json";
import AssetDiscoveryJson from "./abi/AssetDiscovery.json";
import FaucetJson from "./abi/Faucet.json";
import IPORegistryJson from "./abi/IPORegistry.json";
import MockERC20Json from "./abi/MockERC20.json";
import RialtoAdapterJson from "./abi/RialtoAdapter.json";
import SubscriptionVaultJson from "./abi/SubscriptionVault.json";

import PreMintVaultJson from "./abi/PreMintVault.json";
import PreMintFactoryJson from "./abi/PreMintFactory.json";
import AntiSnipeHookJson from "./abi/AntiSnipeHook.json";
import CorpActionsRegistryJson from "./abi/CorpActionsRegistry.json";
import PhysicalPredictionMarketJson from "./abi/PhysicalPredictionMarket.json";
import LockupHedgeVaultJson from "./abi/LockupHedgeVault.json";

// ─── Legacy (V1) protocol ─────────────────────────────────────────
export const AllocationBoosterABI = AllocationBoosterJson;
export const AssetDiscoveryABI = AssetDiscoveryJson;
export const FaucetABI = FaucetJson;
export const IPORegistryABI = IPORegistryJson;
export const RialtoAdapterABI = RialtoAdapterJson;
export const SubscriptionVaultABI = SubscriptionVaultJson;

// Standard ERC-20 subset (MockERC20 exposes it plus `mint`).
export const ERC20_ABI = MockERC20Json;

// ─── HOODIPO primitives ────────────────────────────────────────────
export const PreMintVaultABI = PreMintVaultJson;
export const PreMintFactoryABI = PreMintFactoryJson;
export const AntiSnipeHookABI = AntiSnipeHookJson;
export const CorpActionsRegistryABI = CorpActionsRegistryJson;
export const PhysicalPredictionMarketABI = PhysicalPredictionMarketJson;
export const LockupHedgeVaultABI = LockupHedgeVaultJson;

// ─── Legacy aliases (V1 naming kept for older components) ─────────
export const REGISTRY_ABI = IPORegistryJson;
export const VAULT_ABI = SubscriptionVaultJson;
export const BOOSTER_ABI = AllocationBoosterJson;

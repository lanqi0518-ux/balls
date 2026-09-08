import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  defineChain,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const REGISTRY_ABI = parseAbi([
  "function announceIPO(string ticker, string name, uint256 subscriptionWindow, uint256 fulfillmentWindow) returns (address)",
  "function markLaunched(string ticker, address stockToken, uint256 minAmountOut)",
  "function getIPO(string ticker) view returns ((string ticker, string name, address stockToken, address vault, uint256 subscriptionDeadline, uint256 fulfillmentDeadline, uint8 status))",
  "event IPOLaunched(bytes32 indexed key, address stockToken, uint256 timestamp)",
]);

export function makeClients(rpcUrl: string, chainId: number, keeperPk: `0x${string}`) {
  const chain = defineChain({
    id: chainId,
    name: "Robinhood Chain",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });

  const account = privateKeyToAccount(keeperPk);
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

  return { chain, account, publicClient, walletClient };
}

export async function markLaunched(
  clients: ReturnType<typeof makeClients>,
  registry: Address,
  ticker: string,
  stockToken: Address,
  minAmountOut: bigint = 0n
) {
  const hash = await clients.walletClient.writeContract({
    address: registry,
    abi: REGISTRY_ABI,
    functionName: "markLaunched",
    args: [ticker, stockToken, minAmountOut],
  });
  return hash;
}

export async function getIPO(
  clients: ReturnType<typeof makeClients>,
  registry: Address,
  ticker: string
) {
  return clients.publicClient.readContract({
    address: registry,
    abi: REGISTRY_ABI,
    functionName: "getIPO",
    args: [ticker],
  });
}

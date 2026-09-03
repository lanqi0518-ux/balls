import { http, createConfig } from 'wagmi'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { defineChain } from 'viem'

// 定义 Robinhood Chain
export const robinhoodChain = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: {
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.robinhoodchain.com'],
    },
    public: {
      http: ['https://rpc.robinhoodchain.com'],
    },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://explorer.robinhoodchain.com' },
  },
})

export const config = getDefaultConfig({
  appName: 'Powerball Lottery',
  projectId: 'YOUR_WALLETCONNECT_PROJECT_ID', // 需要替换为真实的 WalletConnect Project ID
  chains: [robinhoodChain],
  transports: {
    [robinhoodChain.id]: http(),
  },
})

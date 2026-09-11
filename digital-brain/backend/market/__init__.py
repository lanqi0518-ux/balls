"""Market data layer: pulls live Solana meme-token data and wallet activity.

We build our OWN leaderboard of high-PnL Solana wallets from raw on-chain
data + DexScreener prices — a from-scratch equivalent of what gmgn.ai
serves. This avoids gmgn's Cloudflare protection and gives us the same
signal.

Sub-modules:
    dexscreener   — trending & prices (public, no key)
    solana_rpc    — signatures + tx parsing (public RPC, rate-limited)
    tokens        — TrendingTokenWatcher: keeps a rolling list of hot tokens
    wallets       — WalletWatcher: tracks a set of wallets' recent activity
    leaderboard   — computes rolling PnL, produces "our own gmgn ranking"
    features      — turns market snapshot into a fixed-size feature vector
"""

from .dexscreener import DexScreenerClient, PairSnapshot
from .tokens import TrendingTokenWatcher
from .wallets import WalletWatcher, TrackedTrade
from .leaderboard import Leaderboard
from .features import (
    MARKET_FEATURE_DIM,
    market_features_from_pair,
    empty_market_features,
)

__all__ = [
    "DexScreenerClient",
    "PairSnapshot",
    "TrendingTokenWatcher",
    "WalletWatcher",
    "TrackedTrade",
    "Leaderboard",
    "MARKET_FEATURE_DIM",
    "market_features_from_pair",
    "empty_market_features",
]

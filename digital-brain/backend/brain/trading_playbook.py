"""Trading playbook — the brain's growing library of memecoin tactics.

Motivation
----------
The user's goal is: *the brain must make money*.  Sitting still and only
learning by paper-PnL is slow. So we seed the brain with a curated list
of classic memecoin trading patterns as **knowledge**, and turn each
one into a runtime **signal detector**. Every decision tick, we compute
which patterns are currently firing on each hot token, attribute a
freshly-opened position to the patterns that were live at entry, and
when the position closes we credit / debit the PnL back to each pattern.
Over time, a live rolling win-rate + expected-value emerges for every
tactic, entirely from the brain's own real trades.

This is not just book-keeping: the trading loop reads
``PlaybookScorer.best_active_signal`` and lowers its buy-confidence gate
when a high-EV, well-sampled pattern is firing (and raises the gate when
a well-known losing pattern is firing).  That's how the brain "learns
trading tactics" over time — not by inventing new ones from scratch, but
by discovering which of the classic ones actually work for it, right
now, on this chain.

No LLM. No inference model. Everything is deterministic Python from the
DexScreener pair snapshot + fresh-launch metadata.
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple


LOG = logging.getLogger("trading_playbook")


# ---------------------------------------------------------------------------
# Signal detectors
#
# Each detector receives:
#   pair : PairSnapshot  (backend.market.dexscreener.PairSnapshot)
#   meta : FreshLaunchMeta | None  (from TrendingTokenWatcher.fresh_launch_meta;
#          may be None if the token is not a fresh launch)
# and returns True if the pattern fires on the current market snapshot.
#
# We keep detectors *cheap and robust*: only arithmetic on already-fetched
# fields. Anything more advanced (holder distribution, dev sells, etc.)
# would need a new data source and is deliberately out of scope.
# ---------------------------------------------------------------------------


def _safe(v: Any, default: float = 0.0) -> float:
    try:
        return float(v)
    except Exception:
        return default


def _buy_pressure_h1(p) -> float:
    b = _safe(getattr(p, "txns_h1_buys", 0))
    s = _safe(getattr(p, "txns_h1_sells", 0))
    tot = b + s
    return (b / tot) if tot > 0 else 0.0


def _buy_pressure_m5(p) -> float:
    b = _safe(getattr(p, "txns_m5_buys", 0))
    s = _safe(getattr(p, "txns_m5_sells", 0))
    tot = b + s
    return (b / tot) if tot > 0 else 0.0


def _vol_over_liq(p) -> float:
    liq = _safe(getattr(p, "liquidity_usd", 0))
    v = _safe(getattr(p, "volume_h1", 0))
    return (v / liq) if liq > 0 else 0.0


def _age_hours(p) -> float:
    try:
        return float(p.age_hours)
    except Exception:
        return 0.0


# Every detector is a tiny lambda so PLAYBOOK stays readable.
def _mk_detectors() -> Dict[str, Callable[[Any, Any], bool]]:
    D: Dict[str, Callable[[Any, Any], bool]] = {}

    # --- Fresh-launch family --------------------------------------------------
    D["fresh_under_10m"] = lambda p, m: (
        (m is not None and m.age_minutes <= 10.0)
        or _age_hours(p) <= (10.0 / 60.0)
    )
    D["fresh_10_60m"] = lambda p, m: (
        10.0 < ((m.age_minutes if m else _age_hours(p) * 60.0)) <= 60.0
    )
    D["fresh_with_liq"] = lambda p, m: (
        _age_hours(p) <= 1.0 and _safe(getattr(p, "liquidity_usd", 0)) >= 20_000.0
    )
    D["fresh_with_deep_liq"] = lambda p, m: (
        _age_hours(p) <= 2.0 and _safe(getattr(p, "liquidity_usd", 0)) >= 80_000.0
    )
    D["fresh_dry_liq"] = lambda p, m: (
        _age_hours(p) <= 1.0 and _safe(getattr(p, "liquidity_usd", 0)) < 8_000.0
    )
    D["fresh_first_green_5m"] = lambda p, m: (
        _age_hours(p) <= 1.0 and _safe(getattr(p, "price_change_m5", 0)) >= 15.0
    )

    # --- Momentum family ------------------------------------------------------
    D["momo_5m_pump"] = lambda p, m: _safe(getattr(p, "price_change_m5", 0)) >= 8.0
    D["momo_1h_pump"] = lambda p, m: _safe(getattr(p, "price_change_h1", 0)) >= 25.0
    D["momo_1h_hyper_pump"] = lambda p, m: _safe(getattr(p, "price_change_h1", 0)) >= 60.0
    D["momo_24h_trend_up"] = lambda p, m: _safe(getattr(p, "price_change_h24", 0)) >= 40.0
    D["momo_5m_and_1h_align"] = lambda p, m: (
        _safe(getattr(p, "price_change_m5", 0)) >= 4.0
        and _safe(getattr(p, "price_change_h1", 0)) >= 15.0
    )
    D["momo_reversal_1h_up_24h_down"] = lambda p, m: (
        _safe(getattr(p, "price_change_h1", 0)) >= 15.0
        and _safe(getattr(p, "price_change_h24", 0)) <= -20.0
    )
    D["momo_pullback_after_run"] = lambda p, m: (
        _safe(getattr(p, "price_change_h24", 0)) >= 50.0
        and -15.0 <= _safe(getattr(p, "price_change_m5", 0)) <= -3.0
    )

    # --- Volume / activity family --------------------------------------------
    D["vol_over_liq_high"] = lambda p, m: _vol_over_liq(p) >= 1.5
    D["vol_over_liq_extreme"] = lambda p, m: _vol_over_liq(p) >= 5.0
    D["h1_txns_dense"] = lambda p, m: (
        _safe(getattr(p, "txns_h1_buys", 0)) + _safe(getattr(p, "txns_h1_sells", 0)) >= 200
    )
    D["m5_txns_dense"] = lambda p, m: (
        _safe(getattr(p, "txns_m5_buys", 0)) + _safe(getattr(p, "txns_m5_sells", 0)) >= 40
    )
    D["buy_pressure_h1_dominant"] = lambda p, m: _buy_pressure_h1(p) >= 0.62
    D["buy_pressure_m5_dominant"] = lambda p, m: _buy_pressure_m5(p) >= 0.65
    D["sell_pressure_m5_dominant"] = lambda p, m: (
        _buy_pressure_m5(p) <= 0.35
        and _safe(getattr(p, "txns_m5_buys", 0)) + _safe(getattr(p, "txns_m5_sells", 0)) >= 20
    )
    D["silent_before_break"] = lambda p, m: (
        _safe(getattr(p, "volume_m5", 0)) >= 500.0
        and _safe(getattr(p, "price_change_m5", 0)) < 2.0
        and _buy_pressure_m5(p) >= 0.60
    )

    # --- Size / structure family ---------------------------------------------
    D["micro_cap_under_50k"] = lambda p, m: 0 < _safe(getattr(p, "market_cap", 0)) < 50_000
    D["micro_cap_50k_250k"] = lambda p, m: 50_000 <= _safe(getattr(p, "market_cap", 0)) < 250_000
    D["small_cap_250k_1m"] = lambda p, m: 250_000 <= _safe(getattr(p, "market_cap", 0)) < 1_000_000
    D["mid_cap_1m_10m"] = lambda p, m: 1_000_000 <= _safe(getattr(p, "market_cap", 0)) < 10_000_000
    D["fdv_over_mcap_2x"] = lambda p, m: (
        _safe(getattr(p, "market_cap", 0)) > 0
        and _safe(getattr(p, "fdv", 0)) / _safe(getattr(p, "market_cap", 0)) >= 2.0
    )
    D["liq_over_mcap_high"] = lambda p, m: (
        _safe(getattr(p, "market_cap", 0)) > 0
        and _safe(getattr(p, "liquidity_usd", 0)) / _safe(getattr(p, "market_cap", 0)) >= 0.20
    )
    D["liq_over_mcap_thin"] = lambda p, m: (
        _safe(getattr(p, "market_cap", 0)) > 0
        and _safe(getattr(p, "liquidity_usd", 0)) / _safe(getattr(p, "market_cap", 0)) <= 0.03
    )

    # --- Warning / danger family (used to RAISE the gate, not lower it) ------
    D["warn_1h_dump"] = lambda p, m: _safe(getattr(p, "price_change_h1", 0)) <= -20.0
    D["warn_24h_dump"] = lambda p, m: _safe(getattr(p, "price_change_h24", 0)) <= -40.0
    D["warn_dead_activity"] = lambda p, m: (
        _safe(getattr(p, "volume_h1", 0)) < 500.0
        and _safe(getattr(p, "txns_h1_buys", 0)) + _safe(getattr(p, "txns_h1_sells", 0)) < 10
    )
    D["warn_liq_drained"] = lambda p, m: _safe(getattr(p, "liquidity_usd", 0)) < 3_000.0
    D["warn_fresh_and_dumping"] = lambda p, m: (
        _age_hours(p) <= 2.0
        and _safe(getattr(p, "price_change_h1", 0)) <= -15.0
    )

    # --- Chain-specific ------------------------------------------------------
    D["chain_robinhood"] = lambda p, m: getattr(p, "chain", "") == "robinhood"
    D["chain_solana"] = lambda p, m: getattr(p, "chain", "") == "solana"

    return D


DETECTORS: Dict[str, Callable[[Any, Any], bool]] = _mk_detectors()


# ---------------------------------------------------------------------------
# Playbook — knowledge seeds. Each entry is a real trading tactic the brain
# now "knows about". `detector` links to a DETECTORS key. `polarity`:
#   "bull" — firing means the setup favors going long
#   "bear" — firing is a warning sign (the brain should raise its gate)
#   "neutral" — descriptive; doesn't lean either way on its own
# `weight_hint` is used to seed the learned weight before enough live
# samples exist. It's discarded once n_samples >= WARMUP_N.
# ---------------------------------------------------------------------------


PLAYBOOK: List[Dict[str, Any]] = [
    # === Fresh launch tactics ===============================================
    {
        "id": "sniper_first_10m",
        "category": "fresh_launch",
        "detector": "fresh_under_10m",
        "polarity": "bull",
        "weight_hint": 0.15,
        "name_en": "Sniper — first 10 minutes",
        "name_zh": "狙击 · 上线 10 分钟内",
        "desc_en": (
            "Buy inside the first 10 minutes of a launch. Highest upside "
            "if the token catches, highest rug risk if it doesn't. Only "
            "worth it when combined with liquidity and buy-pressure "
            "confirmations."
        ),
        "desc_zh": (
            "在代币上线 10 分钟内进场。抓得住的话涨幅最大，抓不住基本就是"
            "被砸盘。要配合流动性与买压过滤器一起用。"
        ),
    },
    {
        "id": "early_10_60m",
        "category": "fresh_launch",
        "detector": "fresh_10_60m",
        "polarity": "bull",
        "weight_hint": 0.20,
        "name_en": "Early — 10 to 60 minutes",
        "name_zh": "早期 · 10-60 分钟",
        "desc_en": (
            "Enter after the initial minute-one chaos but before the "
            "first hour prints — you get some price signal but still ride "
            "the discovery wave."
        ),
        "desc_zh": (
            "上线 10-60 分钟之间进场：躲开开盘乱刀，又赶在被 DexScreener "
            "热榜挖出前买到。"
        ),
    },
    {
        "id": "fresh_with_liq",
        "category": "fresh_launch",
        "detector": "fresh_with_liq",
        "polarity": "bull",
        "weight_hint": 0.35,
        "name_en": "Fresh launch with ≥$20K liquidity",
        "name_zh": "新盘 · 流动性 ≥ 2 万",
        "desc_en": (
            "First hour, at least $20K of pool liquidity — enough that a "
            "small bet can enter AND exit without eating catastrophic "
            "slippage."
        ),
        "desc_zh": (
            "1 小时内的新盘，池子里至少有 2 万美金——保证小额买入之后能顺利"
            "卖出，不会被滑点吃掉。"
        ),
    },
    {
        "id": "fresh_deep_liq",
        "category": "fresh_launch",
        "detector": "fresh_with_deep_liq",
        "polarity": "bull",
        "weight_hint": 0.45,
        "name_en": "Fresh launch with deep liquidity (≥$80K)",
        "name_zh": "新盘 · 深池 (≥ 8 万)",
        "desc_en": (
            "≤2h old with ≥$80K liquidity: the launch had a real seed. "
            "Rug is possible but the room for growth is much wider."
        ),
        "desc_zh": (
            "2 小时内且池子 8 万以上：说明发射方真投了钱做流动性，成长空间"
            "大得多。"
        ),
    },
    {
        "id": "fresh_dry_liq",
        "category": "fresh_launch",
        "detector": "fresh_dry_liq",
        "polarity": "bear",
        "weight_hint": -0.35,
        "name_en": "Fresh launch with dust liquidity",
        "name_zh": "新盘 · 干池",
        "desc_en": (
            "First hour with <$8K liquidity — even winning trades can't be "
            "exited. Almost always a trap. Brain should skip these."
        ),
        "desc_zh": (
            "1 小时内、池子不到 8 千美金——就算价格涨了也卖不出来。基本都是"
            "陷阱，大脑应避开。"
        ),
    },
    {
        "id": "first_green_5m",
        "category": "fresh_launch",
        "detector": "fresh_first_green_5m",
        "polarity": "bull",
        "weight_hint": 0.25,
        "name_en": "First strong 5-min green candle on a fresh mint",
        "name_zh": "新盘 · 首根强阳线",
        "desc_en": (
            "A brand-new token prints a +15% 5-minute candle — someone "
            "just committed real buy pressure. Riskier than momentum on a "
            "mature token, but the multiplier can be huge."
        ),
        "desc_zh": (
            "新盘打出第一根 +15% 的 5 分钟阳线——有人已经开始真金白银买了。"
            "比成熟盘的动量更高风险但倍数也更大。"
        ),
    },

    # === Momentum tactics ==================================================
    {
        "id": "momo_5m",
        "category": "momentum",
        "detector": "momo_5m_pump",
        "polarity": "bull",
        "weight_hint": 0.20,
        "name_en": "5-minute momentum breakout",
        "name_zh": "5 分钟动量突破",
        "desc_en": (
            "Price up ≥8% in the last 5 minutes. Fastest way to catch a "
            "move; also the fastest way to buy the top."
        ),
        "desc_zh": (
            "过去 5 分钟涨幅 ≥ 8%。抓涨最快的信号，也是最容易被套顶的。"
        ),
    },
    {
        "id": "momo_1h",
        "category": "momentum",
        "detector": "momo_1h_pump",
        "polarity": "bull",
        "weight_hint": 0.20,
        "name_en": "1-hour trending pump",
        "name_zh": "1 小时趋势拉升",
        "desc_en": (
            "Price up ≥25% over the last hour — a sustained trend rather "
            "than a single-candle spike."
        ),
        "desc_zh": (
            "过去 1 小时涨幅 ≥ 25%——是持续趋势而非单根蜡烛的插针。"
        ),
    },
    {
        "id": "momo_1h_hyper",
        "category": "momentum",
        "detector": "momo_1h_hyper_pump",
        "polarity": "neutral",
        "weight_hint": 0.05,
        "name_en": "1-hour hyper pump (≥60%)",
        "name_zh": "1 小时暴涨 (≥60%)",
        "desc_en": (
            "≥60% in one hour. Late-stage FOMO — could double again or "
            "unwind 40% just as fast. Neutral until we see how our own "
            "trades perform on this signal."
        ),
        "desc_zh": (
            "1 小时涨 60% 以上。FOMO 后段——可能再翻倍也可能瞬间回撤 40%。"
            "先观望，用真实成绩来判定。"
        ),
    },
    {
        "id": "momo_24h",
        "category": "momentum",
        "detector": "momo_24h_trend_up",
        "polarity": "bull",
        "weight_hint": 0.10,
        "name_en": "24-hour uptrend (≥40%)",
        "name_zh": "24 小时上升趋势 (≥40%)",
        "desc_en": (
            "Sustained multi-hour trend. Lower expected slippage vs a "
            "brand-new momo, but late-cycle risk goes up."
        ),
        "desc_zh": (
            "多小时的持续趋势。相较刚拉的新盘滑点更小，但也更接近顶部。"
        ),
    },
    {
        "id": "momo_align",
        "category": "momentum",
        "detector": "momo_5m_and_1h_align",
        "polarity": "bull",
        "weight_hint": 0.30,
        "name_en": "5-min and 1-hour aligned uptrend",
        "name_zh": "5 分钟 & 1 小时共振",
        "desc_en": (
            "Both timeframes green together — noise-filtered momentum "
            "signal. Higher expected value than 5m or 1h alone."
        ),
        "desc_zh": (
            "5 分钟和 1 小时同时上涨——过滤了噪音的动量信号，比单一周期更"
            "可靠。"
        ),
    },
    {
        "id": "momo_reversal",
        "category": "momentum",
        "detector": "momo_reversal_1h_up_24h_down",
        "polarity": "neutral",
        "weight_hint": 0.05,
        "name_en": "Reversal — up 1h, down 24h",
        "name_zh": "反转 · 1h 涨 24h 跌",
        "desc_en": (
            "The token dumped hard yesterday and is now printing green "
            "1h candles. Classic dead-cat vs real-reversal ambiguity — "
            "let the live PnL tell us which."
        ),
        "desc_zh": (
            "昨日大跌，最近 1 小时反弹。到底是死猫跳还是真反转要看实盘表现。"
        ),
    },
    {
        "id": "momo_pullback",
        "category": "momentum",
        "detector": "momo_pullback_after_run",
        "polarity": "bull",
        "weight_hint": 0.15,
        "name_en": "Pullback after a big run",
        "name_zh": "大涨后的回踩",
        "desc_en": (
            "Up ≥50% on the day but currently red on 5m — potential "
            "re-entry into an established trend at a discount."
        ),
        "desc_zh": (
            "24h 涨幅 ≥50% 但 5 分钟微跌——已确立的趋势里回踩上车的机会。"
        ),
    },

    # === Volume / activity =================================================
    {
        "id": "vol_over_liq",
        "category": "activity",
        "detector": "vol_over_liq_high",
        "polarity": "bull",
        "weight_hint": 0.20,
        "name_en": "Volume / liquidity ratio ≥ 1.5",
        "name_zh": "成交额/流动性 ≥ 1.5",
        "desc_en": (
            "Hourly volume ≥ 1.5× the pool depth. Serious money is "
            "actively cycling in and out — real interest, not a dead pool."
        ),
        "desc_zh": (
            "1 小时成交额至少是流动性的 1.5 倍。资金在真金白银地进出，"
            "不是死盘。"
        ),
    },
    {
        "id": "vol_extreme",
        "category": "activity",
        "detector": "vol_over_liq_extreme",
        "polarity": "neutral",
        "weight_hint": 0.05,
        "name_en": "Extreme volume/liquidity (≥5×)",
        "name_zh": "成交额/流动性 ≥ 5x",
        "desc_en": (
            "Everyone is churning this pool. Could be a mania run-up or "
            "distribution into exit liquidity — direction has to come "
            "from other signals."
        ),
        "desc_zh": (
            "所有人在这个池子里反复交易。可能是主升浪也可能是主力出货，"
            "得配合别的信号才能决定方向。"
        ),
    },
    {
        "id": "txn_dense_1h",
        "category": "activity",
        "detector": "h1_txns_dense",
        "polarity": "bull",
        "weight_hint": 0.10,
        "name_en": "1-hour transaction density ≥ 200",
        "name_zh": "1 小时交易数 ≥ 200",
        "desc_en": (
            "Lots of participants, not just one whale spraying wallets."
        ),
        "desc_zh": (
            "参与者众多——不是一只鲸鱼在自嗨。"
        ),
    },
    {
        "id": "txn_dense_5m",
        "category": "activity",
        "detector": "m5_txns_dense",
        "polarity": "bull",
        "weight_hint": 0.15,
        "name_en": "5-minute transaction density ≥ 40",
        "name_zh": "5 分钟交易数 ≥ 40",
        "desc_en": (
            "Very active short-term flow. Often precedes a break."
        ),
        "desc_zh": (
            "短线交易极活跃——常常出现在突破之前。"
        ),
    },
    {
        "id": "buy_dominant_1h",
        "category": "activity",
        "detector": "buy_pressure_h1_dominant",
        "polarity": "bull",
        "weight_hint": 0.20,
        "name_en": "1-hour buys dominate (≥62%)",
        "name_zh": "1 小时买盘占比 ≥ 62%",
        "desc_en": (
            "Consistent net buying pressure over the last hour."
        ),
        "desc_zh": (
            "过去 1 小时买单占比明显更高，净买压持续。"
        ),
    },
    {
        "id": "buy_dominant_5m",
        "category": "activity",
        "detector": "buy_pressure_m5_dominant",
        "polarity": "bull",
        "weight_hint": 0.25,
        "name_en": "5-minute buys dominate (≥65%)",
        "name_zh": "5 分钟买盘占比 ≥ 65%",
        "desc_en": (
            "The last 5 minutes are lopsided toward buys — often the "
            "trigger for a fast run."
        ),
        "desc_zh": (
            "最近 5 分钟买盘一面倒——通常是快速拉升的启动信号。"
        ),
    },
    {
        "id": "sell_dominant_5m",
        "category": "activity",
        "detector": "sell_pressure_m5_dominant",
        "polarity": "bear",
        "weight_hint": -0.25,
        "name_en": "5-minute sells dominate",
        "name_zh": "5 分钟卖盘占比高",
        "desc_en": (
            "≤35% buys, ≥20 total txns. Distribution in progress — brain "
            "should hesitate to buy in."
        ),
        "desc_zh": (
            "买单占比 ≤35%，且总交易数 ≥20。正在出货，大脑应犹豫。"
        ),
    },
    {
        "id": "coiled_spring",
        "category": "activity",
        "detector": "silent_before_break",
        "polarity": "bull",
        "weight_hint": 0.15,
        "name_en": "Coiled spring — quiet with buy bias",
        "name_zh": "蓄势 · 缩量买压",
        "desc_en": (
            "Real volume is coming in but price is barely moving and "
            "buys dominate — a classic setup for a sudden break."
        ),
        "desc_zh": (
            "有真实成交量进来但价格没怎么动、买盘占优——典型的突破前蓄势。"
        ),
    },

    # === Size / structure ==================================================
    {
        "id": "cap_micro",
        "category": "structure",
        "detector": "micro_cap_under_50k",
        "polarity": "neutral",
        "weight_hint": 0.10,
        "name_en": "Micro cap (< $50K)",
        "name_zh": "微盘 (< 5 万)",
        "desc_en": (
            "Ultra-early — biggest possible multiples, biggest possible "
            "loss. Best combined with fresh-launch + liq filters."
        ),
        "desc_zh": (
            "极早期——倍数与风险都最大。要和新盘 + 流动性过滤器一起用。"
        ),
    },
    {
        "id": "cap_50_250k",
        "category": "structure",
        "detector": "micro_cap_50k_250k",
        "polarity": "bull",
        "weight_hint": 0.15,
        "name_en": "Micro cap $50K–$250K",
        "name_zh": "微盘 5-25 万",
        "desc_en": (
            "Post-launch sweet spot on hype-driven chains — small enough "
            "to 10×, large enough to have a real chart."
        ),
        "desc_zh": (
            "上线后的甜点区间——够小能翻十倍，够大有真实走势可看。"
        ),
    },
    {
        "id": "cap_250k_1m",
        "category": "structure",
        "detector": "small_cap_250k_1m",
        "polarity": "bull",
        "weight_hint": 0.10,
        "name_en": "Small cap $250K–$1M",
        "name_zh": "小盘 25-100 万",
        "desc_en": (
            "Enough attention to sustain a trend, still room to 3–5×."
        ),
        "desc_zh": (
            "关注度足以维持趋势，还有 3-5 倍空间。"
        ),
    },
    {
        "id": "cap_mid",
        "category": "structure",
        "detector": "mid_cap_1m_10m",
        "polarity": "neutral",
        "weight_hint": 0.0,
        "name_en": "Mid cap $1M–$10M",
        "name_zh": "中盘 100-1000 万",
        "desc_en": (
            "Explosive upside is smaller here, but so is the tail risk."
        ),
        "desc_zh": (
            "上行空间没那么爆炸，尾部风险也小。"
        ),
    },
    {
        "id": "fdv_over_mcap",
        "category": "structure",
        "detector": "fdv_over_mcap_2x",
        "polarity": "bear",
        "weight_hint": -0.15,
        "name_en": "FDV ≥ 2× market cap (unlock overhang)",
        "name_zh": "FDV ≥ 2× 市值（解锁悬顶）",
        "desc_en": (
            "Big supply still locked. Every rally attracts insider "
            "distribution."
        ),
        "desc_zh": (
            "大量供应仍锁定，每次拉盘都会招来内部人出货。"
        ),
    },
    {
        "id": "liq_healthy",
        "category": "structure",
        "detector": "liq_over_mcap_high",
        "polarity": "bull",
        "weight_hint": 0.15,
        "name_en": "Liquidity ≥ 20% of market cap",
        "name_zh": "流动性 ≥ 市值 20%",
        "desc_en": (
            "A healthy pool relative to the float — exits stay clean, "
            "wicks stay small."
        ),
        "desc_zh": (
            "池子相对市值健康——卖出干净，插针也小。"
        ),
    },
    {
        "id": "liq_thin",
        "category": "structure",
        "detector": "liq_over_mcap_thin",
        "polarity": "bear",
        "weight_hint": -0.20,
        "name_en": "Liquidity ≤ 3% of market cap (paper depth)",
        "name_zh": "流动性 ≤ 市值 3%（纸面深度）",
        "desc_en": (
            "The chart looks like a big cap, but there's almost no real "
            "liquidity to exit into. One whale sell = -50%."
        ),
        "desc_zh": (
            "行情图看起来是大盘，实则毫无深度。一只鲸鱼卖出 = 直接 -50%。"
        ),
    },

    # === Warning signals ===================================================
    {
        "id": "warn_1h_dump",
        "category": "warning",
        "detector": "warn_1h_dump",
        "polarity": "bear",
        "weight_hint": -0.25,
        "name_en": "1-hour dump (≤ -20%)",
        "name_zh": "1 小时下跌 ≤ -20%",
        "desc_en": (
            "Active distribution. Do not buy without a clear reversal "
            "signal."
        ),
        "desc_zh": (
            "正在出货。没有明确反转信号之前不要接。"
        ),
    },
    {
        "id": "warn_24h_dump",
        "category": "warning",
        "detector": "warn_24h_dump",
        "polarity": "bear",
        "weight_hint": -0.20,
        "name_en": "24-hour dump (≤ -40%)",
        "name_zh": "24 小时下跌 ≤ -40%",
        "desc_en": (
            "Multi-hour bleeding — usually rugs, insider unlocks, or "
            "narrative death. Very hard to trade long."
        ),
        "desc_zh": (
            "多小时的持续下跌——通常是 rug、内部解锁或叙事破灭。做多极难。"
        ),
    },
    {
        "id": "warn_dead",
        "category": "warning",
        "detector": "warn_dead_activity",
        "polarity": "bear",
        "weight_hint": -0.30,
        "name_en": "Dead activity",
        "name_zh": "无人交易",
        "desc_en": (
            "Hourly volume <$500 and <10 txns — token is dead, exit "
            "liquidity is you."
        ),
        "desc_zh": (
            "1 小时成交额不到 500 美金、交易数少于 10——币已经死了，你就是"
            "接盘侠。"
        ),
    },
    {
        "id": "warn_liq_drained",
        "category": "warning",
        "detector": "warn_liq_drained",
        "polarity": "bear",
        "weight_hint": -0.50,
        "name_en": "Liquidity drained (< $3K)",
        "name_zh": "流动性被抽干 (< 3 千)",
        "desc_en": (
            "Rug indicator. Ignore no matter how green the candle is."
        ),
        "desc_zh": (
            "跑路信号。不管蜡烛多绿都别买。"
        ),
    },
    {
        "id": "warn_fresh_dumping",
        "category": "warning",
        "detector": "warn_fresh_and_dumping",
        "polarity": "bear",
        "weight_hint": -0.35,
        "name_en": "Fresh launch already dumping",
        "name_zh": "新盘已在下跌",
        "desc_en": (
            "≤2h old and already -15% on 1h — usually the dev / snipers "
            "already exited. Skip."
        ),
        "desc_zh": (
            "2 小时内的新盘 1 小时已跌 15%——通常是发射方/早期狙击手已经跑了。"
        ),
    },

    # === Chain-specific (used mostly for stats separation) =================
    {
        "id": "chain_robinhood",
        "category": "chain",
        "detector": "chain_robinhood",
        "polarity": "neutral",
        "weight_hint": 0.0,
        "name_en": "Robinhood chain",
        "name_zh": "Robinhood 链",
        "desc_en": "Trade happens on Robinhood Chain (Arbitrum Orbit L2, ETH gas).",
        "desc_zh": "在 Robinhood 链上的交易（Arbitrum Orbit L2，ETH 支付 gas）。",
    },
    {
        "id": "chain_solana",
        "category": "chain",
        "detector": "chain_solana",
        "polarity": "neutral",
        "weight_hint": 0.0,
        "name_en": "Solana chain",
        "name_zh": "Solana 链",
        "desc_en": "Trade happens on Solana.",
        "desc_zh": "在 Solana 链上的交易。",
    },
]


PLAYBOOK_BY_ID: Dict[str, Dict[str, Any]] = {p["id"]: p for p in PLAYBOOK}


# ---------------------------------------------------------------------------
# Runtime — signal detection + scoring
# ---------------------------------------------------------------------------


def detect_signals(pair: Any, meta: Any = None) -> Dict[str, bool]:
    """Compute which playbook patterns fire on the current market snapshot.

    Returns a dict {pattern_id: True} — only firing patterns are included
    (keeps the payload small when serialized).
    """
    out: Dict[str, bool] = {}
    for entry in PLAYBOOK:
        det = DETECTORS.get(entry["detector"])
        if det is None:
            continue
        try:
            if det(pair, meta):
                out[entry["id"]] = True
        except Exception:  # noqa: BLE001
            continue
    return out


@dataclass
class _PatternStats:
    n_samples: int = 0
    n_wins: int = 0
    sum_pnl_pct: float = 0.0
    sum_sq_pnl_pct: float = 0.0
    last_updated_at_s: float = 0.0

    def record(self, pnl_pct: float) -> None:
        self.n_samples += 1
        if pnl_pct > 0:
            self.n_wins += 1
        self.sum_pnl_pct += float(pnl_pct)
        self.sum_sq_pnl_pct += float(pnl_pct) * float(pnl_pct)
        self.last_updated_at_s = time.time()

    @property
    def win_rate(self) -> float:
        return (self.n_wins / self.n_samples) if self.n_samples else 0.0

    @property
    def mean_pnl_pct(self) -> float:
        return (self.sum_pnl_pct / self.n_samples) if self.n_samples else 0.0

    @property
    def std_pnl_pct(self) -> float:
        if self.n_samples < 2:
            return 0.0
        mean = self.mean_pnl_pct
        var = max(0.0, self.sum_sq_pnl_pct / self.n_samples - mean * mean)
        return var ** 0.5


# When a pattern has fewer than WARMUP_N live samples, blend its live EV
# with the seeded `weight_hint` from the playbook — so the brain has an
# opinion on day 0 rather than treating every pattern identically.
WARMUP_N = 8


class PlaybookScorer:
    """Rolling per-pattern win-rate + EV, persisted to disk as JSON.

    Design goals:
      * Cheap: no torch, no numpy — dict of ints + floats.
      * Attributable: each opened position remembers which patterns were
        firing at entry so we can credit / debit them on close.
      * Reactive: exposes `best_active_signal(...)` so the trading loop
        can adjust its buy gate in real time.
    """

    def __init__(self, path: Optional[str] = None):
        if path is None:
            data_dir = os.environ.get("DATA_DIR", "./data")
            path = os.path.join(data_dir, "playbook.json")
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self.stats: Dict[str, _PatternStats] = {p["id"]: _PatternStats() for p in PLAYBOOK}
        # Attribution: token_mint (lowercased) -> list of pattern ids firing at entry.
        self.attributions: Dict[str, List[str]] = {}
        self._load()

    # ---- persistence -----------------------------------------------------

    def _load(self) -> None:
        try:
            if not self.path.exists():
                return
            with self.path.open("r", encoding="utf-8") as f:
                d = json.load(f)
            for pid, sd in (d.get("stats") or {}).items():
                if pid in self.stats:
                    st = self.stats[pid]
                    st.n_samples = int(sd.get("n_samples", 0))
                    st.n_wins = int(sd.get("n_wins", 0))
                    st.sum_pnl_pct = float(sd.get("sum_pnl_pct", 0.0))
                    st.sum_sq_pnl_pct = float(sd.get("sum_sq_pnl_pct", 0.0))
                    st.last_updated_at_s = float(sd.get("last_updated_at_s", 0.0))
            self.attributions = {
                k: list(v) for k, v in (d.get("attributions") or {}).items()
                if isinstance(v, list)
            }
        except Exception as e:  # noqa: BLE001
            LOG.warning("playbook load failed (%s) — starting fresh", e)

    def _save(self) -> None:
        try:
            payload = {
                "saved_at": time.time(),
                "stats": {pid: asdict(st) for pid, st in self.stats.items()},
                "attributions": self.attributions,
            }
            tmp = self.path.with_suffix(".json.tmp")
            with tmp.open("w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2, ensure_ascii=False)
            os.replace(tmp, self.path)
        except Exception as e:  # noqa: BLE001
            LOG.warning("playbook save failed: %s", e)

    # ---- attribution -----------------------------------------------------

    def record_entry(self, token_mint: str, firing: Dict[str, bool]) -> List[str]:
        """Remember which patterns were live when we opened this position."""
        if not token_mint:
            return []
        ids = [pid for pid, on in firing.items() if on and pid in self.stats]
        with self._lock:
            self.attributions[token_mint.lower()] = ids
            self._save()
        return ids

    def record_close(self, token_mint: str, pnl_pct: float) -> List[str]:
        """Credit / debit each attributed pattern with the realized PnL.

        `pnl_pct` is a fraction (e.g. +0.35 for +35%), matching
        ClosedTrade.pnl_pct semantics.
        """
        if not token_mint:
            return []
        key = token_mint.lower()
        with self._lock:
            ids = self.attributions.pop(key, [])
            for pid in ids:
                st = self.stats.get(pid)
                if st is None:
                    continue
                st.record(pnl_pct)
            self._save()
        return ids

    # ---- decision-time queries ------------------------------------------

    def ev_for(self, pattern_id: str) -> float:
        """Blended EV (mean pnl pct) for one pattern.

        For patterns with fewer than WARMUP_N samples, we blend live EV
        with the playbook's `weight_hint` so the brain has a Day-0
        opinion instead of a 0.0 flatline.
        """
        st = self.stats.get(pattern_id)
        if st is None:
            return 0.0
        pb = PLAYBOOK_BY_ID.get(pattern_id) or {}
        hint = float(pb.get("weight_hint", 0.0))
        if st.n_samples >= WARMUP_N:
            return st.mean_pnl_pct
        # Weighted blend: hint dominates at n=0, live EV dominates at WARMUP_N.
        w_live = st.n_samples / max(1, WARMUP_N)
        return w_live * st.mean_pnl_pct + (1.0 - w_live) * hint

    def best_active_signal(
        self,
        firing: Dict[str, bool],
        *,
        polarity: str = "bull",
    ) -> Optional[Tuple[str, float, int]]:
        """Return (pattern_id, ev, n_samples) for the strongest firing pattern
        of the requested polarity, or None if nothing qualifies.
        """
        best: Optional[Tuple[str, float, int]] = None
        for pid, on in firing.items():
            if not on:
                continue
            pb = PLAYBOOK_BY_ID.get(pid)
            if pb is None or pb.get("polarity") != polarity:
                continue
            ev = self.ev_for(pid)
            n = self.stats[pid].n_samples
            if best is None:
                best = (pid, ev, n)
                continue
            # For bull: pick the highest EV. For bear: pick the most negative.
            better = (ev > best[1]) if polarity == "bull" else (ev < best[1])
            if better:
                best = (pid, ev, n)
        return best

    def gate_adjustment(self, firing: Dict[str, bool]) -> Tuple[float, Dict[str, Any]]:
        """Compute how much to shift the buy-confidence gate based on the
        currently firing playbook patterns.

        Returns (delta, info):
          * delta is added to the base gate. Negative → easier to buy
            (we trust this setup). Positive → harder to buy (danger).
          * info is a small debug dict the caller can log so the user
            sees WHY the gate moved.

        Bounded to [-0.15, +0.25]: never let a single pattern completely
        override the brain's own head.
        """
        best_bull = self.best_active_signal(firing, polarity="bull")
        best_bear = self.best_active_signal(firing, polarity="bear")

        delta = 0.0
        info: Dict[str, Any] = {}
        if best_bull is not None:
            pid, ev, n = best_bull
            # Positive EV lowers the gate up to -0.15.
            delta -= max(0.0, min(0.15, ev * 0.5))
            info["bull"] = {"id": pid, "ev": round(ev, 4), "n": n}
        if best_bear is not None:
            pid, ev, n = best_bear
            # Negative EV raises the gate up to +0.25.
            delta += max(0.0, min(0.25, -ev * 0.6))
            info["bear"] = {"id": pid, "ev": round(ev, 4), "n": n}

        delta = max(-0.15, min(0.25, delta))
        info["delta"] = round(delta, 4)
        return delta, info

    # ---- snapshot for the UI --------------------------------------------

    def snapshot(self, top_n: int = 6) -> Dict[str, Any]:
        """Return a UI-friendly view of the playbook: top-EV bull tactics,
        top-EV bear warnings, and overall aggregate."""
        rows: List[Dict[str, Any]] = []
        for pb in PLAYBOOK:
            st = self.stats[pb["id"]]
            rows.append({
                "id": pb["id"],
                "category": pb["category"],
                "name_en": pb["name_en"],
                "name_zh": pb["name_zh"],
                "desc_en": pb["desc_en"],
                "desc_zh": pb["desc_zh"],
                "polarity": pb["polarity"],
                "n_samples": st.n_samples,
                "n_wins": st.n_wins,
                "win_rate": round(st.win_rate, 3),
                "mean_pnl_pct": round(st.mean_pnl_pct, 4),
                "std_pnl_pct": round(st.std_pnl_pct, 4),
                "live_ev": round(self.ev_for(pb["id"]), 4),
                "weight_hint": pb["weight_hint"],
                "last_updated_at_s": st.last_updated_at_s,
            })
        bull = sorted(
            [r for r in rows if r["polarity"] == "bull"],
            key=lambda r: (r["live_ev"], r["n_samples"]),
            reverse=True,
        )[:top_n]
        bear = sorted(
            [r for r in rows if r["polarity"] == "bear"],
            key=lambda r: (r["live_ev"], -r["n_samples"]),
        )[:top_n]
        total_samples = sum(r["n_samples"] for r in rows)
        realized_pnl = sum(r["mean_pnl_pct"] * r["n_samples"] for r in rows)
        return {
            "n_patterns": len(rows),
            "n_total_attributions": total_samples,
            "cumulative_pnl_pct": round(realized_pnl, 4),
            "top_bull": bull,
            "top_bear": bear,
            "all": rows,
        }

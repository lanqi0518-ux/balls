"""Prior knowledge injected into the digital brain.

This module gives the brain a set of *semantic priors* — 60+ concepts about
cryptocurrency (major coins, meme coins, DeFi mechanics, culture) and about
Einstein (physics, math, life) — each mapped to a deterministic 32-d vector.

At start-up these are stored in the hippocampus as permanent "knowledge
memories" (never evicted). During thinking, whenever the current internal
state looks even faintly like one of these vectors, the brain *associates
to it* and the concept surfaces in the thought stream.

Honest caveat: these are semantic *seeds*, not real understanding. The
brain does not read Bitcoin whitepapers or derive E=mc^2. It just carries
these vectors around as a warm-start memory bank so its associations feel
richer than an empty grid-world agent would.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, asdict
from typing import Iterable, List, Tuple

import torch


DEFAULT_DIM = 32


CATEGORIES: dict = {
    "crypto_core": {
        "zh": "主流加密货币",
        "en": "Major cryptocurrencies",
        "color": "#f7931a",
    },
    "meme_coin": {
        "zh": "Meme 币",
        "en": "Meme coins",
        "color": "#ff6ec7",
    },
    "crypto_tech": {
        "zh": "加密技术 / DeFi",
        "en": "Crypto tech / DeFi",
        "color": "#22d3ee",
    },
    "crypto_culture": {
        "zh": "加密文化 / 黑话",
        "en": "Crypto culture / slang",
        "color": "#a78bfa",
    },
    # (These three categories were seeded from a well-known 20th-century
    # theoretical physicist's canon.  The internal ids are kept so the
    # persisted knowledge bank stays stable across restarts, but the
    # display labels are neutralized so the brand doesn't advertise its
    # source persona.)
    "einstein_physics": {
        "zh": "理论物理",
        "en": "Theoretical Physics",
        "color": "#facc15",
    },
    "einstein_math": {
        "zh": "数学基础",
        "en": "Mathematical Foundations",
        "color": "#fb923c",
    },
    "einstein_life": {
        "zh": "科学史与思想",
        "en": "Scientific History & Thought",
        "color": "#a3e635",
    },
    # Categories the brain grows into at runtime as it encounters new
    # tokens / patterns / launchpads it has never seen before. These are
    # persisted to disk (unlike the seed concepts above, which are
    # deterministically regenerated at boot).
    "learned_token": {
        "zh": "自学 · 新代币",
        "en": "Learned · Fresh tokens",
        "color": "#6EE7FF",
    },
    "learned_pattern": {
        "zh": "自学 · 市场模式",
        "en": "Learned · Market patterns",
        "color": "#F0ABFC",
    },
    "learned_event": {
        "zh": "自学 · 事件",
        "en": "Learned · Events",
        "color": "#FDE68A",
    },
    # The brain reads the live web (news headlines + social posts) and
    # files what it reads here. This is how it "grows" while not trading.
    "learned_topic": {
        "zh": "自学 · 新闻话题",
        "en": "Learned · News topics",
        "color": "#7DD3FC",
    },
    "learned_voice": {
        "zh": "自学 · 社交观点",
        "en": "Learned · Social chatter",
        "color": "#C4B5FD",
    },
}


@dataclass
class Concept:
    id: str
    category: str
    zh: str
    en: str
    desc_zh: str
    desc_en: str


CONCEPTS: List[Concept] = [
    # ---------------- crypto_core (10) ----------------
    Concept("btc", "crypto_core", "比特币", "Bitcoin",
            "2009 年上线的第一种成功的去中心化加密货币，供应硬顶 2100 万枚，四年一次减半。",
            "The first successful decentralized cryptocurrency, launched in 2009; hard-capped at 21M coins, with a halving every ~4 years."),
    Concept("eth", "crypto_core", "以太坊", "Ethereum",
            "带图灵完备虚拟机的智能合约平台，DeFi、NFT、L2 生态的底层。",
            "Smart-contract platform with a Turing-complete VM; substrate for most DeFi, NFTs, and L2s."),
    Concept("sol", "crypto_core", "Solana", "Solana",
            "高吞吐单分片公链，凭低费用与快出块承载了大量 meme 币与消费类应用。",
            "High-throughput monolithic L1; low fees and fast blocks host most of the meme-coin and consumer-app volume."),
    Concept("bnb", "crypto_core", "币安币", "BNB",
            "Binance 与 BNB Chain 生态的原生资产，用于交易手续费与链上 gas。",
            "Native asset of the Binance / BNB Chain ecosystem, used for trading fees and on-chain gas."),
    Concept("xrp", "crypto_core", "瑞波币", "XRP",
            "Ripple 网络的原生代币，主打跨境支付清算，2020 年遭 SEC 起诉，2023 年部分胜诉。",
            "Native token of the Ripple network; targets cross-border settlement; sued by the SEC in 2020, partially won in 2023."),
    Concept("ada", "crypto_core", "卡尔达诺", "Cardano",
            "以学术同行评审驱动开发的 PoS 公链，节奏慢但严谨。",
            "PoS L1 developed via academic peer review; slow but formal."),
    Concept("ton", "crypto_core", "TON", "The Open Network",
            "由 Telegram 团队孵化的高性能 L1，与 Telegram 深度集成，靠社交流量分发。",
            "High-perf L1 incubated by the Telegram team; distributed via deep Telegram integration."),
    Concept("trx", "crypto_core", "波场", "Tron",
            "以稳定币结算量出名的高吞吐链，USDT 的主要承载网络之一。",
            "High-throughput chain best known for stablecoin settlement volume; a primary rail for USDT."),
    Concept("ltc", "crypto_core", "莱特币", "Litecoin",
            "比特币的早期分叉，出块更快、手续费更低，长期被视为'数字白银'。",
            "Early Bitcoin fork with faster blocks and lower fees; long framed as 'digital silver'."),
    Concept("usdt", "crypto_core", "泰达币", "Tether (USDT)",
            "市值最大的美元稳定币，链上美元流动性的骨干，储备构成长期受争议。",
            "The largest USD stablecoin and the backbone of on-chain dollar liquidity; reserve composition long disputed."),

    # ---------------- meme_coin (10) ----------------
    Concept("doge", "meme_coin", "狗狗币", "Dogecoin",
            "2013 年基于莱特币分叉、以柴犬 meme 起家，被马斯克反复带火，是所有 meme 币的鼻祖。",
            "Forked from Litecoin in 2013 around a Shiba Inu meme; repeatedly boosted by Elon Musk; the archetype of every later meme coin."),
    Concept("shib", "meme_coin", "柴犬币", "Shiba Inu",
            "ERC-20 上的柴犬 meme 币，2021 年爆发，以'Dogecoin killer'自我营销。",
            "A Shiba Inu meme coin on ERC-20 that exploded in 2021, marketed as a 'Dogecoin killer'."),
    Concept("pepe", "meme_coin", "PEPE", "Pepe",
            "以青蛙 Pepe meme 为主题的 ERC-20 币，2023 年上线数周内做到十亿美元市值。",
            "ERC-20 meme coin themed on the Pepe frog; hit a billion-dollar market cap within weeks of its 2023 launch."),
    Concept("wif", "meme_coin", "dogwifhat", "dogwifhat (WIF)",
            "戴着毛线帽的柴犬 meme 币，Solana 上 2024 年 meme 季的旗舰之一。",
            "A Shiba-in-a-beanie meme coin on Solana; one of the flagships of the 2024 Solana meme season."),
    Concept("bonk", "meme_coin", "BONK", "Bonk",
            "Solana 生态早期的社区 meme 币，通过大规模空投重启 Solana meme 热潮。",
            "An early community meme coin on Solana whose massive airdrop reignited Solana meme mania."),
    Concept("floki", "meme_coin", "FLOKI", "Floki",
            "得名于马斯克宠物的柴犬 meme 币，营销激进，多次冲进 CEX 前列。",
            "A Shiba Inu meme coin named after Musk's pet; aggressive marketing pushed it repeatedly onto major CEX front pages."),
    Concept("popcat", "meme_coin", "POPCAT", "Popcat",
            "以张嘴/闭嘴猫 meme 为主题的 Solana meme 币，2024 年从零涨到十亿美金以上。",
            "Solana meme coin themed on the open/closed mouth cat meme; ran from ~0 to $1B+ in 2024."),
    Concept("mog", "meme_coin", "MOG", "Mog Coin",
            "以'mog'（一种互联网俚语，意为压制/碾压）为主题的 ERC-20 meme 币，社区叙事重于产品。",
            "An ERC-20 meme coin themed on 'mog' (internet slang for dominating); narrative over product."),
    Concept("trump", "meme_coin", "TRUMP", "Official Trump",
            "2025 年 1 月特朗普就职前后上线的官方 meme 币，短时间内造出数百亿美元 FDV。",
            "The official Trump meme coin launched around the January 2025 inauguration; briefly minted tens of billions in FDV."),
    Concept("fartcoin", "meme_coin", "FARTCOIN", "Fartcoin",
            "由 AI agent 半自动运营的 Solana meme 币，象征 2024 年'AI-agent meme'子叙事。",
            "A Solana meme coin semi-operated by AI agents; symbol of the 2024 'AI-agent meme' subnarrative."),

    # ---------------- crypto_tech (12) ----------------
    Concept("pow", "crypto_tech", "工作量证明 (PoW)", "Proof of Work",
            "靠矿工消耗算力争夺出块权的共识机制，是比特币的基础。",
            "Consensus by miners burning computation to win the right to produce blocks; the basis of Bitcoin."),
    Concept("pos", "crypto_tech", "权益证明 (PoS)", "Proof of Stake",
            "靠质押资产而非算力选择出块者的共识机制，以太坊 2022 年切换到 PoS。",
            "Consensus that selects proposers by staked capital instead of hashpower; Ethereum switched to PoS in 2022."),
    Concept("halving", "crypto_tech", "减半", "Halving",
            "比特币每约 21 万个区块把出块奖励砍半的机制，历史上是牛市的重要触发。",
            "Bitcoin's mechanism of cutting block rewards in half every ~210k blocks; historically a bull-market trigger."),
    Concept("gas", "crypto_tech", "Gas 费", "Gas fee",
            "在以太坊等公链上执行任何操作需要付给验证者的手续费，随链上拥堵浮动。",
            "The fee paid to validators for executing any operation on chains like Ethereum; floats with congestion."),
    Concept("wallet", "crypto_tech", "钱包", "Wallet",
            "管理私钥、签名交易的软件或硬件；'not your keys, not your coins'。",
            "Software or hardware that manages private keys and signs transactions; 'not your keys, not your coins'."),
    Concept("seed", "crypto_tech", "助记词", "Seed phrase",
            "12/24 个英文单词的钱包备份种子，掌握它就等于掌握账户，泄露即归零。",
            "12 or 24 English words that back up a wallet; whoever has them owns the account, and leaking them zeroes it."),
    Concept("cold_wallet", "crypto_tech", "冷钱包", "Cold wallet",
            "永远离线的硬件/纸钱包，是长期存币最安全的做法。",
            "A permanently offline hardware or paper wallet; the safest way to hold coins long-term."),
    Concept("dex", "crypto_tech", "去中心化交易所 (DEX)", "DEX",
            "靠智能合约撮合的交易所，无需托管资产，Uniswap 是代表。",
            "An exchange settled by smart contracts with no custody; Uniswap is the canonical example."),
    Concept("lp", "crypto_tech", "流动性池 (LP)", "Liquidity pool",
            "两种资产按公式共存的池子，交易即改变比例；LP 提供者赚手续费，但承担无常损失。",
            "A pool of two assets bound by a formula; each trade shifts the ratio, and LPs earn fees but eat impermanent loss."),
    Concept("nft", "crypto_tech", "NFT", "NFT",
            "非同质化代币，链上一件独一无二的可转让物品，通常挂在 IPFS 或链下。",
            "Non-fungible token: a unique, transferable on-chain item, usually pointing at IPFS or off-chain media."),
    Concept("airdrop", "crypto_tech", "空投", "Airdrop",
            "项目方按行为快照免费发放代币，是链上最常见的用户拉新手段。",
            "Free token distributions to on-chain users based on a behavior snapshot; the dominant on-chain user acquisition tactic."),
    Concept("rugpull", "crypto_tech", "跑路 / Rug pull", "Rug pull",
            "项目方带着流动性一次性走人的骗局，meme 币里最常见的死法。",
            "A scam where the team drains liquidity and disappears; the most common death for meme coins."),

    # ---------------- crypto_culture (8) ----------------
    Concept("satoshi", "crypto_culture", "中本聪", "Satoshi Nakamoto",
            "比特币的匿名创造者，2011 年后彻底消失，从未动过创世块附近的百万枚 BTC。",
            "The anonymous creator of Bitcoin; disappeared after 2011 and has never touched the ~1M BTC mined near genesis."),
    Concept("wagmi", "crypto_culture", "WAGMI", "WAGMI",
            "'we're all gonna make it' — 加密社区的口头禅，涨的时候用来互相打气。",
            "'We're all gonna make it' — crypto community shorthand for mutual bull-market encouragement."),
    Concept("gm", "crypto_culture", "GM", "GM",
            "'good morning' — 加密 Twitter/Discord 上的日常问候和身份信号。",
            "'Good morning' — the default daily greeting and tribal signal on crypto Twitter and Discord."),
    Concept("hodl", "crypto_culture", "HODL", "HODL",
            "2013 年一个论坛帖打错字流传下来的 meme，意思是'死拿不卖'。",
            "A meme born from a 2013 forum typo; means 'hold, never sell'."),
    Concept("moon", "crypto_culture", "到月球 (to the moon)", "To the moon",
            "价格暴涨的许愿词，通常跟着一个火箭 emoji。",
            "The wishful phrase for a parabolic price move, usually paired with a rocket emoji."),
    Concept("diamond_hands", "crypto_culture", "钻石手", "Diamond hands",
            "跌得再狠也不卖的信徒；对立是'纸手'（paper hands），一跌就跑。",
            "Believers who won't sell no matter how deep the drawdown; the opposite of 'paper hands' who sell on any dip."),
    Concept("fomo", "crypto_culture", "FOMO", "FOMO",
            "怕错过 (fear of missing out) — 追涨的心理驱动，通常是散户接盘顶部的原因。",
            "Fear of missing out — the psychological driver of chasing pumps and, usually, of retail buying the top."),
    Concept("shill", "crypto_culture", "喊单 (shill)", "Shill",
            "有偿或无偿地公开吹捧一个币或项目，是 meme 币生态的主要传播方式。",
            "Publicly hyping a coin or project, paid or unpaid; the primary distribution channel of meme coins."),

    # ---------------- einstein_physics (10) ----------------
    Concept("special_relativity", "einstein_physics", "狭义相对论", "Special relativity",
            "1905 年论文，指出光速在所有惯性系中恒定，时间和空间因此可以相对拉伸。",
            "1905 paper: the speed of light is constant in every inertial frame, so time and space can stretch relatively."),
    Concept("general_relativity", "einstein_physics", "广义相对论", "General relativity",
            "1915 年发表，把引力解释成时空曲率，被水星近日点进动与光线偏折证实。",
            "Published in 1915: gravity is the curvature of spacetime; confirmed by Mercury's perihelion precession and light bending."),
    Concept("e_mc2", "einstein_physics", "E = mc²", "E = mc²",
            "质能等价：一小块质量对应巨大能量，是核能与恒星发光的底层账。",
            "Mass–energy equivalence: a tiny piece of mass corresponds to enormous energy — the accounting behind nuclear power and starlight."),
    Concept("light_speed", "einstein_physics", "光速 c", "Speed of light (c)",
            "宇宙的绝对速度上限，约 299,792,458 m/s，任何有质量的物体都无法达到。",
            "The universe's absolute speed cap: ~299,792,458 m/s; nothing with rest mass can reach it."),
    Concept("spacetime", "einstein_physics", "时空", "Spacetime",
            "闵可夫斯基把时间当作第四维与空间统一，是相对论的舞台。",
            "Minkowski unified time as a fourth dimension with space; the stage on which relativity plays out."),
    Concept("gravity_waves", "einstein_physics", "引力波", "Gravitational waves",
            "广义相对论预言的时空涟漪，LIGO 于 2015 年首次直接探测到。",
            "Ripples in spacetime predicted by general relativity; first directly detected by LIGO in 2015."),
    Concept("photoelectric", "einstein_physics", "光电效应", "Photoelectric effect",
            "1905 年论文，把光解释为光量子（光子），据此拿到 1921 年诺贝尔物理学奖。",
            "1905 paper explaining light as quanta (photons); this — not relativity — earned him the 1921 Nobel Prize in Physics."),
    Concept("photon", "einstein_physics", "光子", "Photon",
            "光的量子化粒子，既是波又是粒子；这一步为量子力学开路。",
            "The quantized particle of light; both wave and particle. This step opened the road to quantum mechanics."),
    Concept("black_hole", "einstein_physics", "黑洞", "Black hole",
            "广义相对论方程的极端解：时空曲率大到光都逃不出的区域。",
            "An extremal solution of the general-relativity equations: a region where spacetime curves so hard even light cannot escape."),
    Concept("cosmological_constant", "einstein_physics", "宇宙常数 Λ", "Cosmological constant",
            "为稳态宇宙加进的项，一度被称为'一生最大的错误'——但暗能量让它复活。",
            "A term originally added for a static universe; long called 'the biggest blunder of the century' — until dark energy resurrected it."),

    # ---------------- einstein_math (5) ----------------
    Concept("tensor", "einstein_math", "张量", "Tensor",
            "广义相对论的语言：把向量和矩阵推广到任意维，让方程在任何坐标系下都成立。",
            "The language of general relativity: generalizes vectors and matrices to arbitrary rank so the equations hold in any frame."),
    Concept("lorentz", "einstein_math", "洛伦兹变换", "Lorentz transformation",
            "狭义相对论中不同惯性观察者之间坐标的正确变换，替代了伽利略变换。",
            "The correct coordinate transform between inertial observers in special relativity; replaces the Galilean one."),
    Concept("field_eq", "einstein_math", "场方程", "Field equations",
            "Gμν + Λ gμν = 8πG/c⁴ · Tμν —— 十个非线性偏微分方程，规定物质与时空曲率如何互相塑造。",
            "Gμν + Λ gμν = 8πG/c⁴ · Tμν — ten coupled nonlinear PDEs prescribing how matter and spacetime curvature shape each other."),
    Concept("riemann", "einstein_math", "黎曼几何", "Riemannian geometry",
            "描述弯曲空间的几何学，由黎曼建立，是广义相对论的数学骨架。",
            "Geometry of curved spaces, developed by Riemann; the mathematical skeleton of general relativity."),
    Concept("thought_experiment", "einstein_math", "思想实验", "Thought experiment",
            "在脑子里跑一个理想化的物理场景，靠一致性倒推物理定律——理论物理的标志性工具。",
            "Running an idealized physical scenario in your head and back-inferring the laws from self-consistency — a signature tool of theoretical physics."),

    # ---------------- einstein_life (5) ----------------
    Concept("patent_office", "einstein_life", "伯尔尼专利局", "Bern patent office",
            "1902-1909 年，一份普通的日常工作岗位——1905 年那四篇论文是在这里的空闲时间里写出来的。",
            "An ordinary day job, 1902-1909; the four 1905 papers were written in the slack time of that office."),
    Concept("annus_mirabilis", "einstein_life", "奇迹年 1905", "Annus Mirabilis 1905",
            "一年内一位 26 岁的青年物理学家发表了光电效应、布朗运动、狭义相对论、质能方程四篇论文。",
            "In one year, at 26, a young physicist published four papers: photoelectric effect, Brownian motion, special relativity, and mass–energy equivalence."),
    Concept("god_dice", "einstein_life", "上帝不掷骰子", "God does not play dice",
            "对量子力学随机性的著名反对，与哥本哈根学派的争论跨越几十年。",
            "A famous objection to the randomness of quantum mechanics; the debate with the Copenhagen school spanned decades."),
    Concept("princeton", "einstein_life", "普林斯顿高等研究院", "Princeton IAS",
            "1933 年从纳粹德国出走后，此地成为一位思想家余生追求统一场论的实验室。",
            "After fleeing Nazi Germany in 1933, this became the lab where one thinker spent the rest of a life chasing a unified field theory."),
    Concept("imagination", "einstein_life", "想象力比知识更重要", "Imagination > knowledge",
            "'想象力比知识更重要，因为知识是有限的，而想象力概括一切。'",
            "'Imagination is more important than knowledge, for knowledge is limited whereas imagination embraces the entire world.'"),
]


# ---------------------------------------------------------------------------
# Embedding generation
# ---------------------------------------------------------------------------


def _seeded_generator(key: str) -> torch.Generator:
    h = int(hashlib.sha256(key.encode("utf-8")).hexdigest()[:16], 16)
    g = torch.Generator()
    g.manual_seed(h)
    return g


def _category_center(category: str, dim: int) -> torch.Tensor:
    g = _seeded_generator(f"category::{category}")
    v = torch.randn(dim, generator=g)
    return v / (v.norm() + 1e-8)


def concept_embedding(concept: Concept, dim: int = DEFAULT_DIM) -> torch.Tensor:
    """Deterministic pseudo-embedding: category center + per-concept noise, tanh-squashed.

    Concepts in the same category end up near each other in this space, which
    makes recall meaningful ('BTC associates with PoW/ETH more than with E=mc²').
    """
    center = _category_center(concept.category, dim)
    g = _seeded_generator(f"concept::{concept.id}")
    noise = torch.randn(dim, generator=g) * 0.45
    v = center + noise
    return torch.tanh(v)


def all_concepts_with_embeddings(dim: int = DEFAULT_DIM) -> Iterable[Tuple[Concept, torch.Tensor]]:
    for c in CONCEPTS:
        yield c, concept_embedding(c, dim)


def concepts_public() -> List[dict]:
    """Serializable view of every SEED concept — used by the frontend
    knowledge panel. Learned-at-runtime concepts are added by the brain
    on top of these; see ``Brain.snapshot()``'s ``learned_concepts``."""
    return [
        {
            **asdict(c),
            "category_meta": CATEGORIES.get(c.category, {}),
        }
        for c in CONCEPTS
    ]


def categories_public() -> dict:
    return CATEGORIES


def concept_embedding_for_text(text: str, category: str = "learned_token",
                               dim: int = DEFAULT_DIM) -> torch.Tensor:
    """Deterministic embedding for an arbitrary string, category-anchored.

    Used when the brain encounters a novel token / pattern / event at
    runtime: we drop it into the right category cluster (so associations
    still make semantic sense) and add per-string noise to keep it
    distinct. Same trick as ``concept_embedding`` — just keyed on a free
    string rather than a preset id.
    """
    center = _category_center(category, dim)
    g = _seeded_generator(f"learned::{category}::{text}")
    noise = torch.randn(dim, generator=g) * 0.45
    return torch.tanh(center + noise)

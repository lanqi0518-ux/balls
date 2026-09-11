# 数字人脑 · The Digital Human Brain

**A live digital human brain — eight anatomical regions, each a real neural network, cooperating in real time. No LLM used.**

一个真正在"活着"的数字人脑：8 个脑区，每个都是一个**真实的神经网络模块**，共同感知、记忆、决策、产生情绪。整个系统运行在浏览器里，实时可视化，**完全不使用 LLM**。

**在线 Demo** · Live: <https://balls-lanqi.fly.dev>（部署在 Fly.io，`sjc`，1 台 + 1GB volume）

> 当前默认为 **Einstein 模式**：更宽的前额叶（192-wide）、更长的海马体（400 槽）、更活跃的默认网络，
> 且启动时向海马体灌入 **60 个语义种子**——30+ 个加密货币概念（BTC / ETH / SOL / DOGE / PEPE / WIF / HODL / rug pull / gas ...）
> 加 20+ 个爱因斯坦概念（狭义&广义相对论 / E=mc² / 光速 / 引力波 / 张量 / 场方程 / 思想实验 / "上帝不掷骰子" ...）。
> 它在思考时会不定期"联想"到其中之一，你能在 UI 上看到当下想到的概念。
>
> **另外**：现在多了一块**交易皮层**（Trader Cortex），可以跟踪 Solana 链上钱包的行为、行为克隆学他们的
> 买卖决策、用真实 DexScreener 价格模拟买卖，并把实盈亏反传回来微调策略。默认为**只做 paper 交易**——
> 不动真钱。见下方 [交易皮层](#交易皮层--traders-cortex) 一节。

![Digital Human Brain screenshot placeholder](docs/screenshot.png)

## 它是什么

在这个项目里，一个数字大脑活在一个 9×9 的虚拟环境里：它要寻找食物（奖励 +1），躲避危险（惩罚 −1），凭自己长出来的经验去做决定。

它的"大脑"由 8 个模块组成，**每一个都是解剖学上真实脑区的功能替身**：

| 脑区 | 中文名 | 实现方式 | 干什么 |
|---|---|---|---|
| Visual cortex (V1–V4) | 视觉皮层 | 卷积神经网络（PyTorch）| 把环境画面变成特征向量 |
| Thalamus | 丘脑 | 门控 + 增益 | 感官过滤 / 自上而下的注意力 |
| Hippocampus | 海马体 | Hopfield 风格情节记忆库 | 存储 & 提取过去的经历 |
| Amygdala | 杏仁核 | 状态变量 + 巴甫洛夫式条件化 | 恐惧、威胁探测、情绪记忆标记 |
| Nucleus accumbens / VTA | 伏隔核 & 腹侧被盖区 | 时间差分学习（TD） | 奖励预测误差 / 动机 |
| Prefrontal cortex | 前额叶皮层 | Actor-Critic MLP | 权衡选项、决策 |
| Motor cortex (M1) | 运动皮层 | Categorical 采样 | 发出运动指令 |
| Default mode network | 默认网络 | 空闲时的记忆回放 | 走神、想象、记忆回放 |

**这些不是装饰的动画——每个模块都在做真实的计算，用真实的 PyTorch 神经网络。**

## 为什么它值得看

* **完全没有 LLM**——所有智能来自实实在在的神经网络协同工作
* **在线学习**：actor-critic 算法边跑边学，你能看到它变聪明
* **杏仁核会学习恐惧**：踩过一次陷阱后，看到相似场景就会警觉
* **海马体会记住地点**：能识别"这地方我似曾相识"
* **可视化真实反映内部状态**：3D 大脑上每个脑区的亮度=真实激活值，不是随机动画
* **可以互动**：随时给环境增加食物/危险，重置大脑，调整思考速度

## 快速开始

```bash
# 1. 装依赖（用国内镜像更快）
pip install -r requirements.txt
# 或只装 torch 的 CPU 版本（更小）：
#   pip install --index-url https://download.pytorch.org/whl/cpu torch
#   pip install fastapi "uvicorn[standard]" numpy websockets

# 2. 启动服务器
python -m backend.server

# 3. 打开浏览器
open http://localhost:8000
```

默认监听 8000 端口，可通过环境变量 `PORT` 修改。

## 项目结构

```
digital-brain/
├── backend/
│   ├── brain/
│   │   ├── brain.py                  # Brain 主类，协调所有脑区
│   │   ├── region.py                 # BrainRegion 基类
│   │   └── regions/                  # 每个脑区一个文件
│   │       ├── visual_cortex.py      # 卷积网络
│   │       ├── hippocampus.py        # 情节记忆
│   │       ├── amygdala.py           # 恐惧回路
│   │       ├── nucleus_accumbens.py  # 奖励预测误差
│   │       ├── prefrontal_cortex.py  # actor-critic 决策
│   │       ├── motor_cortex.py       # 动作采样
│   │       ├── default_mode.py       # DMN 空闲回放
│   │       └── thalamus.py           # 感官门控
│   ├── env/
│   │   └── gridworld.py              # 9×9 虚拟环境
│   └── server.py                     # FastAPI + WebSocket
├── frontend/
│   ├── index.html                    # 主布局
│   ├── css/style.css                 # 深色科技风
│   └── js/
│       ├── main.js                   # WebSocket + 状态派发
│       ├── brain3d.js                # Three.js 3D 大脑
│       ├── environment.js            # 网格环境渲染
│       └── thoughtstream.js          # 思考流
├── requirements.txt
└── README.md
```

## 界面说明

- **左：3D 人脑** —— 可拖拽旋转、滚轮缩放。每个脑区是一个发光球体，亮度对应实时激活值。**点击任意脑区**查看它内部的神经元活动。
- **中上：虚拟环境** —— 蓝色是身体（agent），绿色是食物，红色 × 是危险。
- **中下：脑区详情** —— 点击的脑区的内部计算：激活值、神经元活动图、最近事件、专属指标（例如海马体的记忆数量、杏仁核的恐惧值、伏隔核的累计奖励）。
- **右：思考流** —— 大脑每一步在"想什么"。可以切换中/英显示。
- **底部：控制条** —— 调整大脑运行速度（1–20 Hz）。

## 观察建议

- 前几十步大脑几乎随机移动；**逐渐会学会去找绿色食物**
- **踩到红色 × 后**：观察杏仁核的 `conditioned templates` 数量上升，之后大脑会更倾向躲开红色
- **闲下来的时候**：默认网络会亮起，随机回放一段过去的记忆
- **切换脑区详情**：点海马体看它存了多少条记忆；点伏隔核看奖励预测误差

## 我做不到什么（老实说）

- **它不会跟你对话**——那需要 LLM，本项目故意不用
- **它的"思考"是结构化的**（感知 → 记忆 → 决策 → 行动），不是人的意识流
- **它的"情绪"是功能等价物**（一个变量），不代表主观体验
- **它不是"真的懂"加密货币或相对论**。知识库里的 60 个概念，是启动时塞进海马体的语义种子（每个是一个 32 维向量），
  在思考时会被联想到，但它不会推导 E=mc²，也没读过比特币白皮书。要想让它"懂"，只能上 LLM。
- 只有 8 个脑区、几百到几千个参数——离真人脑（860 亿神经元、每个 1000+ 突触）差 8 个数量级

## 关于 Einstein 模式 & 知识库

启动时把两组概念灌入海马体作为**永久记忆**（不会被后续经历淘汰）：

| 分类 | 例子 | 数量 |
|---|---|---|
| 主流加密货币 | BTC / ETH / SOL / BNB / XRP / ADA / TON / TRX / LTC / USDT | 10 |
| Meme 币 | DOGE / SHIB / PEPE / WIF / BONK / FLOKI / POPCAT / MOG / TRUMP / FARTCOIN | 10 |
| 加密技术 / DeFi | PoW / PoS / halving / gas / wallet / seed / cold wallet / DEX / LP / NFT / airdrop / rugpull | 12 |
| 加密文化 | 中本聪 / WAGMI / GM / HODL / to the moon / diamond hands / FOMO / shill | 8 |
| 爱因斯坦·物理 | 狭义 / 广义相对论 / E=mc² / 光速 / 时空 / 引力波 / 光电效应 / 光子 / 黑洞 / 宇宙常数 Λ | 10 |
| 爱因斯坦·数学 | 张量 / 洛伦兹变换 / 场方程 / 黎曼几何 / 思想实验 | 5 |
| 爱因斯坦·生平 | 伯尔尼专利局 / 奇迹年 1905 / 上帝不掷骰子 / 普林斯顿 IAS / 想象力比知识更重要 | 5 |

**联想机制**：每步以一定概率（越无聊概率越高）从知识库里按余弦相似度加权采样一个概念，
在思考流里打出「💭 联想到 XX」，并把 UI 上对应的知识片高亮出来。整个过程用的是同一个 Hopfield 风格相似度检索，**没有任何 LLM 调用**。

想关掉知识库、跑纯 RL 版本？

```bash
BRAIN_MODE=default python -m backend.server
# 或
BRAIN_KNOWLEDGE=0 python -m backend.server
```

## 交易皮层 · Trader's cortex

> 大脑现在多了一块 **Trader Cortex**（前额叶右侧那个橙色球），它做的事：
> **观察 Solana 链上钱包的真实交易 → 行为克隆学习他们 → 用实时价模拟买卖 → 平仓的实盈亏
> 反传回来微调策略**。整套流程默认只跑 paper，**不动真钱**。

### 数据链路（gmgn.ai 在做什么，我们就自己算一遍）

由于 gmgn.ai 的 API 挡在 Cloudflare 后面，我们直接从两个公开源拿数据：

* **DexScreener** — 免费公开，每 60 秒拉一次 Solana 上的热门 meme 币，包括价格、24h/1h/5m 涨跌、
  流动性、Buy/Sell 数量。
* **Solana public RPC** (`api.mainnet-beta.solana.com`) — 每 25 秒轮询已跟踪钱包的最近 15 笔交易，
  用 `preTokenBalances` / `postTokenBalances` 提取 buy/sell 事件（SPL 增加+SOL 减少=买入；反之=卖出）。

跟踪的钱包**默认为空**。gmgn 战壕榜上的每一个钱包地址都是可复制的——你在浏览器打开
gmgn.ai/trenches（避开 CF），把觉得靠谱的地址复制过来，粘到 UI 里的"👁 跟踪中的钱包"表下面
即可。我们从那一刻起就在 Solana RPC 上跟着它的每笔交易了。

### 学习机制（两种梯度同时下降）

1. **行为克隆 (Behavior Cloning)** — 每次跟踪的钱包出一笔 buy/sell：
   - 把那个时刻那个 token 的 16 维市场特征算出来
   - 把钱包的动作作为标签（BUY/SELL），做一次交叉熵梯度更新
   - **权重按那个钱包的滚动 24h 已实现 PnL 加权**——赚的钱包影响大，亏的影响小
2. **PnL 强化学习** — 每次我们自己 paper 平仓：
   - 用实际实现的收益率（例如 +8%、-12%）作为 reward
   - 对建仓时的状态做一步 REINFORCE + value baseline 更新

### Smart-money 榜（我们自己算的）

每个被跟踪钱包按滚动 24h 已实现 PnL 排序，FIFO 匹配每 token 的买卖计算成本和收益。
这就是 gmgn "战壕榜"的算法本质，我们只是从零算了一遍。

### Paper trader（模拟撮合）

* 起始资金 **$10,000 USD**
* 单笔上限：账户的 10%
* 最多 6 个并行持仓
* 摩擦成本：**1.5% round-trip**（滑点 + 手续费的粗估）
* 自动止损 **-18%**、自动止盈 **+35%**、最大持仓时间 **12 小时**

### 持久化

Cortex 权重和 paper 账本每 3 分钟保存一次到 `$DATA_DIR/state.pt`。Fly.io 部署里挂了一个 1GB 卷到
`/data`，重启和滚动部署都不会丢学到的东西。

### 环境变量

| 变量 | 作用 | 默认 |
|---|---|---|
| `BRAIN_MODE` | `einstein` / `default` | `einstein` |
| `BRAIN_KNOWLEDGE` | 是否灌入知识库 (`1`/`0`) | 跟 BRAIN_MODE 走 |
| `DATA_DIR` | 状态持久化目录 | `./data` |
| `TRACK_WALLETS` | 启动时预先跟踪的钱包，格式 `addr:label,addr:label,addr` | 空 |

例：`TRACK_WALLETS='6WdEZ...ABCDE:cupsey,GJRs4Fw...ABC:whale2' python -m backend.server`

### 关于实盘（Phase 4，**目前未实现**）

要让这套系统真的去 Jupiter/Raydium 下单，需要：

* 一个 Solana 私钥（或 delegate 权限的次级钱包）
* 用户显式的每笔确认，或一个"自动预算 $X"上限
* 硬性风控：单笔上限、日损止损、最大 open positions

**我没有做这一步。** paper 不动真钱，是我给自己留的止损。真要上，先跑一周 paper 看它 PnL 是不是
稳定的，再动手加执行层。跟单 top traders 的**尾部亏损**和**头部收益**同样真实。

### 老实说清楚这个系统不是什么

* **不是印钞机**。gmgn "战壕榜"高收益选手多是短线尾部胜出，跟他们跟不出稳定收益。
* **不是"AI 交易员"**。cortex 只有 ~30K 参数，跟一个大型量化模型差 6 个数量级。
* **不做技术分析**。它只看 16 维原始市场状态 + 你选的钱包的动作。K 线、成交量分布、订单簿都没用。
* **数据滞后**。DexScreener 数据 30-60s 延迟；公共 Solana RPC 有速率限制。真做 alpha 需要
  Helius 之类的付费实时源。

## 它真的做到了什么

- ✅ **3D 大脑可视化真实反映内部计算**
- ✅ **每个脑区真的在算东西**（不是动画）
- ✅ **真的有记忆**（Hopfield 相似度检索）
- ✅ **真的有情绪状态**（会影响后续决策）
- ✅ **真的能自主决策**（给目标就自己去做）
- ✅ **真的会学习**（在线 actor-critic）
- ✅ **完全没用 LLM 或任何外部 API**

## 技术栈

- **后端**：Python 3.10+ · PyTorch 2.x · FastAPI · WebSockets
- **前端**：原生 ES modules · Three.js（3D）· Canvas 2D
- **算法**：Actor-critic (REINFORCE + value baseline) · Hopfield-like associative memory · Pavlovian conditioning

## 部署到 Fly.io

项目里已经包含 `Dockerfile` + `fly.toml`（app 名 `balls-lanqi`，区域 `sjc`，CPU-only PyTorch 镜像约 255 MB）。自己部署一份：

```bash
# 1. 装 flyctl
curl -L https://fly.io/install.sh | sh

# 2. 登录并创建 app（换成你自己的名字）
flyctl auth login
flyctl apps create <your-app-name>

# 3. 修改 fly.toml 里的 app = "<your-app-name>"
# 4. 部署
flyctl deploy --remote-only
```

默认部署 2 台 shared-cpu-1x（1 GB）机器，开启 `auto_stop_machines`，没人访问时会挂起。

## 许可

MIT — 随便用。

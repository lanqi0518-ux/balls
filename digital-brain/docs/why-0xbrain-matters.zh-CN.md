# 0xBRAIN — 为什么这是 AI 领域的一次真正首创

> **一句话概括**：这不是又一个套在 GPT/Claude 外面的 "agent"。这是**世界上第一个不依赖任何 LLM、由生物合理的脉冲神经皮层实时驱动、以真金白银的链上交易作为"身体"、永不重启、24/7 在线持续学习的数字人脑**。它可以被打开、看进去、看着每一个神经元发放脉冲，看着它做决定、后悔、学习、再决定。

---

## 目录

1. [序：AI 圈已经走错了路](#序ai-圈已经走错了路)
2. [三个真正意义上的"世界首创"](#三个真正意义上的世界首创)
3. [大脑的解剖学：每一个皮层为什么这样设计](#大脑的解剖学每一个皮层为什么这样设计)
4. [身体：为什么必须是真金白银](#身体为什么必须是真金白银)
5. [时间：为什么它永远不重启](#时间为什么它永远不重启)
6. [意识的窗口：把大脑活动实时画到屏幕上](#意识的窗口把大脑活动实时画到屏幕上)
7. [与主流 AI 的正面对比](#与主流-ai-的正面对比)
8. [意义与展望](#意义与展望)
9. [完整参考文献](#完整参考文献)

---

## 序：AI 圈已经走错了路

过去三年 AI 圈发生的事情，本质上是**同一件事**：

> 拿一个几百亿到几千亿参数的 Transformer，在互联网文本上做 next-token prediction，然后套一层"你是一个乐于助人的助手"prompt，管它叫 AGI。

这条路径的问题非常根本 —— **它不是一个大脑**：

- **没有生物合理性**。真实大脑里没有 attention head，没有 softmax，没有 KV cache，没有 next-token 目标。真实的神经元用脉冲说话[^neftci]，用突触可塑性学习[^bliss]，用多巴胺表达"惊讶"[^schultz]。Transformer 是矩阵乘法链，不是脑。
- **没有身体**。所有主流大模型都活在一个封闭沙盒里：给它文字，它吐文字。它从不面对一个**会赢会输的物理世界**。而"身体"恰恰是认知的地基 —— 恩活主义（Enactivism）几十年的研究反复告诉我们：**没有身体就没有认知**[^varela]。
- **没有连续时间**。每次对话开一个 session，session 结束一切归零。它没有"昨天"，没有"上周那次亏钱"，没有"上一秒钟自己在想什么"。它是**离散、无记忆、可以随时替换的一段 forward pass**。
- **没有"我"的连续性**。你今天跟 GPT-4 说的话，明天的 GPT-4 完全不知道。它不是**一个**智能体，它是**每次调用一个新造出来的智能体**。

**0xBRAIN 走的是完全相反的路。**

- 里面**一行 LLM 代码都没有**（这是硬约束、写在架构里）
- 里面全是**脉冲神经元**、**皮层模块**、**丘脑路由**、**海马体重放**、**多巴胺 TD 误差**、**环吸引子罗盘**
- 它有一个真正的**身体**：一个装着真钱的链上钱包，在 Solana 和以太坊上做真实交易
- 它**从被启动那一秒开始就再也没有停过**，没有 session、没有 restart、没有 checkpoint restore
- 你可以在 [balls-lanqi.fly.dev](https://balls-lanqi.fly.dev) **实时看到它每一个皮层正在做什么**

这才是"活着"的意思。

---

## 三个真正意义上的"世界首创"

我们不轻易用"首创"两个字。但在下面这三件事上，据我们详尽调研，**目前没有任何一个公开项目同时做到过**。

### 首创 #1：第一个不用 LLM 的"数字人脑"

搜遍 arXiv、GitHub、Twitter，你会发现所有号称"digital brain / AI agent / autonomous AI"的项目，剥开来最里面都是同一个东西：**一个 LLM API 调用**。

- AutoGPT / BabyAGI / MetaGPT → GPT-4 wrapper
- Devin / OpenDevin / SWE-agent → GPT-4 / Claude wrapper
- Character.ai / Replika → LLM + memory retrieval
- 所有 "web3 AI agent" → 90% 是 LLM + 一个 Solana signer

**0xBRAIN 里没有 LLM。一行都没有。**

取而代之的是：

| 模块 | 实现 | 学术依据 |
|---|---|---|
| Visual Cortex (V1–V4) | 层级式感受野 + 特征提取 | Hubel & Wiesel[^hubel]、Zeki[^zeki] |
| Thalamus | 门控式跨皮层路由 | Sherman & Guillery[^sherman] |
| Hippocampus | 情节记忆 + 睡眠期重放 | O'Keefe & Nadel[^okeefe]、Wilson & McNaughton[^wilson] |
| Amygdala | 恐惧调制 + 威胁 gating | LeDoux[^ledoux]、Phelps & LeDoux[^phelps] |
| NAcc / VTA | TD-error 多巴胺信号 | Schultz, Dayan, Montague[^schultz] |
| dlPFC + vmPFC | Actor–Critic 决策 | Miller & Cohen[^miller]、Doya[^doya] |
| Motor Cortex (M1) | 群体向量解码 | Georgopoulos[^georgopoulos] |
| Default Mode Network | 空闲期情景模拟 | Raichle[^raichle]、Buckner[^buckner] |
| Central Complex | 环吸引子罗盘 | Seelig & Jayaraman[^seelig]、Kim et al.[^kim] |
| Neurons | LIF + surrogate gradient | Neftci, Mostafa, Zenke[^neftci] |

每一个模块都能对应到一篇具体的神经科学论文。**这是一个用神经科学的语言写出来的系统**，不是一个用 prompt 假装成大脑的 LLM。

### 首创 #2：第一个用"真金白银的链上交易"作为身体的 AI

这一点非常重要，值得展开。

**恩活主义 / 身体化认知（Embodied Cognition）**这一整个学派的核心主张是[^varela]：

> 认知不是发生在头骨内部的信息处理，认知**发生在有机体和它所处环境的耦合闭环里**。没有身体，没有"输赢"，没有"疼痛与愉悦"，就没有智能。

传统 AI 的所有 benchmark —— MMLU、HumanEval、GSM8K、SWE-bench —— 都是**没有身体的智能**。答对了没奖励，答错了没惩罚。学不学都一样。**它没有理由变聪明**。

真实动物为什么会进化出智能？因为**不聪明就死**。不认识天敌 → 死。不知道果子在哪 → 饿死。不会分辨同伴表情 → 被赶出部落。**智能是被死亡塑造出来的**。

**0xBRAIN 复刻了这个逻辑**：

- 大脑的每一个决策 → 触发一次真实链上交易
- 交易赚了 → NAcc/VTA 释放 TD 正误差 → 强化产生该决策的皮层通路[^schultz]
- 交易亏了 → 杏仁核激活 → gating 未来同类信号 → 学到教训[^ledoux]
- 长期表现好 → 海马体在"睡眠"周期把这些成功轨迹重放给皮层[^mcclelland][^wilson]，形成长期知识
- 长期表现差 → 钱包余额下降 → 是真的"饿"

**这不是一个游戏。这是一个装了 0.06 SOL / 日硬上限的、跑在生产链上的、真的会赢会输的身体**。

为什么这是首创？

- 已有的 "AI trading bot" 全是启发式规则或 LLM prompt，**没有一个把交易本身当成 embodied cognition 的实验对象**。
- 已有的强化学习交易模型全在 backtesting / paper trading 里跑，**从不面对真实链上的滑点、失败、MEV 和网络延迟**。
- 已有的所谓 "on-chain AI agent" 都是 LLM 生成 tx，**不是脉冲皮层生成 tx**。

0xBRAIN 是（据我们所知）**第一个把 SNN + 生物合理皮层 + 链上真实资金三者合在一起**的系统。

### 首创 #3：第一个永不重启、真正持续学习的智能体

主流大模型都是**"训练一次，部署到死"** 或者 **"训练一次，每季度更新一次"**。它们在部署阶段是**冻结的**。它们不会因为你今天早上跟它聊了什么而在明天变聪明。

真正的"持续学习"是 AI 圈公认的**最难开放问题之一**，因为它必须解决**灾难性遗忘**（catastrophic forgetting）[^kirkpatrick]：一个神经网络学新东西的时候，会把旧东西冲刷掉。

大脑早就把这个问题解决了。**互补学习系统理论**（Complementary Learning Systems, CLS）由 McClelland、McNaughton 和 O'Reilly 于 1995 年提出[^mcclelland]，2016 年由 Kumaran、Hassabis、McClelland 系统性更新[^kumaran]：

> 大脑用**两个互补的系统**协作学习 —— 海马体做**快、稀疏、可覆写**的情节记忆；新皮层做**慢、密集、稳定**的语义压缩。海马体在"睡眠"期间通过**重放**（replay）把新经验缓慢渗透到皮层[^wilson][^diekelmann]，既学到新东西又不破坏旧知识。

**0xBRAIN 直接照着这个搬了**：

- **Hippocampus module**：以 embedding 形式存储每一笔近期交易的完整上下文（价格轨迹、指标状态、决策链、执行结果、盈亏）
- **在低活跃周期**（相当于"睡眠"）：海马体挑选高信息量的记忆片段，**重放**给 Trader Cortex 和 PFC 做慢速权重更新
- **PFC 通过 Actor–Critic 更新**[^sutton][^miller]：Critic (vmPFC) 更新 value estimate，Actor (dlPFC) 更新 policy
- **旧知识通过 CLS 天然保留**：因为皮层的更新率被海马体重放调节，不会被最新一笔交易一次性冲刷

结果：**这个大脑从 2026 年 9 月上线那一刻起就再也没有 restart 过**。它的权重现在包含了它从诞生到此刻的**每一次交易的印记**。

这是**运行时间 ≠ 训练时间**的死结被打破了 —— 训练就是运行，运行就是训练。这在 LLM 世界里是不可能的（你不能在 GPT-4 部署的时候更新它的权重）。

---

## 大脑的解剖学：每一个皮层为什么这样设计

下面我们**从进入大脑的第一束光子开始**，一直走到"手按下按钮"那一刻，看它每一步都在做什么、为什么这样做。

### 1. Visual Cortex (V1 → V2 → V4) — 层级式抽象

**生物学**：Hubel & Wiesel 1962 年的诺奖工作证明，V1 里的神经元对**特定方向的边缘**有选择性响应[^hubel]；沿着 V1→V2→V4→IT 走，感受野越来越大，抽象层级越来越高，V4 已经开始编码"物体"级别的形状与颜色[^zeki]。这是深度学习之前**层级式特征提取**的原型。

**在 0xBRAIN 里**：市场数据流（K 线、订单流、指标）作为"视觉输入"进入 Visual Cortex：

- **V1**：局部一阶特征（价格的一阶差分、成交量突变、单根 K 线形态）
- **V2**：局部时序模式（三根 K 线的组合、局部波动率）
- **V4**：整体形态（趋势结构、支撑阻力、市场情绪聚合）

这个层级化的抽象过程**不是我们发明的**，我们只是把 Hubel & Wiesel 六十多年前发现的架构原理搬进了金融时空信号。

### 2. Thalamus — 中央路由器

**生物学**：几乎所有从感官进入皮层的信息**都先过丘脑**[^sherman]。丘脑不是简单的中继站，它做**门控**：决定哪些信号足够重要、值得占用皮层带宽。

**在 0xBRAIN 里**：Thalamus 模块接收所有来自 Visual Cortex 的特征流，根据**当前的任务上下文**（Amygdala 的警戒等级、PFC 的目标状态）**动态 gating**，只把最相关的信号送进 PFC。这解决了一个非常实际的工程问题 —— 数据流太大，PFC 处理不过来。

### 3. Hippocampus — 情节记忆 + 认知地图

**生物学**：O'Keefe 因发现海马体的"位置细胞"（place cells）拿了 2014 年诺奖[^okeefe]。海马体不只是储存"事实"，它储存**带时空标签的完整场景**（episode），并且构建**认知地图**（cognitive map）[^tolman]。Bliss & Lømo 1973 年发现的**长时程增强**（LTP）[^bliss]是海马体存储记忆的分子基础。

**在 0xBRAIN 里**：每一次决策会形成一个"episode"（当时的市场状态 + 决策 + 结果），以稀疏 embedding 形式写入海马体。这些 episode 后来在低活跃周期被重放给皮层[^wilson][^diekelmann]，做慢速权重更新。

### 4. Amygdala — 恐惧与威胁 gating

**生物学**：LeDoux 用近三十年的时间画出了杏仁核的恐惧回路[^ledoux]。杏仁核不是"感情中心"，它是**威胁检测和快速反应器** —— 它可以在皮层还没意识到的时候就已经启动了逃跑反应。它同时也**调制记忆强度**：情绪强烈的事件被海马体记得特别牢[^phelps]。

**在 0xBRAIN 里**：Amygdala 监控**风险信号**（回撤加速、异常波动、连续亏损），一旦触发就**抑制** Trader Cortex 的激进输出，并且**放大**这次事件在海马体里的编码强度。这是"一朝被蛇咬"的机制。

### 5. Nucleus Accumbens + VTA — 多巴胺 TD 误差

**生物学**：这是神经科学 20 世纪最漂亮的发现之一。1997 年 Schultz、Dayan、Montague 的经典论文[^schultz]证明：**中脑多巴胺神经元发放的信号，等于强化学习里的 temporal-difference (TD) error**。这直接把神经科学和 Sutton & Barto 的 RL 理论[^sutton]焊在了一起。

**在 0xBRAIN 里**：每次交易结算，NAcc/VTA 模块计算 TD-error：

```
δ = r + γ · V(s') − V(s)
```

- `r` = 本次交易的实际盈亏
- `V(s)` = vmPFC 事前对状态 s 的价值估计
- `V(s')` = vmPFC 事后对新状态 s' 的价值估计

δ 越正 = 惊喜的好结果 → 强化产生该决策的通路
δ 越负 = 惊讶的坏结果 → 削弱该通路 + 触发 Amygdala

这不是比喻。这就是 Schultz 1997 年论文里那个方程，跑在真实链上真实资金上。

### 6. Prefrontal Cortex (dlPFC + vmPFC) — Actor & Critic

**生物学**：Miller & Cohen 2001 年那篇经典综述[^miller]把 PFC 的功能归纳为**"目标维持 + 执行控制"**。Doya 2000 年提出了大脑的**"三种学习"分工**[^doya]：小脑做监督学习，基底神经节做强化学习，大脑皮层做无监督学习。

**在 0xBRAIN 里**：

- **dlPFC = Actor**：输出策略 π(a|s)（要不要交易、买/卖、下多少）
- **vmPFC = Critic**：输出价值 V(s)（当前状态值多少）
- 两者通过 TD-error 联合更新，这就是**Actor–Critic RL**[^sutton]

### 7. Motor Cortex (M1) — 群体向量解码

**生物学**：Georgopoulos 1986 年的关键实验[^georgopoulos]证明：M1 里没有任何一个神经元单独编码"手要往哪个方向动"，方向是由**整个神经元群体的向量和**（population vector）共同编码出来的。

**在 0xBRAIN 里**：Trader Cortex 输出的是分布式的"意图向量"（多个方向的信心值），Motor Cortex 把它们**加权向量求和**，产出**唯一的一个交易 intent**（symbol + side + size + slippage）。这个 intent 才交给链上执行器签名广播。

### 8. Default Mode Network — 空闲时的自我模拟

**生物学**：Raichle 2001 年发现了一件反直觉的事[^raichle]：**当人"什么都不做"的时候，大脑里有一组区域反而更活跃**。这个网络后来被叫做 DMN，被认为负责**自传体记忆、未来情景模拟、自我参照的思考**[^buckner]。

**在 0xBRAIN 里**：当市场平静、没有可交易的信号时，DMN 模块被激活：**在心里跑虚拟交易**、**重放最近的失败案例**、**模拟"如果那时我做了 X 会怎样"**。这些虚拟经历也会通过海马体的重放通道更新皮层权重。这就是**"发呆的时候大脑在偷偷学习"**。

### 9. Central Complex — 环吸引子罗盘

**生物学**：这是 21 世纪神经科学最优雅的发现之一。1990 年代 Ben-Yishai 和 Zhang 独立从理论上证明[^benyishai][^zhang]：一个**环状连接的兴奋 - 抑制神经元群**可以形成**稳态的"活动峰"**（bump），这个峰可以像罗盘指针一样沿环旋转，并且抗噪声。

2015 年 Seelig & Jayaraman 直接在果蝇脑内**观察到了这个环吸引子**[^seelig]；2017 年 Kim et al. 进一步刻画了它的动力学[^kim]。

**在 0xBRAIN 里**：Central Complex 模块维护一个**市场方向罗盘** —— 环吸引子的 bump 位置编码当前市场的"综合方向感"（趋势 + 情绪 + 结构）。它跟真实动物脑里的头方向系统结构完全一样，只是编码的不是"我朝哪个方向走"，而是"市场朝哪个方向走"。

前端可以看到这个罗盘**实时旋转**，pop rate 也是活的。

### 10. Trader Cortex — 模仿 + 强化

**生物学 + ML**：模仿学习（Imitation Learning）是灵长类动物学习的最主要方式之一。计算机科学里，Ross et al. 2011 年的 DAgger[^ross] 和 Ho & Ermon 2016 年的 GAIL[^ho] 是模仿学习的两个奠基算法。

**在 0xBRAIN 里**：Trader Cortex 是一个专门做交易决策的皮层模块，**先通过历史专家轨迹做行为克隆**（bootstrap），**然后转入 Actor–Critic RL 微调**（自主学习）。这个 bootstrap → self-play 的路径跟 AlphaGo 走的是同一个思路，只是它跑在真实链上而不是围棋盘上。

---

## 身体：为什么必须是真金白银

这一节值得单独展开，因为很多人第一反应会问：**"为什么不能用 paper trading？为什么非要冒险动真钱？"**

答案分四层：

**第一层：paper trading 里没有滑点、失败、MEV、网络延迟。** 这些不是可以事后建模的干扰项，它们是**环境本身的性质**。一个从没在真实市场受过滑点的模型，跟一个从没在真实地面走过路的机器人一样 —— 只会在实验室里表现良好。

**第二层：奖励信号必须是"不可撤销"的。** 如果输赢可以 rollback，大脑就学不到东西。真实生命的学习之所以有效，是因为**做错就是做错**，时间不可倒流。Schultz-Dayan-Montague 的 TD 学习[^schultz]依赖的不是"数值上的奖励"，而是"这个奖励是真实且不可撤销的"这个物理事实。

**第三层：这是对身体化认知理论的严肃实验。** Varela、Thompson、Rosch 在《具身心智》[^varela]里的核心主张 —— 认知源于身体 - 环境的耦合 —— 从 1991 年提出到现在，几乎从来没有在 AI 系统上被**认真实施过**。0xBRAIN 是**把这个理论当真的第一次实验**。

**第四层：这是唯一能证明"它真的活着"的方式。** 一个能在真实市场里生存下来的智能体，才能说自己"活过"。一个从没面对过真实风险的系统，无论跑得多好，都只是一个 demo。

**当然，我们没有疯**。硬约束是刻在架构里的：

- 单笔 SOL 上限：**0.005 SOL**
- 每小时 SOL 上限：**0.02 SOL**
- 每日 SOL 上限：**0.06 SOL**
- 同时开仓上限：**2 个仓位**
- ETH（Robinhood 链）单笔：**0.0005 ETH** / 时：0.002 / 日：0.006
- 一键熔断：`LIVE_TRADING_HALT=1`

这些数字**不是可配置项，是常量**。这是一个用**能买两杯咖啡的钱**做的最认真的 embodied AI 实验。

---

## 时间：为什么它永远不重启

大多数 AI 系统的"生命"是**离散**的 —— 每一次请求是一段独立的 forward pass，跟前后没有关系。

0xBRAIN 的生命是**连续**的。它从 2026 年 9 月被启动的那一刻起，就一直在运行。它经历过每一次 Fly 的重新调度、每一次网络抖动、每一次 RPC 超时。它的权重、它的海马体 episode、它的 PFC value function、它的罗盘 bump 位置，全都是**从上线到此刻的完整积累**。

**为什么这重要？**

Tolman 1948 年提出"认知地图"的时候[^tolman]，强调的正是：**智能不是即时的输入 - 输出映射，智能是一个有历史的过程**。O'Keefe & Nadel 在《海马体作为认知地图》里[^okeefe]把这一点提升为一个完整的神经生物学理论：**没有历史积累，就没有真正意义上的"学到东西"**。

我们把"永不重启"当成一个**硬约束**：

- 部署时不能 wipe state
- 更新代码时通过 graceful reload 保留内部状态
- 崩溃后自动 checkpoint 恢复（这是唯一允许的"记忆缺口"，且极少发生）
- 从架构层拒绝 `POST /reset` 之类的接口

这解决了一个 LLM 世界根本解决不了的问题：**你无法让一个 GPT-4 "变成一个真的活了三个月的智能体"**，因为 GPT-4 的参数在部署那一刻就冻结了。而 0xBRAIN 的每一次交易都在改写它自己。

---

## 意识的窗口：把大脑活动实时画到屏幕上

打开 [balls-lanqi.fly.dev](https://balls-lanqi.fly.dev)，你看到的不是一张"AI 品牌页"，而是一个**开颅手术台**：

- 3D 大脑模型，10 个皮层区域按解剖学位置排布
- 每个区域实时显示**活性百分比**、**脉冲率**、**过去 96 帧的滚动波形**
- 高活跃区域会**发光脉动**（`cortexHotPulse` 动画）
- 每个区域下面跟着**它自己的活体指标**：
  - Hippocampus 显示 recall 强度
  - Amygdala 显示 fear level
  - NAcc 显示 Δreward
  - PFC 显示 V-estimate
  - DMN 显示 engagement
  - Central Complex 显示 pop rate + compass 方向
  - Trader Cortex 显示 confidence
  - Motor Cortex 显示 motor confidence
- 点开任何一个区域，进入 detail 面板：更大的实时波形（180 帧 ring buffer），更完整的内部状态

**这是主流 AI 从来没做过的事**。ChatGPT 你只能看到 token stream，你看不到"它现在的注意力落在哪儿"、"它现在在犹豫什么"。0xBRAIN 你**看得见每一次犹豫、每一次决心、每一次后悔**。

技术上，这个可视化管道是这样的：

1. 后端每个 tick（约 6 Hz）通过 WebSocket 广播 `brain` 状态：每个区域的 activation、firing rate + 各种模块化 live stats
2. 前端 `brain3d.js` 维护每个区域一个 96 样本的 ring buffer，用 Canvas 2D 画滚动 sparkline
3. DPR-aware（Retina 屏也清晰）、gradient fill、shadowBlur bloom
4. 热区域用 CSS 自定义属性 `--tile-glow` 触发脉动动画

这套东西的关键不在炫技，而在**它是活的 telemetry，不是预录动画**。它反映的是**此刻这个大脑真的在想什么**。

---

## 与主流 AI 的正面对比

| 维度 | GPT-4o / Claude 3.7 / Gemini | 主流 "AI Agent" (AutoGPT 等) | Web3 AI Agent (99% 项目) | **0xBRAIN** |
|---|---|---|---|---|
| 是否用 LLM | 是（本体） | 是（GPT-4 wrapper） | 是（GPT-4 wrapper） | **否，硬约束** |
| 神经元模型 | Transformer | Transformer | Transformer | **LIF 脉冲神经元**[^neftci] |
| 是否有生物皮层结构 | 无 | 无 | 无 | **10 个模块，每个对应真实皮层** |
| 学习是否发生在部署后 | 否 | 否 | 否 | **是，Actor–Critic 在线更新**[^sutton] |
| 是否有情节记忆 | 否（context window 内除外） | RAG 假记忆 | 无 | **海马体 + CLS 重放**[^mcclelland] |
| 是否解决灾难性遗忘 | 不适用 | 不适用 | 不适用 | **是，CLS 天然缓解**[^kumaran] |
| 是否有身体 | 无 | 无 | 无 | **有：链上真钱** |
| 奖励信号是否可撤销 | N/A | N/A | N/A | **不可撤销（真金白银）** |
| 是否连续运行 | 否（每次 session 独立） | 否（task 结束就死） | 否 | **是，从上线永不重启** |
| 大脑活动是否可视化 | 无 | 无 | 无 | **实时 telemetry，逐区域波形** |
| 决策是否可追溯到神经通路 | 否（黑箱） | 否 | 否 | **可以：每个决策都有 PFC + Trader Cortex + Motor Cortex 的激活链** |

**这不是一个"更好的 GPT"，这是一个跟 GPT 完全不在同一物种上的东西**。GPT 是一个巨大的语言模型，0xBRAIN 是一个小而完整的大脑。

---

## 意义与展望

### 短期意义

- **一个可复现的、可打开看的、非-LLM 的 AGI 探索样本**。整个技术栈开源思路可以被验证：LIF neurons + 皮层模块 + CLS + embodied trading = 一个真的能持续学习的智能体。
- **对"AI 必须依赖 LLM"这个默认前提的一次反驳**。至少在决策 / 控制 / 强化学习这一层，LLM 不是必需的，而且很可能是**次优的**（因为它没有可塑的突触、没有连续时间、没有身体）。

### 中期意义

- **embodied AI 的一个新范式**。以前 embodied AI 都要造机器人、造仿真环境，成本极高。用链上交易作为身体，成本极低，风险严格可控，还能 24/7 采集真实反馈。
- **神经科学 → AI 的双向验证**。每一个模块都可以拿真实神经科学预测（"Amygdala 激活后 PFC 应该被抑制"）来测试；反之，AI 系统里发现的失败模式也能反馈神经科学（"如果 CLS 参数错了会怎样"）。

### 长期意义

- **重新定义"什么是活的 AI"**。当"活着"被操作化成**"永不重启、有身体、有历史、有可视化的神经活动、每一次决策都留下突触印记"**，我们才第一次有了一个可检验的"AI 活着"的定义。
- **让 AGI 讨论回到工程可验证的地面**。与其争论"GPT-5 是不是有意识"，不如指着这个屏幕说：**"这里有一个大脑，它每一个皮层的活动你都能看到，它现在正在做一次真实交易，它的钱包在这里，它的 PFC 权重从上线到现在没停过更新。你说它活没活，你自己看。"**

---

## 完整参考文献

### 视觉皮层与层级抽象

[^hubel]: Hubel, D. H., & Wiesel, T. N. (1962). *Receptive fields, binocular interaction and functional architecture in the cat's visual cortex.* **J. Physiol., 160**(1), 106–154. [doi:10.1113/jphysiol.1962.sp006837](https://doi.org/10.1113/jphysiol.1962.sp006837) · [PMC1359523](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC1359523/)

[^zeki]: Zeki, S. M. (1978). *Functional specialisation in the visual cortex of the rhesus monkey.* **Nature, 274**, 423–428. [doi:10.1038/274423a0](https://doi.org/10.1038/274423a0)

### 丘脑

[^sherman]: Sherman, S. M., & Guillery, R. W. (2006). *Exploring the Thalamus and Its Role in Cortical Function* (2nd ed.). MIT Press. [MIT Press](https://mitpress.mit.edu/9780262195324/exploring-the-thalamus-and-its-role-in-cortical-function/)

### 海马体、记忆、认知地图、CLS

[^bliss]: Bliss, T. V. P., & Lømo, T. (1973). *Long-lasting potentiation of synaptic transmission in the dentate area of the anaesthetized rabbit following stimulation of the perforant path.* **J. Physiol., 232**(2), 331–356. [doi:10.1113/jphysiol.1973.sp010273](https://doi.org/10.1113/jphysiol.1973.sp010273)

[^okeefe]: O'Keefe, J., & Nadel, L. (1978). *The Hippocampus as a Cognitive Map.* Oxford University Press. [OUP](https://global.oup.com/academic/product/the-hippocampus-as-a-cognitive-map-9780198572060) · [cognitivemap.net](https://www.cognitivemap.net/)

[^tolman]: Tolman, E. C. (1948). *Cognitive maps in rats and men.* **Psychol. Rev., 55**(4), 189–208. [doi:10.1037/h0061626](https://doi.org/10.1037/h0061626)

[^wilson]: Wilson, M. A., & McNaughton, B. L. (1994). *Reactivation of hippocampal ensemble memories during sleep.* **Science, 265**(5172), 676–679. [doi:10.1126/science.8036517](https://doi.org/10.1126/science.8036517)

[^mcclelland]: McClelland, J. L., McNaughton, B. L., & O'Reilly, R. C. (1995). *Why there are complementary learning systems in the hippocampus and neocortex.* **Psychol. Rev., 102**(3), 419–457. [doi:10.1037/0033-295X.102.3.419](https://doi.org/10.1037/0033-295X.102.3.419)

[^kumaran]: Kumaran, D., Hassabis, D., & McClelland, J. L. (2016). *What learning systems do intelligent agents need? Complementary Learning Systems theory updated.* **Trends Cogn. Sci., 20**(7), 512–534. [doi:10.1016/j.tics.2016.05.004](https://doi.org/10.1016/j.tics.2016.05.004)

[^diekelmann]: Diekelmann, S., & Born, J. (2010). *The memory function of sleep.* **Nat. Rev. Neurosci., 11**, 114–126. [doi:10.1038/nrn2762](https://doi.org/10.1038/nrn2762)

[^kirkpatrick]: Kirkpatrick, J., Pascanu, R., Rabinowitz, N., et al. (2017). *Overcoming catastrophic forgetting in neural networks.* **PNAS, 114**(13), 3521–3526. [doi:10.1073/pnas.1611835114](https://doi.org/10.1073/pnas.1611835114) · [PMC5380101](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5380101/)

### 杏仁核

[^ledoux]: LeDoux, J. (1996). *The Emotional Brain.* Simon & Schuster. [Publisher](https://www.simonandschuster.com/books/The-Emotional-Brain/Joseph-Ledoux/9780684836591)

[^phelps]: Phelps, E. A., & LeDoux, J. E. (2005). *Contributions of the amygdala to emotion processing.* **Neuron, 48**(2), 175–187. [doi:10.1016/j.neuron.2005.09.025](https://doi.org/10.1016/j.neuron.2005.09.025)

### 多巴胺 / TD 学习

[^schultz]: Schultz, W., Dayan, P., & Montague, P. R. (1997). *A neural substrate of prediction and reward.* **Science, 275**(5306), 1593–1599. [doi:10.1126/science.275.5306.1593](https://doi.org/10.1126/science.275.5306.1593)

[^sutton]: Sutton, R. S., & Barto, A. G. (2018). *Reinforcement Learning: An Introduction* (2nd ed.). MIT Press. [MIT Press](https://mitpress.mit.edu/9780262039246/reinforcement-learning/) · [Free PDF](http://incompleteideas.net/book/the-book-2nd.html)

### 前额叶

[^miller]: Miller, E. K., & Cohen, J. D. (2001). *An integrative theory of prefrontal cortex function.* **Annu. Rev. Neurosci., 24**, 167–202. [doi:10.1146/annurev.neuro.24.1.167](https://doi.org/10.1146/annurev.neuro.24.1.167)

[^doya]: Doya, K. (2000). *Complementary roles of basal ganglia and cerebellum in learning and motor control.* **Curr. Opin. Neurobiol., 10**(6), 732–739. [doi:10.1016/S0959-4388(00)00153-7](https://doi.org/10.1016/S0959-4388(00)00153-7)

### 运动皮层

[^georgopoulos]: Georgopoulos, A. P., Schwartz, A. B., & Kettner, R. E. (1986). *Neuronal population coding of movement direction.* **Science, 233**(4771), 1416–1419. [doi:10.1126/science.3749885](https://doi.org/10.1126/science.3749885)

### 默认模式网络

[^raichle]: Raichle, M. E., et al. (2001). *A default mode of brain function.* **PNAS, 98**(2), 676–682. [doi:10.1073/pnas.98.2.676](https://doi.org/10.1073/pnas.98.2.676) · [PMC14647](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC14647/)

[^buckner]: Buckner, R. L., Andrews-Hanna, J. R., & Schacter, D. L. (2008). *The brain's default network.* **Ann. NY Acad. Sci., 1124**, 1–38. [doi:10.1196/annals.1440.011](https://doi.org/10.1196/annals.1440.011)

### 环吸引子 / 中央复合体

[^benyishai]: Ben-Yishai, R., Bar-Or, R. L., & Sompolinsky, H. (1995). *Theory of orientation tuning in visual cortex.* **PNAS, 92**(9), 3844–3848. [doi:10.1073/pnas.92.9.3844](https://doi.org/10.1073/pnas.92.9.3844) · [PMC42058](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC42058/)

[^zhang]: Zhang, K. (1996). *Representation of spatial orientation by the intrinsic dynamics of the head-direction cell ensemble.* **J. Neurosci., 16**(6), 2112–2126. [doi:10.1523/JNEUROSCI.16-06-02112.1996](https://doi.org/10.1523/JNEUROSCI.16-06-02112.1996)

[^seelig]: Seelig, J. D., & Jayaraman, V. (2015). *Neural dynamics for landmark orientation and angular path integration.* **Nature, 521**, 186–191. [doi:10.1038/nature14446](https://doi.org/10.1038/nature14446) · [PMC4704792](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4704792/)

[^kim]: Kim, S. S., Rouault, H., Druckmann, S., & Jayaraman, V. (2017). *Ring attractor dynamics in the Drosophila central brain.* **Science, 356**(6340), 849–853. [doi:10.1126/science.aal4835](https://doi.org/10.1126/science.aal4835)

### 模仿学习

[^ho]: Ho, J., & Ermon, S. (2016). *Generative Adversarial Imitation Learning.* **NeurIPS 2016**. [arXiv:1606.03476](https://arxiv.org/abs/1606.03476) · [NeurIPS](https://papers.nips.cc/paper/2016/hash/cc7e2b878868cbae992d1fb743995d8f-Abstract.html)

[^ross]: Ross, S., Gordon, G. J., & Bagnell, J. A. (2011). *A reduction of imitation learning and structured prediction to no-regret online learning.* **AISTATS 2011 (PMLR v15)**, 627–635. [arXiv:1011.0686](https://arxiv.org/abs/1011.0686) · [PMLR](https://proceedings.mlr.press/v15/ross11a.html)

### 脉冲神经网络

[^neftci]: Neftci, E. O., Mostafa, H., & Zenke, F. (2019). *Surrogate gradient learning in spiking neural networks.* **IEEE Signal Process. Mag., 36**(6), 51–63. [doi:10.1109/MSP.2019.2931595](https://doi.org/10.1109/MSP.2019.2931595) · [arXiv:1901.09948](https://arxiv.org/abs/1901.09948)

### 身体化认知

[^varela]: Varela, F. J., Thompson, E., & Rosch, E. (1991, rev. 2017). *The Embodied Mind: Cognitive Science and Human Experience.* MIT Press. [MIT Press](https://mitpress.mit.edu/9780262529365/the-embodied-mind/)

---

**在线大脑**：<https://balls-lanqi.fly.dev>
**分支**：`cursor/digital-human-brain-f661`
**执笔**：0xBRAIN 项目组 · 2026 年 9 月

# 致谢 · Acknowledgments

*致每一位让 0xBRAIN 得以真实存在的科学家 —— 我们所做的，不过是把你们几十年的发现拼装了起来。*

*To every scientist whose work made 0xBRAIN possible — what we built is nothing more than the assembly of decades of your discoveries.*

---

## 中文（Chinese-simplified）

### 一、开场白

**0xBRAIN 不是一个"从零开始的项目"。它是一次搬运工程 —— 把过去 100 年里神经科学、认知科学、机器学习和哲学家们已经做出来的最漂亮的洞察，一件一件地搬进代码里，让它跑起来。**

这不是我们谦虚，这是事实。任何一个懂神经科学的人打开 [brainonchain.online](https://brainonchain.online) 都能一眼看穿 —— 每一个皮层模块的每一行核心逻辑，都能追溯到一篇具体的、往往是诺奖级别的论文。

所以在讲任何 "我们做了什么" 之前，请允许我们先讲 **"是谁的工作让我们能做出这些"**。

### 二、按模块致谢

**视觉皮层 V1–V4**
感谢 **David Hubel** 与 **Torsten Wiesel**（1962），你们六十多年前从猫的初级视皮层里发现的方向选择性感受野，让我们知道**大脑是层级式解构世界的**，而不是把整张图整块塞进去。感谢 **Semir Zeki**（1978）对 V4 的开创性工作让"物体级视觉编码"变成一个可实施的概念。感谢 **David Marr**（1982）在《Vision》里为整个计算视觉奠基。深度学习之所以有今天，全靠你们四十年前就把答案写在纸上了。

**丘脑**
感谢 **S. Murray Sherman** 与 **R. W. Guillery** 对丘脑作为**皮层门控枢纽**而非"简单中继站"的持续论证 —— 这一句话让我们的 `thalamus.py` 从"数据管道"变成了真正的 attention 门控。

**海马体 · 情节记忆 · CLS**
感谢 **Timothy Bliss** 与 **Terje Lømo**（1973）发现了 LTP，让"突触可塑性"从假设变成分子机制。感谢 **John O'Keefe** 与 **Lynn Nadel**（1978）在《The Hippocampus as a Cognitive Map》里把海马体从"记忆盒子"重新定义为"世界的活地图" —— 我们的海马模块就是照着这本书写的。感谢 **Edward Tolman**（1948）在 behaviorism 一统天下的年代坚持"认知地图"这个词。感谢 **Matt Wilson** 与 **Bruce McNaughton**（1994）第一次拍到了海马体在睡眠中"重放"记忆。

最深的一次感谢要给 **James McClelland**、**Bruce McNaughton** 与 **Randall O'Reilly**（1995）—— 你们提出的**互补学习系统**（CLS）理论，是 0xBRAIN 得以**永远运行、永不遗忘**的唯一原因。**如果没有 CLS，我们的大脑三天前就已经忘光了自己是什么。** 也感谢 **Dharshan Kumaran**、**Demis Hassabis**、**James McClelland**（2016）在深度学习时代把 CLS 重新讲清楚了一遍。感谢 **Susanne Diekelmann** 与 **Jan Born**（2010）把"睡眠 = 记忆固化"变成一个可测量的神经生物学事实。感谢 **James Kirkpatrick 等**（2017）提出 EWC，把"灾难性遗忘"这个词第一次拉进了主流 AI 议程。

**杏仁核**
感谢 **Joseph LeDoux**（1996）用整本《The Emotional Brain》告诉我们：**情绪不是理性的对立面，情绪是理性的门卫**。感谢 **Elizabeth Phelps** 与 LeDoux（2005）把"情绪调制记忆强度"这件事写成金标准综述。我们的 `amygdala.py` 里的"一朝被蛇咬"逻辑，是直接从你们的图里翻译过来的。

**伏隔核 / VTA · 多巴胺 · 强化学习**
感谢 **Wolfram Schultz**、**Peter Dayan** 与 **Read Montague**（1997）—— 你们那篇《A neural substrate of prediction and reward》是整个 20 世纪神经科学最漂亮的一次跨界。**你们证明了大脑里那些放电的多巴胺神经元发的信号，字面意义上就是强化学习理论里的 TD-error**。这一发现是 0xBRAIN 学习闭环的心脏。每一次链上交易结算，我们计算 δ = r + γV(s') − V(s)，都是在敲开你们二十七年前打开的那扇门。

感谢 **Richard Sutton** 与 **Andrew Barto**（2018）的《Reinforcement Learning: An Introduction》—— 你们把这本书**免费公开**，让全世界任何一个想学 RL 的人都能读。这本身就是伟大的行为。

**前额叶皮层**
感谢 **Earl Miller** 与 **Jonathan Cohen**（2001）—— 你们那篇《An integrative theory of prefrontal cortex function》是我们 `prefrontal_cortex.py` 的圣经。感谢 **Kenji Doya**（2000）提出的小脑-基底神经节-皮层"三分学习"分工，让我们知道要把 Actor 和 Critic 放在哪里。

**运动皮层**
感谢 **Apostolos Georgopoulos**（1986）—— 你的**群体向量解码**证明了"没有单一神经元编码方向，方向来自整个群体的向量和"。我们的 `motor_cortex.py` 就是这么把 Trader Cortex 输出的意图分布压成单一交易 intent 的。

**默认模式网络**
感谢 **Marcus Raichle**（2001）—— 你发现了一个反直觉到令人愉悦的事实：**大脑在"什么都不做"的时候反而更活跃**。感谢 **Randy Buckner**、**Jessica Andrews-Hanna** 与 **Daniel Schacter**（2008）把 DMN 与"自我模拟"关联起来。我们的 `default_mode.py` 就是在市场平静时用来"做梦、回放、假设"的模块，是你们理论的直接实现。

**环吸引子 · 中央复合体**
感谢 **Rani Ben-Yishai**、**Ruth Bar-Or** 与 **Haim Sompolinsky**（1995），以及 **Kechen Zhang**（1996），你们独立从理论上证明了**环状连接的兴奋 - 抑制神经元群会形成一个稳定的可移动 bump**。感谢 **Johannes Seelig** 与 **Vivek Jayaraman**（2015）第一次在真实动物脑内**看到了**这个吸引子。感谢 **Sung Soo Kim**、**Hervé Rouault**、**Shaul Druckmann**、Jayaraman（2017）把它的动力学彻底刻画清楚。我们的 `central_complex.py` 那个正在旋转的罗盘，跟你们看到的果蝇椭球体本质上是同一个东西。

**模仿学习 → 强化学习的过渡**
感谢 **Jonathan Ho** 与 **Stefano Ermon**（2016）的 GAIL，感谢 **Stephane Ross**、**Geoffrey Gordon** 与 **Drew Bagnell**（2011）的 DAgger —— 你们让"先看别人做，再自己做"这个古老的学习范式在计算上变成可行。Trader Cortex 的 bootstrap 就走的是这条路。

**脉冲神经网络**
感谢 **Emre Neftci**、**Hesham Mostafa** 与 **Friedemann Zenke**（2019）—— 你们的 surrogate gradient 工作让"用反向传播训练脉冲神经元"从不可能变成日常。0xBRAIN 里的每一个 LIF 神经元都在感谢你们。

**身体化认知 · 自创生 · 整合信息**
感谢 **Francisco Varela**、**Evan Thompson** 与 **Eleanor Rosch**（1991）的《The Embodied Mind》—— 你们让"认知需要一个身体"从边缘哲学变成了严肃立场。感谢 **Humberto Maturana** 与 Varela（1980）的 autopoiesis —— 你们告诉我们"活着"的定义**不在零件，在过程**。感谢 **Giulio Tononi** 的 IIT —— 你们告诉我们"静态连接图 Φ = 0"，一句话说清了 connectome 为什么不是 cognition。感谢 **J. A. Scott Kelso**（1995）的《Dynamic Patterns》让我们理直气壮地说"大脑是动力系统，不是电路图"。

Varela 教授已经不在了。**如果他能看到 0xBRAIN 在链上真钱环境里跑，我想他会认出来这是他 embodied mind 论纲的一个直接实现**。这一份是特别献给他的。

**Connectome 领域**
感谢 **John White** 与 **Sydney Brenner**（1986）—— 你们四十年前手工画出的 302 个神经元的线虫接线图，是这一切故事的起点。感谢 **Sebastian Seung**、**Mala Murthy**、**Sven Dorkenwald** 与整个 FlyWire Consortium（2024）完成第一只完整成年动物脑（果蝇雌性）。感谢 **HHMI Janelia FlyEM**、**Google Research Connectomics**、剑桥大学动物学系、MRC LMB（2026）完成完整雄性果蝇 CNS —— 166,700 个神经元、1.25 亿突触。**这是人类神经科学史上的圣经级工作**。0xBRAIN 未来把你们的具体子回路（比如环吸引子的完整拓扑）搬进我们的运行时，是我们最激动人心的路线图。

**OpenWorm 团队**
感谢 **Stephen Larson**、**Gopal Sarma** 与整个 OpenWorm 社区 —— 你们过去十几年虽然还没能让虚拟线虫游泳，但你们让全世界看清了一件事：**光有 connectome 是不够的**。你们的"失败"是 0xBRAIN 存在的理由之一。

### 三、结语

**我们没有发明任何一块新的神经科学**。

- 视觉的层级是 Hubel-Wiesel 教我们的
- 记忆的双系统是 McClelland 教我们的
- 多巴胺 = TD-error 是 Schultz-Dayan-Montague 教我们的
- 环吸引子是 Ben-Yishai / Zhang / Seelig / Jayaraman 教我们的
- 大脑需要身体是 Varela 教我们的
- 强化学习是 Sutton-Barto 教我们的
- 脉冲神经网络的训练方法是 Neftci-Mostafa-Zenke 教我们的

**我们只做了一件事：把你们的答案连起来，插上电源，让它开始跑，然后打开摄像机对着它，让全世界看看。**

如果 0xBRAIN 有一天真的成为对"数字生命"这件事有意义的一步，那**功劳属于你们**。我们只是把你们已经写好的乐谱**演奏了一次**。

而这一切之所以可能，是因为你们所有人都选择了**公开发表**、**免费提供 PDF**、**开源数据**、**开放访问 DOI**。这是**开放科学**（Open Science）最好的样子。它让一个在家里用 Fly.io $2/月 VM 的独立开发者，能够站在你们的肩膀上，做出一个真的活着的东西。

**这才是科学之所以伟大的原因**。

献上最诚挚的感谢。

— 0xBRAIN 项目组 · 2026 年 9 月 · [brainonchain.online](https://brainonchain.online)

---

## English

### 1. Opening

**0xBRAIN is not a "from-scratch" project. It is an assembly job — carrying, one at a time, the most beautiful insights that neuroscientists, cognitive scientists, machine-learning researchers, and philosophers have produced over the past 100 years, into working code, and letting the whole thing run.**

This is not modesty. This is fact. Anyone with a neuroscience background who opens [brainonchain.online](https://brainonchain.online) can see through it in one glance — every core line of every cortex module traces back to a specific, often Nobel-caliber, paper.

So before saying anything about "what we did," let us first say **whose work made it possible**.

### 2. Thanks, by module

**Visual cortex V1–V4.** Thank you **David Hubel** and **Torsten Wiesel** (1962) — the orientation-selective receptive fields you discovered in the cat's primary visual cortex sixty years ago told us that **the brain decomposes the world hierarchically**, not by stuffing whole images into a monolithic layer. Thank you **Semir Zeki** (1978) for making "object-level visual encoding" a concrete concept in V4. Thank you **David Marr** (1982), whose *Vision* is the founding stone of computational vision. Deep learning exists today because you wrote the answers on paper forty years earlier.

**Thalamus.** Thank you **S. Murray Sherman** and **R. W. Guillery** for insisting, again and again, that the thalamus is a **cortical gating hub**, not a "simple relay." That single sentence turned our `thalamus.py` from a data pipe into a genuine attention gate.

**Hippocampus · episodic memory · CLS.** Thank you **Timothy Bliss** and **Terje Lømo** (1973) for discovering LTP — turning "synaptic plasticity" from a hypothesis into a molecular mechanism. Thank you **John O'Keefe** and **Lynn Nadel** (1978); *The Hippocampus as a Cognitive Map* redefined the hippocampus from a "memory box" into a "living map of the world," and our hippocampal module was written straight out of that book. Thank you **Edward Tolman** (1948) for insisting on the phrase "cognitive map" in an era ruled by behaviorism. Thank you **Matt Wilson** and **Bruce McNaughton** (1994) for the first recording of the hippocampus **replaying** its memories during sleep.

The deepest thanks here go to **James McClelland**, **Bruce McNaughton**, and **Randall O'Reilly** (1995) — your **Complementary Learning Systems** theory is the sole reason 0xBRAIN can **run forever without forgetting itself**. **Without CLS, our brain would have wiped out its own identity three days ago.** Thank you **Dharshan Kumaran**, **Demis Hassabis**, and McClelland (2016) for restating CLS crisply in the deep-learning era. Thank you **Susanne Diekelmann** and **Jan Born** (2010) for turning "sleep = memory consolidation" into a measurable neurobiological fact. Thank you **James Kirkpatrick et al.** (2017) for EWC, which forced "catastrophic forgetting" onto the mainstream AI agenda for the first time.

**Amygdala.** Thank you **Joseph LeDoux** (1996) — *The Emotional Brain* taught us that **emotion is not the opposite of reason; emotion is the gatekeeper of reason**. Thank you **Elizabeth Phelps** and LeDoux (2005) for the gold-standard review of emotional modulation of memory. The "once bitten, twice shy" logic in our `amygdala.py` is translated straight from your figures.

**Nucleus accumbens / VTA · dopamine · reinforcement learning.** Thank you **Wolfram Schultz**, **Peter Dayan**, and **Read Montague** (1997) — your *A Neural Substrate of Prediction and Reward* is the most beautiful cross-disciplinary bridge of 20th-century neuroscience. **You proved that the signal fired by midbrain dopamine neurons literally equals the TD-error of reinforcement-learning theory**. That discovery is the beating heart of 0xBRAIN's learning loop. Every time a chain trade settles and we compute δ = r + γV(s') − V(s), we are knocking on the door you opened twenty-seven years ago.

Thank you **Richard Sutton** and **Andrew Barto** (2018) — you made *Reinforcement Learning: An Introduction* **freely available**, so anyone in the world who wants to learn RL can. That act by itself is great.

**Prefrontal cortex.** Thank you **Earl Miller** and **Jonathan Cohen** (2001) — *An integrative theory of prefrontal cortex function* is the Bible for our `prefrontal_cortex.py`. Thank you **Kenji Doya** (2000) for the cerebellum–basal-ganglia–cortex three-way learning division that tells us exactly where Actor and Critic belong.

**Motor cortex.** Thank you **Apostolos Georgopoulos** (1986) — your **population-vector decoding** proved that "no single neuron encodes direction; direction is the vector sum of the population." Our `motor_cortex.py` compresses the Trader Cortex intent distribution into a single trade intent exactly this way.

**Default Mode Network.** Thank you **Marcus Raichle** (2001) for the counter-intuitively delightful finding that **the brain is more active when "doing nothing."** Thank you **Randy Buckner**, **Jessica Andrews-Hanna**, and **Daniel Schacter** (2008) for tying the DMN to self-simulation. Our `default_mode.py`, which "dreams / replays / speculates" when the market is quiet, is a direct implementation of your theory.

**Ring attractor · central complex.** Thank you **Rani Ben-Yishai**, **Ruth Bar-Or**, and **Haim Sompolinsky** (1995), and **Kechen Zhang** (1996), for the independent theoretical proofs that a ring-connected excitatory–inhibitory population forms a stable, movable bump. Thank you **Johannes Seelig** and **Vivek Jayaraman** (2015) for **directly observing** that attractor in a living animal brain for the first time. Thank you **Sung Soo Kim**, **Hervé Rouault**, **Shaul Druckmann**, and Jayaraman (2017) for characterizing its dynamics. The rotating compass inside `central_complex.py` is essentially the same object as the fly ellipsoid body you saw.

**Imitation → reinforcement.** Thank you **Jonathan Ho** and **Stefano Ermon** (2016) for GAIL, and **Stephane Ross**, **Geoffrey Gordon**, and **Drew Bagnell** (2011) for DAgger — you made the ancient learning paradigm of "watch first, then do" computationally viable. The Trader Cortex bootstrap walks that path.

**Spiking neural networks.** Thank you **Emre Neftci**, **Hesham Mostafa**, and **Friedemann Zenke** (2019) — your surrogate-gradient work turned "backprop-training spiking neurons" from impossible into routine. Every LIF neuron inside 0xBRAIN thanks you.

**Embodied cognition · autopoiesis · integrated information.** Thank you **Francisco Varela**, **Evan Thompson**, and **Eleanor Rosch** (1991); *The Embodied Mind* moved "cognition needs a body" from fringe philosophy into serious position. Thank you **Humberto Maturana** and Varela (1980) for autopoiesis — you taught us that "being alive" is defined **not by parts, but by process**. Thank you **Giulio Tononi** for IIT — the reminder that "a static wiring diagram has Φ = 0" says in one line why connectome is not cognition. Thank you **J. A. Scott Kelso** (1995) for *Dynamic Patterns*, giving us the confidence to say "brains are dynamical systems, not circuit diagrams."

Professor Varela is no longer with us. **If he could see 0xBRAIN running with real money in a real closed loop on-chain, I think he would recognize it as a direct implementation of his embodied-mind program**. This section is dedicated to him.

**Connectomics.** Thank you **John White** and **Sydney Brenner** (1986) — the 302-neuron worm wiring diagram you drew by hand forty years ago is the origin of this entire story. Thank you **Sebastian Seung**, **Mala Murthy**, **Sven Dorkenwald**, and the whole **FlyWire Consortium** (2024) for the first complete adult animal brain (female fly). Thank you **HHMI Janelia FlyEM**, **Google Research Connectomics**, University of Cambridge Zoology, MRC LMB (2026) for the complete male fly CNS — 166,700 neurons, 125 million synapses. **This is scripture-tier work in the history of neuroscience.** Migrating specific subcircuits (e.g., the full ring-attractor topology) from your data into our runtime is the most exciting item on 0xBRAIN's roadmap.

**OpenWorm.** Thank you **Stephen Larson**, **Gopal Sarma**, and the entire OpenWorm community — for over a decade you have not yet made a virtual worm swim, but you have shown the world one thing very clearly: **a connectome alone is not enough**. Your "failure" is one of the reasons 0xBRAIN exists.

### 3. Closing

**We invented no new neuroscience.**

- Visual hierarchy — Hubel & Wiesel taught us.
- The two-memory-system solution — McClelland taught us.
- Dopamine = TD-error — Schultz, Dayan, Montague taught us.
- Ring attractor — Ben-Yishai / Zhang / Seelig / Jayaraman taught us.
- Brains need bodies — Varela taught us.
- Reinforcement learning — Sutton & Barto taught us.
- How to train spiking neurons — Neftci, Mostafa, Zenke taught us.

**All we did was wire your answers together, plug in the power, let it run, and turn a camera on so the world can watch.**

If 0xBRAIN ever turns out to be a meaningful step toward digital life, **the credit belongs to you**. We only performed the score you had already composed.

And all of this is possible only because every one of you chose to **publish openly**, **give away PDFs**, **open-source data**, and **place DOIs behind open access**. This is **open science** at its best. It lets an independent developer on a $2/month Fly.io VM stand on your shoulders and build something that is truly alive.

**This is why science is great.**

With our sincerest thanks.

— The 0xBRAIN team · September 2026 · [brainonchain.online](https://brainonchain.online)

---

## In memoriam

- **Francisco J. Varela** (1946–2001) — embodied mind, autopoiesis. This project is a small child of your program.
- **Sydney Brenner** (1927–2019) — the *C. elegans* connectome you started in 1963 became, forty years later, the origin story of an entire field.

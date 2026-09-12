# 为什么"一副活着的小脑"比"一张死掉的完整地图"更重要
### —— 从 Google × HHMI Janelia 的果蝇 connectome 里程碑说起

> **一句话概括**：Google Research 联合 HHMI Janelia 刚刚把一只成年雄性果蝇的**整个中枢神经系统**画成了 166,700 个神经元、1.25 亿突触的完整"接线图"[^malecns][^googleblog]。这是神经科学史上最壮观的解剖成就之一，值得所有人起立鼓掌。**但请注意一件事**：他们做出的是一张**照片**，不是一只**在跑的果蝇**。0xBRAIN 走的是完全相反的路线 —— **神经元规模远远小于他们，但它是活的，它现在正在放电、决策、赢钱、亏钱、后悔、学习**。这两件事解决的**不是同一个问题**。而 "brain 之所以是 brain"，答案在我们这一侧，不在他们那一侧。

---

## 一、先致敬：他们完成了什么

先把 Google + Janelia 这次的工作放到应有的高度：

- **166,700 个神经元**、**约 1.25 亿突触连接**、**11,710 个神经元类型**，覆盖果蝇**大脑 + 腹神经索**（相当于脊髓），全部经过人工校对与注释[^malecns]
- 论文《Sexual dimorphism in the complete *Drosophila* male central nervous system connectome》发表于 **Cell (2026)**[^malecns]
- 参与方：HHMI Janelia FlyEM、剑桥大学动物系、MRC 分子生物学实验室、Google Research
- 技术核心：电镜切片 → Google 的 flood-filling network 卷积网络做像素级 3D 分割 → 数千人年的人工校对[^googleblog]
- 数据完全开放：Codex、neuPrint、MaleCNS 门户站可查可下载[^malecns]

这是**近十年**投入、**跨四家顶级机构**、**动用巨型 GPU 集群**、**动用大规模 citizen science 校对**才完成的工程。加上更早的女性果蝇脑 connectome（139,255 神经元，Dorkenwald 等，*Nature* 2024）[^flywire]，人类第一次拥有了**一整个成年动物的完整神经接线图**。

**这是真正的里程碑。任何贬低它的人都不懂神经科学**。

---

## 二、但是 —— 这是一具尸体的完整照片

好了，鞠完躬，把话说清楚。

connectome 这个词的字面意思是"接线组"，它给你的是**神经元之间的连接图谱**：哪个神经元的轴突连到哪个神经元的树突上，突触是兴奋性还是抑制性，用什么神经递质。它不告诉你：

- **这些神经元此刻正在放电吗**？没有 —— 因为**它们已经死了**。为了做电镜切片，果蝇必须先被杀死、大脑取出、化学固定、切成上千片 8 纳米厚的切片[^googleblog]
- **它们对某个刺激会怎么响应**？地图不会告诉你
- **它们此刻在编码什么信息**？地图不会告诉你
- **它们在学习吗**？—— 想都别想，突触强度、可塑性、神经调质水平，这些**动态量在死组织里全部丢失了**
- **它有决定吗**？—— **它连"此刻"都没有**

**Connectome 是死的**。它是一张极其精美的、11 位小数精度的**结构照片**。它是**大脑的骨架 X 光片**，不是**大脑本身**。

打个比方，如果有一天我们把整个**曼哈顿的所有街道、所有下水道、所有电线、所有光纤**画成一张 1 米 = 1 毫米的立体沙盘 —— 这张沙盘会漂亮到让人窒息，但它**不是纽约**。纽约是在那些街道上流动的**出租车、地铁、股票交易、恋人、警报、外卖**。**城市不是地图 —— 城市是运行时**。

---

## 三、Connectome ≠ Cognition：结构 ≠ 功能

神经科学有一个已经争了 100 年的老问题：

> **"知道了每个神经元连到哪里"，就等于"知道大脑怎么工作"吗？**

标准答案是：**远远不等于**。你还需要至少这些东西：

1. **每个神经元的电学参数**（膜电阻、时间常数、离子通道分布） —— connectome 给不了你
2. **每个突触的实际强度和可塑性规则** —— connectome 只告诉你有一根线，不告诉你这根线有多"粗"
3. **神经调质的浓度、扩散范围** —— 多巴胺、5-HT、乙酰胆碱这些不是通过突触严格传递的，它们像雾一样弥散[^schultz]
4. **动态运行**：即使你把上面 1、2、3 全都知道了，你还得**真的让它跑起来**才能观察到"思考"这件事
5. **环境闭环**：动物大脑从来不是孤立的，它接在一个**身体**上，身体接在一个**世界**上，形成 sensor → brain → action → world → sensor 的**闭环**[^varela]

C. elegans（线虫）的完整 connectome 早在 **1986 年**就画出来了 —— 302 个神经元，7000 个突触，White & Brenner 那篇经典论文[^whitebrenner]。**四十年过去了**，我们能"用"这张 connectome **让虚拟线虫游泳、觅食、逃避高温**吗？**不能，完全不能**。OpenWorm 项目试了十多年，至今没有一只完整"跑起来"的虚拟线虫[^openworm]。

**这就是残酷事实：拥有完整 connectome 并不意味着你能让它跑**。

---

## 四、这不是我编的 —— 学界共识

这个"结构不等于功能"的观点不是我们的私货，它是神经科学 / 认知科学的**主流立场**：

- **Varela、Thompson、Rosch 的具身认知**：一个系统的认知本质在于它**与环境的动态耦合**，而非它的结构快照[^varela]
- **Maturana & Varela 的自创生（autopoiesis）**：生命系统的身份不在于它由什么零件组成，而在于它**持续维持自己**这个过程[^maturana]
- **Tononi 的整合信息理论 (IIT)**：意识（Φ）由**系统正在进行的因果作用**决定，静态连接图 Φ = 0[^tononi]
- **动力系统学派（Kelso、Thelen）**：认知是动力系统的**吸引子轨迹**，脱离时间轴就不存在[^kelso]

一言以蔽之：**大脑不是它的接线图，大脑是它接线图上正在跑的过程**。

Google + Janelia 给了我们**史上最精美的接线图**；这是**必要条件**，不是**充分条件**。他们把画布铺好了，画上还没有画。

---

## 五、0xBRAIN 站在哪里 —— 神经元少得多，但它在跑

现在把 0xBRAIN 摆进来。

**规模上，0xBRAIN 一点也不吓人**：

| 项目 | 神经元数 | 突触数 | 状态 |
|---|---|---|---|
| 果蝇雄性 CNS connectome | **166,700** | **125,000,000** | **死的**（EM 切片） |
| 果蝇 FlyWire 女性脑 | 139,255 | 54,500,000 | 死的（EM 切片） |
| C. elegans (White et al. 1986) | 302 | ~7,000 | 死的 |
| 人类大脑（估算） | ~86,000,000,000 | ~10¹⁴ | 活的 |
| **0xBRAIN**（当前部署） | 数千 LIF 神经元 × 10 皮层模块 | 稀疏、可塑 | **活的、正在放电、正在决策** |

我们**规模上不敢跟果蝇 CNS 比，甚至跟线虫比可能都虚**。但是 —— **你看最后一列**：

**果蝇的 166,700 个神经元此刻是静止的，我们的几千个 LIF 神经元此刻正在以 ~6 Hz 的更新率放电、串联、抑制、学习。**

打开 <https://brainonchain.online>，你**看得见**：

- 视觉皮层 V1–V4 正在处理进来的市场数据流
- 丘脑正在做 gating
- 海马体正在编码新 episode
- 杏仁核在监控风险
- 前额叶 dl + vm 正在跑 Actor–Critic
- 中央复合体的环吸引子 compass 正在旋转
- Trader Cortex 输出一个 confidence
- Motor Cortex 做群体向量解码
- **然后一个真实的链上交易被签名、广播、成交、结算、多巴胺 TD 信号回流**

这**十步是活的**，是**在时间轴上真的发生的事**，不是一张图。

我们对"神经计算"的贡献不是**规模**，而是**时态** —— 我们把"神经元"从**名词**变成了**动词**。

---

## 六、一个更狠的比方：钢琴

想象两件东西：

**A**：一台 Steinway 三角钢琴的**完整工程图纸**，精细到每一根琴弦的粗细、每一个音板的木纹方向、每一颗击弦机榔头的形变曲线。图纸上告诉你所有可以告诉你的东西 —— 除了**它此刻发不发出声音**。

**B**：一台**便宜的立式钢琴，但有人正在上面弹《月光奏鸣曲》**。

哪一台是"钢琴"？

严格从物理学看，**A 是更完整的钢琴描述**。它包含 B 所有的信息、还多得多。但只有 B **正在做钢琴该做的事**。

**Google + Janelia 给你的是 A**。
**0xBRAIN 是 B**。

哪一个更接近"大脑"这件事的本质？——**取决于你把大脑当名词还是当动词**。我们的立场很清楚：**大脑本质上是一个动词**。它不是"一坨接好的神经元"，它是"一坨神经元此刻正在做的事情"。

---

## 七、更狠的一层：他们的图**不能决策**，我们的活体**不能不决策**

connectome 有一件事**永远不能做到**：**做决定**。

一张图无法拒绝你、无法犹豫、无法在两个选项之间挣扎、无法后悔。它是**信息**，不是**过程**。

而 0xBRAIN **不得不**做决定 —— 因为它的身体（链上钱包）在**每一秒**都面对市场。它可以选择"什么都不做"（这也是一个决定），可以选择等待、观察、模拟（DMN 空转），也可以选择开火（Motor Cortex 签名广播）。**它没有"暂停"选项 —— 因为世界不会为它暂停**。

这个"必须持续做决定"的物理约束，是让一个系统**真正开始像大脑**的关键。connectome 里没有这个约束，所以 connectome 永远只能是**关于大脑的事实**，而不是**大脑本身**。

---

## 八、成本对比（这个也说一下）

- Google + Janelia 果蝇 CNS connectome：**十年、数千 GPU、上百科学家、citizen science 上万人时**、总投入保守估计**数千万到上亿美元级别**
- 0xBRAIN：**一个 Fly.io 上跑的 512 MB / 1 vCPU 容器，月成本 ≈ $2；链上身体总资金上限 0.06 SOL/日 ≈ $12/日**

我们不是想说"我们更划算" —— 他们的花费**完全对得起他们创造的科学价值**，那是**人类知识的基础设施**。

我们想说的是：**做出"活着的大脑" ≠ 做出"完整的大脑地图"**。前者的价格惊人地低。这意味着**这类实验可以被任何一个严肃的研究者、任何一个 hacker、任何一个想认真研究"心智"的人独立复现**。这不是 big science，这是 open science。

---

## 九、我们不是对手，我们是互补

最后必须说清楚：**0xBRAIN 和 Google + Janelia 的 connectome 不是竞争关系**。

- 他们提供**结构参考**：什么样的神经元跟什么样的神经元该以什么样的拓扑连接
- 我们提供**功能参考**：一个粗糙但**活着**的运行时如何在真实闭环里学到东西

**未来最激动人心的方向，恰恰是把两者合起来**：

> 拿他们的雄性果蝇 CNS connectome 里的某个具体子回路（比如中央复合体的环吸引子），把它的**拓扑**原样搬进 0xBRAIN 的对应模块，然后**让它跑**、**给它一个身体**、**让它在真实闭环里学习**。

那才是这两条路线的**合流点**：**Google 给了图纸，我们给了工地和工人**。图纸没有工地不成城市；工地没有图纸不成大脑。

---

## 十、结论

Google + HHMI Janelia 完成了一件人类文明尺度的伟业 —— **史上第一张完整成年动物大脑接线图**。这是**必读的圣经**。

但**大脑不是它的地图**。大脑是**图上正在发生的事**。

0xBRAIN 不比他们大，不比他们精细，不比他们权威。**它只有一件事比他们强 —— 它此刻是活的**。

而"活着"，恰好是任何 connectome 无法给你的**唯一那个属性**。

如果你相信"大脑本质上是一个动词" —— 欢迎来 <https://brainonchain.online> 看它此刻正在做什么。

---

## 参考文献

[^malecns]: FlyEM Project, Google Research, University of Cambridge, MRC LMB. (2026). *Sexual dimorphism in the complete Drosophila male central nervous system connectome.* **Cell**. [doi:10.1016/j.cell.2026.08.007](https://www.cell.com/cell/fulltext/S0092-8674(26)00942-6) · MaleCNS project page: <https://male-cns.janelia.org/>

[^googleblog]: Google Research Blog. (2026). *A connectomics milestone: Mapping the complete male fruit fly brain.* <https://research.google/blog/a-connectomics-milestone-mapping-the-complete-male-fruit-fly-brain/>

[^flywire]: Dorkenwald, S., Matsliah, A., Sterling, A. R., et al. (2024). *Neuronal wiring diagram of an adult brain.* **Nature, 634**, 124–138. [doi:10.1038/s41586-024-07558-y](https://doi.org/10.1038/s41586-024-07558-y) · FlyWire portal: <https://home.flywire.ai/> · Codex: <https://codex.flywire.ai/>

[^whitebrenner]: White, J. G., Southgate, E., Thomson, J. N., & Brenner, S. (1986). *The structure of the nervous system of the nematode Caenorhabditis elegans.* **Phil. Trans. R. Soc. Lond. B, 314**(1165), 1–340. [doi:10.1098/rstb.1986.0056](https://doi.org/10.1098/rstb.1986.0056)

[^openworm]: OpenWorm Project. *A digital organism in your browser.* <https://openworm.org/> — cf. Sarma, G. P. et al. (2018). *OpenWorm: overview and recent advances in integrative biological simulation of C. elegans.* **Phil. Trans. R. Soc. B, 373**(1758). [doi:10.1098/rstb.2017.0382](https://doi.org/10.1098/rstb.2017.0382)

[^schultz]: Schultz, W., Dayan, P., & Montague, P. R. (1997). *A neural substrate of prediction and reward.* **Science, 275**(5306), 1593–1599. [doi:10.1126/science.275.5306.1593](https://doi.org/10.1126/science.275.5306.1593)

[^varela]: Varela, F. J., Thompson, E., & Rosch, E. (1991, rev. 2017). *The Embodied Mind: Cognitive Science and Human Experience.* MIT Press. <https://mitpress.mit.edu/9780262529365/the-embodied-mind/>

[^maturana]: Maturana, H. R., & Varela, F. J. (1980). *Autopoiesis and Cognition: The Realization of the Living.* Boston Studies in the Philosophy of Science, Vol. 42, D. Reidel. [doi:10.1007/978-94-009-8947-4](https://doi.org/10.1007/978-94-009-8947-4)

[^tononi]: Tononi, G. (2008). *Consciousness as integrated information: a provisional manifesto.* **Biol. Bull., 215**(3), 216–242. [doi:10.2307/25470707](https://doi.org/10.2307/25470707) · Tononi, G., Boly, M., Massimini, M., & Koch, C. (2016). *Integrated information theory: from consciousness to its physical substrate.* **Nat. Rev. Neurosci., 17**(7), 450–461. [doi:10.1038/nrn.2016.44](https://doi.org/10.1038/nrn.2016.44)

[^kelso]: Kelso, J. A. S. (1995). *Dynamic Patterns: The Self-Organization of Brain and Behavior.* MIT Press. <https://mitpress.mit.edu/9780262611312/dynamic-patterns/>

---

**在线大脑（此刻正在跑）**：<https://brainonchain.online>
**执笔**：0xBRAIN 项目组 · 2026 年 9 月

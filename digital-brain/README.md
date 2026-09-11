# 数字人脑 · The Digital Human Brain

**A live digital human brain — eight anatomical regions, each a real neural network, cooperating in real time. No LLM used.**

一个真正在"活着"的数字人脑：8 个脑区，每个都是一个**真实的神经网络模块**，共同感知、记忆、决策、产生情绪。整个系统运行在浏览器里，实时可视化，**完全不使用 LLM**。

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
- 只有 8 个脑区、几百个参数——离真人脑（860 亿神经元、每个 1000+ 突触）差 8 个数量级

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

## 许可

MIT — 随便用。

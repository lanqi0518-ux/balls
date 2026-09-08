# 🎰 Powerball Lottery - 链上抽奖代币

自动开奖的链上 Powerball 抽奖系统，部署在 Robinhood Chain 上。默认每 70 秒开一次奖，
其中 10 秒用于冻结名单、60 秒留给新买家满足持币时长。

## 📁 项目结构

```
powerball-lottery/
├── contracts/           # 智能合约 (Foundry)
│   ├── src/
│   │   ├── LotteryToken.sol      # 带税费的ERC20代币
│   │   └── PowerballLottery.sol  # 抽奖合约
│   ├── test/           # 测试文件
│   └── script/         # 部署脚本
├── backend/            # 后端服务 (Node.js)
│   └── src/
│       ├── index.ts              # 入口与API路由
│       ├── auto-lottery.ts       # 开奖调度与派奖
│       ├── holder-tracker.ts     # 持币者追踪与资格判定
│       ├── draw-random.ts        # commit-reveal 随机数
│       ├── auth.ts               # 管理接口鉴权
│       └── config.ts             # 配置
└── frontend/           # 前端网页 (React + Vite)
    └── src/
        ├── components/           # UI组件
        ├── hooks/                # 自定义Hooks
        └── contracts.ts          # 合约配置
```

## 🎮 核心机制

### 税费分配
- 每笔交易收取 **4%** 税费
- **3%** 进入抽奖奖池，开奖时全额发给中奖者
- **1%** 在有中奖者的那一轮转给团队钱包

### 号码分配
- 每个持币地址根据地址哈希分配 **1-50** 的固定号码
- 公式：`number = keccak256(address) % 50 + 1`
- 确定性分配，透明可验证

### 参与资格
- 需持币满 `MIN_HOLDING_DURATION` 秒（默认 60 秒）
- 按余额排序，只有前 `TOP_HOLDERS_LIMIT` 名（默认 100）参与开奖
- 开奖前 `SNAPSHOT_LEAD_TIME`（默认 10 秒）冻结参与者名单

### 开奖机制
- 每 `DRAW_INTERVAL`（默认 70 秒）自动开奖一次：10 秒快照锁定 + 60 秒买家窗口
- 随机抽取 1-50 中的一个号码
- 持有该号码的所有地址按余额比例瓜分奖池
- 该轮无人持有中奖号码时，奖池滚入下一轮

> 默认让 `DRAW_INTERVAL - SNAPSHOT_LEAD_TIME` 恰好等于 `MIN_HOLDING_DURATION`，
> 这样新买家在一次开奖后立刻买入，正好有 60 秒达到持币门槛，能赶上下一次开奖。
> 若把 `DRAW_INTERVAL` 改小至 60 秒，新买家最多需要多等一轮才能生效。

### 开奖可验证性
链下开奖采用 commit-reveal：

1. 冻结名单时生成一个保密的 `serverSeed`，同时公布 `commitment = keccak256(serverSeed)`
2. 开奖结果连同 `serverSeed` 一起公布
3. 任何人都可以复核：`keccak256(serverSeed)` 应等于事先公布的 `commitment`，
   且 `keccak256(serverSeed, drawId, snapshotHash) % 50 + 1` 应等于中奖号码

因为 `commitment` 在开奖前就已公开，运营方无法在看到名单后改用对自己有利的种子；
又因为 `serverSeed` 在开奖前保密，参与者也无法提前算出号码。
`backend/src/draw-random.ts` 的 `verifyDraw()` 实现了这个复核。

---

## 🚀 快速开始

### 1. 安装依赖

```bash
# 前端
cd frontend
npm install

# 后端
cd ../backend
npm install

# 合约（需要安装 Foundry）
cd ../contracts
git submodule update --init --recursive
forge build
```

### 运行测试

```bash
cd contracts && forge test    # 合约
cd backend && npm test        # 后端
```

### 2. 运行前端（开发模式）

```bash
cd frontend
npm run dev
```

访问 http://localhost:3000 查看网站

### 3. 运行后端（开发模式）

```bash
cd backend
cp .env.example .env
# 编辑 .env 填写配置
npm run dev
```

---

## 📝 部署流程

### 步骤1: 部署智能合约

```bash
cd contracts
cp .env.example .env
# 编辑 .env 填写私钥和团队钱包地址

# 部署到 Robinhood Chain
forge script script/Deploy.s.sol --rpc-url https://rpc.robinhoodchain.com --broadcast
```

### 步骤2: 更新前端配置

编辑 `frontend/src/contracts.ts`，填入部署后的合约地址：

```typescript
export const LOTTERY_TOKEN_ADDRESS = '0x...' // 代币合约地址
export const POWERBALL_LOTTERY_ADDRESS = '0x...' // 抽奖合约地址
```

### 步骤3: 更新后端配置

编辑 `backend/.env`，完整选项见 `backend/.env.example`：

```env
TOKEN_ADDRESS=0x...
TAX_RECEIVER_WALLET=0x...
TAX_RECEIVER_PRIVATE_KEY=...
TEAM_WALLET=0x...

AUTO_DRAW_ENABLED=true
ADMIN_TOKEN=<一段随机字符串>
ALLOWED_ORIGINS=https://your-frontend-domain
```

### 步骤4: 创建流动性池

在 Uniswap V4 上创建 PBALL/WETH 交易对，添加初始流动性。

### 步骤5: 启动服务

```bash
# 启动后端
cd backend
npm start

# 构建并部署前端
cd ../frontend
npm run build
# 将 dist 目录部署到静态托管服务
```

---

## 🔧 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查（含 `scanComplete`，为 false 表示持币者名单不完整） |
| `/health/deep` | GET | 含 RPC 连通性的健康检查 |
| `/api/status` | GET | 抽奖状态、奖池、倒计时、当前快照 |
| `/api/events` | GET | SSE 实时推送（`status` / `snapshot` / `draw`） |
| `/api/draws` | GET | 最近开奖记录 |
| `/api/user/:address` | GET | 用户信息 |
| `/api/number/:address` | GET | 查询号码 |
| `/api/distribution` | GET | 号码分布 |
| `/api/holders` | GET | 持币者列表 |
| `/api/tracker/stats` | GET | 追踪器统计 |
| `/api/tracker/rescan` | POST | 强制重新扫描（需鉴权） |
| `/api/tracker/exclude` | POST | 加入排除名单（需鉴权） |
| `/api/admin/verify-config` | GET | 校验转账配置（需鉴权） |

需鉴权的端点要求请求头 `Authorization: Bearer $ADMIN_TOKEN`。
未设置 `ADMIN_TOKEN` 时这些端点直接返回 503，而不是放开访问。

---

## ⚠️ 风险提示

1. **法律风险**: 博彩类应用在多数地区受监管，请确保合规
2. **智能合约风险**: 建议部署前进行专业审计
3. **经济模型风险**: 交易量低时奖池积累慢
4. **女巫攻击**: 号码由地址哈希决定，攻击者可以生成大量映射到同一号码的地址。
   `TOP_HOLDERS_LIMIT` 按余额截断参与者，`MIN_HOLDING_DURATION` 要求持币时长，
   两者共同抬高了成本，但都无法彻底消除这个问题
5. **链上随机数**: 合约里的 `_generateWinningNumber` 使用 `block.prevrandao` 和
   `blockhash`，验证者在一定范围内可以操纵它们。上线前应换成 Chainlink VRF
   之类的可验证随机数预言机。链下开奖走的是 commit-reveal，不受此限制

---

## 📄 License

MIT

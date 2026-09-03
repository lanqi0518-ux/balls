# 🎰 Powerball Lottery - 链上抽奖代币

每分钟自动开奖的链上Powerball抽奖系统，部署在 Robinhood Chain 上。

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
│       ├── index.ts              # 入口
│       ├── lottery-service.ts    # 抽奖服务
│       ├── auto-drawer.ts        # 自动开奖
│       └── api.ts                # API路由
└── frontend/           # 前端网页 (React + Vite)
    └── src/
        ├── components/           # UI组件
        ├── hooks/                # 自定义Hooks
        └── contracts.ts          # 合约配置
```

## 🎮 核心机制

### 税费分配
- 每笔交易收取 **4%** 税费
- **3%** 自动进入抽奖奖池
- **1%** 给团队钱包

### 号码分配
- 每个持币地址根据地址哈希分配 **1-50** 的固定号码
- 公式：`number = hash(address) % 50 + 1`
- 确定性分配，透明可验证

### 开奖机制
- 每分钟自动开奖一次
- 随机抽取 1-50 中的一个号码
- 持有该号码的所有地址平分奖池
- 中奖者需主动领取奖金

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
forge install OpenZeppelin/openzeppelin-contracts
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

编辑 `backend/.env`：

```env
TOKEN_ADDRESS=0x...
LOTTERY_ADDRESS=0x...
DRAWER_PRIVATE_KEY=...
AUTO_DRAW_ENABLED=true
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
| `/health` | GET | 健康检查 |
| `/api/token/info` | GET | 代币信息 |
| `/api/token/balance/:address` | GET | 查询余额 |
| `/api/number/:address` | GET | 查询号码 |
| `/api/lottery/stats` | GET | 抽奖统计 |
| `/api/lottery/prize-pool` | GET | 当前奖池 |
| `/api/lottery/draws/recent` | GET | 最近开奖 |
| `/api/lottery/draws/:id` | GET | 开奖详情 |
| `/api/user/:address` | GET | 用户信息 |
| `/api/service/status` | GET | 服务状态 |
| `/api/service/draw` | POST | 手动开奖（需认证） |

---

## ⚠️ 风险提示

1. **法律风险**: 博彩类应用在多数地区受监管，请确保合规
2. **智能合约风险**: 建议部署前进行专业审计
3. **经济模型风险**: 交易量低时奖池积累慢
4. **女巫攻击**: 恶意用户可能创建大量小额地址刷号码

---

## 📄 License

MIT

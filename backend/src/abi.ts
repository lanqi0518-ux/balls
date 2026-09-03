// LotteryToken ABI（简化版，只包含需要的函数）
export const LotteryTokenABI = [
  // 读取函数
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function getNumber(address holder) pure returns (uint8)',
  'function getHoldersCount() view returns (uint256)',
  'function getAllHolders() view returns (address[])',
  'function getHoldersPaginated(uint256 offset, uint256 limit) view returns (address[])',
  'function getHoldersByNumber(uint8 number) view returns (address[])',
  'function getHoldersCountByNumber(uint8 number) view returns (uint256)',
  'function isHolder(address) view returns (bool)',
  'function holderNumber(address) view returns (uint8)',
  
  // 事件
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event TaxCollected(address indexed from, uint256 lotteryAmount, uint256 teamAmount)',
  'event HolderAdded(address indexed holder, uint8 number)',
  'event HolderRemoved(address indexed holder, uint8 number)',
];

// PowerballLottery ABI（简化版）
export const PowerballLotteryABI = [
  // 读取函数
  'function currentDrawId() view returns (uint256)',
  'function lastDrawTime() view returns (uint256)',
  'function drawInterval() view returns (uint256)',
  'function canDraw() view returns (bool)',
  'function getCurrentPrizePool() view returns (uint256)',
  'function getTimeUntilNextDraw() view returns (uint256)',
  'function getDrawInfo(uint256 drawId) view returns (tuple(uint256 drawId, uint256 timestamp, uint8 winningNumber, uint256 prizePool, uint256 winnersCount, uint256 prizePerWinner, bool distributed))',
  'function getDrawWinners(uint256 drawId) view returns (tuple(address winner, uint256 prize, bool claimed)[])',
  'function getRecentDraws(uint256 count) view returns (tuple(uint256 drawId, uint256 timestamp, uint8 winningNumber, uint256 prizePool, uint256 winnersCount, uint256 prizePerWinner, bool distributed)[])',
  'function getUserNumber(address user) view returns (uint8)',
  'function getPendingPrize(address user) view returns (uint256)',
  'function getStats() view returns (uint256 totalDraws, uint256 totalDistributed, uint256 currentPrizePool, uint256 holdersCount)',
  'function totalDraws() view returns (uint256)',
  'function totalDistributed() view returns (uint256)',
  
  // 写入函数
  'function draw() returns (uint256)',
  'function claimPrize()',
  
  // 事件
  'event DrawExecuted(uint256 indexed drawId, uint8 winningNumber, uint256 prizePool, uint256 winnersCount, uint256 prizePerWinner)',
  'event PrizeClaimed(address indexed winner, uint256 amount)',
  'event DrawerRewarded(address indexed drawer, uint256 reward)',
  'event PrizeRolledOver(uint256 indexed fromDrawId, uint256 amount)',
];

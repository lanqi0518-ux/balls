// 合约地址（部署后需要更新）
export const LOTTERY_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000' as const
export const POWERBALL_LOTTERY_ADDRESS = '0x0000000000000000000000000000000000000000' as const

// LotteryToken ABI
export const LotteryTokenABI = [
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getNumber',
    stateMutability: 'pure',
    inputs: [{ name: 'holder', type: 'address' }],
    outputs: [{ type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'getHoldersCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getHoldersByNumber',
    stateMutability: 'view',
    inputs: [{ name: 'number', type: 'uint8' }],
    outputs: [{ type: 'address[]' }],
  },
] as const

// PowerballLottery ABI
export const PowerballLotteryABI = [
  {
    type: 'function',
    name: 'currentDrawId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'lastDrawTime',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'drawInterval',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'canDraw',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getCurrentPrizePool',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getTimeUntilNextDraw',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getDrawInfo',
    stateMutability: 'view',
    inputs: [{ name: 'drawId', type: 'uint256' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'drawId', type: 'uint256' },
        { name: 'timestamp', type: 'uint256' },
        { name: 'winningNumber', type: 'uint8' },
        { name: 'prizePool', type: 'uint256' },
        { name: 'winnersCount', type: 'uint256' },
        { name: 'prizePerWinner', type: 'uint256' },
        { name: 'distributed', type: 'bool' },
      ],
    }],
  },
  {
    type: 'function',
    name: 'getRecentDraws',
    stateMutability: 'view',
    inputs: [{ name: 'count', type: 'uint256' }],
    outputs: [{
      type: 'tuple[]',
      components: [
        { name: 'drawId', type: 'uint256' },
        { name: 'timestamp', type: 'uint256' },
        { name: 'winningNumber', type: 'uint8' },
        { name: 'prizePool', type: 'uint256' },
        { name: 'winnersCount', type: 'uint256' },
        { name: 'prizePerWinner', type: 'uint256' },
        { name: 'distributed', type: 'bool' },
      ],
    }],
  },
  {
    type: 'function',
    name: 'getUserNumber',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'getPendingPrize',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getStats',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'totalDraws', type: 'uint256' },
      { name: 'totalDistributed', type: 'uint256' },
      { name: 'currentPrizePool', type: 'uint256' },
      { name: 'holdersCount', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'claimPrize',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'event',
    name: 'DrawExecuted',
    inputs: [
      { name: 'drawId', type: 'uint256', indexed: true },
      { name: 'winningNumber', type: 'uint8', indexed: false },
      { name: 'prizePool', type: 'uint256', indexed: false },
      { name: 'winnersCount', type: 'uint256', indexed: false },
      { name: 'prizePerWinner', type: 'uint256', indexed: false },
    ],
  },
] as const

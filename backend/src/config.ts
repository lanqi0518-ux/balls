import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Blockchain config
  rpcUrl: process.env.RPC_URL || 'https://rpc.mainnet.chain.robinhood.com',
  chainId: parseInt(process.env.CHAIN_ID || '4663'),
  
  // Token contract address (BALLS token for holder tracking)
  tokenAddress: process.env.TOKEN_ADDRESS || '',
  lotteryAddress: process.env.LOTTERY_ADDRESS || '',
  
  // Tax collection wallet — the token contract sends BOTH the 3% lottery
  // tax and the 1% team tax to this address, so the balance represents the
  // full 4% share of trading volume. The backend splits it in software:
  //   * `prizePoolBps` (default 7500 = 75%) is the prize pool paid to winners
  //   * The remaining 25% is the team fee (stays in the wallet unless a
  //     separate `devWallet` is configured with a signer)
  taxReceiverWallet: process.env.TAX_RECEIVER_WALLET || '0x4E91fc43e0a9BFBaf98D063eEf393Fe74211E624',
  taxReceiverPrivateKey: process.env.TAX_RECEIVER_PRIVATE_KEY || '',

  // Legacy: a separate on-chain wallet just for the 1% share. Only used when
  // set AND different from taxReceiverWallet — otherwise the single-wallet
  // model above (75/25 split of one balance) is used.
  publisherWallet: process.env.PUBLISHER_WALLET || '',
  publisherPrivateKey: process.env.PUBLISHER_PRIVATE_KEY || '',

  // Optional: address the 25% team fee is forwarded to on each draw. Leave
  // unset (or equal to taxReceiverWallet) to keep the fee in the tax wallet.
  devWallet: process.env.TEAM_WALLET || '0x4E91fc43e0a9BFBaf98D063eEf393Fe74211E624',

  // Share of the tax wallet displayed as the prize pool and paid to winners,
  // in basis points. Default 7500 = 75% (i.e. the 3% portion of a 3%+1% tax).
  prizePoolBps: parseInt(process.env.PRIZE_POOL_BPS || '7500'),

  // Amount of ETH parked in the tax wallet that ISN'T part of the tax pool
  // (e.g. an initial seed the operator personally deposited for gas). This is
  // subtracted from the wallet balance BEFORE the prize/team split, and the
  // UI shows the smaller number as the jackpot. Transfers also respect it,
  // so this ETH is never included in a prize payout.
  excludedBaselineEth: parseFloat(process.env.EXCLUDED_BASELINE_ETH || '0'),
  
  prizeInEth: true,
  
  // Excluded addresses (LP pools, contracts, etc.)
  excludedAddresses: [
    '0x267444d099b10fb5ed7c3cc7b7c767adca574952', // LP Pool
    '0x8366a39cc670b4001a1121b8f6a443a643e40951', // Router/Contract
  ],
  
  port: parseInt(process.env.PORT || '3001'),
  // 70s per draw: 10s snapshot lead + 60s buyer window. Sized so that a fresh
  // buyer arriving right after a draw has exactly minHoldingDuration seconds
  // to clear the requirement before the next snapshot freezes the list.
  // Shorter intervals still work, but any buyer who arrives during the
  // (drawInterval - snapshotLeadTime - minHoldingDuration) tail has to sit
  // out one round before becoming eligible.
  drawInterval: parseInt(process.env.DRAW_INTERVAL || '70000'),
  autoDrawEnabled: process.env.AUTO_DRAW_ENABLED !== 'false',

  // How long before a draw the participant list is frozen.
  snapshotLeadTime: parseInt(process.env.SNAPSHOT_LEAD_TIME || '10000'),

  // How long an address must hold before it can win. Matches the default
  // buyer window (drawInterval - snapshotLeadTime = 60s) so a fresh buyer
  // can qualify for the very next draw.
  minHoldingDuration: parseInt(process.env.MIN_HOLDING_DURATION || '60'),

  // Number of top holders by balance that take part in a draw.
  topHoldersLimit: parseInt(process.env.TOP_HOLDERS_LIMIT || '100'),

  // Shared secret required by mutating/admin endpoints. When unset those
  // endpoints are disabled rather than left open to the internet.
  adminToken: process.env.ADMIN_TOKEN || '',

  // Comma-separated list of allowed browser origins. Empty means allow all.
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean),

  // When true, the server fabricates its own holders, prize pool growth and
  // draws so the site is fully interactive without a deployed token contract.
  // Overrides TOKEN_ADDRESS while set — set DEMO_MODE=false and provide a
  // real TOKEN_ADDRESS to switch to production.
  demoMode: process.env.DEMO_MODE === 'true',
};

/**
 * Time between a snapshot being frozen and the next one being taken. A buyer
 * who arrives just after a snapshot has this long to clear minHoldingDuration
 * if they want to make the very next draw.
 */
export function getEligibilityWindowMs(): number {
  return config.drawInterval - config.snapshotLeadTime;
}

export function validateConfig(): void {
  console.log('\n📋 Configuration:');
  console.log(`  Token: ${config.tokenAddress || '(not set - waiting)'}`);
  console.log(`  Tax Wallet (collects 3% + 1%): ${config.taxReceiverWallet}`);
  if (config.excludedBaselineEth > 0) {
    console.log(`  Excluded baseline: ${config.excludedBaselineEth} ETH (not part of the pool)`);
  }
  console.log(`  Prize pool share: ${config.prizePoolBps / 100}% of (balance − baseline − gas) (winners)`);
  console.log(`  Team fee share:  ${(10000 - config.prizePoolBps) / 100}% of same`);
  const devSameAsTax = config.devWallet.toLowerCase() === config.taxReceiverWallet.toLowerCase();
  console.log(`  Team fee destination: ${devSameAsTax ? '(stays in tax wallet)' : config.devWallet}`);

  console.log('\n⏱️ Schedule:');
  console.log(`  Draw interval: ${config.drawInterval / 1000}s`);
  console.log(`  Snapshot lead: ${config.snapshotLeadTime / 1000}s before each draw`);
  console.log(`  Min holding: ${config.minHoldingDuration}s`);
  console.log(`  Top holders: ${config.topHoldersLimit}`);
  console.log(`  Auto draw: ${config.autoDrawEnabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`  Demo mode: ${config.demoMode ? 'ENABLED (fake holders + fake draws)' : 'disabled'}`);

  console.log('\n🚫 Excluded Addresses (not counted as holders):');
  config.excludedAddresses.forEach(addr => {
    console.log(`  - ${addr}`);
  });

  if (!config.tokenAddress && !config.demoMode) {
    console.log('\n⚠️ TOKEN_ADDRESS not set - draws paused, prize pool uses real tax-wallet ETH');
  }

  if (!config.adminToken) {
    console.log('\n⚠️ ADMIN_TOKEN not set - /api/tracker/* and /api/admin/* are disabled');
  }

  if (config.drawInterval <= 0) {
    throw new Error(`DRAW_INTERVAL must be positive, got ${config.drawInterval}ms`);
  }

  if (config.snapshotLeadTime >= config.drawInterval) {
    throw new Error(
      `SNAPSHOT_LEAD_TIME (${config.snapshotLeadTime}ms) must be shorter than ` +
      `DRAW_INTERVAL (${config.drawInterval}ms), otherwise the snapshot for a draw ` +
      `would be due before the previous draw has run.`
    );
  }

  if (config.minHoldingDuration <= 0) {
    throw new Error(
      `MIN_HOLDING_DURATION must be positive, otherwise an address can buy in ` +
      `right before the snapshot and win the draw it just funded.`
    );
  }

  const windowMs = getEligibilityWindowMs();
  if (config.minHoldingDuration * 1000 > windowMs) {
    const waitRounds = Math.ceil((config.minHoldingDuration * 1000) / config.drawInterval) + 1;
    console.log(
      `\n⚠️ MIN_HOLDING_DURATION (${config.minHoldingDuration}s) exceeds the gap between ` +
      `snapshots (${windowMs / 1000}s), so a new buyer waits up to ${waitRounds} draws ` +
      `before becoming eligible.`
    );
  }

  if (config.prizePoolBps <= 0 || config.prizePoolBps > 10000) {
    throw new Error(
      `PRIZE_POOL_BPS must be in (0, 10000], got ${config.prizePoolBps}. ` +
      `Default is 7500 (75%) matching a 3%+1% tax split.`
    );
  }

  if (!Number.isFinite(config.excludedBaselineEth) || config.excludedBaselineEth < 0) {
    throw new Error(
      `EXCLUDED_BASELINE_ETH must be a non-negative number, got ${config.excludedBaselineEth}.`
    );
  }
}

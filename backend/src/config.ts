import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Blockchain config
  rpcUrl: process.env.RPC_URL || 'https://rpc.mainnet.chain.robinhood.com',
  chainId: parseInt(process.env.CHAIN_ID || '4663'),
  
  // Token contract address (BALLS token for holder tracking)
  tokenAddress: process.env.TOKEN_ADDRESS || '',
  lotteryAddress: process.env.LOTTERY_ADDRESS || '',
  
  // Prize pool wallet — receives the 3% lottery tax.
  // 100% of this wallet (minus 0.05 ETH gas) goes to winners.
  taxReceiverWallet: process.env.TAX_RECEIVER_WALLET || '0xfaF2deaF29C4A0bb086195c675eA37d4820E0598',
  taxReceiverPrivateKey: process.env.TAX_RECEIVER_PRIVATE_KEY || '',
  
  // Publisher automatically receives 1%. At draw time this is forwarded
  // to teamWallet together with prize payouts.
  // If empty or the same as the prize wallet, only the 3% prize pool is paid.
  publisherWallet: process.env.PUBLISHER_WALLET || '',
  publisherPrivateKey: process.env.PUBLISHER_PRIVATE_KEY || '',
  
  // Team wallet that receives the forwarded publisher 1%
  devWallet: process.env.TEAM_WALLET || '0x9bae8aDF73F0dd6d27acB12E41eb9B800f93785F',
  
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
  console.log(`  Prize Pool Wallet (3%): ${config.taxReceiverWallet}`);
  console.log(`  Publisher Wallet (1%): ${config.publisherWallet || '(same as prize pool — 1% forward skipped)'}`);
  console.log(`  Team Wallet (receives 1%): ${config.devWallet}`);
  console.log('  Payout: 3% ALL to winners | 1% forwarded to team at draw');

  console.log('\n⏱️ Schedule:');
  console.log(`  Draw interval: ${config.drawInterval / 1000}s`);
  console.log(`  Snapshot lead: ${config.snapshotLeadTime / 1000}s before each draw`);
  console.log(`  Min holding: ${config.minHoldingDuration}s`);
  console.log(`  Top holders: ${config.topHoldersLimit}`);
  console.log(`  Auto draw: ${config.autoDrawEnabled ? 'ENABLED' : 'DISABLED'}`);
  
  console.log('\n🚫 Excluded Addresses (not counted as holders):');
  config.excludedAddresses.forEach(addr => {
    console.log(`  - ${addr}`);
  });
  
  if (!config.tokenAddress) {
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
}

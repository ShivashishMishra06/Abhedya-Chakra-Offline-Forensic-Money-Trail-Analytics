/**
 * Synthetic Test Data Generator for Operation Abhedya-Chakra
 * Generates an 11-column forensic dataset with realistic banking traffic
 * and injected multi-tiered money mule rings (L1, L2, L3).
 *
 * NOTE: For development and offline testing only.
 * Production app starts empty with zero synthetic pre-loads.
 */

export interface GeneratorOptions {
  totalRows: number;
  numVictims: number;
  muleRingsCount: number;
  startDate?: string;
}

export interface SyntheticDatasetOutput {
  csvText: string;
  groundTruthCsvText: string;
  sampleVictims: string[];
  injectedMules: string[];
  totalRows: number;
  distinctAccounts: number;
}

const INDIAN_IFSC_PREFIXES = [
  'SBIN0001234',
  'HDFC0004567',
  'ICIC0007890',
  'PUNB0002468',
  'BARB0001357',
  'CNRB0003691',
  'UBIN0009876',
  'UTIB0005432',
  'KKBK0001122',
  'YESB0003344',
];

const DOMESTIC_IPS = [
  '103.21.244.',
  '103.22.200.',
  '117.200.12.',
  '122.160.45.',
  '157.48.90.',
  '49.36.128.',
  '14.139.112.',
];

const FOREIGN_PROXY_IPS = [
  '185.220.101.',
  '185.191.171.',
  '194.26.29.',
  '194.165.16.',
];

const LEGIT_NARRATIONS = [
  'UPI-P2A-RentPayment',
  'IMPS-Salary-Direct',
  'NEFT-Vendor-Invoice-99',
  'UPI-Groceries-Supermart',
  'RTGS-Corporate-Transfer',
  'UPI-UtilityBill-Electricity',
  'IMPS-Peer-Transfer',
  'UPI-Restaurant-Split',
];

const SCAM_CASH_OUT_NARRATIONS = [
  'UPI-P2P-USDT-TRADE',
  'IMPS-CRYPTO-EXCHANGE-CASHOUT',
  'P2P-BINANCE-ESCROW',
  'WALLET-CASHOUT-FAST',
  'IMPS-WALLET-RECHARGE',
  'CRYPTO-TOKEN-PURCHASE',
  'OFFSHORE-SETTLEMENT-P2P',
];

export function generateSyntheticDataset(
  options: GeneratorOptions,
  onProgress?: (percent: number) => void
): SyntheticDatasetOutput {
  const { totalRows, numVictims, muleRingsCount } = options;

  const rows: string[] = [];
  rows.push(
    'Transaction_ID,Sender_Account,Receiver_Account,Sender_IFSC,Receiver_IFSC,Amount,Timestamp,Payment_Mode,Narration,IP_Address,Device_Type'
  );

  const victimAccounts: string[] = [];
  const injectedMuleSet = new Set<string>();
  const allAccountsSet = new Set<string>();

  // Base epoch: 2026-09-15 09:00:00
  const baseEpochMs = new Date('2026-09-15T09:00:00Z').getTime();

  // 1. Generate Victims
  for (let i = 0; i < numVictims; i++) {
    const acc = `91${(1000000000 + i * 11111).toString().slice(0, 10)}`;
    victimAccounts.push(acc);
    allAccountsSet.add(acc);
  }

  // 2. Generate Injected Multi-Tier Mule Rings
  // Each ring: Victim -> L1 Collector -> 3 to 5 L2 Distributors -> L3 Terminal Cashouts
  let txCounter = 1;

  for (let r = 0; r < muleRingsCount; r++) {
    const victim = victimAccounts[r % victimAccounts.length];
    const victimIfsc = INDIAN_IFSC_PREFIXES[r % INDIAN_IFSC_PREFIXES.length];

    // L1 Collector Mule
    const l1Mule = `88${(2000000000 + r * 7777).toString().slice(0, 10)}`;
    const l1Ifsc = INDIAN_IFSC_PREFIXES[(r + 1) % INDIAN_IFSC_PREFIXES.length];
    injectedMuleSet.add(l1Mule);
    allAccountsSet.add(l1Mule);

    // Initial fraud siphoning: Victim to L1
    const siphonedAmount = 250000 + (r * 75000);
    const ringStartTime = baseEpochMs + r * 86400000 + 3600000; // staggered over days
    
    // Victim -> L1
    const txId1 = `TXN${txCounter.toString().padStart(8, '0')}`;
    txCounter++;
    rows.push(
      `${txId1},${victim},${l1Mule},${victimIfsc},${l1Ifsc},${siphonedAmount},${formatIsoDate(ringStartTime)},IMPS,IMPS-Task-Earning-Deposit,103.21.244.${(r % 250) + 1},Windows_Browser`
    );

    // Also add a few secondary victim/sender deposits into L1 (Collector Fan-In)
    for (let c = 1; c <= 3; c++) {
      const coVictim = `95${(3000000000 + r * 5000 + c * 333).toString().slice(0, 10)}`;
      allAccountsSet.add(coVictim);
      const coAmount = 45000 + c * 15000;
      const coTime = ringStartTime + c * 180000;
      const coTxId = `TXN${txCounter.toString().padStart(8, '0')}`;
      txCounter++;
      rows.push(
        `${coTxId},${coVictim},${l1Mule},${INDIAN_IFSC_PREFIXES[c % INDIAN_IFSC_PREFIXES.length]},${l1Ifsc},${coAmount},${formatIsoDate(coTime)},UPI,UPI-Digital-Arrest-Clearance,117.200.12.${c},Android`
      );
    }

    // High-Velocity Pass-Through from L1 to L2 Distributors
    // Disperse within 4 to 8 minutes across 3 to 4 L2 Distributors
    const numL2 = 3 + (r % 3); // 3 to 5
    const l2SliceAmount = Math.floor((siphonedAmount * 0.95) / numL2);
    const l1DisperseTime = ringStartTime + 240000 + (r % 180000); // 4-7 minutes after arrival

    const l2Mules: string[] = [];
    for (let l2Idx = 0; l2Idx < numL2; l2Idx++) {
      const l2Acc = `77${(4000000000 + r * 9999 + l2Idx * 1234).toString().slice(0, 10)}`;
      const l2Ifsc = INDIAN_IFSC_PREFIXES[(l2Idx + 2) % INDIAN_IFSC_PREFIXES.length];
      l2Mules.push(l2Acc);
      injectedMuleSet.add(l2Acc);
      allAccountsSet.add(l2Acc);

      const txId2 = `TXN${txCounter.toString().padStart(8, '0')}`;
      txCounter++;
      rows.push(
        `${txId2},${l1Mule},${l2Acc},${l1Ifsc},${l2Ifsc},${l2SliceAmount},${formatIsoDate(l1DisperseTime + l2Idx * 60000)},IMPS,IMPS-Settlement-Split,103.22.200.${l2Idx + 10},Web_Emulator`
      );
    }

    // L2 to L3 Terminal Cash-Out nodes
    // Each L2 sends funds downstream to terminal wallets, crypto accounts, or offshore proxies
    for (let l2Idx = 0; l2Idx < l2Mules.length; l2Idx++) {
      const l2Acc = l2Mules[l2Idx];
      const l2Ifsc = INDIAN_IFSC_PREFIXES[(l2Idx + 2) % INDIAN_IFSC_PREFIXES.length];
      const l2DisperseTime = l1DisperseTime + 300000 + l2Idx * 120000;

      // Terminal node
      const l3Acc = `66${(5000000000 + r * 8888 + l2Idx * 4321).toString().slice(0, 10)}`;
      const l3Ifsc = INDIAN_IFSC_PREFIXES[(l2Idx + 4) % INDIAN_IFSC_PREFIXES.length];
      injectedMuleSet.add(l3Acc);
      allAccountsSet.add(l3Acc);

      const foreignIp = `${FOREIGN_PROXY_IPS[(r + l2Idx) % FOREIGN_PROXY_IPS.length]}${(l2Idx * 37) % 250 + 1}`;
      const cryptoNarration = SCAM_CASH_OUT_NARRATIONS[(r + l2Idx) % SCAM_CASH_OUT_NARRATIONS.length];
      const l3Amount = Math.floor(l2SliceAmount * 0.92);

      const txId3 = `TXN${txCounter.toString().padStart(8, '0')}`;
      txCounter++;
      rows.push(
        `${txId3},${l2Acc},${l3Acc},${l2Ifsc},${l3Ifsc},${l3Amount},${formatIsoDate(l2DisperseTime)},RTGS,${cryptoNarration},${foreignIp},Linux_Script`
      );
    }
  }

  // 3. Fill remaining transactions with realistic background legitimate traffic
  const regularAccountPool: string[] = [];
  const targetLegitAccounts = Math.max(500, Math.floor(totalRows / 5));
  for (let i = 0; i < targetLegitAccounts; i++) {
    const acc = `55${(6000000000 + i * 987).toString().slice(0, 10)}`;
    regularAccountPool.push(acc);
    allAccountsSet.add(acc);
  }

  while (rows.length - 1 < totalRows) {
    const sIdx = Math.floor(Math.random() * regularAccountPool.length);
    let rIdx = Math.floor(Math.random() * regularAccountPool.length);
    if (sIdx === rIdx) rIdx = (rIdx + 1) % regularAccountPool.length;

    const sender = regularAccountPool[sIdx];
    const receiver = regularAccountPool[rIdx];
    const sIfsc = INDIAN_IFSC_PREFIXES[sIdx % INDIAN_IFSC_PREFIXES.length];
    const rIfsc = INDIAN_IFSC_PREFIXES[rIdx % INDIAN_IFSC_PREFIXES.length];

    const amount = Math.floor(Math.random() * 25000) + 200;
    const randomTime = baseEpochMs + Math.floor(Math.random() * (14 * 86400000));
    const modes = ['UPI', 'IMPS', 'NEFT', 'RTGS'];
    const pMode = modes[Math.floor(Math.random() * modes.length)];
    const narration = LEGIT_NARRATIONS[Math.floor(Math.random() * LEGIT_NARRATIONS.length)];
    const ip = `${DOMESTIC_IPS[Math.floor(Math.random() * DOMESTIC_IPS.length)]}${Math.floor(Math.random() * 250) + 1}`;
    const devices = ['Android', 'iOS', 'Windows_Browser'];
    const device = devices[Math.floor(Math.random() * devices.length)];

    const txId = `TXN${txCounter.toString().padStart(8, '0')}`;
    txCounter++;

    rows.push(
      `${txId},${sender},${receiver},${sIfsc},${rIfsc},${amount},${formatIsoDate(randomTime)},${pMode},${narration},${ip},${device}`
    );

    if (rows.length % 20000 === 0 && onProgress) {
      onProgress(Math.min(99, Math.round(((rows.length - 1) / totalRows) * 100)));
    }
  }

  // 4. Build Ground Truth CSV
  const gtLines: string[] = ['Account_Number,Is_Mule,Label'];
  for (const mule of injectedMuleSet) {
    gtLines.push(`${mule},1,INJECTED_MULE`);
  }
  for (const acc of regularAccountPool.slice(0, 2000)) {
    gtLines.push(`${acc},0,LEGITIMATE`);
  }

  return {
    csvText: rows.join('\n'),
    groundTruthCsvText: gtLines.join('\n'),
    sampleVictims: victimAccounts.slice(0, 5),
    injectedMules: Array.from(injectedMuleSet),
    totalRows: rows.length - 1,
    distinctAccounts: allAccountsSet.size,
  };
}

function formatIsoDate(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

import { PaymentMode, DeviceType, RawTransaction as Transaction } from '../types/dataset';

export type { Transaction };

export interface EvalDataset {
  transactions: Transaction[];
  mules: Set<string>;
  muleLayers: Map<string, 'L1' | 'L2' | 'L3'>;
}

/**
 * Seeded PRNG (Mulberry32) for reproducible synthetic dataset generation.
 */
function createRng(seed: number = 42) {
  let s = (seed >>> 0) || 1;
  return function next(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DOMESTIC_BANKS = [
  { ifsc: 'SBIN0001234', bank: 'State Bank of India' },
  { ifsc: 'HDFC0000456', bank: 'HDFC Bank' },
  { ifsc: 'ICIC0000789', bank: 'ICICI Bank' },
  { ifsc: 'PUNB0002345', bank: 'Punjab National Bank' },
  { ifsc: 'BARB0003456', bank: 'Bank of Baroda' },
  { ifsc: 'UTIB0004567', bank: 'Axis Bank' },
  { ifsc: 'KKBK0005678', bank: 'Kotak Mahindra Bank' },
  { ifsc: 'CNRB0006789', bank: 'Canara Bank' },
  { ifsc: 'UBIN0007890', bank: 'Union Bank of India' },
  { ifsc: 'IDIB0008901', bank: 'Indian Bank' },
];

const DOMESTIC_IPS = [
  '49.36.128.',
  '103.211.54.',
  '106.51.88.',
  '115.110.22.',
  '122.160.44.',
  '157.48.91.',
  '223.185.33.',
];

const FOREIGN_IPS = [
  '185.220.101.',
  '185.193.88.',
  '194.165.16.',
  '194.26.29.',
  '185.107.56.',
  '194.32.78.',
];

const CRYPTO_NARRATIONS = [
  'CRYPTO P2P PURCHASE USDT',
  'P2P ORDER CRYPTO DISPERSAL',
  'BINANCE P2P TRADE SETTLEMENT',
  'USDT WALLET TRANSFER',
  'WALLET CASH OUT SETTLEMENT',
  'TERMINAL OTC CRYPTO LIQUIDATION',
  'INSTANT WALLET TOPUP TRANSFER',
  'ATM INSTANT CASH WITHDRAWAL',
];

const REGULAR_NARRATIONS = [
  'UPI payment to merchant',
  'Grocery store purchase',
  'Electric bill payment',
  'Dinner with friends',
  'Mobile recharge',
  'Medical pharmacy bill',
  'Domestic utility fee',
  'Online shopping order',
  'Tuition payment',
  'Fuel purchase at petrol pump',
  'Rent transfer',
  'Travel ticket booking',
];

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

function formatTimestamp(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = pad2(d.getUTCMonth() + 1);
  const dd = pad2(d.getUTCDate());
  const hh = pad2(d.getUTCHours());
  const min = pad2(d.getUTCMinutes());
  const ss = pad2(d.getUTCSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

/**
 * Generates labelled synthetic evaluation dataset.
 * - 1,500 injected mule accounts (L1 Collector, L2 Distributor, L3 Cash-Out)
 * - 23,500 regular accounts (including >= 5% hard negatives)
 * - 15-day window starting 2026-09-01
 * - ~300,000 transactions in total
 *
 * THIS FILE IS IMPORTED ONLY BY THE EVALUATION PAGE AND TESTS.
 * PRODUCTION DETECTION CODE MUST NEVER IMPORT THIS.
 */
export function generateEvalDataset(seed: number = 42): EvalDataset {
  const rand = createRng(seed);

  const START_EPOCH_SEC = Date.UTC(2026, 8, 1, 0, 0, 0) / 1000; // 2026-09-01 00:00:00 UTC
  const WINDOW_SECONDS = 15 * 86400; // 15 days

  const transactions: Transaction[] = [];
  let txCounter = 1;

  function nextTxId(): string {
    return 'TX-' + String(txCounter++).padStart(7, '0');
  }

  function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(rand() * arr.length)];
  }

  function randomRange(min: number, max: number): number {
    return min + rand() * (max - min);
  }

  function randomInt(min: number, max: number): number {
    return Math.floor(randomRange(min, max + 1));
  }

  // Account registry and primary IFSC
  const accountIfscMap = new Map<string, string>();
  function getIfscForAccount(acc: string): string {
    let ifsc = accountIfscMap.get(acc);
    if (!ifsc) {
      ifsc = pickRandom(DOMESTIC_BANKS).ifsc;
      accountIfscMap.set(acc, ifsc);
    }
    return ifsc;
  }

  // Helper to add transaction
  function addTx(
    sender: string,
    receiver: string,
    amount: number,
    epochSec: number,
    mode: PaymentMode,
    narration: string,
    ip: string,
    device: DeviceType
  ): Transaction {
    const tx: Transaction = {
      Transaction_ID: nextTxId(),
      Sender_Account: sender,
      Receiver_Account: receiver,
      Sender_IFSC: getIfscForAccount(sender),
      Receiver_IFSC: getIfscForAccount(receiver),
      Amount: Math.round(amount * 100) / 100,
      Timestamp: formatTimestamp(epochSec),
      Payment_Mode: mode,
      Narration: narration,
      IP_Address: ip,
      Device_Type: device,
    };
    transactions.push(tx);
    return tx;
  }

  // 1. SETUP ACCOUNTS
  const TOTAL_MULES = 1500;
  const TOTAL_REGULAR = 23500;

  const mules = new Set<string>();
  const muleLayers = new Map<string, 'L1' | 'L2' | 'L3'>();

  // Pre-generate mule account IDs
  const muleAccountPool: string[] = [];
  for (let i = 1; i <= TOTAL_MULES; i++) {
    const acc = '9820' + String(i).padStart(6, '0');
    muleAccountPool.push(acc);
    mules.add(acc);
  }

  // Pre-generate regular account IDs
  const regularAccountPool: string[] = [];
  for (let i = 1; i <= TOTAL_REGULAR; i++) {
    const acc = '4150' + String(i).padStart(6, '0');
    regularAccountPool.push(acc);
  }

  // Identify Hard Negatives among regular accounts (at least 5% = >= 1,175)
  // We allocate 1,450 accounts (6.17%) across specific patterns:
  // HN1: Merchants receiving from many distinct senders (350 accounts)
  // HN2: Salary accounts paying 20-50 employees on one day (200 accounts)
  // HN3: Landlords and utility accounts (250 accounts)
  // HN4: Family forwarders (250 accounts)
  // HN5: Occasional VPN users (250 accounts)
  // HN6: Script / tech developers (150 accounts)
  const hnMerchants = regularAccountPool.slice(0, 350);
  const hnSalary = regularAccountPool.slice(350, 550);
  const hnLandlords = regularAccountPool.slice(550, 800);
  const hnFamily = regularAccountPool.slice(800, 1050);
  const hnVpnUsers = regularAccountPool.slice(1050, 1300);
  const hnScriptUsers = regularAccountPool.slice(1300, 1450);
  const standardRegulars = regularAccountPool.slice(1450);

  // 2. GENERATE MULE CHAINS (L1, L2, L3)
  // Follow realistic topology:
  // Some 3-layer chains: L1 -> L2 -> 3 to 6 L3s
  // Some 2-layer chains: L1 -> 2 to 4 L3s
  // Noise:
  // - forward ratio 70% to 95%
  // - delay 2 to 30 minutes
  // - some domestic IPs, some foreign IPs
  let muleIndex = 0;
  let chainCounter = 0;

  while (muleIndex < TOTAL_MULES) {
    chainCounter++;
    const remaining = TOTAL_MULES - muleIndex;
    const isTwoLayer = rand() < 0.25 || remaining < 5;

    // Pick a victim/feeder account from standard regulars to start the fraud
    const victim = pickRandom(standardRegulars);
    const chainStartSec = START_EPOCH_SEC + randomRange(3600, WINDOW_SECONDS - 7200);

    if (isTwoLayer) {
      // 2-layer chain: 1 L1, and 2 to 4 L3s
      const l3Count = Math.min(remaining - 1, randomInt(2, Math.min(4, Math.max(2, remaining - 1))));
      if (l3Count <= 0) {
        // Fallback for single account
        const singleMule = muleAccountPool[muleIndex++];
        muleLayers.set(singleMule, 'L1');
        break;
      }
      const l1 = muleAccountPool[muleIndex++];
      muleLayers.set(l1, 'L1');
      const l3List: string[] = [];
      for (let k = 0; k < l3Count; k++) {
        const l3 = muleAccountPool[muleIndex++];
        muleLayers.set(l3, 'L3');
        l3List.push(l3);
      }

      // Inflow to L1: victim transfers
      const victimAmount = randomRange(150000, 750000);
      addTx(
        victim,
        l1,
        victimAmount,
        chainStartSec,
        'UPI',
        'Urgent Transfer',
        pickRandom(DOMESTIC_IPS) + randomInt(2, 250),
        'Android'
      );

      // Add 2-3 additional feeder inflows to L1 to establish fan-in collector signal
      const feederCount = randomInt(2, 4);
      let totalL1Inflow = victimAmount;
      for (let f = 0; f < feederCount; f++) {
        const feeder = pickRandom(standardRegulars);
        const fAmount = randomRange(40000, 180000);
        totalL1Inflow += fAmount;
        addTx(
          feeder,
          l1,
          fAmount,
          chainStartSec + randomInt(60, 600),
          'IMPS',
          'Online Payment',
          pickRandom(DOMESTIC_IPS) + randomInt(2, 250),
          'Android'
        );
      }

      // L1 forwards 70% to 95% of total inflow to L3 accounts within 2 to 25 minutes
      const l1ForwardRatio = randomRange(0.70, 0.95);
      const totalToForward = totalL1Inflow * l1ForwardRatio;
      const sharePerL3 = totalToForward / l3List.length;
      const l1DispatchSec = chainStartSec + randomInt(120, 1500); // 2 to 25 min

      for (let i = 0; i < l3List.length; i++) {
        const l3 = l3List[i];
        const slice = sharePerL3 * randomRange(0.90, 1.10);
        const l3InflowSec = l1DispatchSec + i * randomInt(20, 120);
        addTx(
          l1,
          l3,
          slice,
          l3InflowSec,
          'IMPS',
          'Dispersal Share',
          pickRandom(DOMESTIC_IPS) + randomInt(2, 250),
          rand() < 0.3 ? 'Web_Emulator' : 'Android'
        );

        // L3 terminal cash-out within 2 to 15 min after receiving funds
        const l3CashOutSec = l3InflowSec + randomInt(120, 900);
        const useForeignIp = rand() < 0.75;
        const useScript = rand() < 0.70;
        const ip = useForeignIp ? pickRandom(FOREIGN_IPS) + randomInt(2, 250) : pickRandom(DOMESTIC_IPS) + randomInt(2, 250);
        const device: DeviceType = useScript ? (rand() < 0.5 ? 'Web_Emulator' : 'Linux_Script') : 'Android';
        const narration = rand() < 0.8 ? pickRandom(CRYPTO_NARRATIONS) : 'Settlement payout';

        // Cash out to a dummy terminal gateway or external merchant
        addTx(
          l3,
          pickRandom(standardRegulars),
          slice * randomRange(0.85, 0.98),
          l3CashOutSec,
          'RTGS',
          narration,
          ip,
          device
        );
      }
    } else {
      // 3-layer chain: 1 L1, 1 L2, and 3 to 6 L3s
      const l3Count = Math.min(remaining - 2, randomInt(3, Math.min(6, Math.max(3, remaining - 2))));
      if (l3Count <= 0) {
        while (muleIndex < TOTAL_MULES) {
          const m = muleAccountPool[muleIndex++];
          muleLayers.set(m, 'L1');
        }
        break;
      }
      const l1 = muleAccountPool[muleIndex++];
      muleLayers.set(l1, 'L1');
      const l2 = muleAccountPool[muleIndex++];
      muleLayers.set(l2, 'L2');
      const l3List: string[] = [];
      for (let k = 0; k < l3Count; k++) {
        const l3 = muleAccountPool[muleIndex++];
        muleLayers.set(l3, 'L3');
        l3List.push(l3);
      }

      // Multiple inflows to L1 (fan-in collector pattern: 3-5 distinct senders)
      const feederCount = randomInt(3, 5);
      let totalL1Inflow = 0;
      for (let f = 0; f < feederCount; f++) {
        const sender = f === 0 ? victim : pickRandom(standardRegulars);
        const amt = randomRange(50000, 300000);
        totalL1Inflow += amt;
        addTx(
          sender,
          l1,
          amt,
          chainStartSec + f * randomInt(60, 400),
          'UPI',
          'Instant Transfer',
          pickRandom(DOMESTIC_IPS) + randomInt(2, 250),
          'Android'
        );
      }

      // L1 forwards 75% to 95% of funds to L2 within 3 to 20 minutes (pass-through velocity)
      const l1ForwardRatio = randomRange(0.75, 0.95);
      const l1ForwardAmount = totalL1Inflow * l1ForwardRatio;
      const l1ForwardSec = chainStartSec + randomInt(180, 1200); // 3 to 20 mins
      addTx(
        l1,
        l2,
        l1ForwardAmount,
        l1ForwardSec,
        'IMPS',
        'Fund Settlement',
        pickRandom(DOMESTIC_IPS) + randomInt(2, 250),
        'Android'
      );

      // L2 Distributor fans out to 3 to 7 downstream L3 accounts within 2 to 20 minutes
      const l2ForwardRatio = randomRange(0.75, 0.95);
      const l2ForwardTotal = l1ForwardAmount * l2ForwardRatio;
      const sharePerL3 = l2ForwardTotal / l3List.length;
      const l2ForwardSec = l1ForwardSec + randomInt(120, 1200);

      for (let i = 0; i < l3List.length; i++) {
        const l3 = l3List[i];
        const slice = sharePerL3 * randomRange(0.92, 1.08);
        const l3InflowSec = l2ForwardSec + i * randomInt(30, 90);
        addTx(
          l2,
          l3,
          slice,
          l3InflowSec,
          'IMPS',
          'Sub share',
          pickRandom(DOMESTIC_IPS) + randomInt(2, 250),
          rand() < 0.25 ? 'Web_Emulator' : 'Android'
        );

        // L3 Cash-Out strictly after receiving funds from L2
        const l3Sec = l3InflowSec + randomInt(120, 900);
        const useForeignIp = rand() < 0.80; // Some use domestic IPs
        const useScript = rand() < 0.75;
        const ip = useForeignIp ? pickRandom(FOREIGN_IPS) + randomInt(2, 250) : pickRandom(DOMESTIC_IPS) + randomInt(2, 250);
        const device: DeviceType = useScript ? (rand() < 0.5 ? 'Web_Emulator' : 'Linux_Script') : 'Android';
        const narration = rand() < 0.85 ? pickRandom(CRYPTO_NARRATIONS) : 'Liquidation transfer';

        addTx(
          l3,
          pickRandom(standardRegulars),
          slice * randomRange(0.85, 0.98),
          l3Sec,
          'RTGS',
          narration,
          ip,
          device
        );
      }
    }
  }

  // 3. GENERATE HARD NEGATIVES (>= 1,175 accounts, here 1,450 accounts)
  // HN1: Busy Merchants (350 accounts)
  // Receive from 15 to 40 distinct customers over 15 days, no rapid pass-through, domestic IP, Android/iOS
  for (const merchant of hnMerchants) {
    const customerCount = randomInt(15, 40);
    let merchantBalance = 0;
    for (let c = 0; c < customerCount; c++) {
      const customer = pickRandom(standardRegulars);
      const amt = randomRange(200, 8500);
      merchantBalance += amt;
      const tSec = START_EPOCH_SEC + randomRange(0, WINDOW_SECONDS);
      addTx(
        customer,
        merchant,
        amt,
        tSec,
        'UPI',
        'Store purchase QR payment',
        pickRandom(DOMESTIC_IPS) + randomInt(2, 250),
        'Android'
      );
    }
    // Merchant spends 20% to 50% on suppliers DAYS later, not rapid minutes
    const supplier = pickRandom(standardRegulars);
    addTx(
      merchant,
      supplier,
      merchantBalance * randomRange(0.20, 0.45),
      START_EPOCH_SEC + randomRange(WINDOW_SECONDS * 0.6, WINDOW_SECONDS),
      'NEFT',
      'Vendor inventory supply',
      pickRandom(DOMESTIC_IPS) + randomInt(2, 250),
      'Windows_Browser'
    );
  }

  // HN2: Salary Accounts (200 accounts)
  // Sends to 20 to 50 employees on one single day (Sep 1 or Sep 5), corporate Windows_Browser, domestic IP
  for (const corp of hnSalary) {
    const empCount = randomInt(20, 45);
    const payDaySec = START_EPOCH_SEC + (rand() < 0.5 ? 86400 : 5 * 86400) + randomRange(36000, 45000);
    for (let e = 0; e < empCount; e++) {
      const emp = pickRandom(standardRegulars);
      addTx(
        corp,
        emp,
        randomRange(25000, 120000),
        payDaySec + e * randomInt(2, 10),
        'NEFT',
        'Salary payment for August 2026',
        pickRandom(DOMESTIC_IPS) + randomInt(2, 250),
        'Windows_Browser'
      );
    }
  }

  // HN3: Landlords & Utility billers (250 accounts)
  // Receive rent/utility once a month from 5 to 12 senders on 1st-4th. Outflow is weeks later.
  for (const landlord of hnLandlords) {
    const tenantCount = randomInt(5, 12);
    for (let t = 0; t < tenantCount; t++) {
      const tenant = pickRandom(standardRegulars);
      addTx(
        tenant,
        landlord,
        randomRange(12000, 45000),
        START_EPOCH_SEC + randomRange(3600, 4 * 86400),
        'UPI',
        'Apartment Monthly Rent',
        pickRandom(DOMESTIC_IPS) + randomInt(2, 250),
        'Android'
      );
    }
  }

  // HN4: Family forwarders (250 accounts)
  // Receive money and forward to family within an hour. But only 1 sender and 1 receiver!
  for (const person of hnFamily) {
    const parent = pickRandom(standardRegulars);
    const sibling = pickRandom(standardRegulars);
    const amt = randomRange(5000, 25000);
    const tRecv = START_EPOCH_SEC + randomRange(86400, WINDOW_SECONDS - 86400);
    addTx(
      parent,
      person,
      amt,
      tRecv,
      'UPI',
      'Pocket money assistance',
      pickRandom(DOMESTIC_IPS) + randomInt(2, 250),
      'Android'
    );
    // Forward within 20-50 mins
    addTx(
      person,
      sibling,
      amt * randomRange(0.80, 0.95),
      tRecv + randomInt(1200, 3000),
      'UPI',
      'Forwarded to brother',
      pickRandom(DOMESTIC_IPS) + randomInt(2, 250),
      'Android'
    );
  }

  // HN5: Occasional VPN users (250 accounts)
  // Regular users who happen to make 1-2 purchases through VPN (185.x or 194.x), but normal consumer narrations
  for (const vpnUser of hnVpnUsers) {
    const recipient = pickRandom(standardRegulars);
    addTx(
      vpnUser,
      recipient,
      randomRange(1500, 8000),
      START_EPOCH_SEC + randomRange(0, WINDOW_SECONDS),
      'UPI',
      'Online gadget shopping',
      pickRandom(FOREIGN_IPS) + randomInt(2, 250),
      'Windows_Browser'
    );
  }

  // HN6: Script / Tech developers (150 accounts)
  // Automated utility payment using Linux_Script or Web_Emulator at low frequency
  for (const devUser of hnScriptUsers) {
    const biller = pickRandom(hnLandlords);
    addTx(
      devUser,
      biller,
      randomRange(1000, 5000),
      START_EPOCH_SEC + randomRange(0, WINDOW_SECONDS),
      'UPI',
      'API test bill payment',
      pickRandom(DOMESTIC_IPS) + randomInt(2, 250),
      rand() < 0.5 ? 'Linux_Script' : 'Web_Emulator'
    );
  }

  // 4. GENERATE STANDARD REGULAR BACKGROUND TRANSACTIONS TO BRING TOTAL TO ~300,000
  // Target total: ~300,000 transactions
  const targetTotal = 300000;
  const needed = Math.max(0, targetTotal - transactions.length);

  for (let i = 0; i < needed; i++) {
    const s = pickRandom(standardRegulars);
    let r = pickRandom(standardRegulars);
    if (s === r) {
      r = pickRandom(standardRegulars);
    }
    const amt = randomRange(100, 15000);
    const tSec = START_EPOCH_SEC + randomRange(0, WINDOW_SECONDS);
    const mode: PaymentMode = rand() < 0.7 ? 'UPI' : rand() < 0.9 ? 'IMPS' : 'NEFT';
    const narration = pickRandom(REGULAR_NARRATIONS);
    const ip = pickRandom(DOMESTIC_IPS) + randomInt(2, 250);
    const device: DeviceType = rand() < 0.7 ? 'Android' : rand() < 0.9 ? 'iOS' : 'Windows_Browser';

    addTx(s, r, amt, tSec, mode, narration, ip, device);
  }

  // Sort transactions chronologically
  transactions.sort((a, b) => a.Timestamp.localeCompare(b.Timestamp));

  return {
    transactions,
    mules,
    muleLayers,
  };
}

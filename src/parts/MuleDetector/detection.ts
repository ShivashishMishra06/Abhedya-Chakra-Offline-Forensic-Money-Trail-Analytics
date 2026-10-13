import { RawTransaction as Transaction } from '../../types/dataset';

/**
 * DETECTION ENGINE CONFIGURATION
 * All detection weights, thresholds, and operational limits are centralized here.
 */
export const DETECTION_CONFIG = {
  // Classification threshold (0-100) above which an account is flagged as a suspected mule
  flagThreshold: 60,

  // Minimum count of independent suspicious signals required to exceed flagThreshold.
  // Prevents single-attribute hard negatives (e.g. busy merchants with high fan-in) from flagging alone.
  minIndependentSignals: 2,

  // Maximum score bonus added for topological proximity to other high-risk accounts (bounded bonus)
  maxGraphBonus: 10,

  // Pass-through velocity signal weight (0-100)
  passThroughWeight: 35,

  // Minimum pass-through ratio (outflow / inflow) to trigger pass-through velocity signal
  passThroughMinRatio: 0.70,

  // Target pass-through ratio for maximum normalized pass-through score
  passThroughTargetRatio: 0.85,

  // Minimum burst window in minutes for rapid pass-through
  passThroughMinMinutes: 0.5,

  // Maximum burst window in minutes to receive full pass-through score
  passThroughMaxMinutes: 30,

  // Minimum number of distinct downstream receivers for pass-through (1 allows single-downstream L1->L2 or L3->Cashout)
  passThroughMinReceivers: 1,

  // Collector fan-in signal weight (0-100) for L1 aggregation
  fanInWeight: 30,

  // Minimum distinct senders to trigger the collector fan-in signal
  fanInMinSenders: 3,

  // Distributor fan-out signal weight (0-100) for L2 layering
  fanOutWeight: 30,

  // Minimum distinct receivers to trigger distributor fan-out
  fanOutMinReceivers: 3,

  // Maximum distinct receivers for distributor fan-out (upper bound of typical mule slicing)
  fanOutMaxReceivers: 7,

  // Terminal cash-out signal weight (0-100) for L3 liquidation
  cashOutWeight: 30,

  // Foreign IP prefixes indicative of bulletproof/VPN infrastructure
  foreignIpPrefixes: ['185.', '194.'],

  // Headless browser and automation user agent device types
  scriptDeviceTypes: ['Web_Emulator', 'Linux_Script'],

  // High-risk terminal narration keywords associated with P2P crypto/OTC liquidation
  cashOutKeywords: [
    'CRYPTO',
    'P2P',
    'USDT',
    'BINANCE',
    'WALLET',
    'CASH',
    'ATM',
    'WITHDRAWAL',
    'LIQUIDATION',
  ],

  // Base threshold for considering a connected neighbor account as "high-risk" during graph context pass
  neighborRiskThreshold: 45,
};

export type DetectionConfig = typeof DETECTION_CONFIG;

export interface ScoredAccount {
  account: string;
  score: number;
  layer: 'L1' | 'L2' | 'L3' | 'LEGITIMATE';
  signalsCount: number;
  reasons: string[];
  baseScore: number;
  graphBonus: number;
  totalInflow: number;
  totalOutflow: number;
  distinctSenders: number;
  distinctReceivers: number;
}

export type ScoredAccountMap = Map<string, ScoredAccount> & {
  filter?: (fn: (item: ScoredAccount) => boolean) => ScoredAccount[];
  map?: <U>(fn: (item: ScoredAccount) => U) => U[];
};

interface AccountAccumulator {
  inflow: number;
  outflow: number;
  inCount: number;
  outCount: number;
  senders: Set<string>;
  receivers: Set<string>;
  firstInflowSec: number;
  lastInflowSec: number;
  firstOutflowSec: number;
  lastOutflowSec: number;
  foreignIpOut: number;
  scriptDeviceOut: number;
  cryptoNarrationOut: number;
}

/**
 * Formats rupee amounts into standard Indian grouping: Rs 4,50,000
 */
function formatIndianCurrency(amount: number): string {
  const rounded = Math.round(amount);
  const str = Math.abs(rounded).toString();
  if (str.length <= 3) return `Rs ${str}`;
  const lastThree = str.substring(str.length - 3);
  const otherNumbers = str.substring(0, str.length - 3);
  const formatted = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  return `Rs ${formatted}`;
}

/**
 * Parses YYYY-MM-DD HH:MM:SS to epoch seconds
 */
function parseTimestampSec(ts: string): number {
  if (!ts) return 0;
  const parts = ts.split(' ');
  if (parts.length < 2) return 0;
  const dateParts = parts[0].split('-');
  const timeParts = parts[1].split(':');
  if (dateParts.length < 3 || timeParts.length < 3) return 0;
  return (
    Date.UTC(
      parseInt(dateParts[0], 10),
      parseInt(dateParts[1], 10) - 1,
      parseInt(dateParts[2], 10),
      parseInt(timeParts[0], 10),
      parseInt(timeParts[1], 10),
      parseInt(timeParts[2], 10)
    ) / 1000
  );
}

/**
 * Computes risk scores and detects mule accounts across all transactions.
 * Single pass over transactions with Map indexes, followed by an adjacency graph context pass.
 * Never freezes UI.
 */
export function computeRisks(
  transactions: Transaction[],
  config: Partial<DetectionConfig> = {}
): ScoredAccountMap {
  const cfg: DetectionConfig = { ...DETECTION_CONFIG, ...config };

  const foreignPrefixes = cfg.foreignIpPrefixes;
  const scriptDevices = new Set(cfg.scriptDeviceTypes);
  const cashKeywords = cfg.cashOutKeywords.map((k) => k.toUpperCase());

  // Account accumulators and adjacency maps
  const accMap = new Map<string, AccountAccumulator>();
  const adjacencyOut = new Map<string, Set<string>>();
  const adjacencyIn = new Map<string, Set<string>>();

  function getAcc(id: string): AccountAccumulator {
    let acc = accMap.get(id);
    if (!acc) {
      acc = {
        inflow: 0,
        outflow: 0,
        inCount: 0,
        outCount: 0,
        senders: new Set<string>(),
        receivers: new Set<string>(),
        firstInflowSec: Number.MAX_SAFE_INTEGER,
        lastInflowSec: 0,
        firstOutflowSec: Number.MAX_SAFE_INTEGER,
        lastOutflowSec: 0,
        foreignIpOut: 0,
        scriptDeviceOut: 0,
        cryptoNarrationOut: 0,
      };
      accMap.set(id, acc);
    }
    return acc;
  }

  // PASS 1: Single pass over all transactions
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    const sId = tx.Sender_Account;
    const rId = tx.Receiver_Account;
    const amount = tx.Amount;
    const epochSec = parseTimestampSec(tx.Timestamp);

    // Sender update
    const sAcc = getAcc(sId);
    sAcc.outflow += amount;
    sAcc.outCount++;
    sAcc.receivers.add(rId);
    if (epochSec < sAcc.firstOutflowSec) sAcc.firstOutflowSec = epochSec;
    if (epochSec > sAcc.lastOutflowSec) sAcc.lastOutflowSec = epochSec;

    // Check sender IP
    const ip = tx.IP_Address || '';
    for (let p = 0; p < foreignPrefixes.length; p++) {
      if (ip.startsWith(foreignPrefixes[p])) {
        sAcc.foreignIpOut++;
        break;
      }
    }

    // Check sender device
    if (scriptDevices.has(tx.Device_Type)) {
      sAcc.scriptDeviceOut++;
    }

    // Check narration
    const narrationUpper = (tx.Narration || '').toUpperCase();
    for (let k = 0; k < cashKeywords.length; k++) {
      if (narrationUpper.includes(cashKeywords[k])) {
        sAcc.cryptoNarrationOut++;
        break;
      }
    }

    // Receiver update
    const rAcc = getAcc(rId);
    rAcc.inflow += amount;
    rAcc.inCount++;
    rAcc.senders.add(sId);
    if (epochSec < rAcc.firstInflowSec) rAcc.firstInflowSec = epochSec;
    if (epochSec > rAcc.lastInflowSec) rAcc.lastInflowSec = epochSec;

    // Adjacency
    let outSet = adjacencyOut.get(sId);
    if (!outSet) {
      outSet = new Set<string>();
      adjacencyOut.set(sId, outSet);
    }
    outSet.add(rId);

    let inSet = adjacencyIn.get(rId);
    if (!inSet) {
      inSet = new Set<string>();
      adjacencyIn.set(rId, inSet);
    }
    inSet.add(sId);
  }

  // PASS 2: Feature scoring & independent signals validation
  interface IntermediateScore {
    account: string;
    baseScore: number;
    signalsCount: number;
    reasons: string[];
    dominantRole: 'L1' | 'L2' | 'L3' | 'LEGITIMATE';
    totalInflow: number;
    totalOutflow: number;
    distinctSenders: number;
    distinctReceivers: number;
    fanInScore: number;
    fanOutScore: number;
    cashOutScore: number;
    passThroughScore: number;
  }

  const intermediateMap = new Map<string, IntermediateScore>();

  for (const [accId, acc] of accMap.entries()) {
    const distinctSenders = acc.senders.size;
    const distinctReceivers = acc.receivers.size;
    const totalInflow = acc.inflow;
    const totalOutflow = acc.outflow;

    let independentSignals = 0;
    const reasons: string[] = [];

    // SIGNAL 1: Pass-Through Velocity
    let passThroughScore = 0;
    if (totalInflow > 0 && totalOutflow > 0) {
      const ratio = totalOutflow / totalInflow;
      const windowMin = Math.max(0, (acc.lastOutflowSec - acc.firstInflowSec) / 60);

      if (
        ratio >= cfg.passThroughMinRatio &&
        distinctReceivers >= cfg.passThroughMinReceivers &&
        windowMin >= cfg.passThroughMinMinutes &&
        windowMin <= cfg.passThroughMaxMinutes * 1.5
      ) {
        independentSignals++;
        const ratioNorm = Math.min(1.0, 0.85 + (ratio - cfg.passThroughMinRatio) * 0.75);
        const timeNorm = windowMin <= cfg.passThroughMaxMinutes ? 1.0 : 0.85;
        passThroughScore = Math.round(cfg.passThroughWeight * ratioNorm * timeNorm);

        reasons.push(
          `${Math.round(ratio * 100)} percent of incoming ${formatIndianCurrency(totalInflow)} forwarded within ${Math.round(windowMin)} min to ${distinctReceivers} accounts`
        );
      }
    }

    // SIGNAL 2: Collector Fan-In (L1)
    let fanInScore = 0;
    if (distinctSenders >= cfg.fanInMinSenders) {
      independentSignals++;
      fanInScore = cfg.fanInWeight;
      reasons.push(
        `Collector topology: Inflow received from ${distinctSenders} distinct senders (${formatIndianCurrency(totalInflow)} total)`
      );
    }

    // SIGNAL 3: Distributor Fan-Out (L2)
    let fanOutScore = 0;
    if (
      distinctReceivers >= cfg.fanOutMinReceivers &&
      distinctReceivers <= cfg.fanOutMaxReceivers
    ) {
      independentSignals++;
      fanOutScore = cfg.fanOutWeight;
      reasons.push(
        `Distributor topology: Sliced and dispersed funds into ${distinctReceivers} downstream accounts`
      );
    }

    // SIGNAL 4: Terminal Cash-Out (L3)
    let cashOutScore = 0;
    const terminalMarkers = acc.foreignIpOut + acc.scriptDeviceOut + acc.cryptoNarrationOut;
    if (terminalMarkers > 0) {
      independentSignals++;
      const norm = Math.min(1.0, 0.80 + (terminalMarkers - 1) * 0.15);
      cashOutScore = Math.round(cfg.cashOutWeight * norm);

      reasons.push(
        `Terminal cash-out: Identified ${acc.foreignIpOut} foreign IP (185/194), ${acc.scriptDeviceOut} script/emulator, and ${acc.cryptoNarrationOut} crypto/p2p narrations`
      );
    }

    // Require pass-through velocity or cash-out markers for mule classification.
    // Prevents non-mule users with incidental peer transfers over 15 days from falsely accumulating independent signals.
    if (passThroughScore === 0 && cashOutScore === 0) {
      independentSignals = Math.min(independentSignals, 1);
    }

    // Calculate unadjusted base score as weighted sum of normalized signals
    let baseScore = passThroughScore + fanInScore + fanOutScore + cashOutScore;

    // HARD NEGATIVE PROTECTION: Require at least TWO independent signals to exceed flagThreshold
    if (independentSignals < cfg.minIndependentSignals) {
      baseScore = Math.min(baseScore, cfg.flagThreshold - 1);
    }

    // Dominant layer determination
    let dominantRole: IntermediateScore['dominantRole'] = 'LEGITIMATE';
    if (cashOutScore >= 20 || (acc.foreignIpOut > 0 && acc.outCount > 0)) {
      dominantRole = 'L3';
    } else if (fanOutScore >= fanInScore && distinctReceivers >= cfg.fanOutMinReceivers) {
      dominantRole = 'L2';
    } else if (distinctSenders >= cfg.fanInMinSenders) {
      dominantRole = 'L1';
    } else if (passThroughScore > 0) {
      dominantRole = 'L2';
    }

    intermediateMap.set(accId, {
      account: accId,
      baseScore,
      signalsCount: independentSignals,
      reasons,
      dominantRole,
      totalInflow,
      totalOutflow,
      distinctSenders,
      distinctReceivers,
      fanInScore,
      fanOutScore,
      cashOutScore,
      passThroughScore,
    });
  }

  // PASS 3: Graph context bonus pass over precomputed adjacency maps
  const resultMap: ScoredAccountMap = new Map<string, ScoredAccount>();

  for (const [accId, intermediate] of intermediateMap.entries()) {
    let highRiskNeighbors = 0;

    // Check upstream neighbors (senders to this account)
    const inNeighbors = adjacencyIn.get(accId);
    if (inNeighbors) {
      for (const sender of inNeighbors) {
        const neighbor = intermediateMap.get(sender);
        if (neighbor && neighbor.baseScore >= cfg.neighborRiskThreshold) {
          highRiskNeighbors++;
        }
      }
    }

    // Check downstream neighbors (receivers from this account)
    const outNeighbors = adjacencyOut.get(accId);
    if (outNeighbors) {
      for (const receiver of outNeighbors) {
        const neighbor = intermediateMap.get(receiver);
        if (neighbor && neighbor.baseScore >= cfg.neighborRiskThreshold) {
          highRiskNeighbors++;
        }
      }
    }

    // Bounded graph bonus (max +10)
    const graphBonus = Math.min(cfg.maxGraphBonus, highRiskNeighbors * 3.5);

    let finalScore = intermediate.baseScore + graphBonus;

    // Still respect the 2 independent signals rule:
    // an isolated account cannot cross flagThreshold purely on graph proximity
    if (intermediate.signalsCount < cfg.minIndependentSignals) {
      finalScore = Math.min(finalScore, cfg.flagThreshold - 1);
    }

    finalScore = Math.min(100, Math.max(0, Math.round(finalScore)));

    const finalReasons = [...intermediate.reasons];
    if (graphBonus > 0 && finalScore >= cfg.flagThreshold) {
      finalReasons.push(
        `Graph context: Connected upstream/downstream to ${highRiskNeighbors} suspicious network accounts (+${Math.round(graphBonus)} bonus)`
      );
    }

    let finalLayer = intermediate.dominantRole;
    if (finalScore < cfg.flagThreshold) {
      finalLayer = 'LEGITIMATE';
    }

    resultMap.set(accId, {
      account: accId,
      score: finalScore,
      layer: finalLayer,
      signalsCount: intermediate.signalsCount,
      reasons: finalReasons,
      baseScore: intermediate.baseScore,
      graphBonus: Math.round(graphBonus),
      totalInflow: intermediate.totalInflow,
      totalOutflow: intermediate.totalOutflow,
      distinctSenders: intermediate.distinctSenders,
      distinctReceivers: intermediate.distinctReceivers,
    });
  }

  // Attach array helper methods for interoperability
  resultMap.filter = (fn: (item: ScoredAccount) => boolean) => {
    const arr: ScoredAccount[] = [];
    for (const val of resultMap.values()) {
      if (fn(val)) arr.push(val);
    }
    return arr;
  };

  resultMap.map = <U>(fn: (item: ScoredAccount) => U) => {
    const arr: U[] = [];
    for (const val of resultMap.values()) {
      arr.push(fn(val));
    }
    return arr;
  };

  return resultMap;
}

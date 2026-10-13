import { CsrAdjacency } from './csr';
import { ColumnarDataRef } from './traceEngine';
import { HeuristicThresholds, MuleDetectionResult, defaultHeuristicThresholds } from '../types/heuristics';
import { getBankNameFromIfsc } from '../lib/bankLookup';

/**
 * Runs Module B graph heuristics across the entire indexed dataset.
 * Evaluates pass-through velocity, fan-in/fan-out topologies, terminal cash-outs, and cycles.
 */
export function runBatchMuleDetection(
  numAccounts: number,
  csr: CsrAdjacency,
  data: ColumnarDataRef,
  thresholds: HeuristicThresholds = defaultHeuristicThresholds
): MuleDetectionResult[] {
  const results: MuleDetectionResult[] = [];
  const foreignPrefixes = thresholds.foreignIpPrefixes || ['185.', '194.'];
  const headlessSet = new Set(thresholds.headlessDevices || ['Web_Emulator', 'Linux_Script']);
  const cryptoMarkers = (thresholds.walletCryptoKeywords || []).map((k) => k.toUpperCase());

  // Evaluate each account in the dataset
  for (let accId = 0; accId < numAccounts; accId++) {
    const inStart = csr.inOffsets[accId];
    const inEnd = csr.inOffsets[accId + 1];
    const inCount = inEnd - inStart;

    const outStart = csr.outOffsets[accId];
    const outEnd = csr.outOffsets[accId + 1];
    const outCount = outEnd - outStart;

    // Skip dormant accounts with no transactions
    if (inCount === 0 && outCount === 0) continue;

    // Calculate total inflow and distinct senders
    let totalInflow = 0;
    const distinctSendersSet = new Set<number>();
    let firstInflowSec = Number.MAX_SAFE_INTEGER;
    let lastInflowSec = 0;

    for (let i = inStart; i < inEnd; i++) {
      const tx = csr.inTxIndices[i];
      totalInflow += data.amounts[tx];
      distinctSendersSet.add(data.senderIds[tx]);
      const t = data.timestamps[tx];
      if (t < firstInflowSec) firstInflowSec = t;
      if (t > lastInflowSec) lastInflowSec = t;
    }

    // Calculate total outflow and distinct receivers
    let totalOutflow = 0;
    const distinctReceiversSet = new Set<number>();
    let firstOutflowSec = Number.MAX_SAFE_INTEGER;
    let lastOutflowSec = 0;
    let foreignIpMatches = 0;
    let headlessDeviceMatches = 0;
    let cryptoNarrationMatches = 0;

    for (let i = outStart; i < outEnd; i++) {
      const tx = csr.outTxIndices[i];
      totalOutflow += data.amounts[tx];
      distinctReceiversSet.add(data.receiverIds[tx]);
      const t = data.timestamps[tx];
      if (t < firstOutflowSec) firstOutflowSec = t;
      if (t > lastOutflowSec) lastOutflowSec = t;

      // Check IP
      const ip = data.idToIp[data.ipIds[tx]] || '';
      for (const prefix of foreignPrefixes) {
        if (ip.startsWith(prefix)) {
          foreignIpMatches++;
          break;
        }
      }

      // Check device
      const dev = data.deviceTypes[tx];
      // 3 = Web_Emulator, 4 = Linux_Script
      if (dev === 3 || dev === 4) {
        headlessDeviceMatches++;
      }

      // Check narration
      const narration = (data.idToNarration[data.narrationIds[tx]] || '').toUpperCase();
      for (const marker of cryptoMarkers) {
        if (narration.includes(marker)) {
          cryptoNarrationMatches++;
          break;
        }
      }
    }

    const distinctSenders = distinctSendersSet.size;
    const distinctReceivers = distinctReceiversSet.size;

    // --- Heuristic 1: Pass-Through Velocity ---
    let passThroughScore = 0;
    let isPassThroughFlagged = false;
    let passThroughRatio = 0;
    if (totalInflow > 0 && totalOutflow > 0) {
      passThroughRatio = totalOutflow / totalInflow;
      // Check if ratio >= threshold and dispersed across min receivers
      if (
        passThroughRatio >= thresholds.passThroughRatioThreshold &&
        distinctReceivers >= thresholds.passThroughMinReceivers
      ) {
        // Check time window between first inflow and last outflow in that burst
        const windowMin = Math.max(0, (lastOutflowSec - firstInflowSec) / 60);
        if (
          windowMin >= thresholds.passThroughMinMinutes &&
          windowMin <= thresholds.passThroughMaxMinutes * 2 // allow reasonable burst margin
        ) {
          isPassThroughFlagged = true;
          passThroughScore = thresholds.weights.passThroughVelocity;
        } else if (windowMin <= thresholds.passThroughMaxMinutes * 3) {
          // Partial score for near window
          passThroughScore = Math.round(thresholds.weights.passThroughVelocity * 0.7);
        }
      }
    }

    // --- Heuristic 2: Collector Fan-In (L1) ---
    let fanInScore = 0;
    let isFanInFlagged = false;
    if (distinctSenders >= thresholds.collectorMinSenders) {
      isFanInFlagged = true;
      const severity = Math.min(1.0, distinctSenders / (thresholds.collectorMinSenders * 2));
      fanInScore = Math.round(thresholds.weights.fanInCollector * severity);
    }

    // --- Heuristic 3: Distributor Fan-Out (L2) ---
    let fanOutScore = 0;
    let isFanOutFlagged = false;
    if (
      distinctReceivers >= thresholds.distributorMinReceivers &&
      distinctReceivers <= thresholds.distributorMaxReceivers
    ) {
      isFanOutFlagged = true;
      fanOutScore = thresholds.weights.fanOutDistributor;
    } else if (distinctReceivers > thresholds.distributorMaxReceivers) {
      fanOutScore = Math.round(thresholds.weights.fanOutDistributor * 0.85);
    }

    // --- Heuristic 4: Terminal Cash-Out Signals ---
    let terminalScore = 0;
    const terminalAnomalies: string[] = [];
    if (foreignIpMatches > 0) {
      terminalScore += thresholds.weights.terminalCashOut * 0.4;
      terminalAnomalies.push(`Foreign proxy IP headers observed (${foreignIpMatches} tx)`);
    }
    if (headlessDeviceMatches > 0) {
      terminalScore += thresholds.weights.terminalCashOut * 0.35;
      terminalAnomalies.push(`Headless automation user-agents (${headlessDeviceMatches} tx)`);
    }
    if (cryptoNarrationMatches > 0) {
      terminalScore += thresholds.weights.terminalCashOut * 0.25;
      terminalAnomalies.push(`Crypto P2P or cash-out narration tokens (${cryptoNarrationMatches} tx)`);
    }
    terminalScore = Math.min(thresholds.weights.terminalCashOut, Math.round(terminalScore));

    // --- Heuristic 5: Cyclical Smurfing (Cycle within 4 hops) ---
    let cyclicalScore = 0;
    let hasCycle = false;
    // Check if any receiver is also a sender to this account
    for (const sender of distinctSendersSet) {
      if (distinctReceiversSet.has(sender)) {
        hasCycle = true;
        cyclicalScore = thresholds.weights.cyclicalSmurfing;
        break;
      }
    }

    let signalsCount = 0;
    if (isPassThroughFlagged) signalsCount++;
    if (isFanInFlagged) signalsCount++;
    if (isFanOutFlagged) signalsCount++;
    if (terminalScore >= 15) signalsCount++;
    if (hasCycle) signalsCount++;

    let totalMuleRisk = Math.min(
      100,
      passThroughScore + fanInScore + fanOutScore + terminalScore + cyclicalScore
    );

    // Require at least two independent signals before exceeding classification threshold
    if (signalsCount < 2) {
      totalMuleRisk = Math.min(totalMuleRisk, 59);
    }

    // Only return nodes with noticeable risk (>= 25) or anomalous patterns
    if (
      totalMuleRisk >= 25 ||
      isPassThroughFlagged ||
      isFanInFlagged ||
      foreignIpMatches > 0 ||
      headlessDeviceMatches > 0 ||
      hasCycle
    ) {
      const reasons: string[] = [];
      if (isPassThroughFlagged) {
        reasons.push(
          `High-velocity pass-through: ${(passThroughRatio * 100).toFixed(0)}% funds dispersed across ${distinctReceivers} receivers.`
        );
      }
      if (isFanInFlagged) {
        reasons.push(`Collector topology: In-degree concentration from ${distinctSenders} distinct senders.`);
      }
      if (isFanOutFlagged) {
        reasons.push(`Distributor topology: Slicing funds into ${distinctReceivers} downstream accounts.`);
      }
      if (hasCycle) {
        reasons.push('Cyclical transfer loop detected (circular smurfing).');
      }
      reasons.push(...terminalAnomalies);

      // Determine Layer tag
      let layer: MuleDetectionResult['layer'] = 'INTERMEDIARY';
      if (fanInScore >= fanOutScore && distinctSenders >= thresholds.collectorMinSenders) {
        layer = 'L1_COLLECTOR';
      } else if (fanOutScore >= thresholds.weights.fanOutDistributor * 0.8) {
        layer = 'L2_DISTRIBUTOR';
      } else if (terminalScore > 10 || outCount === 0) {
        layer = 'L3_TERMINAL';
      }

      const accStr = data.idToAccount[accId];
      const primaryIfscIdx = data.accountPrimaryIfsc?.[accId] ?? 0;
      const ifsc = data.idToIfsc[primaryIfscIdx] || 'UNKNOWN';

      results.push({
        accountNumber: accStr,
        primaryIfsc: ifsc,
        bankName: getBankNameFromIfsc(ifsc),
        muleRiskIndex: totalMuleRisk,
        layer,
        totalInflow,
        totalOutflow,
        distinctSenders,
        distinctReceivers,
        breakdown: {
          passThroughScore,
          fanInScore,
          fanOutScore,
          terminalCashOutScore: terminalScore,
          cyclicalScore,
        },
        reasons,
        anomalies: terminalAnomalies,
      });
    }
  }

  // Sort descending by Mule Risk Index
  results.sort((a, b) => b.muleRiskIndex - a.muleRiskIndex);
  return results;
}

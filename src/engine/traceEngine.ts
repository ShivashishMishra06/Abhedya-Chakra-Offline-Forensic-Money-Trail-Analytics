import { CsrAdjacency } from './csr';
import { TraceEdge, TraceNode, TraceResult, MuleLayer, PaymentMode, DeviceType } from '../types/dataset';
import { getBankNameFromIfsc } from '../lib/bankLookup';
import { formatTimestamp } from '../lib/timeUtils';

export interface ColumnarDataRef {
  senderIds: Uint32Array;
  receiverIds: Uint32Array;
  amounts: Float64Array;
  timestamps: Uint32Array; // Epoch seconds
  paymentModes: Uint8Array;
  deviceTypes: Uint8Array;
  senderIfscIds: Uint16Array;
  receiverIfscIds: Uint16Array;
  ipIds: Uint32Array;
  narrationIds: Uint32Array;
  accountPrimaryIfsc?: Uint16Array;
  
  // String tables
  idToAccount: string[];
  idToIfsc: string[];
  idToIp: string[];
  idToNarration: string[];
  idToTxId: string[];
}

const PAYMENT_MODE_MAP: PaymentMode[] = ['UPI', 'IMPS', 'NEFT', 'RTGS'];
const DEVICE_TYPE_MAP: DeviceType[] = ['Android', 'iOS', 'Windows_Browser', 'Web_Emulator', 'Linux_Script'];

/**
 * Computes a time-respecting downstream multi-hop money trail (up to 4 hops).
 * An outgoing transaction only counts if timestamp >= incoming arrival time.
 */
export function computeDownstreamTrace(
  victimAccountId: number,
  csr: CsrAdjacency,
  data: ColumnarDataRef,
  maxHops = 4
): TraceResult {
  const t0 = performance.now();
  const victimAccountStr = data.idToAccount[victimAccountId];

  // Map of accountId -> TraceNode
  const nodeMap = new Map<number, TraceNode>();
  // Visited hops: accountId -> minimum hop reached
  const hopMap = new Map<number, number>();
  // Arrival times: accountId -> first arrival timestamp (epoch seconds)
  const arrivalTimes = new Map<number, number>();
  
  const edges: TraceEdge[] = [];
  const edgeSet = new Set<number>(); // txIndex set

  // Initialize victim
  hopMap.set(victimAccountId, 0);
  arrivalTimes.set(victimAccountId, 0);

  const victimIfsc = data.idToIfsc[data.accountPrimaryIfsc?.[victimAccountId] ?? 0] || 'UNKNOWN';
  nodeMap.set(victimAccountId, {
    id: victimAccountStr,
    accountNumber: victimAccountStr,
    hop: 0,
    layer: 'VICTIM',
    bankName: getBankNameFromIfsc(victimIfsc),
    primaryIfsc: victimIfsc,
    inflowFromTrace: 0,
    outflowInTrace: 0,
    netHoldingInTrace: 0,
    isHolding: false,
    firstReceivedTime: 0,
    lastSentTime: 0,
    riskScore: 0,
    riskReasons: ['Victim Account - Source of Disputed Funds'],
    anomalies: [],
  });

  // BFS Queue: { accountId: number, hop: number, arrivalSec: number }
  const queue: { accountId: number; hop: number; arrivalSec: number }[] = [
    { accountId: victimAccountId, hop: 0, arrivalSec: 0 },
  ];

  let totalSiphoned = 0;

  while (queue.length > 0) {
    const { accountId: u, hop, arrivalSec } = queue.shift()!;
    if (hop >= maxHops) continue;

    const startIdx = csr.outOffsets[u];
    const endIdx = csr.outOffsets[u + 1];

    for (let i = startIdx; i < endIdx; i++) {
      const txIdx = csr.outTxIndices[i];
      const txTimeSec = data.timestamps[txIdx];

      // Time-respecting condition: outgoing must be at or after arrival time
      if (txTimeSec < arrivalSec) {
        continue;
      }

      if (edgeSet.has(txIdx)) {
        continue;
      }
      edgeSet.add(txIdx);

      const v = data.receiverIds[txIdx];
      const amount = data.amounts[txIdx];
      const nextHop = hop + 1;

      if (hop === 0) {
        totalSiphoned += amount;
      }

      // Check arrival time of v
      const prevArrival = arrivalTimes.get(v);
      if (prevArrival === undefined || txTimeSec < prevArrival) {
        arrivalTimes.set(v, txTimeSec);
      }

      // Get or create node v
      let nodeV = nodeMap.get(v);
      if (!nodeV) {
        const vAccStr = data.idToAccount[v];
        const vIfsc = data.idToIfsc[data.receiverIfscIds[txIdx]] || 'UNKNOWN';

        // Initial layer tagging based on hop
        let layer: MuleLayer = 'INTERMEDIARY';
        if (nextHop === 1) layer = 'L1_COLLECTOR';
        else if (nextHop === 2) layer = 'L2_DISTRIBUTOR';
        else if (nextHop >= 3) layer = 'L3_TERMINAL';

        nodeV = {
          id: vAccStr,
          accountNumber: vAccStr,
          hop: nextHop,
          layer,
          bankName: getBankNameFromIfsc(vIfsc),
          primaryIfsc: vIfsc,
          inflowFromTrace: 0,
          outflowInTrace: 0,
          netHoldingInTrace: 0,
          isHolding: false,
          firstReceivedTime: txTimeSec * 1000,
          lastSentTime: 0,
          riskScore: 0,
          riskReasons: [],
          anomalies: [],
        };
        nodeMap.set(v, nodeV);
      }

      nodeV.inflowFromTrace += amount;

      // Update sender node outflow
      const nodeU = nodeMap.get(u)!;
      nodeU.outflowInTrace += amount;
      nodeU.lastSentTime = Math.max(nodeU.lastSentTime, txTimeSec * 1000);

      // Create Edge
      const senderAccStr = data.idToAccount[u];
      const receiverAccStr = data.idToAccount[v];
      const paymentMode = PAYMENT_MODE_MAP[data.paymentModes[txIdx]] || 'UPI';
      const deviceType = DEVICE_TYPE_MAP[data.deviceTypes[txIdx]] || 'Windows_Browser';
      const ipAddress = data.idToIp[data.ipIds[txIdx]] || '';
      const narration = data.idToNarration[data.narrationIds[txIdx]] || '';
      const transactionId = data.idToTxId[txIdx];

      edges.push({
        id: `tx-${txIdx}-${transactionId}`,
        source: senderAccStr,
        target: receiverAccStr,
        amount,
        timestamp: formatTimestamp(txTimeSec * 1000),
        epochMs: txTimeSec * 1000,
        paymentMode,
        narration,
        transactionId,
        deviceType,
        ipAddress,
        hop: nextHop,
      });

      // Check device or IP anomalies on node
      if (ipAddress.startsWith('185.') || ipAddress.startsWith('194.')) {
        if (!nodeV.anomalies.includes('Foreign Proxy IP (' + ipAddress + ')')) {
          nodeV.anomalies.push('Foreign Proxy IP (' + ipAddress + ')');
        }
      }
      if (deviceType === 'Web_Emulator' || deviceType === 'Linux_Script') {
        if (!nodeV.anomalies.includes('Headless Device (' + deviceType + ')')) {
          nodeV.anomalies.push('Headless Device (' + deviceType + ')');
        }
      }

      // Check if we should traverse into v
      const curHopV = hopMap.get(v);
      if (curHopV === undefined || nextHop < curHopV) {
        hopMap.set(v, nextHop);
        if (nextHop < maxHops) {
          queue.push({
            accountId: v,
            hop: nextHop,
            arrivalSec: txTimeSec,
          });
        }
      }
    }
  }

  // Refine node metrics, layer classifications, and holding status
  const nodes = Array.from(nodeMap.values());
  for (const node of nodes) {
    if (node.hop === 0) continue; // Victim stays victim

    node.netHoldingInTrace = Math.max(0, node.inflowFromTrace - node.outflowInTrace);
    node.isHolding = node.netHoldingInTrace > 0.01;

    // Classify layer more specifically per Module B heuristics
    if (node.hop === 1) {
      node.layer = 'L1_COLLECTOR';
      node.riskScore = Math.min(100, 50 + (node.anomalies.length > 0 ? 30 : 10));
      node.riskReasons.push('Direct recipient of victim funds (Layer 1 Collector Mule)');
    } else if (node.hop === 2) {
      node.layer = 'L2_DISTRIBUTOR';
      node.riskScore = Math.min(100, 60 + (node.anomalies.length > 0 ? 25 : 15));
      node.riskReasons.push('Rapid dispersion intermediary (Layer 2 Distributor Mule)');
    } else if (node.hop >= 3 || node.outflowInTrace === 0) {
      node.layer = 'L3_TERMINAL';
      node.riskScore = Math.min(100, 75 + (node.anomalies.length > 0 ? 25 : 10));
      node.riskReasons.push('Terminal cash-out node or wallet destination');
    }

    if (node.isHolding) {
      node.riskReasons.push('Currently retaining disputed funds: ₹ ' + node.netHoldingInTrace.toFixed(2));
    }
  }

  const l1Accounts = nodes.filter((n) => n.layer === 'L1_COLLECTOR');
  const l2Accounts = nodes.filter((n) => n.layer === 'L2_DISTRIBUTOR');
  const l3Accounts = nodes.filter((n) => n.layer === 'L3_TERMINAL');
  const holdingAccounts = nodes.filter((n) => n.isHolding && n.hop > 0);

  const t1 = performance.now();
  const traceLatencyMs = Math.round((t1 - t0) * 100) / 100;

  return {
    victimAccount: victimAccountStr,
    totalSiphoned,
    traceLatencyMs,
    timestamp: Date.now(),
    nodes,
    edges,
    layerBreakdown: {
      l1Accounts,
      l2Accounts,
      l3Accounts,
      holdingAccounts,
    },
  };
}

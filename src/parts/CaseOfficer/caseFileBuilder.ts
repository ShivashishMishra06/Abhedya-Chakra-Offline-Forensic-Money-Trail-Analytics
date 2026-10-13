import { TraceResult } from '../../types/dataset';
import { CaseFileFacts, ChronologicalEntry, LayerEntry, FreezeAccount, BankNoticeFact } from './types';

/**
 * Builds verified factual object strictly from the immutable trace graph.
 * Ensures all entries, totals, and timestamps maintain strict mathematical and chronological invariants.
 */
export function buildCaseFileFacts(trace: TraceResult): CaseFileFacts {
  const victimAccount = trace.victimAccount;
  const victimNode = trace.nodes.find((n) => n.accountNumber === victimAccount);
  const victimBank = victimNode?.bankName || 'Unknown Bank';
  const victimIfsc = victimNode?.primaryIfsc || 'UNKNOWN';

  // Map nodes for fast attribute lookup
  const nodeMap = new Map<string, typeof trace.nodes[0]>();
  for (const n of trace.nodes) {
    nodeMap.set(n.accountNumber, n);
  }

  // Sort edges strictly chronologically
  const sortedEdges = [...trace.edges].sort((a, b) => a.epochMs - b.epochMs);

  const chronologicalEntries: ChronologicalEntry[] = sortedEdges.map((edge, idx) => {
    const sNode = nodeMap.get(edge.source);
    const rNode = nodeMap.get(edge.target);
    return {
      step: idx + 1,
      timestamp: edge.timestamp,
      senderAccount: edge.source,
      senderBank: sNode?.bankName || 'Unknown Bank',
      receiverAccount: edge.target,
      receiverBank: rNode?.bankName || 'Unknown Bank',
      receiverIfsc: rNode?.primaryIfsc || 'UNKNOWN',
      amount: edge.amount,
      paymentMode: edge.paymentMode,
      transactionId: edge.transactionId,
      hop: edge.hop,
    };
  });

  // Calculate victim outflow total (total siphoned)
  const totalSiphoned = chronologicalEntries
    .filter((e) => e.senderAccount === victimAccount)
    .reduce((sum, e) => sum + e.amount, 0);

  // Group entries by layer (hop 1 = Layer 1, hop 2 = Layer 2, hop >= 3 = Layer 3)
  const layer1Entries: LayerEntry[] = [];
  const layer2Entries: LayerEntry[] = [];
  const layer3Entries: LayerEntry[] = [];

  for (const entry of chronologicalEntries) {
    const rNode = nodeMap.get(entry.receiverAccount);
    const item: LayerEntry = {
      account: entry.receiverAccount,
      bank: entry.receiverBank,
      ifsc: entry.receiverIfsc,
      amount: entry.amount,
      timestamp: entry.timestamp,
      transactionId: entry.transactionId,
      hop: entry.hop,
    };

    if (entry.hop === 1 || rNode?.layer === 'L1_COLLECTOR') {
      layer1Entries.push(item);
    } else if (entry.hop === 2 || rNode?.layer === 'L2_DISTRIBUTOR') {
      layer2Entries.push(item);
    } else {
      layer3Entries.push(item);
    }
  }

  const layer1Total = layer1Entries.reduce((s, e) => s + e.amount, 0);
  const layer2Total = layer2Entries.reduce((s, e) => s + e.amount, 0);
  const layer3Total = layer3Entries.reduce((s, e) => s + e.amount, 0);

  // Freeze list: accounts that received funds in the trail and are holding funds or terminal
  // Invariant: freeze list contains ONLY accounts that received funds in the trail
  const trailReceivers = new Set(chronologicalEntries.map((e) => e.receiverAccount));
  const freezeAccounts: FreezeAccount[] = [];

  // Look at holding accounts first
  const holdingList = trace.layerBreakdown.holdingAccounts.length > 0
    ? trace.layerBreakdown.holdingAccounts
    : trace.nodes.filter((n) => n.accountNumber !== victimAccount && (n.netHoldingInTrace > 0 || n.hop >= 2));

  for (const h of holdingList) {
    if (trailReceivers.has(h.accountNumber)) {
      freezeAccounts.push({
        account: h.accountNumber,
        bank: h.bankName,
        ifsc: h.primaryIfsc,
        layer: h.layer,
        freezeAmount: h.netHoldingInTrace > 0 ? h.netHoldingInTrace : h.inflowFromTrace,
      });
    }
  }

  // Ensure freeze list is never empty if there are trail receivers
  if (freezeAccounts.length === 0 && chronologicalEntries.length > 0) {
    const lastEntry = chronologicalEntries[chronologicalEntries.length - 1];
    freezeAccounts.push({
      account: lastEntry.receiverAccount,
      bank: lastEntry.receiverBank,
      ifsc: lastEntry.receiverIfsc,
      layer: 'L3_TERMINAL',
      freezeAmount: lastEntry.amount,
    });
  }

  // Bank Notices: Grouped per bank (or IFSC prefix: first 4 chars of IFSC)
  // Requisition: one notice per bank, addressed to the Nodal Officer of that bank
  // Invariant: no duplicate transaction IDs in a notice
  const bankNoticeMap = new Map<string, BankNoticeFact>();

  for (const entry of chronologicalEntries) {
    const rIfsc = entry.receiverIfsc;
    const prefix = rIfsc.length >= 4 ? rIfsc.substring(0, 4).toUpperCase() : 'BANK';
    const bankName = entry.receiverBank;

    let notice = bankNoticeMap.get(prefix);
    if (!notice) {
      notice = {
        bankName,
        ifscPrefix: prefix,
        accounts: [],
        totalAmount: 0,
      };
      bankNoticeMap.set(prefix, notice);
    }

    // Invariant: Avoid duplicate transaction ID within notice
    const alreadyHasTx = notice.accounts.some((a) => a.transactionId === entry.transactionId);
    if (!alreadyHasTx) {
      notice.accounts.push({
        accountNumber: entry.receiverAccount,
        ifsc: entry.receiverIfsc,
        transactionId: entry.transactionId,
        amount: entry.amount,
        timestamp: entry.timestamp,
      });
      notice.totalAmount += entry.amount;
    }
  }

  const bankNotices = Array.from(bankNoticeMap.values());

  return {
    victimAccount,
    victimBank,
    victimIfsc,
    totalSiphoned,
    chronologicalEntries,
    layer1Entries,
    layer2Entries,
    layer3Entries,
    layer1Total,
    layer2Total,
    layer3Total,
    freezeAccounts,
    bankNotices,
  };
}

/**
 * Computes deterministic SHA-256 hash using Web Crypto API in browser.
 */
export async function computeFactsHash(facts: CaseFileFacts): Promise<string> {
  const json = JSON.stringify(facts);
  const encoder = new TextEncoder();
  const data = encoder.encode(json);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

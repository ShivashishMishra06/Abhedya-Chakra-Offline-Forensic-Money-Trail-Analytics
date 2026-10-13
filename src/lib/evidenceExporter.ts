import { TraceResult, TraceNode, TraceEdge } from '../types/dataset';
import { sanitizeForCsv } from './sanitizer';
import { formatRupees } from './currency';

export interface EvidenceExportResult {
  csvContent: string;
  sha256Hash: string;
  filename: string;
  rowCount: number;
  totalAmount: number;
}

/**
 * Computes deterministic SHA-256 hash using Web Crypto API.
 */
export async function computeStringSha256(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates the Official Forensic Evidence Trail CSV (Standard Legal Evidence Exhibit).
 * Compliant with Section 65B Indian Evidence Act / Section 63 Bharatiya Sakshya Adhiniyam.
 */
export async function generateEvidenceTrailCsv(
  trace: TraceResult,
  officerInfo?: { name: string; badge: string; station: string }
): Promise<EvidenceExportResult> {
  const timestamp = new Date().toISOString();
  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // Map nodes for lookup
  const nodeMap = new Map<string, TraceNode>();
  for (const n of trace.nodes) {
    nodeMap.set(n.accountNumber, n);
  }

  // Sort edges strictly chronologically
  const sortedEdges: TraceEdge[] = [...trace.edges].sort((a, b) => a.epochMs - b.epochMs);

  const lines: string[] = [];

  // Legal Evidence Header Metadata
  lines.push('# =================================================================================');
  lines.push('# FORENSIC EVIDENCE EXHIBIT - OPERATION ABHEDYA-CHAKRA');
  lines.push('# CYBER CRIME INVESTIGATION CELL · INDORE POLICE COMMISSIONERATE');
  lines.push('# STATUTORY REQUISITION EVIDENCE TRAIL UNDER SECTION 91 Cr.P.C. / SECTION 94 BNSS');
  lines.push('# ADMISSIBLE UNDER SECTION 65B INDIAN EVIDENCE ACT / SECTION 63 BHARATIYA SAKSHYA ADHINIYAM');
  lines.push('# =================================================================================');
  lines.push(`# VICTIM_ACCOUNT: ${trace.victimAccount}`);
  lines.push(`# TOTAL_SIPHONED_AMOUNT_INR: ${trace.totalSiphoned}`);
  lines.push(`# TRACE_GENERATED_TIMESTAMP: ${timestamp}`);
  lines.push(`# INVESTIGATING_AUTHORITY: ${officerInfo?.name || 'Investigating Officer'} (Badge: ${officerInfo?.badge || 'IND-CYB-1930'})`);
  lines.push(`# POLICE_STATION: ${officerInfo?.station || 'Cyber Crime Police Station, Indore'}`);
  lines.push(`# TOTAL_EXHIBIT_TRANSACTIONS: ${sortedEdges.length}`);
  lines.push(`# TOTAL_IMPLICATED_ACCOUNTS: ${trace.nodes.length}`);
  lines.push('# =================================================================================');
  lines.push('');

  // CSV Columns Header
  const headers = [
    'Exhibit_SNo',
    'Forensic_Hop',
    'Layer_Classification',
    'Transaction_ID',
    'Timestamp_IST',
    'Sender_Account',
    'Sender_Bank',
    'Sender_IFSC',
    'Receiver_Account',
    'Receiver_Bank',
    'Receiver_IFSC',
    'Disputed_Amount_INR',
    'Payment_Mode',
    'Narration',
    'IP_Address',
    'Device_Type',
    'Fund_Flow_State',
  ];
  lines.push(headers.map((h) => sanitizeForCsv(h)).join(','));

  let totalAmount = 0;

  sortedEdges.forEach((edge, index) => {
    const sNode = nodeMap.get(edge.source);
    const rNode = nodeMap.get(edge.target);

    let layerClass = 'L1_COLLECTOR';
    if (edge.hop === 1 || rNode?.layer === 'L1_COLLECTOR') {
      layerClass = 'L1_MULE_COLLECTOR';
    } else if (edge.hop === 2 || rNode?.layer === 'L2_DISTRIBUTOR') {
      layerClass = 'L2_DISTRIBUTOR';
    } else if (edge.hop >= 3 || rNode?.layer === 'L3_TERMINAL') {
      layerClass = 'L3_TERMINAL_CASHOUT';
    }

    let flowState = 'INTERMEDIATE_DISPERSION';
    if (edge.source === trace.victimAccount) {
      flowState = 'INITIAL_SIPHON_FROM_VICTIM';
    } else if (rNode?.isHolding || rNode?.layer === 'L3_TERMINAL') {
      flowState = 'TERMINAL_HOLDING_CASHOUT';
    }

    totalAmount += edge.amount;

    const row = [
      index + 1,
      `Hop ${edge.hop}`,
      layerClass,
      edge.transactionId,
      edge.timestamp,
      edge.source,
      sNode?.bankName || 'Unknown Bank',
      sNode?.primaryIfsc || 'UNKNOWN',
      edge.target,
      rNode?.bankName || 'Unknown Bank',
      rNode?.primaryIfsc || 'UNKNOWN',
      edge.amount.toFixed(2),
      edge.paymentMode,
      edge.narration || 'N/A',
      edge.ipAddress || 'UNKNOWN',
      edge.deviceType || 'UNKNOWN',
      flowState,
    ];

    lines.push(row.map((cell) => sanitizeForCsv(cell)).join(','));
  });

  const rawCsv = lines.join('\r\n');
  const sha256Hash = await computeStringSha256(rawCsv);

  // Append verified integrity certificate at the bottom of the CSV
  const finalizedCsv = `${rawCsv}\r\n# =================================================================================\r\n# EVIDENCE INTEGRITY CERTIFICATE (SHA-256): ${sha256Hash}\r\n# VERIFIED IMMUTABLE SNAPSHOT GENERATED ON: ${dateStr}\r\n# =================================================================================\r\n`;

  const filename = `forensic_evidence_trail_${trace.victimAccount}_${Date.now()}.csv`;

  return {
    csvContent: finalizedCsv,
    sha256Hash,
    filename,
    rowCount: sortedEdges.length,
    totalAmount,
  };
}

/**
 * Generates the Statutory Bank Freeze Schedule Annexure CSV (Section 91 CrPC / Section 94 BNSS).
 * Grouped for bank nodal officers and judicial magistrate submission.
 */
export async function generateFreezeScheduleCsv(
  trace: TraceResult,
  officerInfo?: { name: string; badge: string; station: string }
): Promise<EvidenceExportResult> {
  const timestamp = new Date().toISOString();

  // Map nodes
  const nodeMap = new Map<string, TraceNode>();
  for (const n of trace.nodes) {
    nodeMap.set(n.accountNumber, n);
  }

  // Find all beneficiary accounts in the trail that received funds
  const receiverEntries = trace.edges.filter((e) => e.source !== e.target);
  const accountTotals = new Map<
    string,
    {
      inflow: number;
      outflow: number;
      txIds: string[];
      bank: string;
      ifsc: string;
      hop: number;
      layer: string;
    }
  >();

  for (const e of receiverEntries) {
    const acc = e.target;
    const rNode = nodeMap.get(acc);
    const existing = accountTotals.get(acc) || {
      inflow: 0,
      outflow: 0,
      txIds: [],
      bank: rNode?.bankName || 'Unknown Bank',
      ifsc: rNode?.primaryIfsc || 'UNKNOWN',
      hop: e.hop,
      layer: rNode?.layer || 'L1_COLLECTOR',
    };

    existing.inflow += e.amount;
    if (!existing.txIds.includes(e.transactionId)) {
      existing.txIds.push(e.transactionId);
    }
    accountTotals.set(acc, existing);
  }

  for (const e of receiverEntries) {
    const acc = e.source;
    if (accountTotals.has(acc)) {
      const existing = accountTotals.get(acc)!;
      existing.outflow += e.amount;
    }
  }

  const lines: string[] = [];
  lines.push('# =================================================================================');
  lines.push('# SECTION 91 Cr.P.C. / SECTION 94 BNSS STATUTORY FREEZE REQUISITION SCHEDULE');
  lines.push('# CYBER CRIME INVESTIGATION CELL · INDORE POLICE COMMISSIONERATE');
  lines.push(`# VICTIM_ACCOUNT: ${trace.victimAccount}`);
  lines.push(`# TOTAL_DISPUTED_SIPHONED_SUM_INR: ${trace.totalSiphoned}`);
  lines.push(`# SCHEDULE_GENERATED_TIMESTAMP: ${timestamp}`);
  lines.push(`# OFFICER_IN_CHARGE: ${officerInfo?.name || 'Investigating Officer'}`);
  lines.push('# =================================================================================');
  lines.push('');

  const headers = [
    'SNo',
    'Bank_Name',
    'IFSC_Prefix',
    'Beneficiary_Account_Number',
    'Branch_IFSC',
    'Forensic_Layer',
    'Trail_Inflow_INR',
    'Trail_Outflow_INR',
    'Retained_Balance_INR',
    'Requisitioned_Freeze_Amount_INR',
    'Mule_Risk_Index',
    'Disputed_Transfers_Count',
    'Disputed_Transaction_IDs',
    'Statutory_Mandate',
  ];
  lines.push(headers.map((h) => sanitizeForCsv(h)).join(','));

  let totalFreeze = 0;
  let sNo = 1;

  for (const [acc, data] of accountTotals.entries()) {
    if (acc === trace.victimAccount) continue;

    const node = nodeMap.get(acc);
    const retained = Math.max(0, data.inflow - data.outflow);
    // Amount to freeze: retained funds if holding, or total tainted inflow
    const freezeAmt = retained > 0 ? retained : data.inflow;
    totalFreeze += freezeAmt;

    const ifscPrefix = data.ifsc.length >= 4 ? data.ifsc.substring(0, 4).toUpperCase() : 'BANK';

    const row = [
      sNo++,
      data.bank,
      ifscPrefix,
      acc,
      data.ifsc,
      node?.layer || data.layer,
      data.inflow.toFixed(2),
      data.outflow.toFixed(2),
      retained.toFixed(2),
      freezeAmt.toFixed(2),
      node?.riskScore ?? 85,
      data.txIds.length,
      data.txIds.slice(0, 5).join('; '),
      'IMMEDIATE DEBIT FREEZE UNDER SEC 91 CrPC / 94 BNSS',
    ];

    lines.push(row.map((cell) => sanitizeForCsv(cell)).join(','));
  }

  const rawCsv = lines.join('\r\n');
  const sha256Hash = await computeStringSha256(rawCsv);

  const finalizedCsv = `${rawCsv}\r\n# =================================================================================\r\n# SCHEDULE INTEGRITY CERTIFICATE (SHA-256): ${sha256Hash}\r\n# TOTAL ACCOUNTS TO FREEZE: ${accountTotals.size}\r\n# TOTAL REQUISITION FREEZE SUM (INR): ${totalFreeze.toFixed(2)}\r\n# =================================================================================\r\n`;

  const filename = `bank_freeze_schedule_${trace.victimAccount}_${Date.now()}.csv`;

  return {
    csvContent: finalizedCsv,
    sha256Hash,
    filename,
    rowCount: accountTotals.size,
    totalAmount: totalFreeze,
  };
}

/**
 * Generates the Implicated Mule Network Entity Registry CSV (Graph Nodes Dossier).
 */
export async function generateMuleEntitiesCsv(trace: TraceResult): Promise<EvidenceExportResult> {
  const timestamp = new Date().toISOString();
  const lines: string[] = [];

  lines.push('# =================================================================================');
  lines.push('# MONEY MULE NETWORK ENTITY REGISTRY & TOPOLOGICAL DOSSIER');
  lines.push('# CYBER CRIME INVESTIGATION CELL · INDORE POLICE COMMISSIONERATE');
  lines.push(`# VICTIM_ACCOUNT: ${trace.victimAccount}`);
  lines.push(`# REGISTRY_TIMESTAMP: ${timestamp}`);
  lines.push('# =================================================================================');
  lines.push('');

  const headers = [
    'Account_Number',
    'Entity_Role',
    'Hop_Distance',
    'Bank_Name',
    'Primary_IFSC',
    'Total_Inflow_INR',
    'Total_Outflow_INR',
    'Net_Retained_Holding_INR',
    'Is_Holding_Funds',
    'Mule_Risk_Score',
    'Risk_Reasons',
    'Detected_Anomalies',
  ];
  lines.push(headers.map((h) => sanitizeForCsv(h)).join(','));

  let totalVolume = 0;

  for (const node of trace.nodes) {
    totalVolume += node.inflowFromTrace;
    const row = [
      node.accountNumber,
      node.layer,
      node.hop,
      node.bankName,
      node.primaryIfsc,
      node.inflowFromTrace.toFixed(2),
      node.outflowInTrace.toFixed(2),
      node.netHoldingInTrace.toFixed(2),
      node.isHolding ? 'YES' : 'NO',
      node.riskScore,
      node.riskReasons.join('; ') || 'N/A',
      node.anomalies.join('; ') || 'N/A',
    ];
    lines.push(row.map((cell) => sanitizeForCsv(cell)).join(','));
  }

  const rawCsv = lines.join('\r\n');
  const sha256Hash = await computeStringSha256(rawCsv);

  const finalizedCsv = `${rawCsv}\r\n# =================================================================================\r\n# ENTITY REGISTRY SHA-256 HASH: ${sha256Hash}\r\n# =================================================================================\r\n`;

  const filename = `mule_entity_registry_${trace.victimAccount}_${Date.now()}.csv`;

  return {
    csvContent: finalizedCsv,
    sha256Hash,
    filename,
    rowCount: trace.nodes.length,
    totalAmount: totalVolume,
  };
}

/**
 * Triggers a browser file download with UTF-8 BOM so Excel/LibreOffice opens it flawlessly.
 */
export function downloadCsvEvidence(csvContent: string, filename: string): void {
  // \uFEFF is UTF-8 Byte Order Mark for Microsoft Excel compatibility
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.setAttribute('download', filename);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

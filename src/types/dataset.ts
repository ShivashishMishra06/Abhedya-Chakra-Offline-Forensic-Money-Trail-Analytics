export type PaymentMode = 'UPI' | 'IMPS' | 'NEFT' | 'RTGS';

export type DeviceType =
  | 'Android'
  | 'iOS'
  | 'Windows_Browser'
  | 'Web_Emulator'
  | 'Linux_Script';

export interface RawTransaction {
  Transaction_ID: string;
  Sender_Account: string;
  Receiver_Account: string;
  Sender_IFSC: string;
  Receiver_IFSC: string;
  Amount: number;
  Timestamp: string; // YYYY-MM-DD HH:MM:SS
  Payment_Mode: PaymentMode;
  Narration: string;
  IP_Address: string;
  Device_Type: DeviceType;
}

export type MuleLayer =
  | 'VICTIM'
  | 'L1_COLLECTOR'
  | 'L2_DISTRIBUTOR'
  | 'L3_TERMINAL'
  | 'INTERMEDIARY'
  | 'LEGITIMATE';

export interface TraceNode {
  id: string; // Account number
  accountNumber: string;
  hop: number; // 0 for victim, 1 for L1, 2 for L2, etc.
  layer: MuleLayer;
  bankName: string;
  primaryIfsc: string;
  inflowFromTrace: number;
  outflowInTrace: number;
  netHoldingInTrace: number;
  isHolding: boolean; // Retaining funds in trace
  firstReceivedTime: number; // epoch ms
  lastSentTime: number; // epoch ms
  riskScore: number;
  riskReasons: string[];
  anomalies: string[];
}

export interface TraceEdge {
  id: string;
  source: string; // Sender account number
  target: string; // Receiver account number
  amount: number;
  timestamp: string;
  epochMs: number;
  paymentMode: PaymentMode;
  narration: string;
  transactionId: string;
  deviceType: DeviceType;
  ipAddress: string;
  hop: number;
}

export interface TraceResult {
  victimAccount: string;
  totalSiphoned: number;
  traceLatencyMs: number;
  timestamp: number;
  nodes: TraceNode[];
  edges: TraceEdge[];
  layerBreakdown: {
    l1Accounts: TraceNode[];
    l2Accounts: TraceNode[];
    l3Accounts: TraceNode[];
    holdingAccounts: TraceNode[];
  };
}

export interface IngestionMetrics {
  rowCount: number;
  distinctAccounts: number;
  bytesProcessed: number;
  elapsedMs: number;
  throughputRowsPerSec: number;
  meetsBenchmark: boolean; // Under 60,000ms
  memoryBytesEstimate: number;
}

export interface AccountSummary {
  accountNumber: string;
  primaryIfsc: string;
  bankName: string;
  totalInflow: number;
  totalOutflow: number;
  netBalance: number;
  inTxCount: number;
  outTxCount: number;
  distinctSenders: number;
  distinctReceivers: number;
  firstTxTime: string;
  lastTxTime: string;
  paymentModesUsed: Record<string, number>;
  ipAddressesSeen: string[];
  deviceTypesSeen: string[];
  foreignIpCount: number;
  scriptDeviceCount: number;
  riskScore: number;
  layerTag: MuleLayer;
  riskReasons: string[];
  passThroughVelocity: {
    flagged: boolean;
    percentage: number;
    windowMinutes: number;
  };
}

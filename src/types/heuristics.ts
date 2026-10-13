export interface HeuristicThresholds {
  // Pass-through velocity
  passThroughMinMinutes: number; // default: 3
  passThroughMaxMinutes: number; // default: 15
  passThroughRatioThreshold: number; // default: 0.90 (90%)
  passThroughMinReceivers: number; // default: 2

  // Fan-In / Collector
  collectorMinSenders: number; // default: 4

  // Fan-Out / Distributor
  distributorMinReceivers: number; // default: 3
  distributorMaxReceivers: number; // default: 7

  // Terminal Cash-out signals
  foreignIpPrefixes: string[]; // default: ['185.', '194.']
  headlessDevices: string[]; // default: ['Web_Emulator', 'Linux_Script']
  walletCryptoKeywords: string[]; // default: ['WALLET', 'CRYPTO', 'P2P', 'BINANCE', 'USDT', 'CASHOUT', 'ATM']

  // Weights (must sum to 100)
  weights: {
    passThroughVelocity: number; // default: 30
    fanInCollector: number; // default: 20
    fanOutDistributor: number; // default: 20
    terminalCashOut: number; // default: 20
    cyclicalSmurfing: number; // default: 10
  };
}

export const defaultHeuristicThresholds: HeuristicThresholds = {
  passThroughMinMinutes: 3,
  passThroughMaxMinutes: 15,
  passThroughRatioThreshold: 0.90,
  passThroughMinReceivers: 2,

  collectorMinSenders: 4,

  distributorMinReceivers: 3,
  distributorMaxReceivers: 7,

  foreignIpPrefixes: ['185.', '194.'],
  headlessDevices: ['Web_Emulator', 'Linux_Script'],
  walletCryptoKeywords: ['WALLET', 'CRYPTO', 'P2P', 'BINANCE', 'USDT', 'CASHOUT', 'ATM', 'TOKEN'],

  weights: {
    passThroughVelocity: 30,
    fanInCollector: 20,
    fanOutDistributor: 20,
    terminalCashOut: 20,
    cyclicalSmurfing: 10,
  },
};

export interface MuleDetectionResult {
  accountNumber: string;
  primaryIfsc: string;
  bankName: string;
  muleRiskIndex: number; // 0 to 100
  layer: 'L1_COLLECTOR' | 'L2_DISTRIBUTOR' | 'L3_TERMINAL' | 'INTERMEDIARY' | 'LEGITIMATE';
  totalInflow: number;
  totalOutflow: number;
  distinctSenders: number;
  distinctReceivers: number;
  breakdown: {
    passThroughScore: number;
    fanInScore: number;
    fanOutScore: number;
    terminalCashOutScore: number;
    cyclicalScore: number;
  };
  reasons: string[];
  anomalies: string[];
}

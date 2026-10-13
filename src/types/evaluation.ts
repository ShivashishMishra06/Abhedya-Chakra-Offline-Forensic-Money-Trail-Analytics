export interface GroundTruthRecord {
  accountNumber: string;
  isMule: boolean; // Ground truth classification
  label?: string;
}

export interface EvaluationMetrics {
  totalAccountsEvaluated: number;
  groundTruthPositives: number; // Actual mules
  groundTruthNegatives: number; // Actual legitimate
  predictedPositives: number; // Flagged by detection engine
  predictedNegatives: number; // Cleared by detection engine

  truePositives: number; // TP
  falsePositives: number; // FP
  trueNegatives: number; // TN
  falseNegatives: number; // FN

  precision: number; // TP / (TP + FP)
  recall: number; // TP / (TP + FN)
  f1Score: number; // 2 * (Precision * Recall) / (Precision + Recall)
  accuracy: number; // (TP + TN) / Total

  falsePositiveAccounts: string[];
  falseNegativeAccounts: string[];
}

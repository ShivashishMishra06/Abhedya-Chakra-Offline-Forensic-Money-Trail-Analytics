import React, { useState } from 'react';
import { Upload, Download, CheckCircle2, AlertTriangle, FileSpreadsheet, Info } from 'lucide-react';
import { MuleDetectionResult } from '../types/heuristics';
import { EvaluationMetrics } from '../types/evaluation';
import { OfficialHeaderBanner } from '../components/layout/OfficialHeaderBanner';

interface EvaluationPageProps {
  engine: unknown;
  detectionResults: MuleDetectionResult[];
  onRunScanFirst: () => void;
}

export const EvaluationPage: React.FC<EvaluationPageProps> = ({
  detectionResults,
  onRunScanFirst,
}) => {
  const [metrics, setMetrics] = useState<EvaluationMetrics | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gtFileName, setGtFileName] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setGtFileName(file.name);
    setErrorMessage(null);
    setIsEvaluating(true);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

      if (lines.length < 2) {
        throw new Error('CSV must contain a header row and at least one data row.');
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const accIdx = headers.findIndex((h) => h.includes('account'));
      const muleIdx = headers.findIndex((h) => h.includes('mule') || h.includes('label') || h.includes('is_mule'));

      if (accIdx === -1 || muleIdx === -1) {
        throw new Error('CSV must contain columns for Account Number and Ground Truth Mule label (1/0 or true/false).');
      }

      const groundTruthMap = new Map<string, boolean>();
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map((p) => p.trim());
        if (parts.length > Math.max(accIdx, muleIdx)) {
          const acc = parts[accIdx];
          const val = parts[muleIdx].toLowerCase();
          const isMule = val === '1' || val === 'true' || val === 'yes' || val === 'mule';
          if (acc) {
            groundTruthMap.set(acc, isMule);
          }
        }
      }

      // Compute actual confusion matrix against detection results
      const predictedMules = new Set(
        detectionResults.filter((r) => r.muleRiskIndex >= 50).map((r) => r.accountNumber)
      );

      let tp = 0;
      let fp = 0;
      let fn = 0;
      let tn = 0;
      const fpList: string[] = [];
      const fnList: string[] = [];

      groundTruthMap.forEach((isActualMule, acc) => {
        const isPredictedMule = predictedMules.has(acc);

        if (isActualMule && isPredictedMule) {
          tp++;
        } else if (!isActualMule && isPredictedMule) {
          fp++;
          fpList.push(acc);
        } else if (isActualMule && !isPredictedMule) {
          fn++;
          fnList.push(acc);
        } else {
          tn++;
        }
      });

      const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
      const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
      const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
      const accuracy = tp + tn + fp + fn > 0 ? (tp + tn) / (tp + tn + fp + fn) : 0;

      setMetrics({
        precision,
        recall,
        f1Score: f1,
        accuracy,
        truePositives: tp,
        falsePositives: fp,
        trueNegatives: tn,
        falseNegatives: fn,
        totalAccountsEvaluated: groundTruthMap.size,
        groundTruthPositives: tp + fn,
        groundTruthNegatives: tn + fp,
        predictedPositives: tp + fp,
        predictedNegatives: tn + fn,
        falsePositiveAccounts: fpList,
        falseNegativeAccounts: fnList,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to evaluate ground truth file.';
      setErrorMessage(msg);
      setMetrics(null);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleDownloadSampleGt = () => {
    const csvContent =
      'Account_Number,Is_Mule\n911000000001,1\n911000000002,1\n911000000003,0\n911000000004,0\n911000000005,1\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ground_truth_sample.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 bg-[#F1F5F9] text-[#0F172A]">
      {/* Official Header Banner */}
      <OfficialHeaderBanner
        title="Ground-Truth Confusion Matrix & Accuracy Benchmark"
        category="Blind Testing Evaluation · Precision & Recall"
        badge="Jury Verification"
      />

      {/* Action Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#CBD5E1] pb-4">
        <div>
          <p className="text-xs text-[#64748B] max-w-2xl leading-relaxed font-mono">
            Measures algorithmic detection precision, recall, and F1 score against uploaded ground-truth
            mule labels without fabricating or estimating performance metrics.
          </p>
        </div>

        <button
          onClick={handleDownloadSampleGt}
          className="flex items-center gap-1.5 rounded-[6px] border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs font-mono font-bold text-[#0B2545] hover:bg-slate-50 cursor-pointer transition-colors shadow-xs"
        >
          <Download className="h-3.5 w-3.5 text-[#B45309]" />
          <span>Download Sample Schema (CSV)</span>
        </button>
      </div>

      {detectionResults.length === 0 ? (
        <div className="rounded-[8px] border border-amber-300 bg-white p-8 text-center font-mono text-xs shadow-xs">
          <AlertTriangle className="h-8 w-8 text-[#B45309] mx-auto mb-3" />
          <h3 className="font-bold text-[#0F172A] text-sm">Module B Scan Not Yet Executed</h3>
          <p className="mt-1 text-[#64748B] max-w-md mx-auto">
            Before ground-truth accuracy can be calculated, run the Module B Mule Scan on the active transaction dataset.
          </p>
          <button
            onClick={onRunScanFirst}
            className="mt-4 rounded-[6px] bg-[#0B2545] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#133866] cursor-pointer transition-colors shadow-xs"
          >
            Go to Mule Detection Screen
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Ground-Truth CSV Upload Box */}
          <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 font-mono text-xs shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B2545] mb-2 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-[#B45309]" />
              Upload Blind Ground-Truth Account List (CSV)
            </h3>
            <p className="text-xs text-[#64748B] mb-4">
              Upload the verification ground-truth file containing verified mule accounts
              (columns: <code className="text-[#0B2545] font-bold bg-slate-100 px-1 py-0.5 rounded">Account_Number, Is_Mule</code>).
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 rounded-[6px] bg-[#0B2545] px-4 py-2 text-xs font-bold text-white hover:bg-[#133866] cursor-pointer transition-colors shadow-xs">
                <Upload className="h-3.5 w-3.5 text-[#E2B734]" />
                <span>{isEvaluating ? 'Computing Confusion Matrix...' : 'Choose Ground-Truth CSV'}</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  disabled={isEvaluating}
                  className="hidden"
                />
              </label>

              {gtFileName && (
                <span className="font-mono text-xs text-[#0F172A] bg-[#F1F5F9] border border-[#CBD5E1] px-3 py-1.5 rounded-[4px]">
                  Loaded: <strong className="text-[#0B2545]">{gtFileName}</strong>
                </span>
              )}
            </div>

            {errorMessage && (
              <div className="mt-4 rounded-[6px] border border-[#DC2626] bg-red-50 p-3 text-xs text-[#991B1B]">
                {errorMessage}
              </div>
            )}
          </div>

          {/* Results */}
          {metrics ? (
            <div className="space-y-6">
              {/* Primary Metrics Grid */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 font-mono text-xs">
                {/* Precision */}
                <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 shadow-xs">
                  <span className="text-[10px] text-[#64748B] uppercase font-bold">Precision (TP / TP + FP)</span>
                  <p className="mt-1 text-2xl font-bold text-[#16A34A]">
                    {(metrics.precision * 100).toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-[#64748B] mt-0.5">
                    {metrics.truePositives} correct / {metrics.predictedPositives} flagged
                  </p>
                </div>

                {/* Recall */}
                <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 shadow-xs">
                  <span className="text-[10px] text-[#64748B] uppercase font-bold">Recall (TP / TP + FN)</span>
                  <p className="mt-1 text-2xl font-bold text-[#16A34A]">
                    {(metrics.recall * 100).toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-[#64748B] mt-0.5">
                    {metrics.truePositives} detected / {metrics.groundTruthPositives} injected
                  </p>
                </div>

                {/* F1 Score */}
                <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 shadow-xs">
                  <span className="text-[10px] text-[#64748B] uppercase font-bold">F1 Harmonic Score</span>
                  <p className="mt-1 text-2xl font-bold text-[#B45309]">
                    {(metrics.f1Score * 100).toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-[#64748B] mt-0.5">Balanced accuracy index</p>
                </div>

                {/* Overall Accuracy */}
                <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 shadow-xs">
                  <span className="text-[10px] text-[#64748B] uppercase font-bold">Total Evaluated</span>
                  <p className="mt-1 text-2xl font-bold text-[#0F172A]">
                    {metrics.totalAccountsEvaluated.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-[#64748B] mt-0.5">Accounts cross-referenced</p>
                </div>
              </div>

              {/* 2x2 Confusion Matrix Table */}
              <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 font-mono text-xs shadow-xs">
                <h3 className="font-bold text-sm text-[#0B2545] border-b border-[#CBD5E1] pb-2">
                  Ground-Truth Confusion Matrix
                </h3>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-center border-collapse border border-[#CBD5E1]">
                    <thead>
                      <tr className="bg-[#F8FAFC] text-[11px] text-[#475569]">
                        <th className="border border-[#CBD5E1] p-3 text-left font-bold">Classification Matrix</th>
                        <th className="border border-[#CBD5E1] p-3 font-bold">Actual Mule (Ground Truth)</th>
                        <th className="border border-[#CBD5E1] p-3 font-bold">Actual Legitimate (Ground Truth)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-[#CBD5E1] p-3 text-left font-bold text-[#0F172A] bg-[#F1F5F9]">
                          Predicted as Mule (Risk &ge; 50)
                        </td>
                        <td className="border border-[#CBD5E1] p-3 bg-green-50">
                          <span className="font-bold text-[#16A34A] text-sm">{metrics.truePositives.toLocaleString()}</span>
                          <div className="text-[10px] text-[#166534]">True Positive (TP)</div>
                        </td>
                        <td className="border border-[#CBD5E1] p-3 bg-red-50">
                          <span className="font-bold text-[#DC2626] text-sm">{metrics.falsePositives.toLocaleString()}</span>
                          <div className="text-[10px] text-[#991B1B]">False Positive (FP)</div>
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-[#CBD5E1] p-3 text-left font-bold text-[#0F172A] bg-[#F1F5F9]">
                          Predicted as Legitimate
                        </td>
                        <td className="border border-[#CBD5E1] p-3 bg-red-50">
                          <span className="font-bold text-[#DC2626] text-sm">{metrics.falseNegatives.toLocaleString()}</span>
                          <div className="text-[10px] text-[#991B1B]">False Negative (FN)</div>
                        </td>
                        <td className="border border-[#CBD5E1] p-3 bg-green-50">
                          <span className="font-bold text-[#16A34A] text-sm">{metrics.trueNegatives.toLocaleString()}</span>
                          <div className="text-[10px] text-[#166534]">True Negative (TN)</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* False Positive & False Negative Inspector */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 font-mono text-xs">
                <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 shadow-xs">
                  <h4 className="font-bold text-[#DC2626] border-b border-[#CBD5E1] pb-2">
                    False Positives ({metrics.falsePositives.toLocaleString()})
                  </h4>
                  <p className="mt-1 text-[11px] text-[#64748B]">
                    Legitimate accounts flagged by heuristics as mules:
                  </p>
                  <div className="mt-2 max-h-36 overflow-y-auto space-y-1 text-[11px] text-[#0F172A]">
                    {metrics.falsePositiveAccounts.length > 0 ? (
                      metrics.falsePositiveAccounts.map((acc) => (
                        <div key={acc} className="p-1.5 rounded-[4px] bg-[#F8FAFC] border border-[#CBD5E1]">
                          {acc}
                        </div>
                      ))
                    ) : (
                      <p className="text-[#64748B] py-2">None detected</p>
                    )}
                  </div>
                </div>

                <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 shadow-xs">
                  <h4 className="font-bold text-[#DC2626] border-b border-[#CBD5E1] pb-2">
                    False Negatives ({metrics.falseNegatives.toLocaleString()})
                  </h4>
                  <p className="mt-1 text-[11px] text-[#64748B]">
                    Injected mules missed by heuristics:
                  </p>
                  <div className="mt-2 max-h-36 overflow-y-auto space-y-1 text-[11px] text-[#0F172A]">
                    {metrics.falseNegativeAccounts.length > 0 ? (
                      metrics.falseNegativeAccounts.map((acc) => (
                        <div key={acc} className="p-1.5 rounded-[4px] bg-[#F8FAFC] border border-[#CBD5E1]">
                          {acc}
                        </div>
                      ))
                    ) : (
                      <p className="text-[#64748B] py-2">None detected</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-12 text-center font-mono text-xs text-[#64748B] shadow-xs">
              <Info className="h-6 w-6 mx-auto mb-2 text-[#0B2545]" />
              <p className="text-[#0F172A] font-bold">No ground-truth file uploaded yet.</p>
              <p className="mt-1 text-[11px]">
                Upload a CSV to compute measured precision, recall, and confusion matrix against ground truth.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

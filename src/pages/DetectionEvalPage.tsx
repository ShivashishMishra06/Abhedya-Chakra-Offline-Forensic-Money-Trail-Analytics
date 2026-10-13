import React, { useState, useMemo } from 'react';
import { Play, Sliders, ShieldCheck, AlertCircle, BarChart3, Clock, Database, Layers } from 'lucide-react';
import { generateEvalDataset } from '../dev/evalData';
import { computeRisks, ScoredAccount, DETECTION_CONFIG } from '../parts/MuleDetector/detection';

interface EvaluationRunData {
  scoredList: ScoredAccount[];
  mules: Set<string>;
  muleLayers: Map<string, 'L1' | 'L2' | 'L3'>;
  scanTimeSec: number;
  totalTransactions: number;
  totalAccounts: number;
}

interface ThresholdMetrics {
  threshold: number;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  flagged: number;
  precision: number;
  recall: number;
  f1: number;
  accuracy: number;
}

export const DetectionEvalPage: React.FC = () => {
  const [runData, setRunData] = useState<EvaluationRunData | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [sliderThreshold, setSliderThreshold] = useState<number>(DETECTION_CONFIG.flagThreshold);
  const [statusText, setStatusText] = useState<string>('');

  const handleRunEvaluation = async () => {
    setIsRunning(true);
    setStatusText('Generating synthetic dataset (300,000 transactions)...');

    // Yield to allow UI update
    await new Promise((r) => setTimeout(r, 20));

    try {
      const t0 = performance.now();
      const dataset = generateEvalDataset(42);

      setStatusText('Running computeRisks single-pass detection...');
      await new Promise((r) => setTimeout(r, 10));

      const tScanStart = performance.now();
      const scoredMap = computeRisks(dataset.transactions);
      const scanElapsedSec = (performance.now() - tScanStart) / 1000;

      const scoredList = Array.from(scoredMap.values());

      setRunData({
        scoredList,
        mules: dataset.mules,
        muleLayers: dataset.muleLayers,
        scanTimeSec: scanElapsedSec,
        totalTransactions: dataset.transactions.length,
        totalAccounts: scoredList.length,
      });
      setStatusText('');
    } catch (err) {
      console.error(err);
      setStatusText('Error executing evaluation.');
    } finally {
      setIsRunning(false);
    }
  };

  // Compute metrics for any given threshold
  const computeMetricsForThreshold = (
    list: ScoredAccount[],
    mules: Set<string>,
    th: number
  ): ThresholdMetrics => {
    let tp = 0;
    let fp = 0;
    let tn = 0;
    let fn = 0;

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const isMule = mules.has(item.account);
      const isFlagged = item.score >= th;

      if (isMule && isFlagged) tp++;
      else if (!isMule && isFlagged) fp++;
      else if (!isMule && !isFlagged) tn++;
      else if (isMule && !isFlagged) fn++;
    }

    const precision = tp + fp > 0 ? (tp / (tp + fp)) * 100 : 0;
    const recall = tp + fn > 0 ? (tp / (tp + fn)) * 100 : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const total = tp + fp + tn + fn;
    const accuracy = total > 0 ? ((tp + tn) / total) * 100 : 0;

    return {
      threshold: th,
      tp,
      fp,
      tn,
      fn,
      flagged: tp + fp,
      precision,
      recall,
      f1,
      accuracy,
    };
  };

  // Live metrics based on current slider threshold
  const liveMetrics = useMemo(() => {
    if (!runData) return null;
    return computeMetricsForThreshold(runData.scoredList, runData.mules, sliderThreshold);
  }, [runData, sliderThreshold]);

  // Layer recall breakdown based on current slider threshold
  const layerRecall = useMemo(() => {
    if (!runData) return null;
    const { scoredList, mules, muleLayers } = runData;
    const flaggedSet = new Set(
      scoredList.filter((a) => a.score >= sliderThreshold).map((a) => a.account)
    );

    let l1Total = 0;
    let l1Detected = 0;
    let l2Total = 0;
    let l2Detected = 0;
    let l3Total = 0;
    let l3Detected = 0;

    for (const muleAcc of mules) {
      const layer = muleLayers.get(muleAcc) || 'L1';
      const isFlagged = flaggedSet.has(muleAcc);

      if (layer === 'L1') {
        l1Total++;
        if (isFlagged) l1Detected++;
      } else if (layer === 'L2') {
        l2Total++;
        if (isFlagged) l2Detected++;
      } else if (layer === 'L3') {
        l3Total++;
        if (isFlagged) l3Detected++;
      }
    }

    return {
      l1: {
        total: l1Total,
        detected: l1Detected,
        pct: l1Total > 0 ? (l1Detected / l1Total) * 100 : 0,
      },
      l2: {
        total: l2Total,
        detected: l2Detected,
        pct: l2Total > 0 ? (l2Detected / l2Total) * 100 : 0,
      },
      l3: {
        total: l3Total,
        detected: l3Detected,
        pct: l3Total > 0 ? (l3Detected / l3Total) * 100 : 0,
      },
    };
  }, [runData, sliderThreshold]);

  // Precomputed thresholds table for 40, 50, 60, 70, 80
  const thresholdTable = useMemo(() => {
    if (!runData) return [];
    return [40, 50, 60, 70, 80].map((th) =>
      computeMetricsForThreshold(runData.scoredList, runData.mules, th)
    );
  }, [runData]);

  // Suggested threshold with best F1
  const suggestedThreshold = useMemo(() => {
    if (thresholdTable.length === 0) return null;
    let best = thresholdTable[0];
    for (const t of thresholdTable) {
      if (t.f1 > best.f1) {
        best = t;
      }
    }
    return best;
  }, [thresholdTable]);

  // Top 20 False Positives
  const topFalsePositives = useMemo(() => {
    if (!runData) return [];
    const { scoredList, mules } = runData;
    return scoredList
      .filter((a) => !mules.has(a.account) && a.score >= sliderThreshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }, [runData, sliderThreshold]);

  // Top 20 False Negatives
  const topFalseNegatives = useMemo(() => {
    if (!runData) return [];
    const { scoredList, mules } = runData;
    return scoredList
      .filter((a) => mules.has(a.account) && a.score < sliderThreshold)
      .sort((a, b) => a.score - b.score)
      .slice(0, 20);
  }, [runData, sliderThreshold]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 bg-[#F1F5F9] text-[#0F172A] font-mono text-xs">
      {/* Prominent Mandatory Label */}
      <div className="mb-4 rounded-[6px] border border-amber-300 bg-amber-50 px-4 py-2 text-center font-bold text-[#92400E] uppercase tracking-wider text-[11px] shadow-xs">
        Synthetic evaluation. This is not the evaluators&apos; dataset.
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#CBD5E1] pb-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] text-[#64748B] uppercase tracking-wider">
            <span>Evaluation Framework</span>
            <span>&middot;</span>
            <span className="text-[#0B2545] font-bold">Detection Precision &amp; Recall Benchmark</span>
          </div>
          <h1 className="font-serif text-xl font-bold text-[#0B2545] mt-1">
            Detection Benchmark &amp; Confusion Matrix
          </h1>
          <p className="text-xs text-[#64748B] mt-1 max-w-2xl">
            Empirical validation identifying 1,500 ground-truth injected mule accounts while minimizing false positives on 23,500 regular accounts across 300,000 transactions.
          </p>
        </div>

        <div>
          <button
            onClick={handleRunEvaluation}
            disabled={isRunning}
            className="flex items-center gap-2 rounded-[6px] bg-[#0B2545] px-4 py-2 font-bold text-white hover:bg-[#133866] disabled:opacity-50 cursor-pointer transition-colors shadow-xs"
          >
            <Play className="h-4 w-4 fill-current text-[#E2B734]" />
            <span>{isRunning ? 'Running evaluation...' : 'Run evaluation'}</span>
          </button>
        </div>
      </div>

      {isRunning && (
        <div className="mb-6 rounded-[8px] border border-[#CBD5E1] bg-white p-5 text-center shadow-xs">
          <p className="font-bold text-[#0B2545] text-sm">{statusText}</p>
          <p className="text-[11px] text-[#64748B] mt-1">
            Deterministic evaluation running in-memory. Please wait...
          </p>
        </div>
      )}

      {/* When evaluation has NOT been run: Show NO numbers */}
      {!runData && !isRunning && (
        <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-12 text-center text-[#64748B] shadow-xs">
          <BarChart3 className="h-10 w-10 text-[#0B2545] mx-auto mb-3" />
          <h3 className="font-serif text-base font-bold text-[#0F172A]">
            Evaluation Not Yet Executed
          </h3>
          <p className="mt-1 text-xs max-w-md mx-auto">
            Click &quot;Run evaluation&quot; above to generate the labelled 300,000-transaction dataset, execute computeRisks, and calculate genuine empirical metrics.
          </p>
        </div>
      )}

      {/* When evaluation HAS been run: Display ONLY real measured values */}
      {runData && liveMetrics && (
        <div className="space-y-6">
          {/* Executive Summary Bar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-4 shadow-xs">
              <span className="text-[10px] text-[#64748B] uppercase font-bold">Precision</span>
              <p className="mt-1 text-2xl font-bold text-[#16A34A]">
                {liveMetrics.precision.toFixed(1)}%
              </p>
              <span className="text-[10px] text-[#64748B]">
                {liveMetrics.tp} / {liveMetrics.flagged} flagged
              </span>
            </div>

            <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-4 shadow-xs">
              <span className="text-[10px] text-[#64748B] uppercase font-bold">Recall</span>
              <p className="mt-1 text-2xl font-bold text-[#16A34A]">
                {liveMetrics.recall.toFixed(1)}%
              </p>
              <span className="text-[10px] text-[#64748B]">
                {liveMetrics.tp} / 1,500 mules
              </span>
            </div>

            <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-4 shadow-xs">
              <span className="text-[10px] text-[#64748B] uppercase font-bold">F1 Score</span>
              <p className="mt-1 text-2xl font-bold text-[#B45309]">
                {liveMetrics.f1.toFixed(1)}%
              </p>
              <span className="text-[10px] text-[#64748B]">Harmonic mean</span>
            </div>

            <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-4 shadow-xs">
              <span className="text-[10px] text-[#64748B] uppercase font-bold">Accuracy</span>
              <p className="mt-1 text-2xl font-bold text-[#0F172A]">
                {liveMetrics.accuracy.toFixed(1)}%
              </p>
              <span className="text-[10px] text-[#64748B]">Overall dataset</span>
            </div>

            <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-4 shadow-xs">
              <span className="text-[10px] text-[#64748B] uppercase font-bold">Flagged Count</span>
              <p className="mt-1 text-2xl font-bold text-[#0F172A]">
                {liveMetrics.flagged.toLocaleString()}
              </p>
              <span className="text-[10px] text-[#64748B]">
                Expected: 1,500 mules
              </span>
            </div>

            <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-4 shadow-xs">
              <span className="text-[10px] text-[#64748B] uppercase font-bold">Scan Time</span>
              <p className="mt-1 text-2xl font-bold text-[#0F172A]">
                {runData.scanTimeSec.toFixed(2)} s
              </p>
              <span className="text-[10px] text-[#64748B]">
                {runData.totalTransactions.toLocaleString()} txs
              </span>
            </div>
          </div>

          {/* Interactive Threshold Slider & Suggested Threshold */}
          <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#CBD5E1] pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-[#B45309]" />
                <h3 className="font-bold uppercase tracking-wider text-xs text-[#0B2545]">
                  Threshold Adjustment Slider
                </h3>
              </div>
              <div className="font-bold text-[#B45309] text-sm">
                Score Threshold: {sliderThreshold}
              </div>
            </div>

            <input
              type="range"
              min={0}
              max={100}
              value={sliderThreshold}
              onChange={(e) => setSliderThreshold(parseInt(e.target.value, 10))}
              className="w-full accent-[#0B2545] cursor-pointer"
            />

            <div className="flex justify-between text-[10px] text-[#64748B] mt-1">
              <span>0 (Flag All)</span>
              <span>25</span>
              <span>50</span>
              <span>60 (Default)</span>
              <span>75</span>
              <span>100 (Flag None)</span>
            </div>

            {/* Suggested Threshold Line */}
            {suggestedThreshold && (
              <div className="mt-3 pt-3 border-t border-[#E2E8F0] text-xs text-[#475569] flex items-center justify-between">
                <span>
                  <strong className="text-[#0B2545]">Suggested threshold:</strong> {suggestedThreshold.threshold} (F1: {suggestedThreshold.f1.toFixed(1)}%, Precision: {suggestedThreshold.precision.toFixed(1)}%, Recall: {suggestedThreshold.recall.toFixed(1)}%)
                </span>
                <span className="text-[10px] text-[#94A3B8]">
                  (Based on empirical benchmark table)
                </span>
              </div>
            )}
          </div>

          {/* Layer Recall Breakdown */}
          {layerRecall && (
            <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 shadow-xs">
              <h3 className="font-bold uppercase tracking-wider text-xs text-[#0B2545] mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#B45309]" />
                Recall per Layer (L1 Collector, L2 Distributor, L3 Cash-Out)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] p-3.5">
                  <span className="text-[10px] text-[#64748B] uppercase font-bold">Layer 1 (Collector) Recall</span>
                  <p className="mt-1 text-xl font-bold text-[#16A34A]">
                    {layerRecall.l1.pct.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-[#64748B]">
                    {layerRecall.l1.detected} / {layerRecall.l1.total} detected
                  </p>
                </div>

                <div className="rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] p-3.5">
                  <span className="text-[10px] text-[#64748B] uppercase font-bold">Layer 2 (Distributor) Recall</span>
                  <p className="mt-1 text-xl font-bold text-[#16A34A]">
                    {layerRecall.l2.pct.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-[#64748B]">
                    {layerRecall.l2.detected} / {layerRecall.l2.total} detected
                  </p>
                </div>

                <div className="rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] p-3.5">
                  <span className="text-[10px] text-[#64748B] uppercase font-bold">Layer 3 (Cash-Out) Recall</span>
                  <p className="mt-1 text-xl font-bold text-[#16A34A]">
                    {layerRecall.l3.pct.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-[#64748B]">
                    {layerRecall.l3.detected} / {layerRecall.l3.total} detected
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Thresholds Performance Table (40, 50, 60, 70, 80) */}
          <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 shadow-xs">
            <h3 className="font-bold uppercase tracking-wider text-xs text-[#0B2545] mb-3">
              Performance at Standard Thresholds (40, 50, 60, 70, 80)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-[#CBD5E1] text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] text-[#475569] border-b border-[#CBD5E1]">
                    <th className="p-2.5 border border-[#CBD5E1] font-bold">Threshold</th>
                    <th className="p-2.5 border border-[#CBD5E1] text-right font-bold">Flagged</th>
                    <th className="p-2.5 border border-[#CBD5E1] text-right font-bold">True Positives</th>
                    <th className="p-2.5 border border-[#CBD5E1] text-right font-bold">False Positives</th>
                    <th className="p-2.5 border border-[#CBD5E1] text-right font-bold">Precision</th>
                    <th className="p-2.5 border border-[#CBD5E1] text-right font-bold">Recall</th>
                    <th className="p-2.5 border border-[#CBD5E1] text-right font-bold">F1 Score</th>
                  </tr>
                </thead>
                <tbody>
                  {thresholdTable.map((row) => (
                    <tr
                      key={row.threshold}
                      className={`border-b border-[#CBD5E1] ${
                        row.threshold === sliderThreshold
                          ? 'bg-amber-50 font-bold text-[#0B2545]'
                          : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <td className="p-2.5 border border-[#CBD5E1]">
                        {row.threshold} {row.threshold === 60 ? '(Default)' : ''}
                      </td>
                      <td className="p-2.5 border border-[#CBD5E1] text-right">{row.flagged.toLocaleString()}</td>
                      <td className="p-2.5 border border-[#CBD5E1] text-right text-[#16A34A]">{row.tp.toLocaleString()}</td>
                      <td className="p-2.5 border border-[#CBD5E1] text-right text-[#DC2626]">{row.fp.toLocaleString()}</td>
                      <td className="p-2.5 border border-[#CBD5E1] text-right">{row.precision.toFixed(1)}%</td>
                      <td className="p-2.5 border border-[#CBD5E1] text-right">{row.recall.toFixed(1)}%</td>
                      <td className="p-2.5 border border-[#CBD5E1] text-right text-[#B45309] font-bold">{row.f1.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2x2 Confusion Matrix Details */}
          <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 shadow-xs">
            <h3 className="font-bold uppercase tracking-wider text-xs text-[#0B2545] mb-3">
              Confusion Matrix at Threshold {sliderThreshold}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse border border-[#CBD5E1]">
                <thead>
                  <tr className="bg-[#F8FAFC] text-[#475569] text-[11px]">
                    <th className="p-2.5 border border-[#CBD5E1] text-left font-bold">Classification</th>
                    <th className="p-2.5 border border-[#CBD5E1] font-bold">Actual Mule (1,500)</th>
                    <th className="p-2.5 border border-[#CBD5E1] font-bold">Actual Regular (23,500)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2.5 border border-[#CBD5E1] text-left font-bold bg-[#F1F5F9] text-[#0F172A]">
                      Predicted Mule (Score &ge; {sliderThreshold})
                    </td>
                    <td className="p-2.5 border border-[#CBD5E1] bg-green-50">
                      <span className="text-sm font-bold text-[#16A34A]">{liveMetrics.tp.toLocaleString()}</span>
                      <div className="text-[10px] text-[#166534]">True Positive (TP)</div>
                    </td>
                    <td className="p-2.5 border border-[#CBD5E1] bg-red-50">
                      <span className="text-sm font-bold text-[#DC2626]">{liveMetrics.fp.toLocaleString()}</span>
                      <div className="text-[10px] text-[#991B1B]">False Positive (FP)</div>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 border border-[#CBD5E1] text-left font-bold bg-[#F1F5F9] text-[#0F172A]">
                      Predicted Regular (Score &lt; {sliderThreshold})
                    </td>
                    <td className="p-2.5 border border-[#CBD5E1] bg-red-50">
                      <span className="text-sm font-bold text-[#DC2626]">{liveMetrics.fn.toLocaleString()}</span>
                      <div className="text-[10px] text-[#991B1B]">False Negative (FN)</div>
                    </td>
                    <td className="p-2.5 border border-[#CBD5E1] bg-green-50">
                      <span className="text-sm font-bold text-[#16A34A]">{liveMetrics.tn.toLocaleString()}</span>
                      <div className="text-[10px] text-[#166534]">True Negative (TN)</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Diagnostic Inspection: Top 20 False Positives & Top 20 False Negatives */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top 20 False Positives */}
            <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 shadow-xs">
              <div className="flex justify-between items-center border-b border-[#CBD5E1] pb-2 mb-3">
                <h4 className="font-bold text-[#DC2626] uppercase text-xs">
                  Top False Positives ({topFalsePositives.length} shown)
                </h4>
                <span className="text-[10px] text-[#64748B]">Legitimate flagged as mule</span>
              </div>
              {topFalsePositives.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {topFalsePositives.map((item) => (
                    <div key={item.account} className="rounded-[4px] bg-[#F8FAFC] border border-[#CBD5E1] p-2.5 text-[11px]">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-[#0F172A]">{item.account}</span>
                        <span className="font-bold text-[#DC2626]">Score: {item.score}</span>
                      </div>
                      <div className="text-[10px] text-[#64748B] space-y-0.5">
                        {item.reasons.map((r, i) => (
                          <div key={i}>&bull; {r}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#16A34A] py-4 text-center font-bold">
                  Zero false positives detected at threshold {sliderThreshold}.
                </p>
              )}
            </div>

            {/* Top 20 False Negatives */}
            <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 shadow-xs">
              <div className="flex justify-between items-center border-b border-[#CBD5E1] pb-2 mb-3">
                <h4 className="font-bold text-[#DC2626] uppercase text-xs">
                  Top False Negatives ({topFalseNegatives.length} shown)
                </h4>
                <span className="text-[10px] text-[#64748B]">Ground-truth mules missed</span>
              </div>
              {topFalseNegatives.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {topFalseNegatives.map((item) => (
                    <div key={item.account} className="rounded-[4px] bg-[#F8FAFC] border border-[#CBD5E1] p-2.5 text-[11px]">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-[#0F172A]">{item.account}</span>
                        <span className="font-bold text-[#B45309]">
                          Score: {item.score} ({runData.muleLayers.get(item.account) || 'MULE'})
                        </span>
                      </div>
                      <div className="text-[10px] text-[#64748B] space-y-0.5">
                        {item.reasons.length > 0 ? (
                          item.reasons.map((r, i) => <div key={i}>&bull; {r}</div>)
                        ) : (
                          <div>&bull; Insufficient independent signals to exceed threshold</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#16A34A] py-4 text-center font-bold">
                  Zero false negatives detected at threshold {sliderThreshold}.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

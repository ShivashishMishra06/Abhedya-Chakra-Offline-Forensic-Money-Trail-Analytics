import React, { useState } from 'react';
import { FlaskConical, Download, Play, AlertTriangle } from 'lucide-react';
import { ForensicEngine } from '../engine/engine';
import { generateSyntheticDataset, SyntheticDatasetOutput } from '../lib/syntheticGenerator';
import { IngestionMetrics } from '../types/dataset';
import { OfficialHeaderBanner } from '../components/layout/OfficialHeaderBanner';

interface DevGeneratorPageProps {
  engine: ForensicEngine;
  onDatasetLoaded: (metrics: IngestionMetrics) => void;
  onNavigateTrace: (victimAccount: string) => void;
}

export const DevGeneratorPage: React.FC<DevGeneratorPageProps> = ({
  engine,
  onDatasetLoaded,
  onNavigateTrace,
}) => {
  const [rowCount, setRowCount] = useState<number>(10000);
  const [numVictims, setNumVictims] = useState<number>(5);
  const [muleRings, setMuleRings] = useState<number>(8);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<SyntheticDatasetOutput | null>(null);
  const [loadStatus, setLoadStatus] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setLoadStatus(null);
    try {
      await new Promise((r) => setTimeout(r, 50));
      const res = generateSyntheticDataset({
        totalRows: rowCount,
        numVictims,
        muleRingsCount: muleRings,
      });
      setGeneratedResult(res);
    } catch {
      // Ignore
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLoadDirectlyIntoEngine = async () => {
    if (!generatedResult) return;
    setLoadStatus('Ingesting synthetic records into in-memory forensic engine...');
    try {
      const metrics = await engine.loadCsvText(generatedResult.csvText);
      setLoadStatus(`Loaded ${metrics.rowCount.toLocaleString()} transactions and ${metrics.distinctAccounts.toLocaleString()} accounts in ${(metrics.elapsedMs / 1000).toFixed(2)}s.`);
      onDatasetLoaded(metrics);
    } catch (err) {
      setLoadStatus(`Error: ${err instanceof Error ? err.message : 'Failed to load'}`);
    }
  };

  const handleDownloadCsv = () => {
    if (!generatedResult) return;
    const blob = new Blob([generatedResult.csvText], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `abhedya_synthetic_transactions_${rowCount}_rows.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadGroundTruth = () => {
    if (!generatedResult) return;
    const blob = new Blob([generatedResult.groundTruthCsvText], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `abhedya_ground_truth_${generatedResult.injectedMules.length}_mules.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 bg-[#F1F5F9] text-[#0F172A]">
      {/* Official Header Banner */}
      <OfficialHeaderBanner
        title="Synthetic Forensic Dataset Generator"
        category="Development & Test Harness · Offline Benchmark"
        badge="Test Tool"
      />

      {/* Description */}
      <div className="mb-6 border-b border-[#CBD5E1] pb-4">
        <p className="text-xs text-[#64748B] max-w-2xl leading-relaxed">
          Generates synthetic 11-column CSV datasets matching forensic specifications with injected multi-tiered
          money mule networks for offline benchmarking and jury verification.
        </p>
      </div>

      {/* Development Only Notice */}
      <div className="mb-6 rounded-[8px] border border-[#CBD5E1] bg-white p-4 font-mono text-xs text-[#0F172A] flex items-start gap-2.5 shadow-xs">
        <AlertTriangle className="h-4 w-4 text-[#B45309] shrink-0 mt-0.5" />
        <div>
          <strong className="block font-semibold text-[#B45309]">
            Synthetic Test Data, Development Only
          </strong>
          <p className="text-[11px] mt-0.5 text-[#64748B] leading-relaxed">
            The production app initializes with an empty ledger. Use this tool to generate realistic
            test ledgers and ground-truth validation pairs for offline demonstration and testing.
          </p>
        </div>
      </div>

      {/* Generator Controls */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 font-mono text-xs space-y-4 shadow-xs">
          <h3 className="font-serif text-sm font-bold text-[#0F172A] border-b border-[#CBD5E1] pb-2">
            Dataset Parameters
          </h3>

          <div>
            <label className="text-[#64748B] block font-semibold mb-1">Target Total Rows:</label>
            <select
              value={rowCount}
              onChange={(e) => setRowCount(parseInt(e.target.value, 10))}
              className="w-full rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-[#0F172A] focus:border-[#0B2545] focus:outline-none"
            >
              <option value="5000">5,000 Transactions (Instant evaluation)</option>
              <option value="10000">10,000 Transactions (Standard test)</option>
              <option value="25000">25,000 Transactions (Extended test)</option>
              <option value="50000">50,000 Transactions (Stress test)</option>
              <option value="100000">100,000 Transactions (Deep graph test)</option>
            </select>
          </div>

          <div>
            <label className="text-[#64748B] block font-semibold mb-1">Injected Victim Accounts:</label>
            <input
              type="number"
              min="1"
              max="20"
              value={numVictims}
              onChange={(e) => setNumVictims(parseInt(e.target.value, 10) || 1)}
              className="w-full rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-[#0F172A] focus:border-[#0B2545] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[#64748B] block font-semibold mb-1">Multi-Tier Mule Rings:</label>
            <input
              type="number"
              min="1"
              max="50"
              value={muleRings}
              onChange={(e) => setMuleRings(parseInt(e.target.value, 10) || 1)}
              className="w-full rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-[#0F172A] focus:border-[#0B2545] focus:outline-none"
            />
          </div>

          <div className="border-t border-[#CBD5E1] pt-4">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 rounded-[6px] bg-[#0B2545] py-2.5 font-mono text-xs font-bold text-white hover:bg-[#133866] disabled:opacity-50 cursor-pointer transition-colors shadow-xs"
            >
              <FlaskConical className="h-4 w-4" />
              <span>{isGenerating ? 'Synthesizing Records...' : 'Generate Synthetic Dataset'}</span>
            </button>
          </div>
        </div>

        {/* Output Panel */}
        <div className="lg:col-span-2 rounded-[8px] border border-[#CBD5E1] bg-white p-5 font-mono text-xs shadow-xs">
          <h3 className="font-serif text-sm font-bold text-[#0F172A] border-b border-[#CBD5E1] pb-2">
            Generated Dataset Status & Ground Truth Export
          </h3>

          {generatedResult ? (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 bg-[#F8FAFC] border border-[#CBD5E1] p-3 rounded-[6px]">
                <div>
                  <span className="text-[10px] text-[#64748B] uppercase">Generated Rows</span>
                  <p className="mt-0.5 text-base font-bold text-[#0F172A]">{generatedResult.totalRows.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-[10px] text-[#64748B] uppercase">Distinct Accounts</span>
                  <p className="mt-0.5 text-base font-bold text-[#0F172A]">{generatedResult.distinctAccounts.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-[10px] text-[#64748B] uppercase">Injected Mules</span>
                  <p className="mt-0.5 text-base font-bold text-[#DC2626]">{generatedResult.injectedMules.length}</p>
                </div>
                <div>
                  <span className="text-[10px] text-[#64748B] uppercase">Sample Victims</span>
                  <p className="mt-0.5 text-base font-bold text-[#166534]">{generatedResult.sampleVictims.length}</p>
                </div>
              </div>

              {/* Sample Victims Available to Test */}
              <div className="bg-[#F8FAFC] border border-[#CBD5E1] p-3 rounded-[6px]">
                <span className="font-bold text-[#0F172A] block mb-2">
                  Injected Victim Accounts (Click to trace in Blind Victim Query):
                </span>
                <div className="flex flex-wrap gap-2">
                  {generatedResult.sampleVictims.map((vic) => (
                    <button
                      key={vic}
                      onClick={() => onNavigateTrace(vic)}
                      className="px-2.5 py-1 rounded-[4px] bg-white border border-[#CBD5E1] hover:border-[#0B2545] text-xs font-mono font-bold text-[#0B2545] cursor-pointer transition-colors shadow-xs"
                    >
                      {vic} &rarr;
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  onClick={handleLoadDirectlyIntoEngine}
                  className="flex items-center gap-1.5 rounded-[6px] bg-[#0B2545] px-4 py-2 font-mono text-xs font-bold text-white hover:bg-[#133866] cursor-pointer transition-colors shadow-xs"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>Load Directly into Forensic Engine</span>
                </button>
                <button
                  onClick={handleDownloadCsv}
                  className="flex items-center gap-1.5 rounded-[6px] bg-white border border-[#CBD5E1] px-3.5 py-2 font-mono text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer transition-colors shadow-xs"
                >
                  <Download className="h-3.5 w-3.5 text-[#0B2545]" />
                  <span>Download Transaction CSV</span>
                </button>
                <button
                  onClick={handleDownloadGroundTruth}
                  className="flex items-center gap-1.5 rounded-[6px] bg-white border border-[#CBD5E1] px-3.5 py-2 font-mono text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer transition-colors shadow-xs"
                >
                  <Download className="h-3.5 w-3.5 text-[#0B2545]" />
                  <span>Download Ground-Truth CSV</span>
                </button>
              </div>

              {loadStatus && (
                <div className="p-3 bg-[#F0FDF4] border border-[#16A34A] text-[#166534] rounded-[6px] font-mono text-xs">
                  {loadStatus}
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-[#64748B] font-mono text-xs">
              <FlaskConical className="h-8 w-8 text-[#94A3B8] mx-auto mb-2" />
              <p>Configure parameters and click "Generate Synthetic Dataset".</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

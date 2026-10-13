import React, { useState, useRef } from 'react';
import { Upload, FileCheck, AlertCircle, HardDrive, CheckCircle2, ArrowRight } from 'lucide-react';
import { EXPECTED_CSV_COLUMNS, ForensicEngine, IngestProgress } from '../engine/engine';
import { IngestionMetrics } from '../types/dataset';
import { generateSyntheticDataset } from '../lib/syntheticGenerator';
import { OfficialHeaderBanner } from '../components/layout/OfficialHeaderBanner';

interface IngestPageProps {
  engine: ForensicEngine;
  onIngestSuccess: (metrics: IngestionMetrics) => void;
  onNavigate: (route: string) => void;
}

export const IngestPage: React.FC<IngestPageProps> = ({
  engine,
  onIngestSuccess,
  onNavigate,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<IngestProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<IngestionMetrics | null>(engine.getMetrics());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const processFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrorMessage('Invalid file format. Please select a valid CSV file.');
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);
    setProgress({
      rowsParsed: 0,
      bytesRead: 0,
      totalBytes: file.size,
      elapsedMs: 0,
      stage: 'reading',
      percent: 0,
    });

    try {
      const calculatedMetrics = await engine.loadCsvFile(file, (p: IngestProgress) => {
        setProgress(p);
      });

      setMetrics(calculatedMetrics);
      onIngestSuccess(calculatedMetrics);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error during CSV parsing.';
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadDemoDataset = async (size: 'small' | 'medium') => {
    setErrorMessage(null);
    setIsProcessing(true);
    setProgress({
      rowsParsed: 0,
      bytesRead: 0,
      totalBytes: 1000000,
      elapsedMs: 0,
      stage: 'reading',
      percent: 10,
    });

    try {
      const rowCount = size === 'small' ? 5000 : 25000;
      const demoResult = generateSyntheticDataset({
        totalRows: rowCount,
        numVictims: size === 'small' ? 3 : 10,
        muleRingsCount: size === 'small' ? 2 : 5,
      });

      const calculatedMetrics = await engine.loadCsvText(demoResult.csvText, (p: IngestProgress) => {
        setProgress(p);
      });

      setMetrics(calculatedMetrics);
      onIngestSuccess(calculatedMetrics);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate and load synthetic dataset.';
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full px-4 py-6 sm:px-6 bg-[#F1F5F9] text-[#0F172A]">
      {/* Official Header Banner */}
      <OfficialHeaderBanner
        title="Transaction Dataset Ingestion & CSR Indexer"
        category="Evidence Ingestion Module"
        badge="60s SLA Ingestion"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Ingestion Zone */}
        <div className="lg:col-span-2 space-y-6">
          {/* File Drop Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center rounded-[8px] border-2 border-dashed p-10 text-center transition-colors shadow-xs ${
              isDragging
                ? 'border-[#B45309] bg-amber-50/40'
                : 'border-[#CBD5E1] bg-white hover:border-[#0B2545]'
            } ${isProcessing ? 'pointer-events-none opacity-60' : ''}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileInput}
              className="hidden"
            />

            <div className="flex h-12 w-12 items-center justify-center rounded-[6px] bg-[#F1F5F9] border border-[#CBD5E1]">
              <Upload className="h-6 w-6 text-[#0B2545]" />
            </div>

            <h3 className="mt-4 font-serif text-base font-bold text-[#0F172A]">
              Drag and drop banking transaction CSV here
            </h3>
            <p className="mt-1 text-xs text-[#64748B] font-mono">
              Supports standard CSV format with 11 forensic columns. Streamed via File.stream() chunking.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="cursor-pointer rounded-[6px] bg-[#0B2545] px-5 py-2.5 font-mono text-xs font-bold text-white hover:bg-[#133866] transition-colors shadow-xs"
              >
                Browse CSV File
              </button>
            </div>
          </div>

          {/* Quick Offline Evaluation Datasets */}
          <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 text-xs font-mono shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="font-bold text-[#0F172A] block text-sm">
                  Offline Evaluation Test Data
                </span>
                <p className="text-[#64748B] mt-0.5 text-[11px]">
                  Load pre-configured synthetic datasets with injected multi-tier mule rings for immediate jury testing.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleLoadDemoDataset('small')}
                  disabled={isProcessing}
                  className="rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 py-1.5 font-medium text-[#0F172A] hover:border-[#0B2545] hover:text-[#0B2545] cursor-pointer transition-colors"
                >
                  Load 5,000 Rows
                </button>
                <button
                  onClick={() => handleLoadDemoDataset('medium')}
                  disabled={isProcessing}
                  className="rounded-[6px] bg-[#0B2545] px-3.5 py-1.5 font-bold text-white hover:bg-[#133866] cursor-pointer transition-colors shadow-xs"
                >
                  Load 25,000 Rows
                </button>
              </div>
            </div>
          </div>

          {/* Processing Progress Monitor */}
          {isProcessing && progress && (
            <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 font-mono text-xs shadow-xs">
              <div className="flex items-center justify-between text-[#B45309] font-bold mb-2">
                <span>
                  {progress.stage === 'reading' && 'Streaming & Parsing Row Chunks...'}
                  {progress.stage === 'indexing' && 'Building CSR & CSC Adjacency Arrays...'}
                  {progress.stage === 'complete' && 'Ingestion Finalized'}
                </span>
                <span>{progress.percent || 0}%</span>
              </div>

              {/* Progress bar */}
              <div className="h-2.5 w-full overflow-hidden rounded-[4px] bg-[#E2E8F0] border border-[#CBD5E1]">
                <div
                  className="h-full bg-[#B45309] transition-all duration-150"
                  style={{ width: `${progress.percent || 0}%` }}
                />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-[#64748B]">
                <div>
                  Rows Parsed: <span className="font-bold text-[#0F172A]">{progress.rowsParsed.toLocaleString()}</span>
                </div>
                <div>
                  Bytes Read: <span className="font-bold text-[#0F172A]">{(progress.bytesRead / (1024 * 1024)).toFixed(1)} MB</span>
                </div>
                <div>
                  Elapsed: <span className="font-bold text-[#0F172A]">{(progress.elapsedMs / 1000).toFixed(1)}s</span>
                </div>
              </div>
            </div>
          )}

          {/* Error Message Display */}
          {errorMessage && (
            <div className="rounded-[8px] border border-[#DC2626] bg-red-50 p-4 text-xs text-[#991B1B]">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-[#DC2626] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Ingestion Failure:</span>
                  <p className="mt-1 font-mono text-[11px] text-[#B91C1C]">{errorMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* Post-Ingest Benchmark Results */}
          {metrics && !isProcessing && (
            <div className="rounded-[8px] border border-[#16A34A]/40 bg-white p-5 font-mono text-xs text-[#0F172A] shadow-xs">
              <div className="flex items-center justify-between border-b border-[#CBD5E1] pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[#16A34A]" />
                  <span className="font-serif text-sm font-bold text-[#0B2545]">
                    Dataset Successfully Indexed
                  </span>
                </div>
                <button
                  onClick={() => onNavigate('#/victim-query')}
                  className="flex items-center gap-1.5 rounded-[6px] bg-[#0B2545] px-4 py-2 text-xs font-bold text-white hover:bg-[#133866] cursor-pointer shadow-xs transition-colors"
                >
                  <span>Proceed to Blind Victim Query</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="border-r border-[#E2E8F0] pr-2">
                  <p className="text-[10px] uppercase font-semibold text-[#64748B]">Measured Rows</p>
                  <p className="mt-0.5 text-lg font-bold text-[#0F172A]">{metrics.rowCount.toLocaleString()}</p>
                </div>
                <div className="border-r border-[#E2E8F0] pr-2">
                  <p className="text-[10px] uppercase font-semibold text-[#64748B]">Distinct Accounts</p>
                  <p className="mt-0.5 text-lg font-bold text-[#0F172A]">{metrics.distinctAccounts.toLocaleString()}</p>
                </div>
                <div className="border-r border-[#E2E8F0] pr-2">
                  <p className="text-[10px] uppercase font-semibold text-[#64748B]">Ingestion Time</p>
                  <p className="mt-0.5 text-lg font-bold text-[#16A34A]">
                    {(metrics.elapsedMs / 1000).toFixed(2)}s
                    <span className="text-[10px] font-normal text-[#64748B] ml-1">
                      {metrics.meetsBenchmark ? '(Passed <60s SLA)' : '(Exceeded SLA)'}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-semibold text-[#64748B]">Throughput</p>
                  <p className="mt-0.5 text-lg font-bold text-[#0F172A]">
                    {metrics.throughputRowsPerSec.toLocaleString()} rows/s
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Schema & Specifications */}
        <div className="space-y-4">
          <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 text-xs font-mono shadow-xs">
            <h4 className="flex items-center gap-2 font-serif font-bold text-[#0B2545] text-sm">
              <FileCheck className="h-4 w-4 text-[#B45309]" />
              Required 11-Column Schema
            </h4>
            <p className="mt-1 text-[11px] text-[#64748B]">
              The parser enforces exact column headers. Mismatches will result in immediate rejection.
            </p>

            <ul className="mt-3 space-y-1.5 text-[11px] border-t border-[#E2E8F0] pt-3">
              {EXPECTED_CSV_COLUMNS.map((col, idx) => (
                <li key={col} className="flex items-center justify-between text-[#475569]">
                  <span>
                    <span className="text-[#94A3B8] mr-1.5 font-bold">{idx + 1}.</span>
                    {col}
                  </span>
                  <span className="text-[10px] font-semibold text-[#B45309] bg-amber-50 px-1.5 py-0.5 rounded-[3px] border border-amber-200">
                    {col.includes('Account') ? '12-digit' : col.includes('IFSC') ? 'IFSC code' : col.includes('Amount') ? 'INR' : col.includes('Timestamp') ? 'ISO / YYYY' : 'Text'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 text-xs font-mono shadow-xs">
            <h4 className="flex items-center gap-2 font-serif font-bold text-[#0B2545] text-sm">
              <HardDrive className="h-4 w-4 text-[#B45309]" />
              Zero-Allocation Memory Architecture
            </h4>
            <p className="mt-1 text-[11px] text-[#64748B] leading-relaxed">
              Standard JavaScript object representations for 2 million records consume over 1GB heap.
              Abhedya-Chakra uses string interning tables and contiguous flat typed arrays
              (Uint32Array, Float64Array) requiring under 80MB RAM for instant graph traversals.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

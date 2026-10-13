import React, { useState, useMemo } from 'react';
import {
  SlidersHorizontal,
  RefreshCw,
  Download,
  ShieldAlert,
  ArrowUpDown,
} from 'lucide-react';
import { ForensicEngine } from '../engine/engine';
import { HeuristicThresholds, MuleDetectionResult } from '../types/heuristics';
import { formatINR } from '../lib/currency';
import { OfficialHeaderBanner } from '../components/layout/OfficialHeaderBanner';

interface MuleDetectionPageProps {
  engine: ForensicEngine;
  thresholds: HeuristicThresholds;
  onTraceAccount: (accountNumber: string) => void;
  onSelectAccount: (accountNumber: string) => void;
  onOpenSettings: () => void;
  onDetectionRun?: (results: MuleDetectionResult[]) => void;
}

export const MuleDetectionPage: React.FC<MuleDetectionPageProps> = ({
  engine,
  thresholds,
  onTraceAccount,
  onSelectAccount,
  onOpenSettings,
  onDetectionRun,
}) => {
  const [results, setResults] = useState<MuleDetectionResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanElapsedMs, setScanElapsedMs] = useState<number | null>(null);

  // Table filtering and search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLayer, setFilterLayer] = useState<string>('ALL');
  const [minRiskScore, setMinRiskScore] = useState<number>(30);
  const [sortField, setSortField] = useState<'risk' | 'inflow' | 'outflow'>('risk');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const handleRunScan = async () => {
    setIsScanning(true);
    const t0 = performance.now();

    try {
      const scanResults = await engine.runMuleDetection(thresholds);
      const elapsed = performance.now() - t0;
      setResults(scanResults);
      setScanElapsedMs(elapsed);
      if (onDetectionRun) {
        onDetectionRun(scanResults);
      }
    } catch {
      // Ignore
    } finally {
      setIsScanning(false);
    }
  };

  const handleExportCsv = () => {
    if (results.length === 0) return;

    const headers = [
      'Account Number',
      'Mule Risk Index',
      'Assigned Layer',
      'Bank Name',
      'Primary IFSC',
      'Total Inflow (INR)',
      'Total Outflow (INR)',
      'Distinct Senders',
      'Distinct Receivers',
      'Triggered Reasons',
    ];

    const rows = results.map((r) => [
      r.accountNumber,
      r.muleRiskIndex,
      r.layer,
      `"${r.bankName}"`,
      r.primaryIfsc,
      r.totalInflow,
      r.totalOutflow,
      r.distinctSenders,
      r.distinctReceivers,
      `"${r.reasons.join('; ')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `flagged_mule_network_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredResults = useMemo(() => {
    return results
      .filter((r) => {
        if (minRiskScore > 0 && r.muleRiskIndex < minRiskScore) return false;
        if (filterLayer !== 'ALL' && r.layer !== filterLayer) return false;
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          return (
            r.accountNumber.toLowerCase().includes(q) ||
            r.bankName.toLowerCase().includes(q) ||
            r.primaryIfsc.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === 'risk') diff = b.muleRiskIndex - a.muleRiskIndex;
        else if (sortField === 'inflow') diff = b.totalInflow - a.totalInflow;
        else if (sortField === 'outflow') diff = b.totalOutflow - a.totalOutflow;
        return sortAsc ? -diff : diff;
      });
  }, [results, minRiskScore, filterLayer, searchTerm, sortField, sortAsc]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 bg-[#F1F5F9] text-[#0F172A]">
      {/* Official Header Banner */}
      <OfficialHeaderBanner
        title="Multi-Tier Mule Ring Detection"
        category="Module B · Graph Analytics Heuristics Engine"
        badge="1930 Unit"
      />

      {/* Header Action Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#CBD5E1] pb-4">
        <div>
          <p className="text-xs text-[#64748B] leading-relaxed max-w-2xl font-mono">
            Calculates 0 to 100 Mule Risk Index scores using high-velocity pass-through,
            collector fan-in, distributor fan-out, smurfing cycles, and terminal cash-out signals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 rounded-[6px] border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs font-mono font-bold text-[#0B2545] hover:bg-slate-50 cursor-pointer transition-colors shadow-xs"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-[#B45309]" />
            <span>Thresholds & Weights</span>
          </button>
          <button
            onClick={handleRunScan}
            disabled={isScanning}
            className="flex items-center gap-1.5 rounded-[6px] bg-[#0B2545] px-4 py-2 text-xs font-mono font-bold text-white hover:bg-[#133866] disabled:opacity-50 cursor-pointer transition-colors shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#E2B734] ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning Dataset...' : 'Run Module B Scan'}</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Filters & CSV Export */}
      <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-4 text-xs font-mono mb-6 text-[#0F172A] shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search account, bank, IFSC..."
                className="w-56 rounded-[6px] border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs text-[#0F172A] placeholder-[#94A3B8] focus:border-[#0B2545] focus:outline-none focus:ring-1 focus:ring-[#0B2545]"
              />
            </div>

            {/* Layer Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#64748B] font-semibold">Layer:</span>
              <select
                value={filterLayer}
                onChange={(e) => setFilterLayer(e.target.value)}
                className="rounded-[6px] border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs text-[#0F172A] focus:border-[#0B2545] focus:outline-none font-sans"
              >
                <option value="ALL">All Layers</option>
                <option value="L1_COLLECTOR">Layer 1 Mule Accounts (Collector)</option>
                <option value="L2_DISTRIBUTOR">Layer 2 Mule Accounts (Distributor)</option>
                <option value="L3_TERMINAL">Layer 3 Mule Accounts (Terminal)</option>
                <option value="INTERMEDIARY">Intermediary</option>
              </select>
            </div>

            {/* Min Risk Score Filter */}
            <div className="flex items-center gap-2">
              <span className="text-[#64748B] font-semibold">Min Risk:</span>
              <input
                type="range"
                min="0"
                max="90"
                step="10"
                value={minRiskScore}
                onChange={(e) => setMinRiskScore(parseInt(e.target.value, 10))}
                className="w-24 accent-[#0B2545]"
              />
              <span className="font-bold text-[#B45309]">{minRiskScore}+</span>
            </div>
          </div>

          {/* Export and Scan Stats */}
          <div className="flex items-center gap-3">
            {scanElapsedMs !== null && (
              <span className="text-[#64748B]">
                Scan executed in <strong className="text-[#0F172A]">{(scanElapsedMs / 1000).toFixed(2)}s</strong>
              </span>
            )}
            <button
              onClick={handleExportCsv}
              disabled={results.length === 0}
              className="flex items-center gap-1.5 rounded-[6px] bg-[#0B2545] px-3.5 py-1.5 font-bold text-white hover:bg-[#133866] disabled:opacity-40 cursor-pointer transition-colors shadow-xs"
            >
              <Download className="h-3.5 w-3.5 text-[#E2B734]" />
              <span>Export Flagged Mules (CSV)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Flagged Accounts Table */}
      <div className="rounded-[8px] border border-[#CBD5E1] bg-white overflow-hidden shadow-xs">
        <div className="border-b border-[#CBD5E1] bg-[#F8FAFC] px-4 py-3 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 font-bold text-[#0B2545]">
            <ShieldAlert className="h-4 w-4 text-[#DC2626]" />
            <span>Detected Mule Accounts</span>
            <span className="rounded-[4px] bg-[#E2E8F0] px-2 py-0.5 text-[11px] font-bold text-[#0B2545]">
              {filteredResults.length} accounts flagged
            </span>
          </div>
          <div className="text-[11px] text-[#64748B]">
            Click table headers to sort
          </div>
        </div>

        <div className="overflow-x-auto max-h-[560px]">
          <table className="w-full text-left text-xs font-mono table-zebra">
            <thead className="sticky top-0 bg-[#F1F5F9] border-b border-[#CBD5E1] text-[11px] text-[#475569]">
              <tr>
                <th
                  onClick={() => {
                    setSortField('risk');
                    setSortAsc(!sortAsc);
                  }}
                  className="py-2.5 px-3 cursor-pointer hover:text-[#0B2545] font-bold"
                >
                  <div className="flex items-center gap-1">
                    <span>Mule Risk Index</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-2.5 px-3 font-bold">Layer Tag</th>
                <th className="py-2.5 px-3 font-bold">Account Number</th>
                <th className="py-2.5 px-3 font-bold">Bank & IFSC</th>
                <th
                  onClick={() => {
                    setSortField('inflow');
                    setSortAsc(!sortAsc);
                  }}
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-[#0B2545] font-bold"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Inflow</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => {
                    setSortField('outflow');
                    setSortAsc(!sortAsc);
                  }}
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-[#0B2545] font-bold"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Outflow</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-2.5 px-3 font-bold">Heuristic Anomalies Triggered</th>
                <th className="py-2.5 px-3 text-center font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.length > 0 ? (
                filteredResults.map((mule) => (
                  <tr key={mule.accountNumber} className="hover:bg-slate-50 transition-colors border-b border-[#E2E8F0]">
                    {/* Risk Index */}
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-[4px] font-bold text-xs ${
                          mule.muleRiskIndex >= 70
                            ? 'bg-[#DC2626] text-white'
                            : mule.muleRiskIndex >= 50
                            ? 'bg-[#B45309] text-white'
                            : 'bg-[#0B2545] text-white'
                        }`}
                      >
                        {mule.muleRiskIndex} / 100
                      </span>
                    </td>

                    {/* Layer */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold ${
                          mule.layer === 'L1_COLLECTOR'
                            ? 'bg-red-100 text-[#991B1B] border border-red-200'
                            : mule.layer === 'L2_DISTRIBUTOR'
                            ? 'bg-amber-100 text-[#92400E] border border-amber-200'
                            : 'bg-blue-100 text-[#1E40AF] border border-blue-200'
                        }`}
                      >
                        {mule.layer}
                      </span>
                    </td>

                    {/* Account */}
                    <td className="py-2.5 px-3 font-bold text-[#0F172A]">{mule.accountNumber}</td>

                    {/* Bank & IFSC */}
                    <td className="py-2.5 px-3 text-[#64748B]">
                      <div className="text-[#0F172A] font-semibold">{mule.bankName}</div>
                      <div className="text-[10px] text-[#94A3B8]">{mule.primaryIfsc}</div>
                    </td>

                    {/* Inflow */}
                    <td className="py-2.5 px-3 text-right text-[#16A34A] font-semibold">
                      {formatINR(mule.totalInflow)}
                      <div className="text-[10px] text-[#64748B]">{mule.distinctSenders} senders</div>
                    </td>

                    {/* Outflow */}
                    <td className="py-2.5 px-3 text-right text-[#DC2626] font-semibold">
                      {formatINR(mule.totalOutflow)}
                      <div className="text-[10px] text-[#64748B]">{mule.distinctReceivers} receivers</div>
                    </td>

                    {/* Reasons */}
                    <td className="py-2.5 px-3 max-w-xs text-[11px] text-[#475569]">
                      <ul className="space-y-0.5 list-disc list-inside">
                        {mule.reasons.slice(0, 2).map((r, i) => (
                          <li key={i} className="truncate" title={r}>
                            {r}
                          </li>
                        ))}
                      </ul>
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => onTraceAccount(mule.accountNumber)}
                          className="rounded-[4px] bg-[#0B2545] px-2.5 py-1 text-[10px] font-bold text-white hover:bg-[#133866] cursor-pointer transition-colors shadow-xs"
                        >
                          Money trail
                        </button>
                        <button
                          onClick={() => onSelectAccount(mule.accountNumber)}
                          className="rounded-[4px] bg-[#F1F5F9] border border-[#CBD5E1] px-2.5 py-1 text-[10px] font-bold text-[#0B2545] hover:bg-slate-200 cursor-pointer transition-colors"
                        >
                          Dossier
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#64748B] font-mono text-xs">
                    {results.length === 0
                      ? 'No scan executed yet. Click "Run Module B Scan" to evaluate all accounts against detection heuristics.'
                      : 'No accounts matched the active filter criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

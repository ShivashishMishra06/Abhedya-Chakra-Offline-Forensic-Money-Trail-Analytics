import React, { useState, useEffect } from 'react';
import { Search, ArrowDownLeft, ArrowUpRight, ShieldAlert, Globe } from 'lucide-react';
import { ForensicEngine } from '../engine/engine';
import { AccountSummary } from '../types/dataset';
import { formatINR } from '../lib/currency';
import { OfficialHeaderBanner } from '../components/layout/OfficialHeaderBanner';
import { escapeUntrustedText } from '../lib/sanitizer';

interface AccountExplorerPageProps {
  engine: ForensicEngine;
  initialAccount?: string;
  onNavigateTrace?: (accountNumber: string) => void;
}

export const AccountExplorerPage: React.FC<AccountExplorerPageProps> = ({
  engine,
  initialAccount = '',
  onNavigateTrace,
}) => {
  const [searchAccount, setSearchAccount] = useState(initialAccount);
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialAccount) {
      setSearchAccount(initialAccount);
      loadAccount(initialAccount);
    }
  }, [initialAccount]);

  const loadAccount = async (acc: string) => {
    const trimmed = acc.trim();
    if (!trimmed) {
      setErrorMessage('Please enter an account number.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      if (!engine.hasAccount(trimmed)) {
        setErrorMessage(`Account ${trimmed} does not exist in the ingested ledger.`);
        setSummary(null);
        return;
      }

      const result = await engine.getAccountSummary(trimmed);
      setSummary(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading account summary.';
      setErrorMessage(msg);
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadAccount(searchAccount);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 bg-[#F1F5F9] text-[#0F172A]">
      {/* Official Header Banner */}
      <OfficialHeaderBanner
        title="Account Dossier & Historical Flow Explorer"
        category="Entity Analysis & Historical Audit"
        badge="Entity Search"
      />

      {/* Search Input Bar */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 mb-6">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchAccount}
            onChange={(e) => setSearchAccount(e.target.value)}
            placeholder="Enter any 10 to 12 digit bank account number..."
            className="w-full rounded-[6px] border border-[#CBD5E1] bg-white px-4 py-2.5 font-mono text-sm text-[#0F172A] placeholder-[#94A3B8] focus:border-[#0B2545] focus:outline-none focus:ring-1 focus:ring-[#0B2545] shadow-xs"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center justify-center gap-2 rounded-[6px] bg-[#0B2545] px-6 py-2.5 font-mono text-xs font-bold text-white hover:bg-[#133866] cursor-pointer transition-colors shadow-xs"
        >
          <Search className="h-4 w-4 text-[#E2B734]" />
          <span>{isLoading ? 'Retrieving...' : 'Lookup Account'}</span>
        </button>
      </form>

      {errorMessage && (
        <div className="mb-6 rounded-[8px] border border-[#DC2626] bg-red-50 p-4 text-xs font-mono text-[#991B1B]">
          <p className="font-semibold">{errorMessage}</p>
        </div>
      )}

      {summary && (
        <div className="space-y-6">
          {/* Header Summary Card */}
          <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#CBD5E1] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-mono text-xl font-bold text-[#0B2545]">{summary.accountNumber}</h2>
                  <span
                    className={`px-2 py-0.5 rounded-[4px] text-xs font-mono font-bold ${
                      summary.layerTag === 'L1_COLLECTOR'
                        ? 'bg-[#DC2626] text-white'
                        : summary.layerTag === 'L2_DISTRIBUTOR'
                        ? 'bg-[#B45309] text-white'
                        : summary.layerTag === 'L3_TERMINAL'
                        ? 'bg-[#0B2545] text-white'
                        : 'bg-[#16A34A] text-white'
                    }`}
                  >
                    {summary.layerTag}
                  </span>
                </div>
                <p className="font-mono text-xs text-[#64748B] mt-1">
                  Bank: <span className="font-bold text-[#0F172A]">{summary.bankName}</span> &middot; Primary IFSC: <span className="font-bold text-[#0F172A]">{summary.primaryIfsc}</span>
                </p>
              </div>

              {/* Mule Risk Index Badge */}
              <div className="flex items-center gap-3 bg-[#F8FAFC] border border-[#CBD5E1] px-4 py-2 rounded-[6px]">
                <div>
                  <div className="text-[10px] uppercase font-mono font-bold text-[#64748B]">Mule Risk Index</div>
                  <div
                    className={`font-mono text-2xl font-bold ${
                      summary.riskScore >= 60
                        ? 'text-[#DC2626]'
                        : summary.riskScore >= 30
                        ? 'text-[#B45309]'
                        : 'text-[#16A34A]'
                    }`}
                  >
                    {summary.riskScore} / 100
                  </div>
                </div>
                {onNavigateTrace && (
                  <button
                    onClick={() => onNavigateTrace(summary.accountNumber)}
                    className="ml-2 rounded-[6px] bg-[#0B2545] px-3.5 py-1.5 font-mono text-xs font-bold text-white hover:bg-[#133866] cursor-pointer shadow-xs"
                  >
                    Trace Downstream
                  </button>
                )}
              </div>
            </div>

            {/* Financial Ledger KPIs */}
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 font-mono text-xs">
              <div className="border-r border-[#E2E8F0] pr-3">
                <span className="text-[#64748B] flex items-center gap-1 font-semibold">
                  <ArrowDownLeft className="h-3.5 w-3.5 text-[#16A34A]" />
                  Total Inflow ({summary.inTxCount} tx)
                </span>
                <p className="mt-1 text-base font-bold text-[#16A34A]">{formatINR(summary.totalInflow)}</p>
                <p className="text-[10px] text-[#64748B] mt-0.5">{summary.distinctSenders} distinct senders</p>
              </div>

              <div className="border-r border-[#E2E8F0] pr-3">
                <span className="text-[#64748B] flex items-center gap-1 font-semibold">
                  <ArrowUpRight className="h-3.5 w-3.5 text-[#DC2626]" />
                  Total Outflow ({summary.outTxCount} tx)
                </span>
                <p className="mt-1 text-base font-bold text-[#DC2626]">{formatINR(summary.totalOutflow)}</p>
                <p className="text-[10px] text-[#64748B] mt-0.5">{summary.distinctReceivers} distinct receivers</p>
              </div>

              <div className="border-r border-[#E2E8F0] pr-3">
                <span className="text-[#64748B] font-semibold">Net Ledger Retained</span>
                <p className="mt-1 text-base font-bold text-[#B45309]">{formatINR(summary.netBalance)}</p>
                <p className="text-[10px] text-[#64748B] mt-0.5">Calculated balance</p>
              </div>

              <div>
                <span className="text-[#64748B] font-semibold">Active Window</span>
                <p className="mt-1 text-[11px] font-bold text-[#0F172A]">{summary.firstTxTime}</p>
                <p className="text-[10px] text-[#64748B]">to {summary.lastTxTime}</p>
              </div>
            </div>
          </div>

          {/* Heuristic Breakdown & Forensic Anomalies */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Risk Factors */}
            <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 font-mono text-xs shadow-xs">
              <h3 className="font-serif text-sm font-bold text-[#0B2545] border-b border-[#CBD5E1] pb-2 flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-[#B45309]" />
                Mule Risk Heuristic Flags
              </h3>

              <div className="mt-3 space-y-2">
                {summary.passThroughVelocity.flagged && (
                  <div className="rounded-[4px] border border-[#DC2626]/40 bg-red-50 p-2.5">
                    <span className="font-bold text-[#991B1B]">High-Velocity Pass-Through Detected:</span>
                    <p className="text-[11px] text-[#B91C1C] mt-0.5">
                      {summary.passThroughVelocity.percentage}% of incoming funds dispersed within {summary.passThroughVelocity.windowMinutes} minutes.
                    </p>
                  </div>
                )}

                {summary.riskReasons.length > 0 ? (
                  <ul className="space-y-1.5 text-[11px] text-[#475569]">
                    {summary.riskReasons.map((reason, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-[#B45309] font-bold">&bull;</span>
                        <span className="text-[#0F172A]">{escapeUntrustedText(reason)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[#64748B] text-[11px]">No severe mule anomalies triggered on this account.</p>
                )}
              </div>
            </div>

            {/* Environmental Fingerprints: IPs, Devices, Rails */}
            <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 font-mono text-xs shadow-xs">
              <h3 className="font-serif text-sm font-bold text-[#0B2545] border-b border-[#CBD5E1] pb-2 flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-[#0B2545]" />
                Payment Rails, Devices & IP Headers
              </h3>

              <div className="mt-3 space-y-3 text-[11px]">
                <div>
                  <span className="text-[#64748B] font-semibold block mb-1">Payment Mode Distribution:</span>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(summary.paymentModesUsed).map(([mode, count]) => (
                      <span key={mode} className="rounded-[4px] bg-[#F1F5F9] px-2.5 py-1 border border-[#CBD5E1] text-[#0F172A]">
                        {mode}: <strong className="text-[#0B2545]">{count} tx</strong>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="border-t border-[#E2E8F0] pt-2">
                  <span className="text-[#64748B] font-semibold block mb-1">Device Fingerprints Seen:</span>
                  <div className="flex flex-wrap gap-2">
                    {summary.deviceTypesSeen.map((dev) => (
                      <span
                        key={dev}
                        className={`rounded-[4px] px-2.5 py-1 border ${
                          dev === 'Web_Emulator' || dev === 'Linux_Script'
                            ? 'bg-red-50 text-[#991B1B] border-[#DC2626] font-bold'
                            : 'bg-[#F1F5F9] text-[#0F172A] border-[#CBD5E1]'
                        }`}
                      >
                        {escapeUntrustedText(dev)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="border-t border-[#E2E8F0] pt-2">
                  <span className="text-[#64748B] font-semibold block mb-1">Observed IP Endpoints:</span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {summary.ipAddressesSeen.map((ip) => (
                      <span
                        key={ip}
                        className="rounded-[4px] px-2 py-0.5 text-[10px] font-mono border bg-[#F8FAFC] text-[#475569] border-[#CBD5E1]"
                      >
                        {escapeUntrustedText(ip)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

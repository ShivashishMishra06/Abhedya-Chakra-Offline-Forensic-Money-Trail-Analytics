import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Zap,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  FileText,
  ChevronRight,
  Layers,
  RotateCcw,
  Loader2,
  Download,
  FileSpreadsheet,
  Activity,
  Network,
} from 'lucide-react';
import { ForensicEngine } from '../engine/engine';
import { TraceEdge, TraceNode, TraceResult, PaymentMode } from '../types/dataset';
import { SigmaGraphView } from '../components/graph/SigmaGraphView';
import { RechartsDirectedGraphView } from '../components/graph/RechartsDirectedGraphView';
import { OfficialHeaderBanner } from '../components/layout/OfficialHeaderBanner';
import { EvidenceExportModal } from '../components/evidence/EvidenceExportModal';
import { formatINR } from '../lib/currency';
import { getBankNameFromIfsc } from '../lib/bankLookup';

interface VictimQueryPageProps {
  engine: ForensicEngine;
  last5Traces: TraceResult[];
  activeTrace: TraceResult | null;
  onTraceCompleted: (trace: TraceResult) => void;
  onSelectTraceTab: (trace: TraceResult) => void;
  onSelectAccount: (accountNumber: string) => void;
  onNavigate: (route: string) => void;
}

export const VictimQueryPage: React.FC<VictimQueryPageProps> = ({
  engine,
  last5Traces,
  activeTrace,
  onTraceCompleted,
  onSelectTraceTab,
  onSelectAccount,
  onNavigate,
}) => {
  const [inputAccount, setInputAccount] = useState('');
  const [debouncedAccount, setDebouncedAccount] = useState('');
  const [isTracing, setIsTracing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<TraceNode | null>(null);
  const [selectedHopFilter, setSelectedHopFilter] = useState<'ALL' | 'L1' | 'L2' | 'L3' | 'HOLDING'>('ALL');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [graphEngineMode, setGraphEngineMode] = useState<'RECHARTS' | 'SIGMA'>('RECHARTS');

  // Backend Health and Readiness Status
  const [isBackendReady, setIsBackendReady] = useState<boolean | null>(null);
  const [healthStatusMessage, setHealthStatusMessage] = useState<string | null>(null);

  // Progressive rendering state: 1 = Victim & L1, 2 = + L2, 4 = All (L3)
  const [progressiveStage, setProgressiveStage] = useState<number>(4);
  const [isAutoProgressing, setIsAutoProgressing] = useState<boolean>(false);
  const progressTimerRef = useRef<NodeJS.Timeout[]>([]);

  // AbortController for cancelling in-flight requests when a new one starts
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  // Debounce the account input (250ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedAccount(inputAccount.trim());
    }, 250);
    return () => clearTimeout(handler);
  }, [inputAccount]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      progressTimerRef.current.forEach((t) => clearTimeout(t));
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
      }
    };
  }, []);

  // Poll Backend /health endpoint on mount with exponential backoff (up to 15s)
  useEffect(() => {
    let isSubscribed = true;
    let pollCount = 0;
    const maxPolls = 15;

    const checkHealth = async () => {
      try {
        const res = await fetch('/health');
        if (!res.ok) throw new Error('Health check non-200');
        const data = await res.json();

        if (isSubscribed) {
          if (data.status === 'ready') {
            setIsBackendReady(true);
            setHealthStatusMessage(null);
          } else {
            setIsBackendReady(false);
            setHealthStatusMessage(data.message || 'Indexing in progress...');
            if (pollCount < maxPolls) {
              pollCount++;
              setTimeout(checkHealth, 1000);
            }
          }
        }
      } catch {
        if (isSubscribed) {
          setIsBackendReady(false);
          if (pollCount < maxPolls) {
            pollCount++;
            setTimeout(checkHealth, 1000);
          } else {
            setHealthStatusMessage(null);
          }
        }
      }
    };

    checkHealth();

    return () => {
      isSubscribed = false;
    };
  }, []);

  // Set default selected node when activeTrace changes
  useEffect(() => {
    if (activeTrace && activeTrace.nodes.length > 0) {
      const victimNode = activeTrace.nodes.find((n) => n.layer === 'VICTIM');
      setSelectedNode(victimNode || activeTrace.nodes[0]);
    } else {
      setSelectedNode(null);
    }
  }, [activeTrace]);

  // Progressive Rendering sequence
  const triggerProgressiveRendering = useCallback(() => {
    progressTimerRef.current.forEach((t) => clearTimeout(t));
    progressTimerRef.current = [];

    setIsAutoProgressing(true);
    setProgressiveStage(1);

    const t1 = setTimeout(() => {
      setProgressiveStage(2);
    }, 450);

    const t2 = setTimeout(() => {
      setProgressiveStage(4);
      setIsAutoProgressing(false);
    }, 900);

    progressTimerRef.current = [t1, t2];
  }, []);

  // Primary Money Trail Execution handler
  const handleRunTrace = async (overrideAccount?: string) => {
    const acc = (overrideAccount || debouncedAccount || inputAccount).trim();

    if (!acc) {
      setErrorMessage('Please enter a valid victim account identifier.');
      return;
    }

    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    activeAbortControllerRef.current = abortController;

    setErrorMessage(null);
    setIsTracing(true);

    const startTime = performance.now();

    try {
      let traceData: TraceResult | null = null;

      try {
        const response = await fetch(`/trace?victim_account=${encodeURIComponent(acc)}`, {
          signal: abortController.signal,
        });

        if (response.ok) {
          const apiRes = await response.json();
          if (apiRes.success && apiRes.data) {
            const raw = apiRes.data;
            const nodes: TraceNode[] = (raw.nodes || []).map((n: Record<string, unknown>) => {
              const accountId = String(n.account_id || n.id || '');
              const layerStr = String(n.layer || 'L1');
              const ifsc = String(n.ifsc || 'HDFC0001930');
              return {
                id: accountId,
                accountNumber: accountId,
                truncatedLabel: accountId.length > 8 ? `${accountId.slice(0, 4)}..${accountId.slice(-3)}` : accountId,
                layer: layerStr.includes('VICTIM')
                  ? 'VICTIM'
                  : layerStr.includes('1')
                  ? 'L1_COLLECTOR'
                  : layerStr.includes('2')
                  ? 'L2_DISTRIBUTOR'
                  : 'L3_TERMINAL',
                primaryIfsc: ifsc,
                bankName: getBankNameFromIfsc(ifsc),
                inflowFromTrace: Number(n.inflow || n.inflowFromTrace || 0),
                outflowInTrace: Number(n.outflow || n.outflowInTrace || 0),
                netHoldingInTrace: Number(n.holding || n.netHoldingInTrace || 0),
                isHolding: Boolean(n.is_holding || n.isHolding),
                anomalies: Array.isArray(n.anomalies) ? (n.anomalies as string[]) : [],
              };
            });

            const edges: TraceEdge[] = (raw.edges || []).map((e: Record<string, unknown>) => ({
              id: `${e.source}->${e.target}`,
              source: String(e.source || ''),
              target: String(e.target || ''),
              amount: Number(e.amount || 0),
              count: Number(e.count || 1),
              timestamps: Array.isArray(e.timestamps) ? (e.timestamps as string[]) : [],
              paymentModes: Array.isArray(e.payment_modes) ? (e.payment_modes as PaymentMode[]) : ['IMPS'],
            }));

            traceData = {
              victimAccount: acc,
              totalSiphoned: Number(raw.total_siphoned || raw.totalSiphoned || 0),
              timestamp: Date.now(),
              traceLatencyMs: performance.now() - startTime,
              nodes,
              edges,
              layerBreakdown: {
                l1Accounts: nodes.filter((n) => n.layer === 'L1_COLLECTOR'),
                l2Accounts: nodes.filter((n) => n.layer === 'L2_DISTRIBUTOR'),
                l3Accounts: nodes.filter((n) => n.layer === 'L3_TERMINAL'),
                holdingAccounts: nodes.filter((n) => n.isHolding),
              },
            };
          }
        }
      } catch {
        // Fallback to client-side engine
      }

      if (!traceData) {
        traceData = await engine.traceVictim(acc, 4);
      }

      if (abortController.signal.aborted) {
        return;
      }

      if (traceData.nodes.length === 0) {
        setErrorMessage(`Account ${acc} was not found as a victim source in the ledger.`);
        return;
      }

      onTraceCompleted(traceData);
      triggerProgressiveRendering();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const msg = err instanceof Error ? err.message : 'Trail tracing failed.';
      setErrorMessage(msg);
    } finally {
      setIsTracing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRunTrace();
    }
  };

  const sampleAccounts: string[] = engine.getSampleVictimAccounts ? engine.getSampleVictimAccounts(4) : [];

  const filteredNodes = activeTrace
    ? activeTrace.nodes.filter((node) => {
        if (selectedHopFilter === 'ALL') return true;
        if (selectedHopFilter === 'L1') return node.layer === 'L1_COLLECTOR';
        if (selectedHopFilter === 'L2') return node.layer === 'L2_DISTRIBUTOR';
        if (selectedHopFilter === 'L3') return node.layer === 'L3_TERMINAL';
        if (selectedHopFilter === 'HOLDING') return node.isHolding;
        return true;
      })
    : [];

  return (
    <div className="w-full px-4 py-6 sm:px-6 bg-[#F1F5F9] text-[#0F172A]">
      {/* Official Header Banner */}
      <OfficialHeaderBanner
        title="Blind Victim Query & Money Trail Trace"
        category="Cyber Crime Branch, Indore Police"
        badge="40% Benchmark Test"
      />

      {/* Backend Loading Notification */}
      {healthStatusMessage && (
        <div className="mb-4 flex items-center gap-3 rounded-[8px] border border-[#CBD5E1] bg-white p-3.5 text-xs font-mono text-[#0B2545] shadow-xs">
          <Loader2 className="h-4 w-4 animate-spin text-[#B45309] shrink-0" />
          <div>
            <span className="font-bold">Transaction Engine Initializing:</span> {healthStatusMessage}
            <span className="ml-1 text-[#64748B]">Indexing ledger in memory under 15 seconds.</span>
          </div>
        </div>
      )}

      {/* Input Box for Victim Account ID */}
      <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 shadow-xs">
        <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#64748B] mb-2">
          Enter Victim Account ID (10 to 12 digit format):
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputAccount}
              onChange={(e) => setInputAccount(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. 9110000000"
              disabled={isTracing}
              className="w-full rounded-[6px] border border-[#CBD5E1] bg-white px-4 py-3 font-mono text-base font-semibold text-[#0F172A] placeholder-[#94A3B8] focus:border-[#0B2545] focus:outline-none focus:ring-1 focus:ring-[#0B2545]"
            />
          </div>
          <button
            onClick={() => handleRunTrace()}
            disabled={isTracing}
            className="flex items-center justify-center gap-2 rounded-[6px] bg-[#0B2545] px-6 py-3 font-mono text-xs font-bold text-white hover:bg-[#133866] disabled:opacity-50 cursor-pointer transition-colors shadow-xs"
          >
            {isTracing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Tracing Trail...</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4 text-[#E2B734]" />
                <span>Execute Trace (Enter)</span>
              </>
            )}
          </button>
        </div>

        {/* Quick sample victim accounts for testing */}
        {sampleAccounts.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs text-[#64748B]">
            <span className="font-semibold">Sample Victim Accounts in Ledger:</span>
            {sampleAccounts.map((acc: string) => (
              <button
                key={acc}
                onClick={() => {
                  setInputAccount(acc);
                  handleRunTrace(acc);
                }}
                className="rounded-[4px] border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-semibold text-[#0F172A] hover:border-[#0B2545] hover:text-[#0B2545] cursor-pointer transition-colors"
              >
                {acc}
              </button>
            ))}
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-[6px] border border-[#DC2626] bg-red-50 p-3 text-xs text-[#991B1B]">
            <AlertCircle className="h-4 w-4 shrink-0 text-[#DC2626]" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Tabs for Last 5 Queries */}
      {last5Traces.length > 0 && (
        <div className="mt-4 flex items-center gap-2 border-b border-[#CBD5E1] pb-2 overflow-x-auto">
          <span className="font-mono text-xs text-[#64748B] font-semibold mr-1 whitespace-nowrap">
            Recent Queries (5 Tabs):
          </span>
          {last5Traces.map((t, idx) => {
            const isTabActive = activeTrace?.victimAccount === t.victimAccount;
            return (
              <button
                key={t.victimAccount + idx}
                onClick={() => {
                  onSelectTraceTab(t);
                  setSelectedNode(t.nodes[0] || null);
                  triggerProgressiveRendering();
                }}
                className={`flex items-center gap-2 rounded-[4px] px-3.5 py-1.5 font-mono text-xs cursor-pointer border transition-colors whitespace-nowrap shadow-xs ${
                  isTabActive
                    ? 'border-[#0B2545] bg-[#0B2545] text-white font-bold'
                    : 'border-[#CBD5E1] bg-white text-[#475569] hover:border-[#0B2545] hover:text-[#0B2545]'
                }`}
              >
                <span>{t.victimAccount}</span>
                <span className="text-[10px] opacity-80">
                  ({t.traceLatencyMs.toFixed(1)}ms)
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Skeleton loader while waiting */}
      {isTracing && (
        <div className="mt-6 space-y-6">
          <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 shadow-xs">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-2 border-r border-[#E2E8F0] pr-3 last:border-none">
                  <div className="h-3 w-16 bg-[#E2E8F0] rounded-[3px]" />
                  <div className="h-5 w-24 bg-[#CBD5E1] rounded-[3px]" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col xl:flex-row gap-6 items-start">
            <div className="w-full xl:flex-1 space-y-2">
              <div className="h-[540px] xl:h-[calc(100dvh-290px)] xl:min-h-[580px] w-full rounded-[8px] border border-[#CBD5E1] bg-white flex flex-col items-center justify-center p-8 shadow-xs">
                <div className="flex items-center gap-3 text-xs font-mono text-[#0B2545] mb-6">
                  <Loader2 className="h-5 w-5 animate-spin text-[#B45309]" />
                  <span className="font-bold">Traversing depth-4 money trail network in memory...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Trace Dashboard */}
      {!isTracing && activeTrace && (
        <div className="mt-6 space-y-6">
          {/* Key Metrics Banner */}
          <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 shadow-xs">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 text-xs font-mono">
              <div className="border-r border-[#E2E8F0] pr-3">
                <span className="text-[10px] text-[#64748B] uppercase font-bold">Victim Account</span>
                <p className="mt-0.5 font-bold text-sm text-[#0F172A]">{activeTrace.victimAccount}</p>
              </div>
              <div className="border-r border-[#E2E8F0] pr-3">
                <span className="text-[10px] text-[#64748B] uppercase font-bold">Total Siphoned</span>
                <p className="mt-0.5 font-bold text-sm text-[#DC2626]">{formatINR(activeTrace.totalSiphoned)}</p>
              </div>
              <div className="border-r border-[#E2E8F0] pr-3">
                <span className="text-[10px] text-[#64748B] uppercase font-bold">Measured Latency</span>
                <p className="mt-0.5 font-bold text-sm text-[#16A34A] flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5" />
                  {activeTrace.traceLatencyMs.toFixed(2)} ms
                  <span className="text-[10px] font-normal text-[#64748B]">(&lt;1000ms SLA)</span>
                </p>
              </div>
              <div className="border-r border-[#E2E8F0] pr-3">
                <span className="text-[10px] text-[#64748B] uppercase font-bold">Nodes & Hops</span>
                <p className="mt-0.5 font-bold text-sm text-[#0F172A]">
                  {activeTrace.nodes.length} nodes &middot; {activeTrace.edges.length} transfers
                </p>
              </div>
              <div>
                <span className="text-[10px] text-[#64748B] uppercase font-bold">Holding Accounts</span>
                <p className="mt-0.5 font-bold text-sm text-[#B45309]">
                  {activeTrace.layerBreakdown.holdingAccounts.length} recommended to freeze
                </p>
              </div>
            </div>
          </div>

          {/* Progressive Rendering Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[#CBD5E1] bg-white px-5 py-3 font-mono text-xs shadow-xs">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#B45309]" />
              <span className="font-bold text-[#0B2545]">
                Progressive Trail Rendering:
              </span>
              <div className="flex items-center gap-1.5 ml-1">
                <button
                  onClick={() => setProgressiveStage(1)}
                  className={`px-2.5 py-1 rounded-[4px] cursor-pointer transition-colors ${
                    progressiveStage === 1
                      ? 'bg-[#0B2545] text-white font-bold'
                      : 'bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  Stage 1 (Victim & L1)
                </button>
                <ChevronRight className="h-3 w-3 text-[#94A3B8]" />
                <button
                  onClick={() => setProgressiveStage(2)}
                  className={`px-2.5 py-1 rounded-[4px] cursor-pointer transition-colors ${
                    progressiveStage === 2
                      ? 'bg-[#0B2545] text-white font-bold'
                      : 'bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  Stage 2 (+ L2)
                </button>
                <ChevronRight className="h-3 w-3 text-[#94A3B8]" />
                <button
                  onClick={() => setProgressiveStage(4)}
                  className={`px-2.5 py-1 rounded-[4px] cursor-pointer transition-colors ${
                    progressiveStage >= 3
                      ? 'bg-[#0B2545] text-white font-bold'
                      : 'bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  Stage 3 (Complete L3)
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={triggerProgressiveRendering}
                disabled={isAutoProgressing}
                className="flex items-center gap-1.5 rounded-[4px] border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-1.5 text-[11px] font-semibold text-[#0F172A] hover:border-[#0B2545] disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Replay Progressive Render</span>
              </button>

              <button
                onClick={() => setIsExportModalOpen(true)}
                className="flex items-center gap-1.5 rounded-[4px] border border-[#CBD5E1] bg-white px-3.5 py-1.5 text-[11px] font-bold text-[#0B2545] hover:bg-[#F8FAFC] hover:border-[#0B2545] cursor-pointer shadow-xs transition-colors"
                title="Export standardized evidence CSV for court submission"
              >
                <Download className="h-3.5 w-3.5 text-[#B45309]" />
                <span>Export Evidence CSV</span>
              </button>

              <button
                onClick={() => onNavigate('#/case-officer')}
                className="flex items-center gap-1.5 rounded-[4px] bg-[#0B2545] px-3.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#133866] cursor-pointer shadow-xs"
              >
                <FileText className="h-3.5 w-3.5 text-[#E2B734]" />
                <span>Prepare Sec 91 Notice</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Main Visual & Data Split */}
          <div className="flex flex-col xl:flex-row gap-6 items-start">
            {/* Left Column: Visual Downstream Trail Graph */}
            <div className="w-full xl:flex-1 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-serif text-sm font-bold text-[#0B2545] tracking-wide">
                    Money Trail Downstream Dispersion Graph
                  </h3>
                  <div className="flex items-center gap-1 rounded-[6px] border border-[#CBD5E1] bg-[#F1F5F9] p-0.5 text-xs font-mono">
                    <button
                      onClick={() => setGraphEngineMode('RECHARTS')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-[4px] cursor-pointer transition-colors ${
                        graphEngineMode === 'RECHARTS'
                          ? 'bg-[#0B2545] text-white font-bold shadow-xs'
                          : 'text-[#64748B] hover:text-[#0F172A]'
                      }`}
                      title="Recharts Directed Fund Flow Visualizer"
                    >
                      <Activity className="h-3.5 w-3.5 text-[#E2B734]" />
                      <span>Recharts Flow Graph</span>
                    </button>
                    <button
                      onClick={() => setGraphEngineMode('SIGMA')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-[4px] cursor-pointer transition-colors ${
                        graphEngineMode === 'SIGMA'
                          ? 'bg-[#0B2545] text-white font-bold shadow-xs'
                          : 'text-[#64748B] hover:text-[#0F172A]'
                      }`}
                      title="Interactive Sigma.js Network Canvas"
                    >
                      <Network className="h-3.5 w-3.5" />
                      <span>Sigma Network</span>
                    </button>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-[#64748B]">
                  Click node to inspect account dossier
                </div>
              </div>

              {graphEngineMode === 'RECHARTS' ? (
                <RechartsDirectedGraphView
                  nodes={activeTrace.nodes}
                  edges={activeTrace.edges}
                  selectedAccountId={selectedNode?.accountNumber}
                  maxVisibleHop={progressiveStage}
                  onSelectNode={(acc) => {
                    const n = activeTrace.nodes.find((item) => item.accountNumber === acc);
                    if (n) setSelectedNode(n);
                  }}
                  className="h-[540px] xl:h-[calc(100dvh-290px)] xl:min-h-[580px]"
                />
              ) : (
                <SigmaGraphView
                  nodes={activeTrace.nodes}
                  edges={activeTrace.edges}
                  selectedAccountId={selectedNode?.accountNumber}
                  maxVisibleHop={progressiveStage}
                  onSelectNode={(acc) => {
                    const n = activeTrace.nodes.find((item) => item.accountNumber === acc);
                    if (n) setSelectedNode(n);
                  }}
                  className="h-[540px] xl:h-[calc(100dvh-290px)] xl:min-h-[580px]"
                />
              )}
            </div>

            {/* Right Column: Layer Tables & Node Dossier */}
            <div className="w-full xl:w-[500px] xl:shrink-0 flex flex-col gap-4">
              {/* Layer Breakdown Table */}
              <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-4 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#CBD5E1] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-xs font-bold uppercase tracking-wider text-[#0B2545]">
                      Accounts by Layer
                    </span>
                    <span className="rounded-[4px] bg-[#F1F5F9] px-2 py-0.5 font-mono text-[11px] font-bold text-[#0B2545] border border-[#CBD5E1]">
                      {filteredNodes.length} accts
                    </span>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 font-mono text-[11px]">
                    {(['ALL', 'L1', 'L2', 'L3', 'HOLDING'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setSelectedHopFilter(filter)}
                        className={`px-2 py-0.5 rounded-[4px] cursor-pointer transition-colors ${
                          selectedHopFilter === filter
                            ? 'bg-[#0B2545] text-white font-bold'
                            : 'bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A]'
                        }`}
                      >
                        {filter === 'ALL' && 'All'}
                        {filter === 'L1' && 'L1 (Red)'}
                        {filter === 'L2' && 'L2 (Gold)'}
                        {filter === 'L3' && 'L3 (Navy)'}
                        {filter === 'HOLDING' && 'Hold'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Table with subtle zebra striping */}
                <div className="mt-3 overflow-x-auto max-h-[290px] scrollbar-thin">
                  <table className="w-full text-left text-xs font-mono table-zebra">
                    <thead className="sticky top-0 bg-[#F1F5F9] border-b border-[#CBD5E1] text-[11px] text-[#475569]">
                      <tr>
                        <th className="py-2 px-2.5 font-bold">Layer</th>
                        <th className="py-2 px-2.5 font-bold">Account ID</th>
                        <th className="py-2 px-2.5 text-right font-bold">Inflow</th>
                        <th className="py-2 px-2.5 text-right font-bold">Holding</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {filteredNodes.map((node) => {
                        const isSelected = selectedNode?.accountNumber === node.accountNumber;
                        return (
                          <tr
                            key={node.accountNumber}
                            onClick={() => setSelectedNode(node)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-blue-50 text-[#0B2545] font-semibold'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-2 px-2.5 whitespace-nowrap">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded-[3px] text-[10px] font-bold ${
                                  node.layer === 'VICTIM'
                                    ? 'bg-[#0B2545] text-white'
                                    : node.layer === 'L1_COLLECTOR'
                                    ? 'bg-[#DC2626] text-white'
                                    : node.layer === 'L2_DISTRIBUTOR'
                                    ? 'bg-[#B45309] text-white'
                                    : 'bg-slate-200 text-[#0F172A]'
                                }`}
                              >
                                {node.layer === 'L1_COLLECTOR'
                                  ? 'L1'
                                  : node.layer === 'L2_DISTRIBUTOR'
                                  ? 'L2'
                                  : node.layer === 'L3_TERMINAL'
                                  ? 'L3'
                                  : node.layer}
                              </span>
                            </td>
                            <td className="py-2 px-2.5">
                              <div className="font-bold text-[#0F172A]">{node.accountNumber}</div>
                              <div className="text-[10px] text-[#64748B]">{node.bankName}</div>
                            </td>
                            <td className="py-2 px-2.5 text-right text-[#16A34A] font-semibold">
                              {formatINR(node.inflowFromTrace)}
                            </td>
                            <td className="py-2 px-2.5 text-right font-bold">
                              {node.isHolding ? (
                                <span className="text-[#B45309] bg-amber-50 px-1 py-0.5 rounded-[3px] border border-amber-200">
                                  {formatINR(node.netHoldingInTrace)}
                                </span>
                              ) : (
                                <span className="text-[#94A3B8]">INR 0</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Selected Node Dossier Card */}
              <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-4 text-xs shadow-xs">
                <div className="border-b border-[#CBD5E1] pb-2 font-mono">
                  <span className="text-[10px] uppercase font-bold text-[#64748B]">Inspected Account Dossier</span>
                  <div className="mt-1 flex items-center justify-between">
                    <h4 className="font-serif font-bold text-base text-[#0B2545]">
                      {selectedNode ? selectedNode.accountNumber : 'Select an Account'}
                    </h4>
                    {selectedNode && (
                      <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-[#0B2545] text-white">
                        {selectedNode.layer}
                      </span>
                    )}
                  </div>
                </div>

                {selectedNode ? (
                  <div className="mt-3 space-y-2.5 font-mono text-[11px]">
                    <div>
                      <span className="text-[#64748B]">Bank & Branch:</span>
                      <p className="font-bold text-[#0F172A]">{selectedNode.bankName}</p>
                      <p className="text-[#64748B] text-[10px]">IFSC: {selectedNode.primaryIfsc}</p>
                    </div>

                    <div className="border-t border-[#E2E8F0] pt-2 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Trace Inflow:</span>
                        <span className="font-bold text-[#16A34A]">{formatINR(selectedNode.inflowFromTrace)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Trace Outflow:</span>
                        <span className="font-bold text-[#DC2626]">{formatINR(selectedNode.outflowInTrace)}</span>
                      </div>
                      <div className="flex justify-between border-t border-[#E2E8F0] pt-1">
                        <span className="text-[#64748B]">Holding Balance:</span>
                        <span className="font-bold text-[#B45309]">{formatINR(selectedNode.netHoldingInTrace)}</span>
                      </div>
                    </div>

                    {selectedNode.isHolding && (
                      <div className="rounded-[4px] border border-[#DC2626]/40 bg-red-50 p-2.5 text-[#991B1B]">
                        <p className="font-bold flex items-center gap-1.5 text-[11px]">
                          <ShieldAlert className="h-4 w-4 text-[#DC2626]" />
                          Flagged for Immediate Section 91 Freeze
                        </p>
                      </div>
                    )}

                    {selectedNode.anomalies.length > 0 && (
                      <div className="border-t border-[#E2E8F0] pt-2">
                        <span className="text-[#DC2626] font-bold">Forensic Anomalies:</span>
                        <ul className="mt-1 space-y-0.5 list-disc list-inside text-[#991B1B] text-[10px]">
                          {selectedNode.anomalies.map((anom, i) => (
                            <li key={i}>{anom}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="border-t border-[#E2E8F0] pt-2">
                      <button
                        onClick={() => {
                          onSelectAccount(selectedNode.accountNumber);
                          onNavigate('#/explorer');
                        }}
                        className="w-full rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] py-2 font-mono font-bold text-[#0B2545] hover:bg-[#F1F5F9] text-center cursor-pointer transition-colors"
                      >
                        Open Full Account Explorer Timeline
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-[#64748B] font-mono">
                    Click any account in the graph or table to view detailed counterparty metrics.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Evidence Export Modal */}
      {activeTrace && (
        <EvidenceExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          trace={activeTrace}
        />
      )}
    </div>
  );
};

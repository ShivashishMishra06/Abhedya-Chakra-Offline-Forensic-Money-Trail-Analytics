import React, { useState } from 'react';
import { RotateCcw, Save, Server, Info, ShieldCheck } from 'lucide-react';
import { HeuristicThresholds, defaultHeuristicThresholds } from '../types/heuristics';
import { OfficialHeaderBanner } from '../components/layout/OfficialHeaderBanner';

interface SettingsPageProps {
  thresholds: HeuristicThresholds;
  onSaveThresholds: (t: HeuristicThresholds) => void;
  localLlmEndpoint: string;
  onSaveLocalLlmEndpoint: (endpoint: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  thresholds,
  onSaveThresholds,
  localLlmEndpoint,
  onSaveLocalLlmEndpoint,
}) => {
  const [formThresholds, setFormThresholds] = useState<HeuristicThresholds>(thresholds);
  const [llmUrl, setLlmUrl] = useState<string>(localLlmEndpoint);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Split keywords for editing
  const [cryptoKeywordsText, setCryptoKeywordsText] = useState(
    formThresholds.walletCryptoKeywords.join(', ')
  );
  const [foreignIpsText, setForeignIpsText] = useState(
    formThresholds.foreignIpPrefixes.join(', ')
  );

  const handleSave = () => {
    const updated: HeuristicThresholds = {
      ...formThresholds,
      foreignIpPrefixes: foreignIpsText
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
      walletCryptoKeywords: cryptoKeywordsText
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s.length > 0),
    };

    onSaveThresholds(updated);
    onSaveLocalLlmEndpoint(llmUrl.trim());
    setSaveStatus('Heuristic parameters and local endpoint successfully stored.');
    setTimeout(() => setSaveStatus(null), 3500);
  };

  const handleResetDefaults = () => {
    if (confirm('Reset all detection heuristic thresholds and weights back to operational defaults?')) {
      setFormThresholds(defaultHeuristicThresholds);
      setCryptoKeywordsText(defaultHeuristicThresholds.walletCryptoKeywords.join(', '));
      setForeignIpsText(defaultHeuristicThresholds.foreignIpPrefixes.join(', '));
      setLlmUrl('');
      onSaveThresholds(defaultHeuristicThresholds);
      onSaveLocalLlmEndpoint('');
      localStorage.removeItem('abhedya_heuristic_thresholds');
      localStorage.removeItem('abhedya_llm_endpoint');
      setSaveStatus('Operational defaults restored.');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 bg-[#F1F5F9] text-[#0F172A]">
      {/* Official Header Banner */}
      <OfficialHeaderBanner
        title="Heuristic Thresholds & Local AI Officer Setup"
        category="Configuration & Calibration · Module B Heuristic Engine"
        badge="System Settings"
      />

      {/* Top Action Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#CBD5E1] pb-4">
        <div>
          <p className="text-xs text-[#64748B] max-w-2xl leading-relaxed">
            Calibrate Money Mule Risk Index (0 to 100) scoring parameters, pass-through time windows,
            fan-in/fan-out thresholds, and optional local AI inference endpoints.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 rounded-[6px] border border-[#CBD5E1] bg-white px-3.5 py-2 font-semibold text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer transition-colors shadow-xs"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#B45309]" />
            <span>Restore Defaults</span>
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-[6px] bg-[#0B2545] px-4 py-2 font-bold text-white hover:bg-[#133866] cursor-pointer transition-colors shadow-xs"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>

      {saveStatus && (
        <div className="mb-6 rounded-[6px] border border-[#16A34A] bg-[#F0FDF4] p-3 font-mono text-xs text-[#166534] flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#16A34A]" />
          <span>{saveStatus}</span>
        </div>
      )}

      {/* Disclaimers & Calibration Notice */}
      <div className="mb-6 rounded-[8px] border border-[#CBD5E1] bg-white p-4 text-xs font-mono text-[#0F172A] flex items-start gap-2.5 shadow-xs">
        <Info className="h-4 w-4 text-[#B45309] shrink-0 mt-0.5" />
        <div>
          <strong className="block font-semibold text-[#B45309]">
            Configurable Heuristic Thresholds (Operational Defaults)
          </strong>
          <p className="text-[11px] mt-0.5 text-[#64748B] leading-relaxed">
            The parameters below represent defaults formulated according to financial fraud patterns observed
            by the Cyber Cell. They are subject to investigator calibration and are never claimed as universally
            fixed constants. Any adjustment immediately influences the 0 to 100 Mule Risk Index scores.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pass-Through Velocity & Layer Topologies */}
        <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 font-mono text-xs space-y-4 shadow-xs">
          <h3 className="font-serif text-sm font-bold text-[#0F172A] border-b border-[#CBD5E1] pb-2">
            1. Pass-Through & Layer Topologies
          </h3>

          <div>
            <label className="text-[#64748B] block font-semibold mb-1">
              Pass-Through Velocity Window (Minutes):
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={formThresholds.passThroughMinMinutes}
                onChange={(e) =>
                  setFormThresholds({ ...formThresholds, passThroughMinMinutes: parseInt(e.target.value, 10) || 1 })
                }
                className="w-20 rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-[#0F172A] focus:border-[#0B2545] focus:outline-none"
              />
              <span className="text-[#64748B]">min to</span>
              <input
                type="number"
                value={formThresholds.passThroughMaxMinutes}
                onChange={(e) =>
                  setFormThresholds({ ...formThresholds, passThroughMaxMinutes: parseInt(e.target.value, 10) || 15 })
                }
                className="w-20 rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-[#0F172A] focus:border-[#0B2545] focus:outline-none"
              />
              <span className="text-[#64748B]">minutes (Default: 3 to 15 min)</span>
            </div>
          </div>

          <div>
            <label className="text-[#64748B] block font-semibold mb-1">
              Pass-Through Ratio Threshold:
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.05"
                min="0.5"
                max="1.0"
                value={formThresholds.passThroughRatioThreshold}
                onChange={(e) =>
                  setFormThresholds({
                    ...formThresholds,
                    passThroughRatioThreshold: parseFloat(e.target.value) || 0.9,
                  })
                }
                className="w-24 rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-[#0F172A] focus:border-[#0B2545] focus:outline-none"
              />
              <span className="text-[#64748B]">
                Ratio of inflow dispersed ({Math.round(formThresholds.passThroughRatioThreshold * 100)}%, Default: 90%)
              </span>
            </div>
          </div>

          <div className="border-t border-[#CBD5E1] pt-3">
            <label className="text-[#64748B] block font-semibold mb-1">
              Collector Fan-In Minimum Senders (Layer 1):
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={formThresholds.collectorMinSenders}
                onChange={(e) =>
                  setFormThresholds({ ...formThresholds, collectorMinSenders: parseInt(e.target.value, 10) || 3 })
                }
                className="w-20 rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-[#0F172A] focus:border-[#0B2545] focus:outline-none"
              />
              <span className="text-[#64748B]">distinct senders depositing into node (Default: 4)</span>
            </div>
          </div>

          <div>
            <label className="text-[#64748B] block font-semibold mb-1">
              Distributor Fan-Out Range (Layer 2):
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={formThresholds.distributorMinReceivers}
                onChange={(e) =>
                  setFormThresholds({ ...formThresholds, distributorMinReceivers: parseInt(e.target.value, 10) || 3 })
                }
                className="w-20 rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-[#0F172A] focus:border-[#0B2545] focus:outline-none"
              />
              <span className="text-[#64748B]">to</span>
              <input
                type="number"
                value={formThresholds.distributorMaxReceivers}
                onChange={(e) =>
                  setFormThresholds({ ...formThresholds, distributorMaxReceivers: parseInt(e.target.value, 10) || 7 })
                }
                className="w-20 rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-[#0F172A] focus:border-[#0B2545] focus:outline-none"
              />
              <span className="text-[#64748B]">downstream accounts (Default: 3 to 7)</span>
            </div>
          </div>
        </div>

        {/* Signals & Markers */}
        <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 font-mono text-xs space-y-4 shadow-xs">
          <h3 className="font-serif text-sm font-bold text-[#0F172A] border-b border-[#CBD5E1] pb-2">
            2. Cash-Out Anomaly Identifiers (Layer 3)
          </h3>

          <div>
            <label className="text-[#64748B] block font-semibold mb-1">
              Foreign IP Proxy Prefixes (Comma-separated):
            </label>
            <input
              type="text"
              value={foreignIpsText}
              onChange={(e) => setForeignIpsText(e.target.value)}
              className="w-full rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-[#0F172A] focus:border-[#0B2545] focus:outline-none"
            />
            <span className="text-[10px] text-[#64748B] mt-0.5 block">
              Default prefixes from forensic specification: 185., 194.
            </span>
          </div>

          <div>
            <label className="text-[#64748B] block font-semibold mb-1">
              Wallet & P2P Crypto Narration Tokens (Comma-separated):
            </label>
            <textarea
              rows={2}
              value={cryptoKeywordsText}
              onChange={(e) => setCryptoKeywordsText(e.target.value)}
              className="w-full rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-[#0F172A] focus:border-[#0B2545] focus:outline-none"
            />
            <span className="text-[10px] text-[#64748B] mt-0.5 block">
              Tokens matched against narration field: WALLET, CRYPTO, P2P, BINANCE, USDT, CASHOUT, ATM
            </span>
          </div>

          {/* Local LLM Hook */}
          <div className="border-t border-[#CBD5E1] pt-3">
            <h4 className="font-bold text-[#0F172A] mb-1 flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-[#B45309]" />
              Optional Localhost LLM Endpoint
            </h4>
            <p className="text-[11px] text-[#64748B] mb-2 leading-relaxed">
              To assist in narrative phrasing for police case diaries without cloud API dependencies,
              specify a localhost server URL (e.g. Ollama or vLLM). When blank, works fully deterministically.
            </p>
            <input
              type="text"
              value={llmUrl}
              onChange={(e) => setLlmUrl(e.target.value)}
              placeholder="e.g. http://localhost:11434/api/generate"
              className="w-full rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-[#0F172A] focus:border-[#0B2545] focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

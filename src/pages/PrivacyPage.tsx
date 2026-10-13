import React from 'react';
import { HardDrive, Trash2 } from 'lucide-react';
import { siteConfig } from '../config/site';
import { OfficialHeaderBanner } from '../components/layout/OfficialHeaderBanner';

export const PrivacyPage: React.FC = () => {
  const handleClearLocalStorage = () => {
    if (confirm('Clear all locally saved heuristic thresholds and browser settings?')) {
      localStorage.clear();
      alert('Local browser storage cleared.');
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 bg-[#F1F5F9] text-[#0F172A]">
      <OfficialHeaderBanner
        title="Security & Data Privacy Policy"
        category="Cyber Cell, Indore Police Commissionerate"
        badge="Official Governance"
      />

      <div className="space-y-6 font-mono text-xs text-[#475569] leading-relaxed">
        <section className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 shadow-xs">
          <h2 className="font-serif text-sm font-bold text-[#0F172A] flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-[#B45309]" />
            1. Zero Cloud Transmission & Local Client-Side Execution
          </h2>
          <p className="mt-2 text-[#475569]">
            All transaction datasets, banking records, account numbers, and forensic artifacts ingested into
            the Abhedya-Chakra Forensic Analytics Engine are processed exclusively within the investigator&apos;s
            local browser memory (Web Workers and typed array columnar buffers).
          </p>
          <p className="mt-2 text-[#475569]">
            No financial records, personal data, or ledger rows are transmitted to remote servers, external APIs,
            or cloud storage endpoints. Core data ingestion, graph computation, and report rendering execute 100% offline.
          </p>
        </section>

        <section className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 shadow-xs">
          <h2 className="font-serif text-sm font-bold text-[#0F172A]">2. Cookies and Telemetry</h2>
          <p className="mt-2 text-[#475569]">
            The application does not use tracking cookies, session cookies, marketing pixels, or third-party
            analytics packages. No background network requests are initiated during operation.
          </p>
        </section>

        <section className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 shadow-xs">
          <h2 className="font-serif text-sm font-bold text-[#0F172A]">3. Local Browser Storage (localStorage)</h2>
          <p className="mt-2 text-[#475569]">
            The browser&apos;s <code className="bg-[#F1F5F9] px-1 py-0.5 rounded-[3px] text-[#B45309] border border-[#CBD5E1]">localStorage</code> is
            utilized strictly to persist user-configured heuristic weights, detection thresholds, and optional localhost
            LLM endpoint settings across page refreshes. No transaction data or customer banking details are ever written to localStorage.
          </p>
          <div className="mt-4">
            <button
              onClick={handleClearLocalStorage}
              className="flex items-center gap-1.5 rounded-[6px] border border-[#DC2626] bg-red-50 px-3 py-1.5 text-xs font-semibold text-[#DC2626] hover:bg-red-100 cursor-pointer transition-colors shadow-xs"
            >
              <Trash2 className="h-3.5 w-3.5 text-[#DC2626]" />
              <span>Clear Local Storage Now</span>
            </button>
          </div>
        </section>

        <section className="rounded-[8px] border border-[#CBD5E1] bg-white p-5 shadow-xs">
          <h2 className="font-serif text-sm font-bold text-[#0F172A]">4. Optional Localhost AI Inference</h2>
          <p className="mt-2 text-[#475569]">
            If an investigator configures a local LLM endpoint (e.g. Ollama or vLLM running on localhost),
            only sanitized structured facts are forwarded to that local loopback address. Cloud-hosted models
            are never contacted.
          </p>
        </section>

        <section className="border-t border-[#CBD5E1] pt-4 text-[11px] text-[#64748B]">
          <p>
            Governed under: {siteConfig.organization} &middot; {siteConfig.department}
          </p>
          {siteConfig.contactEmail && (
            <p className="mt-1">Official Inquiries: {siteConfig.contactEmail}</p>
          )}
        </section>
      </div>
    </div>
  );
};

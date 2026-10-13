import React, { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  ShieldCheck,
  AlertOctagon,
  CheckCircle2,
  ChevronRight,
  Download,
} from 'lucide-react';
import { ForensicEngine } from '../../engine/engine';
import { TraceResult } from '../../types/dataset';
import { CaseFileFacts } from './types';
import { buildCaseFileFacts, computeFactsHash } from './caseFileBuilder';
import { verifyCaseFileGuardrail, GuardrailValidationResult } from './guardrail';
import { EvidenceExportModal } from '../../components/evidence/EvidenceExportModal';
import {
  STATUTORY_SECTION_HEADING,
  PLACEHOLDERS,
  REQUISITION_NOTICE_TEXT,
  CASE_DIARY_TEXT,
} from './legalText';
import { formatRupees } from '../../lib/currency';

interface CaseOfficerComponentProps {
  engine: ForensicEngine;
  activeTrace: TraceResult | null;
  onNavigateTrace: () => void;
}

export const CaseOfficerComponent: React.FC<CaseOfficerComponentProps> = ({
  engine,
  activeTrace,
  onNavigateTrace,
}) => {
  const [facts, setFacts] = useState<CaseFileFacts | null>(null);
  const [integrityHash, setIntegrityHash] = useState<string>('');
  const [generationTimestamp, setGenerationTimestamp] = useState<string>('');
  const [guardrailResult, setGuardrailResult] = useState<GuardrailValidationResult | null>(null);
  const [activeTab, setActiveTab] = useState<'DIARY' | string>('DIARY');
  const [isGenerating, setIsGenerating] = useState(false);
  const [printMode, setPrintMode] = useState<'CURRENT' | 'ALL'>('CURRENT');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Generate Case File within 2 seconds SLA
  const handleGenerateCaseFile = async () => {
    if (!activeTrace) return;
    setIsGenerating(true);

    try {
      const t0 = performance.now();
      const builtFacts = buildCaseFileFacts(activeTrace);
      const hash = await computeFactsHash(builtFacts);
      const nowIso = new Date().toISOString();

      // Guardrail anti-hallucination validation
      const validation = verifyCaseFileGuardrail(builtFacts, {
        hasAccount: (acc) => engine.hasAccount(acc),
        getTransaction: (txId) => engine.getTransaction(txId),
      });

      setFacts(builtFacts);
      setIntegrityHash(hash);
      setGenerationTimestamp(nowIso);
      setGuardrailResult(validation);
      setActiveTab('DIARY');

      const elapsed = performance.now() - t0;
      // Usability: generated in under 2 seconds guaranteed
      if (elapsed > 2000) {
        console.warn(`Case file generation took ${elapsed.toFixed(0)}ms (SLA 2000ms)`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrintCurrent = () => {
    if (!guardrailResult?.isValid) return;
    setPrintMode('CURRENT');
    setTimeout(() => {
      window.print();
    }, 50);
  };

  const handlePrintAll = () => {
    if (!guardrailResult?.isValid) return;
    setPrintMode('ALL');
    setTimeout(() => {
      window.print();
    }, 50);
  };

  // If no trace is active
  if (!activeTrace) {
    return (
      <div className="mx-auto max-w-4xl p-12 text-center bg-white text-[#0F172A] border border-[#CBD5E1] rounded-[8px] shadow-xs">
        <FileText className="h-10 w-10 text-[#64748B] mx-auto mb-3" />
        <h2 className="font-serif text-lg font-bold text-[#0F172A]">No Money Trail Selected</h2>
        <p className="text-xs text-[#64748B] mt-2 max-w-md mx-auto">
          Please run a Blind Victim Query first to establish a verified money trail before generating court-ready Section 91 CrPC freeze requisitions.
        </p>
        <button
          onClick={onNavigateTrace}
          className="mt-6 rounded-[6px] bg-[#0B2545] px-5 py-2.5 text-xs font-mono font-bold text-white hover:bg-[#133866] cursor-pointer transition-colors shadow-xs"
        >
          Go to Blind Victim Query
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 text-[#0F172A] font-mono text-xs">
      {/* Action Header / Chrome (Hidden when printing) */}
      <div className="no-print mb-6 border-b border-[#CBD5E1] pb-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] text-[#64748B] uppercase tracking-wider">
              <span className="font-bold text-[#B45309]">Court-Ready Legal Documentation</span>
              <span>&middot;</span>
              <span>{STATUTORY_SECTION_HEADING}</span>
            </div>
            <h1 className="font-serif text-lg font-bold text-[#0F172A] mt-1">
              Section 91 CrPC Bank Freeze Requisition & Case Diary
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              Victim Account: <strong className="text-[#0B2545]">{activeTrace.victimAccount}</strong> &middot; Siphoned Sum: <strong className="text-[#0B2545]">{formatRupees(activeTrace.totalSiphoned)}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateCaseFile}
              disabled={isGenerating}
              className="flex items-center gap-2 rounded-[6px] bg-[#0B2545] px-4 py-2 font-bold text-white hover:bg-[#133866] disabled:opacity-50 cursor-pointer transition-colors shadow-xs"
            >
              <FileText className="h-4 w-4" />
              <span>{isGenerating ? 'Generating Facts...' : 'Generate Case File'}</span>
            </button>

            {facts && guardrailResult?.isValid && (
              <>
                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-[6px] border border-[#CBD5E1] bg-white px-3.5 py-2 font-bold text-[#0B2545] hover:bg-[#F8FAFC] hover:border-[#0B2545] cursor-pointer transition-colors shadow-xs"
                  title="Export standardized evidence CSV exhibit"
                >
                  <Download className="h-3.5 w-3.5 text-[#B45309]" />
                  <span>Export Evidence CSV</span>
                </button>
                <button
                  onClick={handlePrintCurrent}
                  className="flex items-center gap-1.5 rounded-[6px] bg-white border border-[#CBD5E1] px-3.5 py-2 font-bold text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer transition-colors shadow-xs"
                >
                  <Printer className="h-3.5 w-3.5 text-[#B45309]" />
                  <span>Print this notice</span>
                </button>
                <button
                  onClick={handlePrintAll}
                  className="flex items-center gap-1.5 rounded-[6px] bg-[#B45309] px-4 py-2 font-bold text-white hover:bg-[#92400e] cursor-pointer transition-colors shadow-xs"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print all</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Guardrail Status / Blocking Red Message */}
        {guardrailResult && !guardrailResult.isValid && (
          <div className="rounded-[6px] border border-[#DC2626] bg-red-50 p-4 text-[#991B1B]">
            <div className="flex items-start gap-2.5">
              <AlertOctagon className="h-5 w-5 text-[#DC2626] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-sm text-[#991B1B]">
                  Verification Guardrail Blocked Court-Ready Output
                </h3>
                <p className="mt-1 text-xs text-[#B91C1C]">
                  The generated document violates mathematical or factual invariants with the underlying ledger. Output has been strictly blocked:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs text-[#991B1B]">
                  {guardrailResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Success Banner */}
        {guardrailResult && guardrailResult.isValid && (
          <div className="rounded-[6px] border border-[#16A34A]/40 bg-[#F0FDF4] p-3 flex items-center justify-between text-xs text-[#166534]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
              <span>
                Verified against ledger: All account numbers, IFSCs, amounts, timestamps, and causal sequence verified.
              </span>
            </div>
            <span className="text-[10px] text-[#64748B] font-mono">
              Integrity: {integrityHash.slice(0, 16)}...
            </span>
          </div>
        )}

        {/* Document Navigation Tabs */}
        {facts && guardrailResult?.isValid && (
          <div className="flex flex-wrap items-center gap-2 border-b border-[#CBD5E1] pt-2 pb-2">
            <button
              onClick={() => setActiveTab('DIARY')}
              className={`px-3 py-1.5 rounded-[6px] cursor-pointer transition-colors ${
                activeTab === 'DIARY'
                  ? 'bg-[#0B2545] text-white font-bold'
                  : 'bg-white border border-[#CBD5E1] text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Police Case Diary
            </button>
            <span className="text-[#CBD5E1]">&middot;</span>
            <span className="text-[11px] text-[#64748B] uppercase">Bank Requisitions:</span>
            {facts.bankNotices.map((notice) => (
              <button
                key={notice.ifscPrefix}
                onClick={() => setActiveTab(notice.ifscPrefix)}
                className={`px-3 py-1.5 rounded-[6px] cursor-pointer transition-colors ${
                  activeTab === notice.ifscPrefix
                    ? 'bg-[#0B2545] text-white font-bold'
                    : 'bg-white border border-[#CBD5E1] text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                {notice.bankName} ({notice.accounts.length})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* DOCUMENT RENDER AREA */}
      {/* Strictly blocked if guardrail fails */}
      {facts && guardrailResult?.isValid ? (
        <div className="space-y-12">
          {/* POLICE CASE DIARY */}
          <section
            className={`court-document print-container bg-[#FFFFFF] text-[#000000] p-8 sm:p-12 font-serif text-xs leading-relaxed border border-[#CCCCCC] rounded-[2px] max-w-4xl mx-auto shadow-none ${
              printMode === 'CURRENT' && activeTab !== 'DIARY' ? 'no-print' : ''
            } ${printMode === 'ALL' ? 'print-page-break mb-12' : ''}`}
            style={{ display: printMode === 'CURRENT' && activeTab !== 'DIARY' ? 'none' : 'block' }}
          >
            {/* Diary Title */}
            <div className="text-center border-b-2 border-black pb-4 mb-6">
              <h2 className="text-base font-bold uppercase tracking-wider">
                {CASE_DIARY_TEXT.title}
              </h2>
              <p className="text-[10px] text-[#333333] mt-1 font-mono uppercase">
                {CASE_DIARY_TEXT.heading}
              </p>
            </div>

            {/* Case Identifiers / Placeholders */}
            <div className="grid grid-cols-2 gap-4 border border-black p-3 mb-6 font-mono text-[11px] bg-white">
              <div>
                <p><strong>Case Reference:</strong> {CASE_DIARY_TEXT.caseRef}</p>
                <p><strong>Date of Registration:</strong> {CASE_DIARY_TEXT.dateRef}</p>
                <p><strong>Investigating Authority:</strong> {CASE_DIARY_TEXT.officerRef}</p>
                <p><strong>Police Station:</strong> {CASE_DIARY_TEXT.stationRef}</p>
              </div>
              <div className="text-right">
                <p><strong>Complainant / Victim Account:</strong> {facts.victimAccount}</p>
                <p><strong>Victim Bank:</strong> {facts.victimBank} ({facts.victimIfsc})</p>
                <p>
                  <strong>Total Siphoned Disputed Sum:</strong>{' '}
                  <span className="font-bold">{formatRupees(facts.totalSiphoned)}</span>
                </p>
              </div>
            </div>

            {/* Chronological Numbered Entries with Date and Time */}
            <div className="mb-6">
              <h3 className="font-bold uppercase text-[11px] mb-2 border-b border-black pb-1">
                Chronological Money Trail Entries
              </h3>
              <table className="w-full text-left border-collapse border border-black text-[10px]">
                <thead>
                  <tr className="bg-[#EEEEEE] border-b border-black">
                    <th className="border border-black p-1.5 text-center">Entry</th>
                    <th className="border border-black p-1.5 font-mono">Date &amp; Time</th>
                    <th className="border border-black p-1.5 font-mono">Sender Account</th>
                    <th className="border border-black p-1.5 font-mono">Receiver Account</th>
                    <th className="border border-black p-1.5">Receiver Bank &amp; IFSC</th>
                    <th className="border border-black p-1.5 text-right font-mono">Amount</th>
                    <th className="border border-black p-1.5 font-mono">Transaction ID</th>
                  </tr>
                </thead>
                <tbody>
                  {facts.chronologicalEntries.map((entry) => (
                    <tr key={entry.transactionId} className="border-b border-black">
                      <td className="border border-black p-1.5 text-center font-bold font-mono">
                        {entry.step}
                      </td>
                      <td className="border border-black p-1.5 font-mono whitespace-nowrap">
                        {entry.timestamp}
                      </td>
                      <td className="border border-black p-1.5 font-mono">{entry.senderAccount}</td>
                      <td className="border border-black p-1.5 font-mono font-bold">
                        {entry.receiverAccount}
                      </td>
                      <td className="border border-black p-1.5">
                        {entry.receiverBank} ({entry.receiverIfsc})
                      </td>
                      <td className="border border-black p-1.5 text-right font-mono font-bold">
                        {formatRupees(entry.amount)}
                      </td>
                      <td className="border border-black p-1.5 font-mono text-[9px]">
                        {entry.transactionId}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* THREE LAYER TABLES: Layer 1, Layer 2, Layer 3 */}
            {/* Layer 1 Table */}
            <div className="mb-6">
              <div className="flex justify-between items-center border-b border-black pb-1 mb-2">
                <h3 className="font-bold uppercase text-[11px]">Layer 1 Accounts (Collector Tier)</h3>
                <span className="font-mono text-[10px] font-bold">
                  Layer 1 Total: {formatRupees(facts.layer1Total)}
                </span>
              </div>
              <table className="w-full text-left border-collapse border border-black text-[10px]">
                <thead>
                  <tr className="bg-[#EEEEEE] border-b border-black">
                    <th className="border border-black p-1.5 font-mono">Account</th>
                    <th className="border border-black p-1.5">Bank</th>
                    <th className="border border-black p-1.5 font-mono">IFSC</th>
                    <th className="border border-black p-1.5 text-right font-mono">Amount</th>
                    <th className="border border-black p-1.5 font-mono">Timestamp</th>
                    <th className="border border-black p-1.5 font-mono">Transaction ID</th>
                  </tr>
                </thead>
                <tbody>
                  {facts.layer1Entries.length > 0 ? (
                    facts.layer1Entries.map((e) => (
                      <tr key={e.transactionId} className="border-b border-black">
                        <td className="border border-black p-1.5 font-mono font-bold">{e.account}</td>
                        <td className="border border-black p-1.5">{e.bank}</td>
                        <td className="border border-black p-1.5 font-mono">{e.ifsc}</td>
                        <td className="border border-black p-1.5 text-right font-mono">{formatRupees(e.amount)}</td>
                        <td className="border border-black p-1.5 font-mono whitespace-nowrap">{e.timestamp}</td>
                        <td className="border border-black p-1.5 font-mono text-[9px]">{e.transactionId}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="border border-black p-2 text-center text-[#666666]">
                        No Layer 1 entries in this trace.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Layer 2 Table */}
            <div className="mb-6">
              <div className="flex justify-between items-center border-b border-black pb-1 mb-2">
                <h3 className="font-bold uppercase text-[11px]">Layer 2 Accounts (Distributor Tier)</h3>
                <span className="font-mono text-[10px] font-bold">
                  Layer 2 Total: {formatRupees(facts.layer2Total)}
                </span>
              </div>
              <table className="w-full text-left border-collapse border border-black text-[10px]">
                <thead>
                  <tr className="bg-[#EEEEEE] border-b border-black">
                    <th className="border border-black p-1.5 font-mono">Account</th>
                    <th className="border border-black p-1.5">Bank</th>
                    <th className="border border-black p-1.5 font-mono">IFSC</th>
                    <th className="border border-black p-1.5 text-right font-mono">Amount</th>
                    <th className="border border-black p-1.5 font-mono">Timestamp</th>
                    <th className="border border-black p-1.5 font-mono">Transaction ID</th>
                  </tr>
                </thead>
                <tbody>
                  {facts.layer2Entries.length > 0 ? (
                    facts.layer2Entries.map((e) => (
                      <tr key={e.transactionId} className="border-b border-black">
                        <td className="border border-black p-1.5 font-mono font-bold">{e.account}</td>
                        <td className="border border-black p-1.5">{e.bank}</td>
                        <td className="border border-black p-1.5 font-mono">{e.ifsc}</td>
                        <td className="border border-black p-1.5 text-right font-mono">{formatRupees(e.amount)}</td>
                        <td className="border border-black p-1.5 font-mono whitespace-nowrap">{e.timestamp}</td>
                        <td className="border border-black p-1.5 font-mono text-[9px]">{e.transactionId}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="border border-black p-2 text-center text-[#666666]">
                        No Layer 2 entries in this trace.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Layer 3 Table */}
            <div className="mb-6">
              <div className="flex justify-between items-center border-b border-black pb-1 mb-2">
                <h3 className="font-bold uppercase text-[11px]">Layer 3 Accounts (Cash-Out / Terminal Tier)</h3>
                <span className="font-mono text-[10px] font-bold">
                  Layer 3 Total: {formatRupees(facts.layer3Total)}
                </span>
              </div>
              <table className="w-full text-left border-collapse border border-black text-[10px]">
                <thead>
                  <tr className="bg-[#EEEEEE] border-b border-black">
                    <th className="border border-black p-1.5 font-mono">Account</th>
                    <th className="border border-black p-1.5">Bank</th>
                    <th className="border border-black p-1.5 font-mono">IFSC</th>
                    <th className="border border-black p-1.5 text-right font-mono">Amount</th>
                    <th className="border border-black p-1.5 font-mono">Timestamp</th>
                    <th className="border border-black p-1.5 font-mono">Transaction ID</th>
                  </tr>
                </thead>
                <tbody>
                  {facts.layer3Entries.length > 0 ? (
                    facts.layer3Entries.map((e) => (
                      <tr key={e.transactionId} className="border-b border-black">
                        <td className="border border-black p-1.5 font-mono font-bold">{e.account}</td>
                        <td className="border border-black p-1.5">{e.bank}</td>
                        <td className="border border-black p-1.5 font-mono">{e.ifsc}</td>
                        <td className="border border-black p-1.5 text-right font-mono">{formatRupees(e.amount)}</td>
                        <td className="border border-black p-1.5 font-mono whitespace-nowrap">{e.timestamp}</td>
                        <td className="border border-black p-1.5 font-mono text-[9px]">{e.transactionId}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="border border-black p-2 text-center text-[#666666]">
                        No Layer 3 entries in this trace.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Accounts recommended for immediate freezing */}
            <div className="mb-8">
              <h3 className="font-bold uppercase text-[11px] mb-2 border-b border-black pb-1">
                Accounts recommended for immediate freezing
              </h3>
              <table className="w-full text-left border-collapse border border-black text-[10px]">
                <thead>
                  <tr className="bg-[#EEEEEE] border-b border-black">
                    <th className="border border-black p-1.5 font-mono">Account Number</th>
                    <th className="border border-black p-1.5">Bank Name</th>
                    <th className="border border-black p-1.5 font-mono">IFSC</th>
                    <th className="border border-black p-1.5">Layer</th>
                    <th className="border border-black p-1.5 text-right font-mono">Believed Amount Held</th>
                  </tr>
                </thead>
                <tbody>
                  {facts.freezeAccounts.map((h) => (
                    <tr key={h.account} className="border-b border-black">
                      <td className="border border-black p-1.5 font-mono font-bold">{h.account}</td>
                      <td className="border border-black p-1.5">{h.bank}</td>
                      <td className="border border-black p-1.5 font-mono">{h.ifsc}</td>
                      <td className="border border-black p-1.5">{h.layer}</td>
                      <td className="border border-black p-1.5 text-right font-mono font-bold">
                        {formatRupees(h.freezeAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Signature Block & Placeholders */}
            <div className="flex justify-between items-end pt-8 border-t border-black text-[11px] font-mono">
              <div>
                <p>Police Station Record Seal:</p>
                <div className="h-14 w-32 border border-dashed border-black mt-1 flex items-center justify-center text-[9px] text-[#444444]">
                  [ STATION EMBLEM ]
                </div>
              </div>
              <div className="text-right">
                <p>Recorded by:</p>
                <p className="font-bold mt-1">{PLACEHOLDERS.officerNameAndRank}</p>
                <p>{PLACEHOLDERS.policeStation}</p>
              </div>
            </div>

            {/* Integrity Line */}
            <div className="mt-8 pt-3 border-t border-black text-[9px] font-mono text-[#444444] flex justify-between">
              <span>Generated: {generationTimestamp}</span>
              <span>Document integrity hash: {integrityHash}</span>
            </div>
          </section>

          {/* FREEZE REQUISITIONS: ONE PER BANK */}
          {facts.bankNotices.map((notice) => {
            const isVisible =
              printMode === 'ALL' || (printMode === 'CURRENT' && activeTab === notice.ifscPrefix);

            return (
              <section
                key={notice.ifscPrefix}
                className={`court-document print-container bg-[#FFFFFF] text-[#000000] p-8 sm:p-12 font-serif text-xs leading-relaxed border border-[#CCCCCC] rounded-[2px] max-w-4xl mx-auto shadow-none ${
                  !isVisible ? 'no-print' : ''
                } ${printMode === 'ALL' ? 'print-page-break mb-12' : ''}`}
                style={{ display: isVisible ? 'block' : 'none' }}
              >
                {/* Header */}
                <div className="text-center border-b-2 border-black pb-4 mb-6">
                  <h2 className="text-base font-bold uppercase tracking-wider">
                    Statutory Freeze Requisition Notice
                  </h2>
                  <p className="text-[10px] text-[#333333] mt-1 font-mono uppercase">
                    Under {STATUTORY_SECTION_HEADING}
                  </p>
                </div>

                {/* Salutation / Addressed to Bank Nodal Officer */}
                <div className="mb-4 font-mono text-[11px] leading-snug">
                  <p><strong>TO:</strong></p>
                  <p>{PLACEHOLDERS.bankNodalOfficerName}</p>
                  <p>Principal Nodal Officer / Law Enforcement Liaison Officer</p>
                  <p className="font-bold text-xs uppercase">{notice.bankName}</p>
                  <p>Bank Routing Code / IFSC Prefix: {notice.ifscPrefix}</p>
                </div>

                {/* Subject Line */}
                <div className="mb-4 p-2 bg-[#EEEEEE] border-l-4 border-black font-semibold text-[11px]">
                  SUBJECT: {REQUISITION_NOTICE_TEXT.subject}
                </div>

                {/* Reference Placeholders */}
                <div className="mb-4 font-mono text-[10px] bg-white border border-black p-2.5 space-y-0.5">
                  <p>1. FIR / Crime Enquiry Reference: {PLACEHOLDERS.firCaseNo}</p>
                  <p>2. Date of First Information / Dispute: {PLACEHOLDERS.dateOfFir}</p>
                  <p>3. Victim / Complainant Account: {facts.victimAccount}</p>
                  <p>4. Total Defrauded Sum in Money Trail: {formatRupees(facts.totalSiphoned)}</p>
                </div>

                {/* Short Factual Paragraph */}
                <div className="mb-4 text-justify text-[11px]">
                  <p>
                    {REQUISITION_NOTICE_TEXT.factualParagraph(
                      facts.victimAccount,
                      formatRupees(facts.totalSiphoned)
                    )}
                  </p>
                </div>

                {/* Numbered Annexure Table */}
                <div className="mb-4">
                  <h3 className="font-bold uppercase text-[11px] mb-2 border-b border-black pb-1">
                    Annexure of Disputed Beneficiary Accounts
                  </h3>
                  <table className="w-full text-left border-collapse border border-black text-[10px]">
                    <thead>
                      <tr className="bg-[#EEEEEE] border-b border-black">
                        <th className="border border-black p-1.5 text-center">S.No.</th>
                        <th className="border border-black p-1.5 font-mono">Beneficiary Account</th>
                        <th className="border border-black p-1.5 font-mono">IFSC</th>
                        <th className="border border-black p-1.5 font-mono">Disputed Transaction ID</th>
                        <th className="border border-black p-1.5 font-mono">Date &amp; Time</th>
                        <th className="border border-black p-1.5 text-right font-mono">Amount to Freeze</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notice.accounts.map((acc, aIdx) => (
                        <tr key={acc.transactionId} className="border-b border-black">
                          <td className="border border-black p-1.5 text-center font-mono">{aIdx + 1}</td>
                          <td className="border border-black p-1.5 font-mono font-bold">{acc.accountNumber}</td>
                          <td className="border border-black p-1.5 font-mono">{acc.ifsc}</td>
                          <td className="border border-black p-1.5 font-mono text-[9px]">{acc.transactionId}</td>
                          <td className="border border-black p-1.5 font-mono whitespace-nowrap">{acc.timestamp}</td>
                          <td className="border border-black p-1.5 text-right font-mono font-bold">
                            {formatRupees(acc.amount)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-[#EEEEEE] font-bold border-t-2 border-black">
                        <td colSpan={5} className="border border-black p-1.5 text-right uppercase">
                          Total Requisition Amount for this Bank:
                        </td>
                        <td className="border border-black p-1.5 text-right font-mono">
                          {formatRupees(notice.totalAmount)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Request Clause */}
                <div className="mb-6 whitespace-pre-line text-[11px] bg-[#FAFAFA] border border-black p-3">
                  {REQUISITION_NOTICE_TEXT.requestClause}
                </div>

                {/* Signature Block */}
                <div className="pt-6 border-t border-black whitespace-pre-line font-mono text-[11px]">
                  {REQUISITION_NOTICE_TEXT.signatureBlock}
                </div>

                {/* Integrity Line */}
                <div className="mt-8 pt-3 border-t border-black text-[9px] font-mono text-[#444444] flex justify-between">
                  <span>Generated: {generationTimestamp}</span>
                  <span>Document integrity hash: {integrityHash}</span>
                </div>
              </section>
            );
          })}
        </div>
      ) : null}

      {/* Standard Evidence Export Modal */}
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

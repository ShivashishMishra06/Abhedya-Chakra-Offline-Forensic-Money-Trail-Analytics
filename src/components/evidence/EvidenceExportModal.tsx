import React, { useState, useEffect } from 'react';
import {
  Download,
  FileSpreadsheet,
  ShieldCheck,
  Check,
  Copy,
  X,
  FileText,
  Building2,
  Network,
  Lock,
} from 'lucide-react';
import { TraceResult } from '../../types/dataset';
import {
  generateEvidenceTrailCsv,
  generateFreezeScheduleCsv,
  generateMuleEntitiesCsv,
  downloadCsvEvidence,
  EvidenceExportResult,
} from '../../lib/evidenceExporter';
import { formatINR } from '../../lib/currency';

interface EvidenceExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  trace: TraceResult;
}

type ExportType = 'TRAIL' | 'FREEZE' | 'ENTITIES';

export const EvidenceExportModal: React.FC<EvidenceExportModalProps> = ({
  isOpen,
  onClose,
  trace,
}) => {
  const [selectedType, setSelectedType] = useState<ExportType>('TRAIL');
  const [exportData, setExportData] = useState<EvidenceExportResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Officer info from local storage
  const officerName = localStorage.getItem('abhedya_officer_name') || 'Insp. Rajesh Sharma';
  const officerBadge = localStorage.getItem('abhedya_officer_badge') || 'IND-CYB-1930';
  const officerStation = localStorage.getItem('abhedya_officer_station') || 'Cyber Crime Police Station, Indore';

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsGenerating(true);
    setCopied(false);
    setDownloadSuccess(false);

    const generate = async () => {
      try {
        const officerInfo = {
          name: officerName,
          badge: officerBadge,
          station: officerStation,
        };

        let result: EvidenceExportResult;
        if (selectedType === 'TRAIL') {
          result = await generateEvidenceTrailCsv(trace, officerInfo);
        } else if (selectedType === 'FREEZE') {
          result = await generateFreezeScheduleCsv(trace, officerInfo);
        } else {
          result = await generateMuleEntitiesCsv(trace);
        }

        if (isMounted) {
          setExportData(result);
        }
      } catch (err) {
        console.error('Failed to generate export:', err);
      } finally {
        if (isMounted) {
          setIsGenerating(false);
        }
      }
    };

    generate();

    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedType, trace, officerName, officerBadge, officerStation]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!exportData) return;
    downloadCsvEvidence(exportData.csvContent, exportData.filename);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  const handleCopy = async () => {
    if (!exportData) return;
    try {
      await navigator.clipboard.writeText(exportData.csvContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  // Extract preview lines (first 12 lines)
  const previewLines = exportData
    ? exportData.csvContent.split('\r\n').slice(0, 15).join('\n')
    : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div className="relative w-full max-w-3xl rounded-[10px] border border-[#CBD5E1] bg-white text-[#0F172A] shadow-xl overflow-hidden font-mono text-xs">
        {/* National Tricolor Top Bar */}
        <div className="h-1 w-full police-tricolor" aria-hidden="true" />

        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-[#CBD5E1] bg-[#F8FAFC] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-[#0B2545] text-white shrink-0">
              <FileSpreadsheet className="h-5 w-5 text-[#FCD34D]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-[4px] bg-[#FEF3C7] border border-[#FDE68A] px-2 py-0.5 text-[10px] font-bold text-[#92400E]">
                  Evidence Standard CSV
                </span>
                <span className="text-[11px] text-[#64748B]">
                  Sec 65B IEA / Sec 63 BSA Certified
                </span>
              </div>
              <h2 id="export-modal-title" className="font-serif text-lg font-bold text-[#0B2545] mt-0.5">
                Export Forensic Evidence Dossier
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-[4px] p-1.5 text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#0F172A] cursor-pointer transition-colors"
            aria-label="Close export modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Format Selector Tabs */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-2">
              Select Evidence Submission Format
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Option 1: Full Trail */}
              <button
                type="button"
                onClick={() => setSelectedType('TRAIL')}
                className={`p-3 rounded-[6px] border text-left cursor-pointer transition-all ${
                  selectedType === 'TRAIL'
                    ? 'border-[#0B2545] bg-[#EFF6FF] ring-2 ring-[#0B2545]/20'
                    : 'border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#94A3B8]'
                }`}
              >
                <div className="flex items-center gap-2 text-[#0B2545] font-bold">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span>Forensic Trail Ledger</span>
                </div>
                <p className="text-[11px] text-[#64748B] mt-1 leading-snug">
                  Chronological transaction exhibits with Section 65B legal headers & SHA-256 seal.
                </p>
                <span className="inline-block mt-2 text-[10px] font-bold text-[#0B2545] bg-white border border-[#CBD5E1] px-1.5 py-0.5 rounded-[3px]">
                  {trace.edges.length} Disputed Txns
                </span>
              </button>

              {/* Option 2: Freeze Schedule */}
              <button
                type="button"
                onClick={() => setSelectedType('FREEZE')}
                className={`p-3 rounded-[6px] border text-left cursor-pointer transition-all ${
                  selectedType === 'FREEZE'
                    ? 'border-[#0B2545] bg-[#EFF6FF] ring-2 ring-[#0B2545]/20'
                    : 'border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#94A3B8]'
                }`}
              >
                <div className="flex items-center gap-2 text-[#0B2545] font-bold">
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span>Bank Freeze Schedule</span>
                </div>
                <p className="text-[11px] text-[#64748B] mt-1 leading-snug">
                  Sec 91 CrPC requisition annexure for bank nodal officers and court orders.
                </p>
                <span className="inline-block mt-2 text-[10px] font-bold text-[#B45309] bg-white border border-[#CBD5E1] px-1.5 py-0.5 rounded-[3px]">
                  Immediate Freeze Schedule
                </span>
              </button>

              {/* Option 3: Mule Entity Registry */}
              <button
                type="button"
                onClick={() => setSelectedType('ENTITIES')}
                className={`p-3 rounded-[6px] border text-left cursor-pointer transition-all ${
                  selectedType === 'ENTITIES'
                    ? 'border-[#0B2545] bg-[#EFF6FF] ring-2 ring-[#0B2545]/20'
                    : 'border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#94A3B8]'
                }`}
              >
                <div className="flex items-center gap-2 text-[#0B2545] font-bold">
                  <Network className="h-4 w-4 shrink-0" />
                  <span>Mule Node Registry</span>
                </div>
                <p className="text-[11px] text-[#64748B] mt-1 leading-snug">
                  Topology registry of all accounts with layer roles, risk scores & anomalies.
                </p>
                <span className="inline-block mt-2 text-[10px] font-bold text-[#166534] bg-white border border-[#CBD5E1] px-1.5 py-0.5 rounded-[3px]">
                  {trace.nodes.length} Accounts
                </span>
              </button>
            </div>
          </div>

          {/* Evidence Metadata Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F8FAFC] border border-[#CBD5E1] p-3 rounded-[6px] text-[11px]">
            <div>
              <span className="text-[#64748B] block text-[10px] uppercase">Victim Account</span>
              <strong className="text-[#0B2545] font-mono">{trace.victimAccount}</strong>
            </div>
            <div>
              <span className="text-[#64748B] block text-[10px] uppercase">Disputed Sum</span>
              <strong className="text-[#DC2626] font-mono">{formatINR(trace.totalSiphoned)}</strong>
            </div>
            <div>
              <span className="text-[#64748B] block text-[10px] uppercase">Record Count</span>
              <strong className="text-[#0F172A] font-mono">{exportData?.rowCount || 0} rows</strong>
            </div>
            <div>
              <span className="text-[#64748B] block text-[10px] uppercase">Investigating Officer</span>
              <strong className="text-[#0B2545] truncate block">{officerName}</strong>
            </div>
          </div>

          {/* Cryptographic Hash Digest Badge */}
          {exportData && (
            <div className="rounded-[6px] border border-[#CBD5E1] bg-white p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold text-[11px] text-[#0B2545]">
                  <ShieldCheck className="h-4 w-4 text-[#16A34A]" />
                  Cryptographic Evidence Hash (SHA-256)
                </span>
                <span className="text-[10px] text-[#64748B]">
                  Section 65B Electronic Record Hash
                </span>
              </div>
              <div className="rounded-[4px] bg-[#F1F5F9] border border-[#CBD5E1] p-2 font-mono text-[11px] text-[#0F172A] break-all select-all">
                {exportData.sha256Hash}
              </div>
            </div>
          )}

          {/* CSV Preview Window */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-[#475569] uppercase">
                CSV Exhibit Preview ({exportData?.filename})
              </span>
              <span className="text-[10px] text-[#64748B]">
                UTF-8 with BOM (Excel & Calc Compatible)
              </span>
            </div>
            <pre className="rounded-[6px] border border-[#CBD5E1] bg-[#0F172A] text-emerald-400 p-3 text-[10.5px] leading-relaxed max-h-40 overflow-x-auto overflow-y-auto font-mono selection:bg-amber-400 selection:text-black">
              {isGenerating ? 'Generating deterministic CSV evidence exhibit...' : previewLines}
            </pre>
          </div>

          {/* Legal Compliance Disclaimer */}
          <div className="rounded-[6px] border border-[#FDE68A] bg-[#FEF3C7] p-3 text-[11px] text-[#92400E] flex items-start gap-2">
            <Lock className="h-4 w-4 shrink-0 mt-0.5 text-[#B45309]" />
            <div>
              <strong className="block font-bold">
                Official Law Enforcement Chain-of-Custody Certification
              </strong>
              <p className="mt-0.5 leading-snug text-[#78350F]">
                This CSV artifact complies with the statutory formats mandated by Section 91 Cr.P.C. / Section 94 BNSS.
                The embedded cryptographic SHA-256 signature guarantees immutability for judicial scrutiny under Section 65B of the Indian Evidence Act.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer / Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#CBD5E1] bg-[#F8FAFC] p-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={isGenerating || !exportData}
              className="flex items-center gap-1.5 rounded-[6px] border border-[#CBD5E1] bg-white px-3.5 py-2 font-bold text-[#0F172A] hover:bg-[#F1F5F9] disabled:opacity-50 cursor-pointer transition-colors shadow-xs"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#16A34A]" />
                  <span className="text-[#16A34A]">Copied CSV!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-[#64748B]" />
                  <span>Copy to Clipboard</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[6px] border border-[#CBD5E1] bg-white px-4 py-2 font-semibold text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] cursor-pointer transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={isGenerating || !exportData}
              className="flex items-center gap-2 rounded-[6px] bg-[#0B2545] px-5 py-2 font-bold text-white hover:bg-[#133866] disabled:opacity-50 cursor-pointer transition-colors shadow-xs"
            >
              <Download className="h-4 w-4 text-[#FCD34D]" />
              <span>{downloadSuccess ? 'Downloaded!' : 'Download Evidence CSV'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

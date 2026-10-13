import React, { useState } from 'react';
import { Lock, ArrowRight, ShieldCheck } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (officer: { name: string; rank: string; badge: string; station: string }) => void;
  onContinueAsGuest: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onContinueAsGuest }) => {
  const [officerName, setOfficerName] = useState(() => localStorage.getItem('abhedya_officer_name') || 'Rajesh Sharma');
  const [badgeNumber, setBadgeNumber] = useState(() => localStorage.getItem('abhedya_officer_badge') || 'IND-CYB-1930');
  const [designation, setDesignation] = useState(() => localStorage.getItem('abhedya_officer_rank') || 'Inspector of Police');
  const [policeStation, setPoliceStation] = useState('Cyber Crime Police Station, Indore');
  const [passcode, setPasscode] = useState('');
  const [imageError, setImageError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const officer = {
      name: officerName.trim() || 'Investigating Officer',
      rank: designation,
      badge: badgeNumber.trim() || 'PNO-OFFICER',
      station: policeStation,
    };
    try {
      localStorage.setItem('abhedya_officer_name', officer.name);
      localStorage.setItem('abhedya_officer_badge', officer.badge);
      localStorage.setItem('abhedya_officer_rank', officer.rank);
      localStorage.setItem('abhedya_officer_station', officer.station);
      localStorage.setItem('abhedya_session_authorized', 'true');
    } catch {
      // Ignore
    }
    onLoginSuccess(officer);
  };

  return (
    <div className="flex min-h-[100dvh] w-full flex-col lg:flex-row bg-[#F1F5F9] text-[#0F172A]">
      {/* Left Half: Department Banner with Official Police Navy Overlay */}
      <div className="relative flex flex-col justify-between lg:w-1/2 min-h-[380px] lg:min-h-full border-b lg:border-b-0 lg:border-r border-[#CBD5E1] overflow-hidden bg-[#0B2545]">
        {/* Top Indian National Tricolor Ribbon */}
        <div className="h-1.5 w-full police-tricolor relative z-20" aria-hidden="true" />

        {/* Real photo of cyber cell department team */}
        <img
          src={imageError ? '/images/cyber_cell_team.svg' : '/images/cyber_cell_team.jpg'}
          onError={() => setImageError(true)}
          alt="Cyber cell team"
          className="absolute inset-0 h-full w-full object-cover object-top opacity-30 mix-blend-luminosity"
        />

        {/* Deep Police Navy Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A1C36] via-[#0B2545]/85 to-[#0B2545]/90" aria-hidden="true" />

        {/* Top Police Header on left panel */}
        <div className="relative z-10 p-6 sm:p-10">
          <div className="flex items-center gap-3">
            <img
              src="/images/police_emblem.svg"
              alt="Indore Police Emblem"
              className="h-12 w-12 shrink-0 drop-shadow-md"
            />
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#FCD34D]">
                मध्यप्रदेश पुलिस | MP POLICE
              </p>
              <h1 className="font-serif text-lg font-bold text-white tracking-wide">
                इन्दौर पुलिस कमिशनरेट
              </h1>
              <p className="text-[11px] text-slate-300 font-mono">
                Indore Police Commissionerate
              </p>
            </div>
          </div>
        </div>

        {/* Department Name and Crest info pinned to bottom of left half */}
        <div className="relative z-10 p-6 sm:p-10 border-t border-white/10 bg-[#0A1C36]/80 backdrop-blur-sm">
          <div className="inline-flex items-center gap-2 rounded-[4px] bg-[#B45309]/30 border border-[#B45309]/50 px-2.5 py-1 text-[11px] font-mono text-[#FCD34D] font-bold mb-3">
            <span>अभियान अभेद्य-चक्र</span>
            <span>&middot;</span>
            <span>1930 Cyber Cell Portal</span>
          </div>
          <h2 className="font-serif text-xl font-bold text-white leading-snug">
            Abhedya-Chakra Forensic Money Trail Analytics
          </h2>
          <p className="text-xs text-slate-300 mt-2 leading-relaxed font-mono">
            Forensic graph tracing, multi-layered mule network detection, and automated statutory requisition generation under Section 91 Cr.P.C. / Section 94 BNSS.
          </p>
          <div className="mt-4 flex items-center gap-3 text-[11px] text-slate-400 font-mono">
            <span>हेल्पलाइन: 1930</span>
            <span>&middot;</span>
            <span>आपातकालीन: 112</span>
            <span>&middot;</span>
            <span>Law Enforcement Only</span>
          </div>
        </div>
      </div>

      {/* Right Half: Sign-in / Authorization Panel */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 lg:w-1/2 bg-[#F1F5F9]">
        <div className="mx-auto w-full max-w-md">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-[#0B2545] text-white">
                <ShieldCheck className="h-6 w-6 text-[#FCD34D]" />
              </div>
              <div>
                <span className="inline-block rounded-[4px] border border-[#CBD5E1] bg-white px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#B45309]">
                  Official Law Enforcement Terminal
                </span>
                <h2 className="font-serif text-2xl font-bold tracking-tight text-[#0F172A] mt-0.5">
                  Officer Authentication
                </h2>
              </div>
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Authorized portal for Investigating Officers and Cyber Cell analysts handling financial cybercrime money trails.
            </p>
          </div>

          {/* Form Card */}
          <div className="rounded-[8px] border border-[#CBD5E1] bg-white p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block font-mono text-xs font-semibold text-[#475569] uppercase mb-1">
                  Investigating Officer Name
                </label>
                <input
                  type="text"
                  required
                  value={officerName}
                  onChange={(e) => setOfficerName(e.target.value)}
                  placeholder="e.g. Insp. Rajesh Sharma"
                  className="w-full rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 py-2.5 font-mono text-xs text-[#0F172A] placeholder-[#94A3B8] focus:border-[#0B2545] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-xs font-semibold text-[#475569] uppercase mb-1">
                    PNO / Badge Number
                  </label>
                  <input
                    type="text"
                    required
                    value={badgeNumber}
                    onChange={(e) => setBadgeNumber(e.target.value)}
                    placeholder="e.g. IND-CYB-1930"
                    className="w-full rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 py-2.5 font-mono text-xs text-[#0F172A] placeholder-[#94A3B8] focus:border-[#0B2545] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs font-semibold text-[#475569] uppercase mb-1">
                    Designation / Rank
                  </label>
                  <select
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 py-2.5 font-mono text-xs text-[#0F172A] focus:border-[#0B2545] focus:outline-none"
                  >
                    <option value="Inspector of Police">Inspector of Police</option>
                    <option value="Sub-Inspector / IO">Sub-Inspector / IO</option>
                    <option value="Assistant Commissioner of Police">ACP / Incharge</option>
                    <option value="Cyber Forensic Analyst">Cyber Forensic Analyst</option>
                    <option value="1930 Helpline Nodal Officer">1930 Nodal Officer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs font-semibold text-[#475569] uppercase mb-1">
                  Police Station / Unit
                </label>
                <input
                  type="text"
                  required
                  value={policeStation}
                  onChange={(e) => setPoliceStation(e.target.value)}
                  className="w-full rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 py-2.5 font-mono text-xs text-[#0F172A] focus:border-[#0B2545] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono text-xs font-semibold text-[#475569] uppercase mb-1">
                  Officer Security PIN / Passcode
                </label>
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter 4-digit PIN (default demo: 1930)"
                  className="w-full rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 py-2.5 font-mono text-xs text-[#0F172A] placeholder-[#94A3B8] focus:border-[#0B2545] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-[6px] bg-[#0B2545] px-4 py-3 font-mono text-xs font-bold text-white hover:bg-[#133866] cursor-pointer transition-colors shadow-xs"
              >
                <ShieldCheck className="h-4 w-4 text-[#FCD34D]" />
                <span>Authorize Officer Session</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            {/* Quick Direct Access */}
            <div className="mt-5 pt-5 border-t border-[#CBD5E1] flex items-center justify-between text-xs font-mono">
              <span className="text-[#64748B]">Evaluation Bypass:</span>
              <button
                onClick={onContinueAsGuest}
                className="text-[#0B2545] hover:text-[#B45309] hover:underline cursor-pointer flex items-center gap-1 font-bold"
              >
                <span>Continue to Money Trail Analysis</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Statutory Security Disclaimer */}
          <div className="mt-6 rounded-[6px] border border-[#CBD5E1] bg-white p-3 text-[11px] font-mono text-[#64748B] shadow-xs">
            <p className="flex items-center gap-1.5 font-bold text-[#0F172A] mb-1">
              <Lock className="h-3 w-3 text-[#B45309]" />
              Official Government Use Only
            </p>
            <p>
              Unauthorized access or misuse is punishable under Section 43 and Section 66 of the Information Technology Act, 2000. All sessions are logged locally.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

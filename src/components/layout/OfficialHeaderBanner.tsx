import React, { useState } from 'react';

interface OfficialHeaderBannerProps {
  title: string;
  category?: string;
  badge?: string;
}

export const OfficialHeaderBanner: React.FC<OfficialHeaderBannerProps> = ({
  title,
  category = 'Cyber Crime Cell, Indore Police Commissionerate',
  badge,
}) => {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="relative mb-6 w-full overflow-hidden rounded-[8px] border border-[#CBD5E1] bg-[#0B2545] shadow-sm">
      {/* Official Indian National Tricolor Ribbon at Top of Banner */}
      <div className="h-1.5 w-full police-tricolor" aria-hidden="true" />

      <div className="relative min-h-[82px] overflow-hidden">
        {/* Department Team Photo as subtle background texture */}
        <img
          src={imageError ? '/images/cyber_cell_team.svg' : '/images/cyber_cell_team.jpg'}
          onError={() => setImageError(true)}
          alt="Cyber cell team"
          className="absolute inset-0 h-full w-full object-cover object-[center_30%] opacity-20"
        />

        {/* Deep Police Navy overlay with rich texture */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B2545] via-[#0D2E54]/95 to-[#0B2545]/90" aria-hidden="true" />

        {/* Foreground Content */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[#CBD5E1]">
              <span className="font-bold text-[#E2B734]">{category}</span>
              {badge && (
                <>
                  <span className="text-[#64748B]">&middot;</span>
                  <span className="rounded-[4px] border border-[#E2B734]/40 bg-[#061528] px-2 py-0.5 text-[10px] font-semibold text-[#E2B734]">
                    {badge}
                  </span>
                </>
              )}
            </div>
            <h1 className="mt-1 font-serif text-xl sm:text-2xl font-bold tracking-tight text-white drop-shadow-sm">
              {title}
            </h1>
          </div>

          {/* Official Unit Crest / Seal */}
          <div className="hidden sm:flex items-center gap-3 rounded-[6px] border border-[#1E3A5F] bg-[#061528]/90 px-3.5 py-2 font-mono text-xs text-[#CBD5E1] shadow-xs">
            <img
              src="/images/police_emblem.svg"
              alt="Indore Police Emblem"
              className="h-6 w-6 shrink-0"
            />
            <div className="text-left">
              <span className="block text-white font-bold text-[11px]">1930 Cyber Cell</span>
              <span className="block text-[#E2B734] text-[10px]">Indore Commissionerate</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

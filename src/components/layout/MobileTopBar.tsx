import React from 'react';
import { Menu } from 'lucide-react';
import { siteConfig } from '../../config/site';

interface MobileTopBarProps {
  onOpenMobileMenu: () => void;
}

export const MobileTopBar: React.FC<MobileTopBarProps> = ({ onOpenMobileMenu }) => {
  return (
    <header className="no-print sticky top-0 z-30 flex flex-col w-full md:hidden">
      {/* Tricolor Ribbon on Mobile */}
      <div className="h-1 w-full police-tricolor shrink-0" aria-hidden="true" />

      <div className="flex h-14 w-full items-center justify-between border-b border-[#1E3A5F] bg-[#0B2240] px-4 text-white shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            className="flex h-8 w-8 items-center justify-center rounded-[4px] text-white hover:bg-[#132E54] cursor-pointer"
          >
            <Menu className="h-5 w-5" />
          </button>
          <img
            src="/images/police_emblem.svg"
            alt="Indore Police Emblem"
            className="h-7 w-7 shrink-0"
          />
          <div className="truncate">
            <span className="font-serif text-sm font-bold tracking-tight text-white block leading-none">
              {siteConfig.shortName}
            </span>
            <span className="font-mono text-[10px] text-[#E2B734] font-semibold tracking-wider uppercase block mt-0.5">
              Cyber Cell, Indore Police
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[10px] bg-[#081A32] border border-[#1E3A5F] px-2 py-1 rounded-[4px] text-[#E2B734]">
          <span>Helpline: 1930</span>
        </div>
      </div>
    </header>
  );
};

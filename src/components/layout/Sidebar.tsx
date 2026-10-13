import React, { useEffect, useRef } from 'react';
import {
  Database,
  Search,
  UserSearch,
  Network,
  BarChart3,
  FileText,
  Settings,
  FlaskConical,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  X,
} from 'lucide-react';
import { siteConfig } from '../../config/site';
import { IngestionMetrics } from '../../types/dataset';

interface SidebarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  metrics: IngestionMetrics | null;
  flaggedMuleCount?: number;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRoute,
  onNavigate,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  metrics,
  flaggedMuleCount,
}) => {
  const sidebarRef = useRef<HTMLElement>(null);

  // Keyboard navigation: Escape key closes mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen) {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  // Focus trap for mobile drawer when open
  useEffect(() => {
    if (isMobileOpen && sidebarRef.current) {
      const focusable = sidebarRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])'
      );
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    }
  }, [isMobileOpen]);

  const showDevGenerator = import.meta.env.VITE_DEV_TOOLS === 'true';

  const navItems = [
    { id: '#/ingest', label: 'Ingest Ledger', icon: Database },
    { id: '#/victim-query', label: 'Blind Victim Query', icon: Search },
    { id: '#/explorer', label: 'Account Explorer', icon: UserSearch },
    {
      id: '#/detection',
      label: 'Mule Detection',
      icon: Network,
      badge: flaggedMuleCount && flaggedMuleCount > 0 ? flaggedMuleCount.toLocaleString() : null,
    },
    { id: '#/evaluation', label: 'Evaluation Metrics', icon: BarChart3 },
    { id: '#/detection-eval', label: 'Detection Evaluation', icon: BarChart3 },
    { id: '#/case-officer', label: 'Section 91 Notice & Diary', icon: FileText },
    { id: '#/settings', label: 'System Settings', icon: Settings },
    ...(showDevGenerator
      ? [{ id: '#/dev/generator', label: 'Synthetic Generator', icon: FlaskConical }]
      : []),
  ];

  const handleLinkClick = (e: React.MouseEvent, route: string) => {
    e.preventDefault();
    onNavigate(route);
    if (isMobileOpen) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          aria-hidden="true"
        />
      )}

      {/* Persistent / Off-canvas Sidebar Element (Deep Police Navy #0B2240) */}
      <aside
        ref={sidebarRef}
        aria-label="Primary Navigation"
        className={`fixed top-0 bottom-0 left-0 z-50 flex h-[100dvh] flex-col border-r border-[#1E3A5F] bg-[#0B2240] text-white transition-all duration-200 shadow-md ${
          isCollapsed ? 'w-[64px]' : 'w-[250px]'
        } ${
          isMobileOpen
            ? 'translate-x-0'
            : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Tricolor Ribbon on Top of Sidebar */}
        <div className="h-1 w-full police-tricolor shrink-0" aria-hidden="true" />

        {/* Sidebar Header: Department Logo and App Name */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#1E3A5F] px-3.5 bg-[#081A32]">
          <div className="flex items-center gap-3 overflow-hidden">
            {/* Official Police Department Emblem */}
            <img
              src="/images/police_emblem.svg"
              alt="Indore Police Emblem"
              className="h-9 w-9 shrink-0 object-contain drop-shadow-sm"
            />

            {!isCollapsed && (
              <div className="truncate">
                <span className="block font-serif text-sm font-bold tracking-tight text-white leading-tight">
                  ABHEDYA-CHAKRA
                </span>
                <span className="block font-mono text-[10px] text-[#E2B734] font-semibold tracking-wider uppercase mt-0.5">
                  Cyber Cell &middot; Indore Police
                </span>
              </div>
            )}
          </div>

          {/* Close button inside mobile drawer */}
          <button
            onClick={onCloseMobile}
            className="flex h-8 w-8 items-center justify-center rounded-[4px] text-[#CBD5E1] hover:bg-[#132E54] hover:text-white md:hidden cursor-pointer"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Primary Navigation List */}
        <nav aria-label="Primary" className="flex-1 overflow-y-auto px-2 py-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                currentRoute === item.id ||
                (item.id === '#/ingest' && (currentRoute === '#/' || currentRoute === ''));

              return (
                <li key={item.id} className="relative group">
                  <a
                    href={item.id}
                    onClick={(e) => handleLinkClick(e, item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`relative flex h-10 w-full items-center rounded-[6px] text-xs font-medium transition-colors ${
                      isCollapsed ? 'justify-center px-0' : 'px-3'
                    } ${
                      isActive
                        ? 'bg-[#15345C] font-semibold text-white shadow-xs'
                        : 'text-[#CBD5E1] hover:bg-[#132E54]/80 hover:text-white'
                    }`}
                  >
                    {/* Gold marker bar on the active item (#E2B734) */}
                    {isActive && (
                      <span
                        className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[#E2B734]"
                        aria-hidden="true"
                      />
                    )}

                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? 'text-[#E2B734]' : 'text-[#94A3B8]'
                      }`}
                      aria-hidden="true"
                    />

                    {!isCollapsed && (
                      <span className="ml-3 truncate">{item.label}</span>
                    )}

                    {/* Measured badge */}
                    {!isCollapsed && item.badge && (
                      <span className="ml-auto rounded-[4px] border border-[#DC2626]/40 bg-[#DC2626]/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                        {item.badge}
                      </span>
                    )}
                  </a>

                  {/* Accessible tooltip for collapsed mode */}
                  {isCollapsed && (
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute left-full top-1/2 ml-2 z-50 -translate-y-1/2 rounded-[4px] border border-[#1E3A5F] bg-[#081A32] px-2.5 py-1 text-[11px] font-medium text-white shadow-md opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 whitespace-nowrap"
                    >
                      {item.label}
                      {item.badge && ` (${item.badge})`}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Officer Session Quick Link */}
        <div className="border-t border-[#1E3A5F] px-2 py-2">
          <button
            onClick={() => onNavigate('#/login')}
            className={`flex h-9 w-full items-center rounded-[6px] text-xs font-mono text-[#CBD5E1] hover:bg-[#132E54] hover:text-[#E2B734] cursor-pointer transition-colors ${
              isCollapsed ? 'justify-center px-0' : 'px-3'
            } ${currentRoute === '#/login' ? 'bg-[#15345C] text-[#E2B734] font-semibold' : ''}`}
            title="Officer Authentication Terminal"
          >
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#E2B734]" />
            {!isCollapsed && <span className="ml-3 truncate">Officer Terminal</span>}
          </button>
        </div>

        {/* Collapse toggle button at bottom of nav list (hidden on mobile) */}
        <div className="hidden border-t border-[#1E3A5F] px-2 py-2 md:block">
          <button
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex h-9 w-full items-center justify-center rounded-[6px] text-xs font-mono text-[#CBD5E1] hover:bg-[#132E54] hover:text-white cursor-pointer transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <div className="flex w-full items-center justify-between px-2">
                <span className="text-[11px]">Collapse panel</span>
                <ChevronLeft className="h-4 w-4" />
              </div>
            )}
          </button>
        </div>

        {/* Sidebar Footer: Data Status Block & Legal Links */}
        <div className="border-t border-[#1E3A5F] p-3 text-xs bg-[#081A32]">
          {/* Measured Data Status Block */}
          {!isCollapsed ? (
            <div className="rounded-[6px] border border-[#1E3A5F] bg-[#061528] p-2.5 font-mono text-[11px]">
              <div className="text-[10px] uppercase tracking-wider text-[#94A3B8] flex items-center justify-between">
                <span>Ledger Metrics</span>
                <span className="text-[#E2B734] font-bold">1930 Unit</span>
              </div>
              {metrics ? (
                <div className="mt-1 space-y-0.5 text-[#E2E8F0]">
                  <div>
                    Records: <strong>{metrics.rowCount.toLocaleString()}</strong>
                  </div>
                  <div>
                    Accounts: <strong>{metrics.distinctAccounts.toLocaleString()}</strong>
                  </div>
                  <div className="text-[10px] text-[#94A3B8]">
                    Index Time: {(metrics.elapsedMs / 1000).toFixed(2)}s
                  </div>
                </div>
              ) : (
                <div className="mt-1 text-[#94A3B8]">No active ledger</div>
              )}
            </div>
          ) : (
            <div
              title={
                metrics
                  ? `${metrics.rowCount.toLocaleString()} rows, ${metrics.distinctAccounts.toLocaleString()} accounts`
                  : 'No active ledger'
              }
              className="flex justify-center py-1"
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  metrics ? 'bg-[#16A34A]' : 'bg-[#E2B734]'
                }`}
              />
            </div>
          )}

          {/* Department Designation & Statutory Links */}
          <div
            className={`mt-3 pt-2 border-t border-[#1E3A5F] text-[10px] font-mono text-[#94A3B8] ${
              isCollapsed ? 'text-center' : ''
            }`}
          >
            {!isCollapsed && (
              <>
                <p className="font-semibold text-white mb-1">
                  Cyber Cell, Indore Police Commissionerate
                </p>
                <div className="flex gap-2 text-[10px]">
                  <a
                    href="#/privacy"
                    onClick={(e) => handleLinkClick(e, '#/privacy')}
                    className="hover:text-[#E2B734] hover:underline"
                  >
                    Privacy Policy
                  </a>
                  <span>&middot;</span>
                  <a
                    href="#/terms"
                    onClick={(e) => handleLinkClick(e, '#/terms')}
                    className="hover:text-[#E2B734] hover:underline"
                  >
                    Terms
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

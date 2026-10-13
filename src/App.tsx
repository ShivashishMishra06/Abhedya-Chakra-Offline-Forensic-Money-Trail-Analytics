import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { MobileTopBar } from './components/layout/MobileTopBar';
import { IngestPage } from './pages/IngestPage';
import { VictimQueryPage } from './pages/VictimQueryPage';
import { AccountExplorerPage } from './pages/AccountExplorerPage';
import { MuleDetectionPage } from './pages/MuleDetectionPage';
import { EvaluationPage } from './pages/EvaluationPage';
import { CaseOfficerPage } from './pages/CaseOfficerPage';
import { SettingsPage } from './pages/SettingsPage';
import { DevGeneratorPage } from './pages/DevGeneratorPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { LoginPage } from './pages/LoginPage';
import { DetectionEvalPage } from './pages/DetectionEvalPage';

import { forensicEngine } from './engine/engine';
import { IngestionMetrics, TraceResult } from './types/dataset';
import { HeuristicThresholds, MuleDetectionResult, defaultHeuristicThresholds } from './types/heuristics';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<string>(() => window.location.hash || '#/ingest');
  const [metrics, setMetrics] = useState<IngestionMetrics | null>(() => forensicEngine.getMetrics());
  const [last5Traces, setLast5Traces] = useState<TraceResult[]>([]);
  const [activeTrace, setActiveTrace] = useState<TraceResult | null>(null);
  const [selectedExplorerAccount, setSelectedExplorerAccount] = useState<string>('');
  const [detectionResults, setDetectionResults] = useState<MuleDetectionResult[]>([]);

  // Responsive sidebar collapse state:
  // >= 1024px: expanded (isCollapsed: false)
  // 768px to 1023px: collapsed (isCollapsed: true)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('abhedya_sidebar_collapsed');
      if (stored !== null) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignore
    }
    if (typeof window !== 'undefined') {
      if (window.innerWidth >= 768 && window.innerWidth < 1024) {
        return true;
      }
    }
    return false;
  });

  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Enforce official Indian police portal theme (#F1F5F9 canvas with deep police navy)
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  // Load heuristic thresholds from localStorage or use defaults
  const [thresholds, setThresholds] = useState<HeuristicThresholds>(() => {
    try {
      const stored = localStorage.getItem('abhedya_heuristic_thresholds');
      if (stored) {
        return { ...defaultHeuristicThresholds, ...JSON.parse(stored) };
      }
    } catch {
      // Ignore
    }
    return defaultHeuristicThresholds;
  });

  const [localLlmEndpoint, setLocalLlmEndpoint] = useState<string>(() => {
    try {
      return localStorage.getItem('abhedya_llm_endpoint') || '';
    } catch {
      return '';
    }
  });

  // Listen to hash changes for routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash || '#/ingest';
      setCurrentRoute(hash);
      window.scrollTo(0, 0);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (route: string) => {
    window.location.hash = route;
    setCurrentRoute(route);
  };

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('abhedya_sidebar_collapsed', JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const handleIngestSuccess = (newMetrics: IngestionMetrics) => {
    setMetrics(newMetrics);
    setLast5Traces([]);
    setActiveTrace(null);
    setDetectionResults([]);
  };

  const handleTraceCompleted = (trace: TraceResult) => {
    setActiveTrace(trace);
    setLast5Traces((prev) => {
      const filtered = prev.filter((t) => t.victimAccount !== trace.victimAccount);
      return [trace, ...filtered].slice(0, 5);
    });
  };

  const handleSaveThresholds = (newThresholds: HeuristicThresholds) => {
    setThresholds(newThresholds);
    try {
      localStorage.setItem('abhedya_heuristic_thresholds', JSON.stringify(newThresholds));
    } catch {
      // Ignore
    }
  };

  const handleSaveLlmEndpoint = (endpoint: string) => {
    setLocalLlmEndpoint(endpoint);
    try {
      localStorage.setItem('abhedya_llm_endpoint', endpoint);
    } catch {
      // Ignore
    }
  };

  // Full-height split layout for #/login route
  if (currentRoute === '#/login') {
    return (
      <LoginPage
        onLoginSuccess={() => navigateTo('#/victim-query')}
        onContinueAsGuest={() => navigateTo('#/victim-query')}
      />
    );
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#F1F5F9] text-[#0F172A] antialiased">
      {/* Skip to Main Content Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-[4px] focus:bg-[#C9A227] focus:px-3 focus:py-2 focus:text-xs focus:font-semibold focus:text-[#0A1C36] focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Persistent Left Sidebar (Deep Police Navy) */}
      <Sidebar
        currentRoute={currentRoute}
        onNavigate={navigateTo}
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        isMobileOpen={isMobileDrawerOpen}
        onCloseMobile={() => setIsMobileDrawerOpen(false)}
        metrics={metrics}
        flaggedMuleCount={detectionResults.length}
        isDarkMode={false}
        onToggleDarkMode={() => {}}
      />

      {/* Main Content Area */}
      <div
        className={`flex flex-1 flex-col h-[100dvh] overflow-y-auto transition-all duration-200 bg-[#F1F5F9] ${
          isCollapsed ? 'md:ml-[64px]' : 'md:ml-[250px]'
        }`}
      >
        {/* Official Government of Madhya Pradesh & Police Commissionerate Top Bar (Desktop/Tablet) */}
        <div className="no-print hidden md:block w-full border-b border-[#CBD5E1] bg-white shadow-xs shrink-0">
          {/* Top Indian National Tricolor Ribbon */}
          <div className="h-1 w-full police-tricolor" aria-hidden="true" />

          <div className="flex h-11 items-center justify-between px-6 font-mono text-xs text-[#0F172A]">
            <div className="flex items-center gap-3">
              <img
                src="/images/police_emblem.svg"
                alt="Indore Police Emblem"
                className="h-6 w-6 shrink-0"
              />
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#0B2545] font-serif text-sm">
                  मध्यप्रदेश पुलिस | INDORE POLICE COMMISSIONERATE
                </span>
                <span className="text-[#94A3B8]">&middot;</span>
                <span className="text-[11px] font-semibold text-[#B45309]">
                  साइबर अपराध अनुसंधान सेल (1930)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-[11px]">
              <div className="flex items-center gap-1.5 bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] px-2.5 py-0.5 rounded-[4px] font-semibold">
                <span>हेल्पलाइन: 1930</span>
              </div>
              <div className="flex items-center gap-1.5 bg-[#EFF6FF] border border-[#BFDBFE] text-[#1E40AF] px-2.5 py-0.5 rounded-[4px] font-semibold">
                <span>आपातकालीन: 112</span>
              </div>
              <span className="text-[#64748B] text-[10px]">
                Sec 91 CrPC / 94 BNSS Legal Portal
              </span>
            </div>
          </div>
        </div>

        {/* Slim top bar on mobile */}
        <MobileTopBar onOpenMobileMenu={() => setIsMobileDrawerOpen(true)} />

        {/* Scrollable Page Content Container */}
        <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none pb-8 flex flex-col justify-between">
          <div>
            {(!currentRoute || currentRoute === '#/' || currentRoute === '#/ingest') && (
              <IngestPage
                engine={forensicEngine}
                onIngestSuccess={handleIngestSuccess}
                onNavigate={navigateTo}
              />
            )}

            {currentRoute === '#/victim-query' && (
              <VictimQueryPage
                engine={forensicEngine}
                last5Traces={last5Traces}
                activeTrace={activeTrace}
                onTraceCompleted={handleTraceCompleted}
                onSelectTraceTab={(t) => {
                  setActiveTrace(t);
                }}
                onSelectAccount={(acc) => {
                  setSelectedExplorerAccount(acc);
                }}
                onNavigate={navigateTo}
              />
            )}

            {currentRoute === '#/explorer' && (
              <AccountExplorerPage
                engine={forensicEngine}
                initialAccount={selectedExplorerAccount}
                onNavigateTrace={(acc) => {
                  navigateTo('#/victim-query');
                  setTimeout(() => {
                    forensicEngine.traceVictim(acc, 4).then((trace) => {
                      handleTraceCompleted(trace);
                    });
                  }, 50);
                }}
              />
            )}

            {currentRoute === '#/detection' && (
              <MuleDetectionPage
                engine={forensicEngine}
                thresholds={thresholds}
                onTraceAccount={(acc) => {
                  navigateTo('#/victim-query');
                  setTimeout(() => {
                    forensicEngine.traceVictim(acc, 4).then((trace) => {
                      handleTraceCompleted(trace);
                    });
                  }, 50);
                }}
                onSelectAccount={(acc) => {
                  setSelectedExplorerAccount(acc);
                  navigateTo('#/explorer');
                }}
                onOpenSettings={() => navigateTo('#/settings')}
                onDetectionRun={(res) => {
                  setDetectionResults(res);
                }}
              />
            )}

            {currentRoute === '#/evaluation' && (
              <EvaluationPage
                engine={forensicEngine}
                detectionResults={detectionResults}
                onRunScanFirst={() => navigateTo('#/detection')}
              />
            )}

            {currentRoute === '#/case-officer' && (
              <CaseOfficerPage
                engine={forensicEngine}
                activeTrace={activeTrace}
                onNavigateTrace={() => navigateTo('#/victim-query')}
                localLlmEndpoint={localLlmEndpoint}
              />
            )}

            {currentRoute === '#/settings' && (
              <SettingsPage
                thresholds={thresholds}
                onSaveThresholds={handleSaveThresholds}
                localLlmEndpoint={localLlmEndpoint}
                onSaveLocalLlmEndpoint={handleSaveLlmEndpoint}
              />
            )}

            {currentRoute === '#/dev/generator' && (
              <DevGeneratorPage
                engine={forensicEngine}
                onDatasetLoaded={(m) => {
                  handleIngestSuccess(m);
                  navigateTo('#/victim-query');
                }}
                onNavigateTrace={(victim) => {
                  navigateTo('#/victim-query');
                  setTimeout(() => {
                    forensicEngine.traceVictim(victim, 4).then((trace) => {
                      handleTraceCompleted(trace);
                    });
                  }, 50);
                }}
              />
            )}

            {currentRoute === '#/privacy' && <PrivacyPage />}

            {currentRoute === '#/terms' && <TermsPage />}

            {currentRoute === '#/detection-eval' && <DetectionEvalPage />}
          </div>

          {/* Official Department Footer */}
          <footer className="mt-12 border-t border-[#CBD5E1] bg-white text-xs font-mono text-[#475569] shadow-xs">
            {/* Tricolor Ribbon on top of footer */}
            <div className="h-1 w-full police-tricolor" aria-hidden="true" />
            <div className="py-6 px-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 max-w-7xl mx-auto">
                <div className="flex items-center gap-3">
                  <img
                    src="/images/police_emblem.svg"
                    alt="Indore Police Emblem"
                    className="h-6 w-6 shrink-0"
                  />
                  <div>
                    <span className="font-bold text-[#0B2545] block">
                      साइबर अपराध सेल, इन्दौर पुलिस कमिशनरेट (मध्यप्रदेश)
                    </span>
                    <span className="text-[11px] text-[#64748B]">
                      Operation Abhedya-Chakra &middot; For official law enforcement use only
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[11px]">
                  <a
                    href="#/detection-eval"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateTo('#/detection-eval');
                    }}
                    className="text-[#0B2545] font-semibold hover:text-[#B45309] hover:underline"
                  >
                    Detection Evaluation
                  </a>
                  <span className="text-[#CBD5E1]">&middot;</span>
                  <a
                    href="#/privacy"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateTo('#/privacy');
                    }}
                    className="text-[#0B2545] font-semibold hover:text-[#B45309] hover:underline"
                  >
                    Privacy Policy
                  </a>
                  <span className="text-[#CBD5E1]">&middot;</span>
                  <a
                    href="#/terms"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateTo('#/terms');
                    }}
                    className="text-[#0B2545] font-semibold hover:text-[#B45309] hover:underline"
                  >
                    Terms and Conditions
                  </a>
                </div>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

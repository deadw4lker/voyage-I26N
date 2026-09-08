import { Play, GitCompare, RefreshCw } from 'lucide-react';

export type OpsView = 'operations' | 'alerts';

interface SIHHeaderProps {
  onRunSimulation: () => void;
  onCompareRoutes: () => void;
  isLoading: boolean;
  view: OpsView;
  onViewChange: (view: OpsView) => void;
  alertCount: number;
}

export function SIHHeader({
  onRunSimulation,
  onCompareRoutes,
  isLoading,
  view,
  onViewChange,
  alertCount,
}: SIHHeaderProps) {
  return (
    <header className="border-b border-[#262626] bg-[#090909] px-4 py-2.5 sm:px-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#333333] bg-[#1c1c1c]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9c9c9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M15.5 8.5l-2 5-5 2 2-5z" fill="#c9c9c9" stroke="none" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h1 className="truncate text-[14px] font-semibold tracking-[-0.01em] text-slate-100">
                  Hima-Drishti
                </h1>
                <span className="hidden text-[12px] text-[#737373] sm:inline">·</span>
                <p className="truncate text-[12px] text-[#8b98ad]">
                  Antarctic routing · Prydz Bay sector
                </p>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2e2e2e] bg-[#141414] px-2 py-0.5 text-[10.5px] font-medium text-[#8b98ad]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Operational
                </span>
              </div>
            </div>
          </div>

          <nav aria-label="Views" className="flex items-center gap-0.5 rounded-lg border border-[#2e2e2e] bg-[#141414] p-0.5">
            {(['operations', 'alerts'] as const).map((v) => (
              <button
                key={v}
                onClick={() => onViewChange(v)}
                aria-current={view === v ? 'page' : undefined}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium capitalize transition-colors ${
                  view === v ? 'bg-[#2a2a2a] text-slate-100' : 'text-[#8b98ad] hover:text-slate-200'
                }`}
              >
                {v}
                {v === 'alerts' && alertCount > 0 && (
                  <span className="tabular rounded-full bg-[#8f2f35] px-1.5 py-px text-[10px] font-semibold text-white">
                    {alertCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onCompareRoutes}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-lg border border-[#333333] bg-transparent px-3 py-1.5 text-[12.5px] font-medium text-slate-200 transition-colors hover:border-[#404040] hover:bg-[#1c1c1c] disabled:opacity-50"
            >
              <GitCompare className="h-3.5 w-3.5 text-[#c9c9c9]" />
              Compare
            </button>

            <button
              onClick={onRunSimulation}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-black transition-colors hover:bg-neutral-200 disabled:opacity-60"
            >
              {isLoading ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current" />
              )}
              {isLoading ? 'Running…' : 'Run simulation'}
            </button>
        </div>
      </div>
    </header>
  );
}

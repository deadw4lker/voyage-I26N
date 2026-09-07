import { Play, GitCompare, RefreshCw } from 'lucide-react';

interface SIHHeaderProps {
  onRunSimulation: () => void;
  onCompareRoutes: () => void;
  isLoading: boolean;
  activePreset: string;
  onPresetSelect: (preset: string) => void;
}

export function SIHHeader({
  onRunSimulation,
  onCompareRoutes,
  isLoading,
  activePreset,
  onPresetSelect,
}: SIHHeaderProps) {
  return (
    <header className="border-b border-[#1e2b45] bg-[#0c1527] px-4 py-2.5 sm:px-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#2a3c5c] bg-[#13203a]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8fb8d8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M15.5 8.5l-2 5-5 2 2-5z" fill="#8fb8d8" stroke="none" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="truncate text-[14px] font-semibold tracking-[-0.01em] text-slate-100">
                Hima-Drishti
              </h1>
              <span className="hidden text-[12px] text-[#5c6b84] sm:inline">·</span>
              <p className="truncate text-[12px] text-[#8b98ad]">
                Antarctic routing · Prydz Bay sector
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#24344f] bg-[#0f1c33] px-2 py-0.5 text-[10.5px] font-medium text-[#8b98ad]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Operational
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Scenario"
            className="flex items-center gap-0.5 rounded-lg border border-[#24344f] bg-[#0a1222] p-0.5"
          >
            {['Prydz Bay Patrol', 'Bharati Supply', 'Severe Pack Ice'].map((preset) => (
              <button
                key={preset}
                role="tab"
                aria-selected={activePreset === preset}
                onClick={() => onPresetSelect(preset)}
                className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                  activePreset === preset
                    ? 'bg-[#1c2f4f] text-slate-100 shadow-sm'
                    : 'text-[#8b98ad] hover:text-slate-200'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onCompareRoutes}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-lg border border-[#2a3c5c] bg-transparent px-3 py-1.5 text-[12.5px] font-medium text-slate-200 transition-colors hover:border-[#3a4f75] hover:bg-[#13203a] disabled:opacity-50"
            >
              <GitCompare className="h-3.5 w-3.5 text-[#8fb8d8]" />
              Compare
            </button>

            <button
              onClick={onRunSimulation}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-lg bg-[#dbe7f3] px-3.5 py-1.5 text-[12.5px] font-semibold text-[#0c1527] transition-colors hover:bg-white disabled:opacity-60"
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
      </div>
    </header>
  );
}

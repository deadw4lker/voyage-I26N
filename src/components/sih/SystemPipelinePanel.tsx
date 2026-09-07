import { useState } from 'react';
import type { PipelineStage, DataHealth } from '../../types/sih';
import { ChevronDown } from 'lucide-react';

interface SystemPipelinePanelProps {
  stages: PipelineStage[];
  health?: DataHealth[];
}

export function SystemPipelinePanel({ stages, health }: SystemPipelinePanelProps) {
  const [open, setOpen] = useState(false);

  const defaultStages = [
    { stage: 'Data ingestion', status: 'ACTIVE', latency_ms: 12 },
    { stage: 'Data harmonization', status: 'ACTIVE', latency_ms: 18 },
    { stage: 'Feature engineering', status: 'ACTIVE', latency_ms: 24 },
    { stage: 'Monte Carlo ensemble', status: 'ACTIVE', latency_ms: 140 },
    { stage: 'Lagrangian advection', status: 'ACTIVE', latency_ms: 45 },
    { stage: 'Trajectory cone', status: 'ACTIVE', latency_ms: 30 },
    { stage: 'Weighted overlay', status: 'ACTIVE', latency_ms: 15 },
    { stage: 'Risk map', status: 'ACTIVE', latency_ms: 22 },
    { stage: 'Route search (A*)', status: 'ACTIVE', latency_ms: 35 },
  ];

  const activeStages = stages && stages.length > 0 ? stages : defaultStages;
  const totalMs = activeStages.reduce((sum, s) => sum + (s.latency_ms || 0), 0);
  const liveCount = (health || []).filter((h) => h.live).length;

  return (
    <section className="ops-card p-4">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span>
            <span className="block text-[13px] font-medium text-slate-100">Systems normal</span>
            <span className="tabular block text-[11.5px] text-[#737373]">
              {activeStages.length} stages · {totalMs} ms
              {health && health.length > 0 && ` · ${liveCount} live feeds`}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-1 text-[12px] text-[#8b98ad]">
          {open ? 'Hide' : 'Details'}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-1 border-t border-[#1e1e1e] pt-3">
          {activeStages.map((item) => (
            <div key={item.stage} className="flex items-center justify-between py-1 text-[12px]">
              <span className="text-slate-300">{item.stage}</span>
              <span className="tabular text-[#737373]">{item.latency_ms} ms</span>
            </div>
          ))}

          {health && health.length > 0 && (
            <>
              <p className="pt-2 text-[11px] font-medium uppercase tracking-wide text-[#737373]">
                Live feeds
              </p>
              {health.map((h) => (
                <div key={h.layer} className="flex items-center justify-between gap-2 py-1 text-[12px]">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${h.live ? 'bg-emerald-400' : 'bg-neutral-600'}`} />
                    <span className="truncate text-slate-300">{h.layer}</span>
                  </span>
                  <span className="tabular shrink-0 text-[11px] text-[#737373]">
                    {h.live ? `Live${h.updated ? ` · ${h.updated}` : ''}` : 'Synthetic'}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </section>
  );
}

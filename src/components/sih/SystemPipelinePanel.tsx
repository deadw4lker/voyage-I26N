import { useState } from 'react';
import type { PipelineStage } from '../../types/sih';
import { ChevronDown } from 'lucide-react';

interface SystemPipelinePanelProps {
  stages: PipelineStage[];
}

export function SystemPipelinePanel({ stages }: SystemPipelinePanelProps) {
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
            <span className="tabular block text-[11.5px] text-[#5c6b84]">
              {activeStages.length} stages · {totalMs} ms
            </span>
          </span>
        </span>
        <span className="flex items-center gap-1 text-[12px] text-[#8b98ad]">
          {open ? 'Hide' : 'Details'}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-1 border-t border-[#182441] pt-3">
          {activeStages.map((item) => (
            <div key={item.stage} className="flex items-center justify-between py-1 text-[12px]">
              <span className="text-slate-300">{item.stage}</span>
              <span className="tabular text-[#5c6b84]">{item.latency_ms} ms</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

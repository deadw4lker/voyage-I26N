import type { RouteResponse, RouteComparisonResponse, IcebergData, SystemStatus } from '../../types/sih';
import { SystemPipelinePanel } from './SystemPipelinePanel';

export type RouteOptionKey = 'fastest' | 'safest' | 'balanced';

interface SIHRightSidebarProps {
  activeRoute: RouteResponse | null;
  routeComparison: RouteComparisonResponse | null;
  icebergs: IcebergData[];
  predictionConfidence: number;
  uncertaintyRadiusKm: number;
  systemStatus: SystemStatus | null;
  selectedOption: RouteOptionKey;
  onSelectOption: (key: RouteOptionKey) => void;
}

function riskMeta(level: string) {
  switch (level) {
    case 'EXTREME':
    case 'VERY HIGH':
      return { dot: 'bg-rose-400', text: 'text-rose-300', pill: 'border-rose-900/60 bg-rose-950/40 text-rose-200' };
    case 'HIGH':
      return { dot: 'bg-orange-400', text: 'text-orange-300', pill: 'border-orange-900/60 bg-orange-950/40 text-orange-200' };
    case 'MODERATE':
      return { dot: 'bg-amber-300', text: 'text-amber-200', pill: 'border-amber-900/60 bg-amber-950/30 text-amber-100' };
    default:
      return { dot: 'bg-emerald-400', text: 'text-emerald-300', pill: 'border-emerald-900/60 bg-emerald-950/40 text-emerald-200' };
  }
}

function StatRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <span className="text-[12.5px] text-[#8b98ad]">{label}</span>
      <span className="text-right">
        <span className="tabular block text-[13px] font-medium text-slate-100">{value}</span>
        {sub && <span className="block text-[11px] text-[#5c6b84]">{sub}</span>}
      </span>
    </div>
  );
}

export function SIHRightSidebar({
  activeRoute,
  routeComparison,
  icebergs,
  predictionConfidence,
  uncertaintyRadiusKm,
  systemStatus,
  selectedOption,
  onSelectOption,
}: SIHRightSidebarProps) {
  const highRiskCount = icebergs.filter((b) => b.risk_rating >= 60).length;

  const comparison = routeComparison
    ? ([
        { key: 'fastest', label: 'Fastest', note: 'Shortest time', data: routeComparison.fastest },
        { key: 'balanced', label: 'Balanced', note: 'Recommended', data: routeComparison.balanced },
        { key: 'safest', label: 'Safest', note: 'Widest margin', data: routeComparison.safest },
      ] as const)
    : null;

  const activeMeta = activeRoute ? riskMeta(activeRoute.risk_level) : null;

  return (
    <aside className="w-full shrink-0 border-t border-[#1e2b45] bg-[#0c1527] lg:w-[320px] lg:border-t-0 lg:border-l lg:overflow-y-auto lg:min-h-0">
      <div className="space-y-3 p-3.5">
        {/* Active route */}
        <section className="ops-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="ops-section-title">Active route</h2>
            {activeRoute && activeMeta && (
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${activeMeta.pill}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${activeMeta.dot}`} />
                {activeRoute.risk_level.charAt(0) + activeRoute.risk_level.slice(1).toLowerCase()}
              </span>
            )}
          </div>

          {activeRoute ? (
            <div className="mt-3">
              <div className="flex items-baseline justify-between">
                <span className="tabular text-[26px] font-semibold tracking-tight text-slate-50">
                  {(activeRoute.risk_score * 100).toFixed(0)}
                </span>
                <span className="text-[12px] text-[#5c6b84]">risk score / 100 · {activeRoute.mode}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#1c2a46]">
                <div
                  className="h-full rounded-full bg-[#6aa9d6]"
                  style={{ width: `${Math.min(100, Math.max(2, activeRoute.risk_score * 100))}%` }}
                />
              </div>

              <div className="mt-2 divide-y divide-[#182441]">
                <StatRow label="Distance" value={`${activeRoute.distance_km.toFixed(0)} km`} />
                <StatRow label="Travel time" value={`${activeRoute.estimated_time_hours.toFixed(1)} h`} sub={`at 14 kn`} />
                <StatRow label="Safety margin" value={`${activeRoute.safety_margin_percent.toFixed(0)}%`} />
                <StatRow label="Iceberg zones" value={`${activeRoute.iceberg_encounters}`} sub="cells crossed" />
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-[#2a3c5c] px-3 py-5 text-center">
              <p className="text-[13px] text-slate-200">No route yet</p>
              <p className="mx-auto mt-1 max-w-[220px] text-[12px] leading-relaxed text-[#5c6b84]">
                Run a simulation to calculate the safest passage to Bharati Station.
              </p>
            </div>
          )}
        </section>

        {/* Conditions */}
        <section className="ops-card p-4">
          <h2 className="ops-section-title">Ice conditions</h2>
          <p className="ops-section-sub mt-0.5">Live iceberg tracking and forecast quality.</p>
          <div className="mt-1 divide-y divide-[#182441]">
            <StatRow label="Tracked bergs" value={`${icebergs.length}`} />
            <StatRow label="High risk" value={`${highRiskCount}`} sub={highRiskCount > 0 ? 'needs attention' : 'none critical'} />
            <StatRow label="Forecast confidence" value={`${predictionConfidence.toFixed(0)}%`} />
            <StatRow label="Uncertainty" value={`±${uncertaintyRadiusKm.toFixed(1)} km`} />
          </div>
        </section>

        {/* Comparison */}
        <section className="ops-card p-4">
          <h2 className="ops-section-title">Route options</h2>
          <p className="ops-section-sub mt-0.5">
            {comparison ? 'Compare trade-offs before committing.' : 'Run Compare to see three alternatives side by side.'}
          </p>

          {comparison ? (
            <div className="mt-3 space-y-1.5" role="radiogroup" aria-label="Route options">
              {comparison.map((opt) => {
                const m = riskMeta(opt.data.risk_level);
                const selected = selectedOption === opt.key;
                return (
                  <button
                    key={opt.key}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onSelectOption(opt.key)}
                    className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      selected
                        ? 'border-[#3d6a94] bg-[#13233d]'
                        : 'border-[#1e2b45] bg-[#0a1222] hover:border-[#2a3c5c]'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${m.dot}`} />
                        <span className="text-[13px] font-medium text-slate-100">{opt.label}</span>
                        {opt.key === 'balanced' && (
                          <span className="rounded-full bg-[#1c2f4f] px-1.5 py-px text-[10.5px] font-medium text-[#8fb8d8]">
                            Recommended
                          </span>
                        )}
                      </span>
                      <span className={`text-[11px] font-medium ${m.text}`}>
                        {opt.data.risk_level.charAt(0) + opt.data.risk_level.slice(1).toLowerCase()}
                      </span>
                    </span>
                    <span className="tabular mt-1 block text-[12px] text-[#8b98ad]">
                      {opt.data.distance_km.toFixed(0)} km · {opt.data.estimated_time_hours.toFixed(1)} h · {(opt.data.risk_score * 100).toFixed(0)} risk
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-[#2a3c5c] px-3 py-4 text-center text-[12px] text-[#5c6b84]">
              Fastest, balanced and safest will appear here.
            </div>
          )}
        </section>

        {/* System */}
        <SystemPipelinePanel stages={systemStatus?.pipeline_stages || []} />
      </div>
    </aside>
  );
}

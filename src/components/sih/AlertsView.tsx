import { useState } from 'react';
import { BellRing, CheckCheck } from 'lucide-react';
import type { AlertItem, AlertSeverity } from '../../lib/alerts';

interface AlertsViewProps {
  alerts: AlertItem[];
  acknowledged: Set<string>;
  onAcknowledge: (id: string) => void;
  onAcknowledgeAll: () => void;
}

const FILTERS: { id: AlertSeverity | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'critical', label: 'Critical' },
  { id: 'warning', label: 'Warnings' },
  { id: 'info', label: 'Info' },
];

function severityStyle(sev: AlertSeverity) {
  switch (sev) {
    case 'critical':
      return { dot: 'bg-rose-400', pill: 'border-rose-900/60 bg-rose-950/40 text-rose-200', label: 'Critical' };
    case 'warning':
      return { dot: 'bg-amber-300', pill: 'border-amber-900/60 bg-amber-950/30 text-amber-100', label: 'Warning' };
    default:
      return { dot: 'bg-sky-400', pill: 'border-[#2a3c5c] bg-[#0f1c33] text-[#8fb8d8]', label: 'Info' };
  }
}

export function AlertsView({ alerts, acknowledged, onAcknowledge, onAcknowledgeAll }: AlertsViewProps) {
  const [filter, setFilter] = useState<AlertSeverity | 'all'>('all');
  const visible = alerts.filter((a) => filter === 'all' || a.severity === filter);
  const unacked = alerts.filter((a) => !acknowledged.has(a.id)).length;

  return (
    <div className="mx-auto w-full max-w-[880px] flex-1 overflow-y-auto px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-slate-50">Alerts</h2>
          <p className="mt-0.5 text-[12.5px] text-[#8b98ad]">
            {alerts.length === 0
              ? 'No active alerts. Conditions are within limits.'
              : `${unacked} of ${alerts.length} need review · derived from live risk, route and forecast state.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-[#24344f] bg-[#0a1222] p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                  filter === f.id ? 'bg-[#1c2f4f] text-slate-100' : 'text-[#8b98ad] hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {unacked > 0 && (
            <button
              onClick={onAcknowledgeAll}
              className="flex items-center gap-1.5 rounded-lg border border-[#2a3c5c] px-3 py-1.5 text-[12.5px] font-medium text-slate-200 hover:border-[#3a4f75] hover:bg-[#13203a]"
            >
              <CheckCheck className="h-3.5 w-3.5 text-[#8fb8d8]" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="ops-card mt-4 px-4 py-12 text-center">
          <BellRing className="mx-auto h-6 w-6 text-[#5c6b84]" />
          <p className="mt-2 text-[13.5px] font-medium text-slate-200">Nothing here</p>
          <p className="mx-auto mt-1 max-w-[300px] text-[12.5px] text-[#5c6b84]">
            {alerts.length === 0 ? 'The sector is quiet for now.' : 'No alerts match this filter.'}
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {visible.map((alert) => {
            const st = severityStyle(alert.severity);
            const acked = acknowledged.has(alert.id);
            return (
              <li
                key={alert.id}
                className={`ops-card flex items-start gap-3 p-4 transition-opacity ${acked ? 'opacity-55' : ''}`}
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${st.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13.5px] font-medium text-slate-100">{alert.title}</p>
                    <span className={`rounded-full border px-1.5 py-px text-[10.5px] font-medium ${st.pill}`}>
                      {st.label}
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-[#8b98ad]">{alert.detail}</p>
                  <p className="tabular mt-1.5 text-[11px] text-[#5c6b84]">Source: {alert.source}</p>
                </div>
                {!acked && (
                  <button
                    onClick={() => onAcknowledge(alert.id)}
                    className="shrink-0 rounded-md px-2 py-1 text-[12px] font-medium text-[#8b98ad] hover:bg-[#182441] hover:text-slate-200"
                  >
                    Acknowledge
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-[11.5px] leading-relaxed text-[#5c6b84]">
        Simulation output for demonstration — not an operational warning system. Validate against
        official ice charts before navigation decisions.
      </p>
    </div>
  );
}

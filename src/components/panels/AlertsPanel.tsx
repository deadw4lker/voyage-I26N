import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import type { AlertItem } from '../../types';

interface AlertsPanelProps {
  title: string;
  viewAllLabel: string;
  alerts: AlertItem[];
  onViewAll: () => void;
}

const severityDotColors: Record<string, string> = {
  crit: 'bg-[#991b1b]',
  warn: 'bg-[#b45309]',
  info: 'bg-[#64748b]',
};

export function AlertsPanel({ title, viewAllLabel, alerts, onViewAll }: AlertsPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        <a href="#" className="hint hover:text-ice transition-colors" onClick={(e) => { e.preventDefault(); onViewAll(); }}>
          {viewAllLabel}
        </a>
      </div>

      <div className="space-y-0">
        {alerts.map((alert) => {
          const dotColorClass = severityDotColors[alert.severity];

          return (
            <div
              key={alert.id}
              className={cn(
                'flex items-start gap-2.5 py-2.5 border-b border-border last:border-0 last:pb-0',
                alert.acknowledged && 'opacity-50'
              )}
            >
              <span className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', dotColorClass)} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-ice mb-0.5" dangerouslySetInnerHTML={{ __html: t(alert.title) }} />
                <div className="text-[11.5px] text-ice-faint">{alert.meta}</div>
              </div>
              {!alert.acknowledged && (
                <button
                  className="text-[11.5px] font-medium px-2.5 py-1 rounded-md border border-border bg-white text-ice-dim hover:text-ice hover:border-border-strong transition-colors flex-shrink-0"
                  onClick={() => {}}
                >
                  {t('common.acknowledge')}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

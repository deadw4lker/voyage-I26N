import { useTranslation } from 'react-i18next';
import { SingleSelectChips } from '../components/ui/SingleSelectChips';
import { Badge } from '../components/ui/Badge';
import type { AlertItem } from '../types';

const severityDotColors: Record<string, string> = {
  crit: 'bg-[#991b1b]',
  warn: 'bg-[#b45309]',
  info: 'bg-[#64748b]',
};

interface AlertsViewProps {
  alerts: AlertItem[];
  filter: 'all' | 'crit' | 'warn' | 'info';
  setFilter: (filter: 'all' | 'crit' | 'warn' | 'info') => void;
  acknowledgeAlert: (id: string) => void;
}

export function AlertsView({ alerts, filter, setFilter, acknowledgeAlert }: AlertsViewProps) {
  const { t } = useTranslation();

  const filterOptions = [
    { value: 'all', label: t('alerts.filter.all') },
    { value: 'crit', label: t('alerts.filter.crit') },
    { value: 'warn', label: t('alerts.filter.warn') },
    { value: 'info', label: t('alerts.filter.info') },
  ];

  const handleFilterChange = (value: string) => {
    setFilter(value as 'all' | 'crit' | 'warn' | 'info');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4">
        <div className="panel">
          <div className="panel-head">
            <h2>{t('alerts.title')}</h2>
            <SingleSelectChips options={filterOptions} defaultValue={filter} onChange={handleFilterChange} />
          </div>

          <div id="alertList" className="space-y-0">
            {alerts.map((alert) => {
              const dotColorClass = severityDotColors[alert.severity];

              return (
                <div
                  key={alert.id}
                  className={`flex items-start gap-2.5 py-2.5 border-b border-border last:border-0 last:pb-0 ${alert.acknowledged ? 'opacity-50' : ''}`}
                  data-sev={alert.severity}
                >
                  <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dotColorClass}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-ice mb-0.5" dangerouslySetInnerHTML={{ __html: t(alert.title) }} />
                    <div className="text-[11.5px] text-ice-faint">{alert.meta}</div>
                  </div>
                  {!alert.acknowledged && (
                    <button
                      className="text-[11.5px] font-medium px-2.5 py-1 rounded-md border border-border bg-white text-ice-dim hover:text-ice hover:border-border-strong transition-colors flex-shrink-0"
                      onClick={() => acknowledgeAlert(alert.id)}
                    >
                      {t('common.acknowledge')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel">
            <div className="panel-head">
              <h2>{t('alerts.comms.title')}</h2>
              <Badge>{t('alerts.comms.status')}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 gap-x-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-ice-faint">{t('alerts.comms.link')}</span>
                <span className="text-[13px] text-ice">{t('alerts.comms.linkValue')}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-ice-faint">{t('alerts.comms.latency')}</span>
                <span className="text-[13px] text-ice" style={{ fontVariantNumeric: 'tabular-nums' }}>{t('alerts.comms.latencyValue')}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-ice-faint">{t('alerts.comms.bandwidth')}</span>
                <span className="text-[13px] text-ice" style={{ fontVariantNumeric: 'tabular-nums' }}>{t('alerts.comms.bandwidthValue')}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-ice-faint">{t('alerts.comms.autoEscalate')}</span>
                <span className="text-[13px] text-ice-dim">{t('alerts.comms.autoEscalateValue')}</span>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>{t('alerts.escalation.title')}</h2>
            </div>
            <div className="text-[13px] text-ice-dim leading-relaxed" dangerouslySetInnerHTML={{ __html: t('alerts.escalation.text') }} />
          </div>
        </div>
      </div>
    </div>
  );
}

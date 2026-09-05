import { useTranslation } from 'react-i18next';
import { KPICard } from '../components/ui/KPICard';
import { FuelTrendChart } from '../components/charts/FuelTrendChart';
import { Badge } from '../components/ui/Badge';

export function LogView() {
  const { t } = useTranslation();

  const kpiData = [
    {
      label: t('log.kpi.voyages'),
      value: 6,
      delta: t('log.kpi.voyagesDelta') || 'This austral season',
      deltaType: 'up' as const,
    },
    {
      label: t('log.kpi.distance'),
      value: '3,840',
      unit: 'nm',
      delta: t('log.kpi.distanceDelta') || 'Across all voyages',
      deltaType: 'up' as const,
    },
    {
      label: t('log.kpi.fuelSaved'),
      value: 18.4,
      unit: '%',
      delta: t('log.kpi.fuelSavedDelta') || 'Vs. static route plans',
      deltaType: 'up' as const,
    },
    {
      label: t('log.kpi.accuracy'),
      value: 92,
      unit: '%',
      delta: t('log.kpi.accuracyDelta') || 'Mean, 7-day horizon',
      deltaType: 'up' as const,
    },
  ];

  const voyages = [
    { date: t('log.history.voyage1'), route: t('log.history.route1'), duration: t('log.history.duration1'), routing: 'AI', outcome: t('log.history.outcome1') },
    { date: t('log.history.voyage2'), route: t('log.history.route2'), duration: t('log.history.duration2'), routing: 'AI', outcome: t('log.history.outcome2') },
    { date: t('log.history.voyage3'), route: t('log.history.route3'), duration: t('log.history.duration3'), routing: 'Manual', outcome: t('log.history.outcome3') },
    { date: t('log.history.voyage4'), route: t('log.history.route4'), duration: t('log.history.duration4'), routing: 'AI', outcome: t('log.history.outcome4') },
    { date: t('log.history.voyage5'), route: t('log.history.route5'), duration: t('log.history.duration5'), routing: 'AI', outcome: t('log.history.outcome5') },
    { date: t('log.history.voyage6'), route: t('log.history.route6'), duration: t('log.history.duration6'), routing: 'Manual', outcome: t('log.history.outcome6') },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" role="region" aria-label="Season Overview">
        {kpiData.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4">
        <div className="panel">
          <div className="panel-head">
            <h2>{t('log.history.title')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl w-full" role="grid" aria-label={t('log.history.title')}>
              <thead>
                <tr>
                  <th scope="col">{t('log.history.date')}</th>
                  <th scope="col">{t('log.history.route')}</th>
                  <th scope="col">{t('log.history.duration')}</th>
                  <th scope="col">{t('log.history.routing')}</th>
                  <th scope="col">{t('log.history.outcome')}</th>
                </tr>
              </thead>
              <tbody>
                {voyages.map((voyage, index) => (
                  <tr key={index}>
                    <td className="text-ice" style={{ fontVariantNumeric: 'tabular-nums' }}>{voyage.date}</td>
                    <td className="text-ice-dim">{voyage.route}</td>
                    <td className="text-ice" style={{ fontVariantNumeric: 'tabular-nums' }}>{voyage.duration}</td>
                    <td>
                      <Badge>{voyage.routing}</Badge>
                    </td>
                    <td className="text-ice-dim">{voyage.outcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <FuelTrendChart
          title={t('log.chart.title')}
          hint={t('log.chart.hint')}
        />
      </div>
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import { Badge } from '../ui/Badge';

interface DataSourcesPanelProps {
  sources?: { name: string; badge: string }[];
}

export function DataSourcesPanel({ sources }: DataSourcesPanelProps) {
  const { t } = useTranslation();

  const rows = sources ?? [
    { name: t('forecast.sources.sentinel'), badge: t('forecast.badge.live') },
    { name: t('forecast.sources.amsr2'), badge: t('forecast.badge.live') },
    { name: t('forecast.sources.modis'), badge: t('forecast.badge.live') },
    { name: t('forecast.sources.era5'), badge: t('forecast.badge.live') },
  ];

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{t('forecast.sources.title')}</h2>
      </div>
      <ul className="list-none flex flex-col">
          {rows.map((source) => (
          <li
            key={source.name}
            className="flex justify-between items-center text-[13px] text-ice-dim py-2.5 border-b border-border last:border-0 last:pb-0 first:pt-0"
          >
            <span>{source.name}</span>
            <Badge>{source.badge}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

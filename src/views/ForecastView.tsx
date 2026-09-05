import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataSourcesPanel } from '../components/panels/DataSourcesPanel';
import { ConfidenceChart } from '../components/charts/ConfidenceChart';
import { SingleSelectChips } from '../components/ui/SingleSelectChips';
import { IceMap } from '../components/maps/IceMap';
import { useIceWindow } from '../hooks/useIce';
import { projectGrid, confidenceForLead, formatIceDate, gridMean } from '../lib/ice';

const VESSEL_POS: [number, number] = [-67.14, 45.82];

export function ForecastView() {
  const { t } = useTranslation();
  const [day, setDay] = useState('0');
  const [source, setSource] = useState('oisst');

  const feed = useIceWindow({ minLat: -75, maxLat: -55, minLon: 25, maxLon: 85, stride: 2, days: 7 });
  const leadDays = Number(day);
  const isProjection = leadDays > 0;
  const w = feed.state === 'ready' ? feed.data : null;

  const dayOptions = [
    { value: '0', label: t('forecast.chips.today') },
    { value: '3', label: t('forecast.chips.plus3') },
    { value: '7', label: t('forecast.chips.plus7') },
    { value: '14', label: t('forecast.chips.plus14') },
  ];

  const sourceOptions = [
    { value: 'oisst', label: t('forecast.source.oisst') },
    { value: 'nsidc', label: t('forecast.source.nsidc'), disabled: true, tag: t('forecast.source.soon') },
    { value: 'viirs', label: t('forecast.source.viirs'), disabled: true, tag: t('forecast.source.soon') },
  ];

  const grid = useMemo(() => {
    if (!w || source !== 'oisst') return null;
    if (!isProjection) return w.ice[w.ice.length - 1];
    return projectGrid(w, leadDays);
  }, [w, isProjection, leadDays, source]);

  const dayMean = grid ? gridMean(grid) : null;
  const dayLabel = leadDays === 0 ? 'D0' : `D+${leadDays}`;
  const info = w
    ? `${dayLabel} · ${isProjection ? t('forecast.badge.projection') : t('forecast.badge.live')} · ${t('forecast.map.title')} ${dayMean === null ? '—' : `${Math.round(dayMean * 100)}%`}`
    : '';
  const probeTag = `${dayLabel} ${isProjection ? t('forecast.badge.projection').toLowerCase() : t('forecast.badge.live').toLowerCase()}`;

  const confidence = useMemo(() => {
    if (!w) return undefined;
    return Array.from({ length: 15 }, (_, lead) => ({
      label: lead === 0 ? 'D0' : `D${lead}`,
      value: confidenceForLead(w, lead),
    }));
  }, [w]);

  const sourceRows = useMemo(() => {
    if (!feed.status) return undefined;
    const names: Record<string, string> = {
      oisst: t('forecast.source.oisst'),
      nsidc: t('forecast.source.nsidc'),
      viirs: t('forecast.source.viirs'),
    };
    return feed.status.sources.map((s) => ({
      name: `${names[s.id] ?? s.name} · ${s.detail}`,
      badge: s.live ? t('forecast.badge.live') : t('forecast.source.soon'),
    }));
  }, [feed.status, t]);

  const hint =
    w
      ? t('forecast.updated', { date: formatIceDate(w.date) })
      : feed.state === 'error'
        ? t('forecast.offline')
        : t('forecast.hint');

  return (
    <div className="space-y-4">
      <div className="panel">
        <div className="panel-head">
          <h2>{t('forecast.title')}</h2>
          <span className="hint">{hint}</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <SingleSelectChips options={dayOptions} defaultValue="0" onChange={setDay} />
          {feed.state === 'error' && (
            <button className="btn ghost" onClick={feed.retry}>
              {t('common.retry')}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1.05fr] gap-4 items-start">
        <div className="panel hero">
          <div className="p-4 pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-wrap">
            <span className="flex items-center gap-2">
              <h2 className="text-[14px] font-semibold text-ice">{t('forecast.map.title')}</h2>
              <span className="badge">{isProjection ? t('forecast.badge.projection') : t('forecast.badge.live')}</span>
            </span>
            <SingleSelectChips options={sourceOptions} defaultValue="oisst" onChange={setSource} />
          </div>

          {feed.state === 'loading' || feed.state === 'idle' ? (
            <div className="animate-pulse bg-[#e8edf2]" style={{ aspectRatio: '4/3' }} role="status" aria-label={t('forecast.map.title')} />
          ) : grid && w ? (
            <IceMap
              lats={w.lats}
              lons={w.lons}
              grid={grid}
              info={info}
              probeTag={probeTag}
              vesselPos={VESSEL_POS}
              vesselLabel={t('vessel.name')}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 px-4 py-14 text-center" style={{ aspectRatio: '4/3' }}>
              <p className="text-[13px] text-ice-dim max-w-[320px]">{t('forecast.offline')}</p>
              <button className="btn primary" onClick={feed.retry}>
                {t('common.retry')}
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 px-4 py-3.5 border-t border-border">
            <span className="text-[11px] text-ice-dim" style={{ fontVariantNumeric: 'tabular-nums' }}>{t('forecast.map.legend.min')}</span>
            <div className="flex-1 h-2 rounded-full bg-[#e2e8f0] overflow-hidden">
              <div className="h-full w-full" style={{ background: 'linear-gradient(90deg, #e2e8f0, #94a3b8, #475569, #1f3a5f)' }} />
            </div>
            <span className="text-[11px] text-ice-dim" style={{ fontVariantNumeric: 'tabular-nums' }}>{t('forecast.map.legend.max')}</span>
          </div>
        </div>

        <div className="space-y-4">
          <DataSourcesPanel sources={sourceRows} />
          <ConfidenceChart
            title={t('forecast.confidence.title')}
            hint={t('forecast.confidence.hint')}
            data={confidence}
          />
        </div>
      </div>
    </div>
  );
}

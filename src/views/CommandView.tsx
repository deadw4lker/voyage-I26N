import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn, pathDistanceNm, formatVoyageDuration, estimateFuelKl } from '../lib/utils';
import { KPICard } from '../components/ui/KPICard';
import { PolarMap } from '../components/maps/PolarMap';
import { AIRecommendationCard } from '../components/cards/AIRecommendationCard';
import { IceTrendChart } from '../components/charts/IceTrendChart';
import { SafetyBreakdownChart } from '../components/charts/SafetyBreakdownChart';
import { Badge } from '../components/ui/Badge';
import { SingleSelectChips } from '../components/ui/SingleSelectChips';
import type { AlertItem } from '../types';

interface CommandViewProps {
  alerts: AlertItem[];
  showToast: (message: string) => void;
}

type LatLon = [number, number];
type OriginMode = 'live' | 'ports';

const VESSEL_POS: LatLon = [-67.14, 45.82];

const PORTS: { id: string; key: string; pos: LatLon }[] = [
  { id: 'capetown', key: 'ports.capetown', pos: [-33.9249, 18.4241] },
  { id: 'portlouis', key: 'ports.portlouis', pos: [-20.1619, 57.4989] },
  { id: 'maitri', key: 'ports.maitri', pos: [-70.7655, 11.755] },
  { id: 'bharati', key: 'ports.bharati', pos: [-69.4047, 76.1857] },
];

const ROUTE_META = [
  { id: 'ai', key: 'aioptimized', safetyScore: 91, color: '#1f3a5f', recommended: true },
  { id: 'direct', key: 'directroute', safetyScore: 54, color: '#94a3b8', recommended: false },
  { id: 'conservative', key: 'conservative', safetyScore: 97, color: '#475569', recommended: false },
];

function lerp(a: LatLon, b: LatLon, t: number): LatLon {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function buildRoutePaths(origin: LatLon, dest: LatLon): Record<string, LatLon[]> {
  const dLat = dest[0] - origin[0];
  const dLon = dest[1] - origin[1];
  const len = Math.hypot(dLat, dLon) || 1;
  // Perpendicular, forced to bulge toward safer (more northern) water
  const px = -dLon / len;
  const py = dLat / len;
  const s = px >= 0 ? 1 : -1;

  const ai = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => {
    const [la, lo] = lerp(origin, dest, t);
    const mag = Math.sin(Math.PI * t) * len * 0.07 * s;
    return [la + px * mag, lo + py * mag] as LatLon;
  });

  const direct: LatLon[] = [origin, lerp(origin, dest, 0.5), dest];

  const conservative = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const [la, lo] = lerp(origin, dest, t);
    return [Math.min(la + Math.sin(Math.PI * t) * 4, -45), lo] as LatLon;
  });

  return { ai, direct, conservative };
}

const selectClass =
  'mt-1.5 w-full border border-border rounded-md bg-white text-[13px] px-2.5 py-2 text-ice outline-none focus:border-border-strong';

export function CommandView({ showToast }: CommandViewProps) {
  const { t } = useTranslation();
  const [originMode, setOriginMode] = useState<OriginMode>('live');
  const [originPortId, setOriginPortId] = useState('capetown');
  const [destinationId, setDestinationId] = useState('bharati');
  const [selectedRouteId, setSelectedRouteId] = useState('ai');
  const [safetyWeight, setSafetyWeight] = useState(60);
  const [speedWeight, setSpeedWeight] = useState(25);
  const [fuelWeight, setFuelWeight] = useState(15);

  const originPort = PORTS.find((p) => p.id === originPortId) ?? PORTS[0];
  const destPort = PORTS.find((p) => p.id === destinationId) ?? PORTS[3];
  const origin: LatLon = originMode === 'live' ? VESSEL_POS : originPort.pos;
  const originLabel = originMode === 'live' ? t('vessel.name') : t(originPort.key);
  const destLabel = t(destPort.key);

  const handleOriginPortChange = (id: string) => {
    setOriginPortId(id);
    if (id === destinationId) {
      const fallback = PORTS.find((p) => p.id !== id) ?? PORTS[0];
      setDestinationId(fallback.id);
    }
  };

  const handleDestinationChange = (id: string) => {
    if (originMode === 'ports' && id === originPortId) return;
    setDestinationId(id);
  };

  const routes = useMemo(() => {
    const paths = buildRoutePaths(origin, destPort.pos);
    return ROUTE_META.map((r) => {
      const path = paths[r.id];
      const nm = pathDistanceNm(path);
      return {
        ...r,
        path,
        distance: `${Math.round(nm)} nm`,
        duration: formatVoyageDuration(nm),
        fuel: estimateFuelKl(nm),
      };
    });
  }, [origin, destPort.pos]);

  const mapBounds = useMemo<[[number, number], [number, number]]>(() => {
    const pts = [...routes.flatMap((r) => r.path), origin, destPort.pos];
    const lats = pts.map((p) => p[0]);
    const lons = pts.map((p) => p[1]);
    return [
      [Math.min(...lats) - 5, Math.min(...lons) - 7],
      [Math.max(...lats) + 5, Math.max(...lons) + 7],
    ];
  }, [routes, origin, destPort.pos]);

  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? routes[0];

  const kpiData = [
    {
      label: t('command.kpi.iceConcentration'),
      value: 64,
      unit: '%',
      delta: t('command.kpi.iceConcentrationDelta') || '▼ 3.2% vs last week',
      deltaType: 'down' as const,
    },
    {
      label: t('command.kpi.icebergsTracked'),
      value: 128,
      delta: t('command.kpi.icebergsTrackedDelta') || '▲ 6 new detections, 24h',
      deltaType: 'up' as const,
    },
    {
      label: t('command.kpi.routeSafety'),
      value: selectedRoute.safetyScore,
      unit: '/100',
      delta: t('command.kpi.routeSafetyDelta') || '▲ 4 pts after reroute',
      deltaType: 'up' as const,
    },
    {
      label: t('command.kpi.fuelSaved'),
      value: 18.4,
      unit: '%',
      delta: t('command.kpi.fuelSavedDelta') || '▲ vs. static route plans',
      deltaType: 'up' as const,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" role="region" aria-label="Key Performance Indicators">
        {kpiData.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>{t('route.params.title')}</h2>
          <SingleSelectChips
            options={[
              { value: 'live', label: t('route.params.fromLive') },
              { value: 'ports', label: t('route.params.fromPorts') },
            ]}
            defaultValue={originMode}
            onChange={(v) => setOriginMode(v as OriginMode)}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-5">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11.5px] text-ice-faint" htmlFor="originSelect">
              {t('route.params.origin')}
            </label>
            {originMode === 'live' ? (
              <div className="mt-1.5 flex items-center gap-2 border border-border rounded-md px-2.5 py-2 bg-[#f8fafc]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#178a4c] flex-none" />
                <span className="text-[13px] font-medium text-ice truncate">{t('vessel.name')}</span>
                <span className="text-[11.5px] text-ice-faint ml-auto flex-none" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {t('vessel.position')}
                </span>
              </div>
            ) : (
              <select
                id="originSelect"
                className={selectClass}
                value={originPortId}
                onChange={(e) => handleOriginPortChange(e.target.value)}
              >
                {PORTS.map((p) => (
                  <option key={p.id} value={p.id}>{t(p.key)}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11.5px] text-ice-faint" htmlFor="destSelect">
              {t('route.params.destination')}
            </label>
            <select
              id="destSelect"
              className={selectClass}
              value={destinationId}
              onChange={(e) => handleDestinationChange(e.target.value)}
            >
              {PORTS.filter((p) => originMode === 'live' || p.id !== originPortId).map((p) => (
                <option key={p.id} value={p.id}>{t(p.key)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row flex-wrap gap-5 items-start lg:items-end">
          <div className="flex flex-wrap gap-4 flex-1 w-full lg:w-auto">
            <div className="flex-1 min-w-[140px]">
              <label className="flex justify-between gap-2 text-[11.5px] text-ice-faint mb-1.5">
                <span>{t('route.params.safety')}</span>
                <span className="text-ice" style={{ fontVariantNumeric: 'tabular-nums' }}>{safetyWeight}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={safetyWeight}
                onChange={(e) => setSafetyWeight(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="flex justify-between gap-2 text-[11.5px] text-ice-faint mb-1.5">
                <span>{t('route.params.speed')}</span>
                <span className="text-ice" style={{ fontVariantNumeric: 'tabular-nums' }}>{speedWeight}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={speedWeight}
                onChange={(e) => setSpeedWeight(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="flex justify-between gap-2 text-[11.5px] text-ice-faint mb-1.5">
                <span>{t('route.params.fuelEfficiency')}</span>
                <span className="text-ice" style={{ fontVariantNumeric: 'tabular-nums' }}>{fuelWeight}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={fuelWeight}
                onChange={(e) => setFuelWeight(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          <button className="btn primary whitespace-nowrap" onClick={() => showToast(t('toast.simulationRunning'))}>
            {t('route.params.recalculate')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1.05fr] gap-4 items-start">
        <PolarMap
          title={t('command.map.title')}
          badge={t('command.map.badge')}
          layers={[
            { id: 'ice', label: t('command.map.layers.ice'), active: true },
            { id: 'icebergs', label: t('command.map.layers.icebergs'), active: true },
            { id: 'route', label: t('command.map.layers.route'), active: true },
            { id: 'sar', label: t('command.map.layers.sar'), active: false },
          ]}
          legendItems={[
            { type: 'swatch', color: '#1f3a5f', label: t('route.map.legend.ai') },
            { type: 'dash', color: '#94a3b8', label: t('route.map.legend.direct') },
            { type: 'dash', color: '#475569', label: t('route.map.legend.conservative') },
            { type: 'diamond', color: '#991b1b', label: t('command.map.legend.iceberg') },
            { type: 'station', label: t('command.map.legend.station') },
          ]}
          candidateRoutes={routes.map((r) => ({
            id: r.id,
            label: t(`route.card.${r.key}`) || r.id,
            path: r.path,
            color: r.color,
          }))}
          selectedRouteId={selectedRouteId}
          onSelectRoute={setSelectedRouteId}
          fitBounds={mapBounds}
          routeTerminals={{
            start: { pos: origin, label: originLabel },
            end: { pos: destPort.pos, label: destLabel },
          }}
          showForecastSlider
          forecastSliderLabel={t('command.forecastSlider')}
          onSimulate={() => showToast(t('toast.simulationRunning'))}
          onAccept={() => showToast(t('toast.rerouteApplied'))}
        />

        <div className="space-y-4">
          <div className="panel">
            <div className="panel-head">
              <h2>{t('route.map.title')}</h2>
              <span className="hint">{t('route.map.hint')}</span>
            </div>
            <div className="space-y-2">
              {routes.map((route) => {
                const active = route.id === selectedRouteId;
                return (
                  <button
                    key={route.id}
                    onClick={() => setSelectedRouteId(route.id)}
                    aria-pressed={active}
                    className={cn(
                      'w-full text-left rounded-md border px-3 py-2.5 transition-colors',
                      active
                        ? 'border-border-strong bg-[#eef2f6]'
                        : 'border-border bg-white hover:bg-[#f8fafc]'
                    )}
                  >
                    <span className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="flex items-center gap-2 text-[13px] font-medium text-ice">
                        <span className="w-4 h-0.5 rounded flex-none" style={{ background: route.color }} />
                        {t(`route.card.${route.key}`) || route.id}
                      </span>
                      {route.recommended && <Badge>{t('common.recommended')}</Badge>}
                    </span>
                    <span className="grid grid-cols-4 gap-2 text-[11px]">
                      <span className="flex flex-col gap-0.5">
                        <span className="text-ice-faint">{t('route.card.distance')}</span>
                        <span className="text-ice font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>{route.distance}</span>
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <span className="text-ice-faint">{t('route.card.duration')}</span>
                        <span className="text-ice font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>{route.duration}</span>
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <span className="text-ice-faint">{t('route.card.fuel')}</span>
                        <span className="text-ice font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>{route.fuel}</span>
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <span className="text-ice-faint">{t('route.card.safety')}</span>
                        <span className="text-ice font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>{route.safetyScore}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <AIRecommendationCard
            title={t('command.ai.title')}
            confidence={t('command.ai.confidence')}
            text={t('command.ai.text')}
            factors={[
              { label: t('command.ai.factor.drift'), value: 38 },
              { label: t('command.ai.factor.concentration'), value: 27 },
              { label: t('command.ai.factor.seastate'), value: 21 },
              { label: t('command.ai.factor.historical'), value: 14 },
            ]}
            onSimulate={() => showToast(t('toast.simulationRunning'))}
            onAccept={() => showToast(t('toast.rerouteApplied'))}
            onDismiss={() => showToast(t('toast.dismissed'))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4">
        <IceTrendChart
          title={t('command.chart.iceTrend')}
          legendItems={[
            { color: '#1f3a5f', label: t('command.chart.legend.observed') },
            { color: '#64748b', label: t('command.chart.legend.forecast') },
          ]}
        />

        <SafetyBreakdownChart
          title={t('command.chart.safetyBreakdown')}
          hint={t('command.chart.safety.hint')}
          factors={[
            { label: t('command.chart.safety.iceExposure'), value: 32 },
            { label: t('command.chart.safety.icebergRisk'), value: 29 },
            { label: t('command.chart.safety.weather'), value: 24 },
            { label: t('command.chart.safety.historical'), value: 15 },
          ]}
        />
      </div>
    </div>
  );
}

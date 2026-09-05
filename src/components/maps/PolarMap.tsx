import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Polyline, Circle, CircleMarker, Rectangle, Tooltip, useMap } from 'react-leaflet';
import { cn } from '../../lib/utils';
import { Play, Pause } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

interface LayerState {
  [key: string]: boolean;
}

export interface CandidateRoute {
  id: string;
  label: string;
  path: Array<[number, number]>;
  color: string;
}

interface PolarMapProps {
  title: string;
  badge: string;
  layers: { id: string; label: string; active: boolean }[];
  legendItems: { type: 'swatch' | 'dash' | 'diamond' | 'station'; color?: string; label: string }[];
  showForecastSlider?: boolean;
  forecastSliderLabel?: string;
  candidateRoutes?: CandidateRoute[];
  selectedRouteId?: string;
  onSelectRoute?: (id: string) => void;
  fitBounds?: [[number, number], [number, number]];
  routeTerminals?: {
    start: { pos: [number, number]; label: string };
    end: { pos: [number, number]; label: string };
  };
  onSimulate: () => void;
  onAccept: () => void;
}

const LEGEND_SWATCH: Record<string, string> = {
  '#3fd8de': '#1f3a5f',
  '#8d7cf5': '#64748b',
  '#ef5b5b': '#991b1b',
};

// CARTO basemap credentials (key passed as `key` param per CARTO docs)
const CARTO_API_KEY = 'cb1_2u4s_1_2ff09c9dfad35436c7775919';
const CARTO_TILE_URL = `https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`;

// Real-world positions (lat, lon)
const VESSEL_POS: [number, number] = [-67.14, 45.82];
const STATION_POS: [number, number] = [-69.4047, 76.1857];

const ICEBERGS: { id: string; pos: [number, number]; risk: 'high' | 'med' | 'low' }[] = [
  { id: 'B-42', pos: [-66.8, 44.1], risk: 'high' },
  { id: 'C-19', pos: [-65.9, 46.7], risk: 'med' },
  { id: 'A-81', pos: [-67.2, 47.9], risk: 'low' },
  { id: 'D-07', pos: [-66.1, 43.0], risk: 'low' },
];

const RISK_COLOR: Record<string, string> = {
  high: '#991b1b',
  med: '#92400e',
  low: '#475569',
};

const MAP_BOUNDS: [[number, number], [number, number]] = [[-64.2, 37.5], [-70.8, 79.5]];

function FitBounds({ bounds }: { bounds: [[number, number], [number, number]] }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [map, bounds]);
  return null;
}

export function PolarMap({
  title,
  badge,
  layers,
  legendItems,
  showForecastSlider = true,
  forecastSliderLabel,
  candidateRoutes,
  selectedRouteId,
  onSelectRoute,
  fitBounds = MAP_BOUNDS,
  routeTerminals,
  onSimulate,
  onAccept,
}: PolarMapProps) {
  const { t } = useTranslation();
  const [isSimulating, setIsSimulating] = useState(false);
  const [forecastDay, setForecastDay] = useState(0);
  const [activeLayers, setActiveLayers] = useState<LayerState>(
    layers.reduce((acc, layer) => ({ ...acc, [layer.id]: layer.active }), {})
  );

  const toggleLayer = (id: string) => {
    setActiveLayers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePlayPause = () => {
    setIsSimulating((prev) => !prev);
  };

  const resolveColor = (c?: string) => (c && LEGEND_SWATCH[c] ? LEGEND_SWATCH[c] : c ?? '#64748b');
  const effectiveSelected = selectedRouteId ?? candidateRoutes?.[0]?.id;

  return (
    <div className="panel hero">
      <div className="p-4 pb-0 flex items-start justify-between gap-3 flex-wrap">
        <h2 className="text-[14px] font-semibold text-ice">{title}</h2>
        <span className="badge"><span className="dot" />{badge}</span>
      </div>

      <div className="relative z-0" style={{ aspectRatio: '4/3' }}>
        <MapContainer
          bounds={fitBounds}
          style={{ height: '100%', width: '100%', background: '#e8edf2', fontFamily: 'Inter, system-ui, sans-serif' }}
          zoomControl={true}
          scrollWheelZoom={false}
          attributionControl={true}
        >
          <FitBounds bounds={fitBounds} />
          <TileLayer
            url={CARTO_TILE_URL}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />

          {activeLayers.sar && (
            <Rectangle
              bounds={[[-65.2, 40.5], [-69.5, 53.0]]}
              pathOptions={{ color: '#94a3b8', weight: 1, dashArray: '4 4', fillColor: '#94a3b8', fillOpacity: 0.12 }}
            />
          )}

          {activeLayers.ice && (
            <>
              <Circle
                center={[-64.4, 49.5]}
                radius={230000}
                pathOptions={{ color: '#9fb0c3', weight: 1, fillColor: '#cbd6e2', fillOpacity: 0.55 }}
              />
              <Circle
                center={[-66.2, 61.0]}
                radius={190000}
                pathOptions={{ color: '#9fb0c3', weight: 1, fillColor: '#cbd6e2', fillOpacity: 0.55 }}
              />
              <Circle
                center={[-66.4, 46.5]}
                radius={130000 + forecastDay * 22000}
                pathOptions={{ color: '#7d8ea3', weight: 1, dashArray: '5 4', fillColor: '#dbe3ec', fillOpacity: 0.6 }}
              />
            </>
          )}

          {activeLayers.route && candidateRoutes && candidateRoutes.map((route) => {
            const selected = route.id === effectiveSelected;
            return (
              <Polyline
                key={route.id}
                positions={route.path}
                pathOptions={{
                  color: route.color,
                  weight: selected ? 3.5 : 2,
                  opacity: selected ? 1 : 0.55,
                  dashArray: selected ? undefined : '7 6',
                  lineCap: 'round',
                }}
                eventHandlers={onSelectRoute ? { click: () => onSelectRoute(route.id) } : undefined}
              >
                <Tooltip sticky>{route.label}</Tooltip>
              </Polyline>
            );
          })}

          {activeLayers.icebergs && ICEBERGS.map((berg) => (
            <CircleMarker
              key={berg.id}
              center={berg.pos}
              radius={6}
              pathOptions={{ color: RISK_COLOR[berg.risk], weight: 1.5, fillColor: RISK_COLOR[berg.risk], fillOpacity: 0.9 }}
            >
              <Tooltip direction="top" offset={[0, -6]}>{berg.id}</Tooltip>
            </CircleMarker>
          ))}

          <CircleMarker
            center={VESSEL_POS}
            radius={7}
            pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#111e32', fillOpacity: 1 }}
          >
            <Tooltip direction="top" offset={[0, -7]}>{t('vessel.name')}</Tooltip>
          </CircleMarker>

          <CircleMarker
            center={STATION_POS}
            radius={5}
            pathOptions={{ color: '#475569', weight: 1.5, fillColor: '#ffffff', fillOpacity: 1 }}
          >
            <Tooltip direction="top" offset={[0, -5]}>Bharati Stn</Tooltip>
          </CircleMarker>

          {activeLayers.route && routeTerminals && (
            <>
              <CircleMarker
                center={routeTerminals.start.pos}
                radius={6}
                pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#111e32', fillOpacity: 1 }}
              >
                <Tooltip direction="top" offset={[0, -6]}>{routeTerminals.start.label}</Tooltip>
              </CircleMarker>
              <CircleMarker
                center={routeTerminals.end.pos}
                radius={7}
                pathOptions={{ color: '#111e32', weight: 2, fillColor: '#ffffff', fillOpacity: 1 }}
              >
                <Tooltip direction="top" offset={[0, -7]}>{routeTerminals.end.label}</Tooltip>
              </CircleMarker>
            </>
          )}
        </MapContainer>

        <div className="absolute left-3.5 bottom-3.5 bg-white border border-border rounded-md px-2.5 py-2 text-[11px] text-ice-dim flex flex-col gap-1.5" style={{ boxShadow: '0 1px 2px rgba(16,24,40,.08)', zIndex: 500 }}>
          {legendItems.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              {item.type === 'swatch' && (
                <span className="w-4 h-0.5 rounded flex-shrink-0" style={{ background: resolveColor(item.color) }} />
              )}
              {item.type === 'dash' && (
                <span className="w-4 h-0.5 rounded flex-shrink-0" style={{ background: resolveColor(item.color) }} />
              )}
              {item.type === 'diamond' && (
                <span className="w-2 h-2 flex-shrink-0" style={{ transform: 'rotate(45deg)', background: resolveColor(item.color) }} />
              )}
              {item.type === 'station' && (
                <span className="w-2 h-2 flex-shrink-0 border border-ice-dim" style={{ transform: 'rotate(45deg)' }} />
              )}
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 pt-3.5 border-t border-border mt-0.5 space-y-3">
        <div className="flex gap-1.5 flex-wrap p-1 rounded-lg border border-border bg-[#f8fafc] w-fit" role="group" aria-label="Map layers">
          {layers.map((layer) => (
            <button
              key={layer.id}
              className={cn(
                'text-[12px] font-medium px-3 py-1.5 rounded-md border border-transparent transition-colors',
                activeLayers[layer.id]
                  ? 'bg-white text-ice border-border'
                  : 'text-ice-dim hover:text-ice'
              )}
              style={activeLayers[layer.id] ? { boxShadow: '0 1px 2px rgba(16,24,40,.08)' } : undefined}
              onClick={() => toggleLayer(layer.id)}
              aria-pressed={activeLayers[layer.id]}
            >
              {layer.label}
            </button>
          ))}
        </div>

        {showForecastSlider && (
          <div className="flex items-center gap-2.5">
            <button
              className="btn ghost !px-2.5"
              onClick={handlePlayPause}
              aria-label={isSimulating ? t('common.pause') : t('common.play')}
            >
              {isSimulating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <span className="w-8 text-center text-[12px] text-ice-dim" style={{ fontVariantNumeric: 'tabular-nums' }}>D+{forecastDay}</span>
            <input
              type="range"
              id="forecastSlider"
              min="0"
              max="14"
              value={forecastDay}
              step="1"
              aria-label={forecastSliderLabel}
              onChange={(e) => setForecastDay(Number(e.target.value))}
              className="flex-1"
            />
            <span className="w-16 text-right text-[12px] text-ice-dim" style={{ fontVariantNumeric: 'tabular-nums' }}>+{forecastDay} {forecastDay === 1 ? t('common.day') : t('common.days')}</span>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button className="btn primary flex-1" onClick={onAccept}>
            {t('common.accept')}
          </button>
          <button className="btn ghost flex-1" onClick={onSimulate}>
            {t('common.simulate')}
          </button>
        </div>
      </div>
    </div>
  );
}

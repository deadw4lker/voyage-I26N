import { useState, useMemo, Fragment } from 'react';
import { MapContainer, TileLayer, Rectangle, Polyline, Marker, Popup, Tooltip, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type {
  GridCellData, DataLayersState, IcebergData, MonteCarloResponse,
  RouteResponse, RouteComparisonResponse
} from '../../types/sih';
import { CellDetailsDrawer } from './CellDetailsDrawer';
import { FlowField } from './FlowField';

// Quiet, purpose-built markers — no emoji, no glow
const shipIcon = L.divIcon({
  className: 'ops-ship-marker',
  html: `<div style="background:#e8eef5; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:1px solid rgba(0,0,0,.4); box-shadow:0 2px 8px rgba(0,0,0,.45);">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l1.5 4h15L21 17"/><path d="M12 3v6"/><path d="M5 17l7-11 7 11"/></svg>
         </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const destIcon = L.divIcon({
  className: 'ops-dest-marker',
  html: `<div style="background:#000000; width:26px; height:26px; border-radius:8px; display:flex; align-items:center; justify-content:center; border:1px solid #e8eef5; box-shadow:0 2px 8px rgba(0,0,0,.45);">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e8eef5" stroke-width="2.2" stroke-linecap="round"><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.4"/></svg>
         </div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function bergIcon(risk: number) {
  const fill = risk >= 60 ? '#c05757' : risk >= 30 ? '#c99a5b' : '#7fa6bd';
  return L.divIcon({
    className: 'ops-berg-marker',
    html: `<div style="width:14px; height:14px; transform:rotate(45deg); background:${fill}; border:1.5px solid rgba(255,255,255,.9); border-radius:3px; box-shadow:0 1px 5px rgba(0,0,0,.5);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

type RouteKey = 'fastest' | 'safest' | 'balanced';

/** Comparison overlay: the selected route renders full-strength, the other two dim. */
function ComparisonRoutes({
  comparison,
  emphasized,
  casing,
  colors,
  onSelect,
}: {
  comparison: RouteComparisonResponse;
  emphasized: RouteKey;
  casing: { color: string; opacity: number };
  colors: Record<RouteKey, string>;
  onSelect?: (key: RouteKey) => void;
}) {
  const order: { key: RouteKey; dash?: string }[] = [
    { key: 'fastest', dash: '8 6' },
    { key: 'safest', dash: '2 6' },
    { key: 'balanced' },
  ];
  return (
    <>
      {order.map(({ key, dash }) => {
        const isTop = key === emphasized;
        const handlers = onSelect ? { click: () => onSelect(key) } : {};
        return (
          <Fragment key={key}>
            {isTop && (
              <Polyline positions={comparison[key].route} pathOptions={{ ...casing, weight: 8 }} />
            )}
            <Polyline
              positions={comparison[key].route}
              pathOptions={{
                color: colors[key],
                weight: isTop ? 4.5 : 3,
                opacity: isTop ? 1 : 0.6,
                ...(dash ? { dashArray: dash } : {}),
                ...(key === 'safest' ? { lineCap: 'round' as const } : {}),
              }}
              eventHandlers={handlers}
            />
          </Fragment>
        );
      })}
    </>
  );
}

interface SIHMapViewProps {
  riskGrid: GridCellData[][];
  layers: DataLayersState;
  icebergs: IcebergData[];
  monteCarloData: MonteCarloResponse | null;
  activeRoute: RouteResponse | null;
  routeComparison: RouteComparisonResponse | null;
  startPos: [number, number];
  destPos: [number, number];
  startLabel?: string;
  destLabel?: string;
  emphasizedRoute?: 'fastest' | 'safest' | 'balanced' | null;
  onRouteSelect?: (key: 'fastest' | 'safest' | 'balanced') => void;
}

export function SIHMapView({
  riskGrid,
  layers,
  icebergs,
  monteCarloData,
  activeRoute,
  routeComparison,
  startPos,
  destPos,
  startLabel = 'RV Bharati Explorer',
  destLabel = 'Bharati Station',
  emphasizedRoute = null,
  onRouteSelect,
}: SIHMapViewProps) {
  const [selectedCell, setSelectedCell] = useState<GridCellData | null>(null);

  const getCellRiskColor = (score: number) => {
    if (score >= 0.8) return '#8f2f35';
    if (score >= 0.6) return '#b04a3e';
    if (score >= 0.4) return '#b96a35';
    if (score >= 0.2) return '#a8843c';
    return '#2e7d5f';
  };

  const getCellOpacity = (score: number) => {
    if (score >= 0.8) return 0.5;
    if (score >= 0.6) return 0.4;
    if (score >= 0.4) return 0.3;
    if (score >= 0.2) return 0.2;
    return 0.12;
  };

  const { trajectoryLines, totalTracks } = useMemo(() => {
    if (!layers.predictedTrajectories || !monteCarloData) return { trajectoryLines: [], totalTracks: 0 };
    const lines: [number, number][][] = [];
    let total = 0;

    Object.values(monteCarloData.trajectories).forEach((paths) => {
      total += paths.length;
      paths.forEach((path) => {
        if (lines.length < 140) lines.push(path.map((pt) => [pt.latitude, pt.longitude]));
      });
    });

    return { trajectoryLines: lines, totalTracks: total };
  }, [layers.predictedTrajectories, monteCarloData]);

  const ROUTE_COLORS = {
    balanced: '#38bdf8', // vivid sky — recommended
    fastest: '#facc15', // vivid yellow
    safest: '#4ade80', // vivid green
  } as const;

  const routeColor =
    activeRoute?.mode === 'safest'
      ? ROUTE_COLORS.safest
      : activeRoute?.mode === 'fastest'
        ? ROUTE_COLORS.fastest
        : ROUTE_COLORS.balanced;

  // Dark casing drawn under a route so the bright core stays legible
  // over heatmap cells, trajectories and the ocean basemap.
  const casing = { color: '#000000', opacity: 0.9 } as const;

  return (
    <div className="relative h-full min-h-[420px] w-full bg-black lg:min-h-0">
      <MapContainer
        center={[-67.0, 58.0]}
        zoom={6}
        style={{ width: '100%', height: '100%', minHeight: '420px' }}
        attributionControl={false}
        zoomControl={false}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}"
          maxZoom={12}
        />

        {/* Animated wind / current flow particles */}
        <FlowField riskGrid={riskGrid} layers={layers} />

        {riskGrid.map((row, rIdx) =>
          row.map((cell, cIdx) => {
            const nextLat = rIdx + 1 < riskGrid.length ? riskGrid[rIdx + 1][cIdx].latitude : cell.latitude - 0.24;
            const nextLon = cIdx + 1 < row.length ? row[cIdx + 1].longitude : cell.longitude + 1.14;

            const bounds: [[number, number], [number, number]] = [
              [cell.latitude, cell.longitude],
              [nextLat, nextLon],
            ];

            return (
              <Rectangle
                key={`cell-${cell.row}-${cell.col}`}
                bounds={bounds}
                pathOptions={{
                  fillColor: getCellRiskColor(cell.risk_score),
                  fillOpacity: getCellOpacity(cell.risk_score),
                  color: '#222222',
                  weight: 0.4,
                  opacity: 0.6,
                }}
                eventHandlers={{
                  click: () => setSelectedCell(cell),
                }}
              >
                <Tooltip sticky className="ops-tip" direction="top" offset={[0, -6]}>
                  <div>
                    <div className="font-medium">Cell {cell.row}, {cell.col} · {(cell.risk_score * 100).toFixed(0)} / 100</div>
                    <div style={{ opacity: 0.75 }}>
                      Ice {(cell.ice_concentration * 100).toFixed(0)}% · Berg {((cell.iceberg_probability || 0) * 100).toFixed(0)}%
                    </div>
                    <div style={{ opacity: 0.55, fontSize: 11 }}>Click for full conditions</div>
                  </div>
                </Tooltip>
              </Rectangle>
            );
          })
        )}

        {layers.predictedTrajectories &&
          trajectoryLines.map((line, idx) => (
            <Polyline
              key={`traj-${idx}`}
              positions={line}
              pathOptions={{
                color: '#e08a9b',
                weight: 1.25,
                opacity: 0.5,
              }}
            />
          ))}

        {layers.historicalIcebergs &&
          riskGrid.flatMap((row) =>
            row
              .filter((c) => c.historical_iceberg_probability > 0.45)
              .map((c) => (
                <CircleMarker
                  key={`hist-${c.row}-${c.col}`}
                  center={[c.latitude, c.longitude]}
                  radius={2.5}
                  pathOptions={{
                    fillColor: '#c99a5b',
                    fillOpacity: 0.55,
                    color: '#c99a5b',
                    weight: 0,
                  }}
                />
              ))
          )}

        {routeComparison ? (
          <ComparisonRoutes
            comparison={routeComparison}
            emphasized={emphasizedRoute ?? 'balanced'}
            casing={casing}
            colors={ROUTE_COLORS}
            onSelect={onRouteSelect}
          />
        ) : (
          activeRoute && (
            <>
              <Polyline
                positions={activeRoute.route}
                pathOptions={{ ...casing, weight: 8 }}
              />
              <Polyline
                positions={activeRoute.route}
                pathOptions={{ color: routeColor, weight: 4.5, opacity: 1 }}
              />
            </>
          )
        )}

        {icebergs.map((berg) => (
          <Marker key={berg.id} position={[berg.latitude, berg.longitude]} icon={bergIcon(berg.risk_rating)}>
            <Popup className="ops-popup">
              <div>
                <div className="font-medium">{berg.id} · {berg.size_category}</div>
                <div className="tabular mt-1 text-[12px] opacity-80">
                  {Math.abs(berg.latitude).toFixed(2)}°S, {berg.longitude.toFixed(2)}°E<br />
                  Drifting {berg.drift_speed} kn at {berg.drift_direction}°<br />
                  Risk {berg.risk_rating}%
                </div>
                <div className="mt-1 text-[11px] opacity-50">Source: {berg.source}</div>
              </div>
            </Popup>
          </Marker>
        ))}

        <Marker position={startPos} icon={shipIcon}>
          <Popup className="ops-popup">
            <div className="font-medium">{startLabel}</div>
            <div className="text-[12px] opacity-75">Route origin</div>
          </Popup>
        </Marker>

        <Marker position={destPos} icon={destIcon}>
          <Popup className="ops-popup">
            <div className="font-medium">{destLabel}</div>
            <div className="text-[12px] opacity-75">Destination</div>
          </Popup>
        </Marker>
      </MapContainer>

      {/* Top-left route key — color to mode mapping */}
      {routeComparison && (
        <div className="absolute left-4 top-4 z-[900] flex items-center gap-3 rounded-lg border border-[#333333] bg-black/95 px-3 py-2 shadow-xl backdrop-blur">
          {(['fastest', 'balanced', 'safest'] as const).map((key) => (
            <span key={key} className="flex items-center gap-1.5 text-[11px] text-slate-200">
              <span
                className="inline-block h-0 w-5 rounded-full border-t-[3px]"
                style={{ borderColor: ROUTE_COLORS[key], opacity: key === emphasizedRoute ? 1 : 0.6 }}
              />
              <span className="capitalize">{key}</span>
            </span>
          ))}
        </div>
      )}

      {/* Bottom-left legend — compact, out of the way */}
      <div className="absolute bottom-4 left-4 z-[900] rounded-lg border border-[#333333] bg-black/95 px-3 py-2.5 shadow-xl backdrop-blur">
        <p className="text-[11px] font-medium text-[#8b98ad]">Risk</p>
        <div className="mt-1.5 flex items-center gap-2.5">
          {[
            { label: 'Low', color: '#2e7d5f' },
            { label: 'Mod', color: '#a8843c' },
            { label: 'High', color: '#b96a35' },
            { label: 'V.high', color: '#b04a3e' },
            { label: 'Ext', color: '#8f2f35' },
          ].map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[4px]" style={{ background: s.color }} />
              <span className="text-[11px] text-slate-300">{s.label}</span>
            </span>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-[#262626] pt-2">
          <span className="flex items-center gap-1.5 text-[11px] text-slate-300">
            <span className="inline-block h-0 w-5 border-t-[3px] border-[#38bdf8]" /> Route
          </span>
          {layers.predictedTrajectories && totalTracks > 0 && (
            <span className="flex items-center gap-1.5 text-[11px] text-slate-300">
              <span className="inline-block h-0 w-5 border-t border-[#e08a9b]" /> Drift ({totalTracks})
            </span>
          )}
          {layers.wind && (
            <span className="flex items-center gap-1.5 text-[11px] text-slate-300">
              <span className="inline-block h-0 w-5 border-t border-[#d2dbe3]" /> Wind flow
            </span>
          )}
          {layers.oceanCurrents && (
            <span className="flex items-center gap-1.5 text-[11px] text-slate-300">
              <span className="inline-block h-0 w-5 border-t border-[#5eead4]" /> Current drift
            </span>
          )}
          <span className="text-[11px] text-[#737373]">Click a cell for detail</span>
        </div>
      </div>

      <CellDetailsDrawer cell={selectedCell} onClose={() => setSelectedCell(null)} />
    </div>
  );
}

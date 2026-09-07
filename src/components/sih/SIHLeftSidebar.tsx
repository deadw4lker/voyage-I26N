import type { DataLayersState, MCDMWeights } from '../../types/sih';
import { PLACES, VESSEL_PLACE } from '../../lib/places';

export type OriginMode = 'vessel' | 'custom';

interface SIHLeftSidebarProps {
  layers: DataLayersState;
  onLayerToggle: (layer: keyof DataLayersState) => void;
  predictionHours: number;
  onPredictionHoursChange: (hours: number) => void;
  routingMode: 'fastest' | 'safest' | 'balanced';
  onRoutingModeChange: (mode: 'fastest' | 'safest' | 'balanced') => void;
  maxRisk: number;
  onMaxRiskChange: (risk: number) => void;
  weights: MCDMWeights;
  onWeightChange: (key: keyof MCDMWeights, val: number) => void;
  onResetWeights: () => void;
  originMode: OriginMode;
  onOriginModeChange: (mode: OriginMode) => void;
  startPlaceId: string;
  onStartPlaceChange: (id: string) => void;
  destPlaceId: string;
  onDestPlaceChange: (id: string) => void;
}

const selectClass =
  'w-full rounded-lg border border-[#2b2b2b] bg-[#141414] px-2.5 py-2 text-[12.5px] text-slate-200 outline-none transition-colors hover:border-[#333333] focus:border-[#525252] disabled:opacity-50';

export function SIHLeftSidebar({
  layers,
  onLayerToggle,
  predictionHours,
  onPredictionHoursChange,
  routingMode,
  onRoutingModeChange,
  maxRisk,
  onMaxRiskChange,
  weights,
  onWeightChange,
  onResetWeights,
  originMode,
  onOriginModeChange,
  startPlaceId,
  onStartPlaceChange,
  destPlaceId,
  onDestPlaceChange,
}: SIHLeftSidebarProps) {
  const timeOptions = [6, 12, 24, 48, 72];

  const layerItems: { key: keyof DataLayersState; label: string; hint: string }[] = [
    { key: 'seaIce', label: 'Sea ice', hint: 'Concentration' },
    { key: 'oceanCurrents', label: 'Ocean currents', hint: 'Drift vectors' },
    { key: 'wind', label: 'Wind', hint: 'Speed and direction' },
    { key: 'waves', label: 'Waves', hint: 'Significant height' },
    { key: 'historicalIcebergs', label: 'Iceberg history', hint: 'Density' },
    { key: 'bathymetry', label: 'Bathymetry', hint: 'Water depth' },
    { key: 'predictedTrajectories', label: 'Forecast tracks', hint: '72 h cone' },
  ];

  const weightItems: { key: keyof MCDMWeights; label: string }[] = [
    { key: 'iceberg_risk', label: 'Iceberg risk' },
    { key: 'sea_ice_risk', label: 'Sea ice' },
    { key: 'ocean_current_risk', label: 'Currents' },
    { key: 'weather_wind_risk', label: 'Wind' },
    { key: 'wave_risk', label: 'Waves' },
    { key: 'bathymetry_risk', label: 'Depth' },
  ];

  const modeHelp: Record<string, string> = {
    fastest: 'Shortest time, accepts more risk.',
    safest: 'Widest margin from ice and bergs.',
    balanced: 'Best trade-off for supply runs.',
  };

  return (
    <aside className="w-full shrink-0 border-b border-[#262626] bg-[#090909] lg:w-[300px] lg:border-b-0 lg:border-r lg:overflow-y-auto lg:min-h-0">
      <div className="space-y-3 p-3.5">
        {/* Route endpoints */}
        <section className="ops-card p-4">
          <h2 className="ops-section-title">Route endpoints</h2>
          <p className="ops-section-sub mt-0.5">Start from the vessel or any named place.</p>

          <div className="mt-2.5 grid grid-cols-2 gap-1 rounded-lg border border-[#2b2b2b] bg-[#141414] p-1">
            {(['vessel', 'custom'] as const).map((m) => (
              <button
                key={m}
                onClick={() => onOriginModeChange(m)}
                aria-pressed={originMode === m}
                className={`rounded-md py-1.5 text-[12.5px] capitalize transition-colors ${
                  originMode === m
                    ? 'bg-[#2a2a2a] font-medium text-slate-100'
                    : 'text-[#8b98ad] hover:text-slate-200'
                }`}
              >
                {m === 'vessel' ? 'Current location' : 'Choose start'}
              </button>
            ))}
          </div>

          {originMode === 'vessel' ? (
            <p className="tabular mt-2.5 rounded-lg bg-[#141414] px-3 py-2 text-[12px] text-[#8b98ad]">
              From {VESSEL_PLACE.name} · {Math.abs(VESSEL_PLACE.coords[0]).toFixed(2)}°S, {VESSEL_PLACE.coords[1].toFixed(2)}°E
            </p>
          ) : (
            <div className="mt-2.5">
              <label htmlFor="start-place" className="mb-1 block text-[12px] text-[#8b98ad]">
                Start place
              </label>
              <select
                id="start-place"
                value={startPlaceId}
                onChange={(e) => onStartPlaceChange(e.target.value)}
                className={selectClass}
              >
                {PLACES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-2.5">
            <label htmlFor="dest-place" className="mb-1 block text-[12px] text-[#8b98ad]">
              Destination
            </label>
            <select
              id="dest-place"
              value={destPlaceId}
              onChange={(e) => onDestPlaceChange(e.target.value)}
              className={selectClass}
            >
              {PLACES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Layers */}
        <section className="ops-card p-4">
          <h2 className="ops-section-title">Map layers</h2>
          <p className="ops-section-sub mt-0.5">Choose what to overlay on the chart.</p>
          <div className="mt-3 divide-y divide-[#1e1e1e]">
            {layerItems.map((item) => {
              const on = layers[item.key];
              return (
                <button
                  key={item.key}
                  onClick={() => onLayerToggle(item.key)}
                  aria-pressed={on}
                  className="flex w-full items-center justify-between gap-3 py-2 text-left"
                >
                  <span className="min-w-0">
                    <span className={`block truncate text-[13px] ${on ? 'text-slate-100' : 'text-[#8b98ad]'}`}>
                      {item.label}
                    </span>
                    <span className="block text-[11.5px] text-[#737373]">{item.hint}</span>
                  </span>
                  <span
                    className={`relative h-[18px] w-[32px] shrink-0 rounded-full transition-colors ${
                      on ? 'bg-neutral-400' : 'bg-[#2b2b2b]'
                    }`}
                  >
                    <span
                      className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all ${
                        on ? 'left-[16px]' : 'left-[2px] opacity-80'
                      }`}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Forecast + routing */}
        <section className="ops-card p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="ops-section-title">Forecast horizon</h2>
            <span className="tabular text-[12px] font-medium text-[#c9c9c9]">+{predictionHours} h</span>
          </div>
          <div className="mt-2.5 grid grid-cols-5 gap-1 rounded-lg border border-[#2b2b2b] bg-[#141414] p-1">
            {timeOptions.map((hours) => (
              <button
                key={hours}
                onClick={() => onPredictionHoursChange(hours)}
                className={`rounded-md py-1.5 text-[12px] tabular transition-colors ${
                  predictionHours === hours
                    ? 'bg-[#2a2a2a] font-medium text-slate-100'
                    : 'text-[#8b98ad] hover:text-slate-200'
                }`}
              >
                {hours}
              </button>
            ))}
          </div>

          <div className="my-4 border-t border-[#1e1e1e]" />

          <h2 className="ops-section-title">Routing preference</h2>
          <div className="mt-2.5 grid grid-cols-3 gap-1 rounded-lg border border-[#2b2b2b] bg-[#141414] p-1">
            {(['fastest', 'balanced', 'safest'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onRoutingModeChange(mode)}
                aria-pressed={routingMode === mode}
                className={`rounded-md py-1.5 text-[12.5px] capitalize transition-colors ${
                  routingMode === mode
                    ? 'bg-[#2a2a2a] font-medium text-slate-100'
                    : 'text-[#8b98ad] hover:text-slate-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-[#737373]">{modeHelp[routingMode]}</p>

          <div className="mt-3 flex items-center justify-between">
            <label htmlFor="max-risk" className="text-[12.5px] text-slate-300">
              Risk tolerance
            </label>
            <span className="tabular text-[12px] font-medium text-slate-100">
              {(maxRisk * 100).toFixed(0)}%
            </span>
          </div>
          <input
            id="max-risk"
            type="range"
            min="0.10"
            max="1.00"
            step="0.05"
            value={maxRisk}
            onChange={(e) => onMaxRiskChange(parseFloat(e.target.value))}
            className="ops-range mt-2"
          />
          <div className="mt-1 flex justify-between text-[10.5px] text-[#737373]">
            <span>Cautious</span>
            <span>Bold</span>
          </div>
        </section>

        {/* Weights */}
        <section className="ops-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="ops-section-title">Risk factors</h2>
              <p className="ops-section-sub mt-0.5">Weight each input in the score.</p>
            </div>
            <button
              onClick={onResetWeights}
              className="rounded-md px-2 py-1 text-[12px] font-medium text-[#8b98ad] hover:bg-[#1e1e1e] hover:text-slate-200"
            >
              Reset
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {weightItems.map((item) => (
              <div key={item.key}>
                <div className="flex items-center justify-between text-[12.5px]">
                  <label htmlFor={`w-${item.key}`} className="text-slate-300">
                    {item.label}
                  </label>
                  <span className="tabular text-[12px] text-[#8b98ad]">
                    {(weights[item.key] * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  id={`w-${item.key}`}
                  type="range"
                  min="0.00"
                  max="0.80"
                  step="0.05"
                  value={weights[item.key]}
                  onChange={(e) => onWeightChange(item.key, parseFloat(e.target.value))}
                  className="ops-range mt-1.5"
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}

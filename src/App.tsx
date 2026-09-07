import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type {
  GridCellData, DataLayersState, MCDMWeights, IcebergData,
  MonteCarloResponse, RouteResponse, RouteComparisonResponse, SystemStatus
} from './types/sih';
import {
  fetchSystemStatus, fetchGridRiskMap, fetchIcebergs, updateWeights,
  predictTrajectory, compareRoutes, isDemoFallback,
} from './services/api';
import { VESSEL_POS, findPlace } from './lib/places';
import { buildAlerts } from './lib/alerts';
import { SIHHeader, type OpsView } from './components/sih/SIHHeader';
import { SIHLeftSidebar, type OriginMode } from './components/sih/SIHLeftSidebar';
import { SIHRightSidebar, type RouteOptionKey } from './components/sih/SIHRightSidebar';import { SIHMapView } from './components/sih/SIHMapView';
import { AlertsView } from './components/sih/AlertsView';

const DEFAULT_WEIGHTS: MCDMWeights = {
  iceberg_risk: 0.35,
  sea_ice_risk: 0.25,
  ocean_current_risk: 0.10,
  weather_wind_risk: 0.10,
  wave_risk: 0.10,
  bathymetry_risk: 0.10,
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export default function App() {
  const [riskGrid, setRiskGrid] = useState<GridCellData[][]>([]);
  const [icebergs, setIcebergs] = useState<IcebergData[]>([]);
  const [predictionHours, setPredictionHours] = useState<number>(72);
  const [routingMode, setRoutingMode] = useState<'fastest' | 'safest' | 'balanced'>('balanced');
  const [maxRisk, setMaxRisk] = useState<number>(0.70);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRouteUpdating, setIsRouteUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState<boolean>(false);
  const [view, setView] = useState<OpsView>('operations');

  // Route endpoints — vessel position or any named place.
  const [originMode, setOriginMode] = useState<OriginMode>('vessel');
  const [startPlaceId, setStartPlaceId] = useState<string>('mawson');
  const [destPlaceId, setDestPlaceId] = useState<string>('bharati');

  const startPos: [number, number] = useMemo(
    () => (originMode === 'vessel' ? VESSEL_POS : (findPlace(startPlaceId)?.coords ?? VESSEL_POS)),
    [originMode, startPlaceId],
  );
  const destPos: [number, number] = useMemo(
    () => findPlace(destPlaceId)?.coords ?? ([-69.4, 76.2] as [number, number]),
    [destPlaceId],
  );
  const startLabel = originMode === 'vessel' ? 'RV Bharati Explorer' : (findPlace(startPlaceId)?.name ?? 'Start');
  const destLabel = findPlace(destPlaceId)?.name ?? 'Destination';

  const [layers, setLayers] = useState<DataLayersState>({
    seaIce: true,
    oceanCurrents: true,
    wind: true,
    waves: true,
    historicalIcebergs: true,
    bathymetry: true,
    predictedTrajectories: true,
  });

  const [weights, setWeights] = useState<MCDMWeights>(DEFAULT_WEIGHTS);

  const [monteCarloData, setMonteCarloData] = useState<MonteCarloResponse | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteResponse | null>(null);
  const [routeComparison, setRouteComparison] = useState<RouteComparisonResponse | null>(null);
  const [selectedOption, setSelectedOption] = useState<RouteOptionKey>('balanced');
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());

  // Single-flight guards so rapid control changes can't stack stale responses.
  const routeReqId = useRef(0);
  const simReqId = useRef(0);

  // Mirror of the focused route option for async callbacks (avoids refetch loops).
  const selectedRef = useRef<RouteOptionKey>('balanced');
  selectedRef.current = selectedOption;

  const syncDemoFlag = useCallback(() => {
    if (isDemoFallback()) setDemoMode(true);
  }, []);

  // Fetch all three routes and focus the selected option's telemetry.
  // Returns the comparison (or null) so callers can chain further updates.
  const refreshComparison = useCallback(async (): Promise<RouteComparisonResponse | null> => {
    const myId = ++routeReqId.current;
    setIsRouteUpdating(true);
    try {
      const compRes = await compareRoutes(startPos, destPos, maxRisk, 14.0);
      if (myId !== routeReqId.current) return null;
      setRouteComparison(compRes);
      setActiveRoute(compRes[selectedRef.current]);
      syncDemoFlag();
      return compRes;
    } catch (err) {
      console.error('Route comparison failed:', err);
      return null;
    } finally {
      if (myId === routeReqId.current) setIsRouteUpdating(false);
    }
  }, [startPos, destPos, maxRisk, syncDemoFlag]);

  const alerts = useMemo(
    () => buildAlerts({ icebergs, riskGrid, activeRoute, monteCarlo: monteCarloData }),
    [icebergs, riskGrid, activeRoute, monteCarloData],
  );
  const unackedCount = alerts.filter((a) => !acknowledged.has(a.id)).length;

  const acknowledge = useCallback((id: string) => {
    setAcknowledged((prev) => new Set(prev).add(id));
  }, []);
  const acknowledgeAll = useCallback(() => {
    setAcknowledged(new Set(alerts.map((a) => a.id)));
  }, [alerts]);

  // Initial load — backend if available, local demo engine otherwise.
  useEffect(() => {
    let cancelled = false;
    async function initDashboard() {
      setIsLoading(true);
      setError(null);
      try {
        const statusRes = await fetchSystemStatus();
        if (cancelled) return;
        setSystemStatus(statusRes);

        const [gridRes, icebergsRes] = await Promise.all([fetchGridRiskMap(), fetchIcebergs()]);
        if (cancelled) return;
        setRiskGrid(gridRes);
        setIcebergs(icebergsRes);

        const mcRes = await predictTrajectory(72, 200);
        if (cancelled) return;
        setMonteCarloData(mcRes);

        const gridAfterMc = await fetchGridRiskMap();
        if (cancelled) return;
        setRiskGrid(gridAfterMc);

        await refreshComparison();
      } catch (err) {
        console.error('Init failed:', err);
        if (!cancelled) setError('Could not reach the simulation backend. Showing demo data instead — start the backend for live results.');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          syncDemoFlag();
        }
      }
    }
    initDashboard();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncDemoFlag]);

  // Debounced route recalc on risk / endpoints change — all three routes reload.
  const debouncedRisk = useDebouncedValue(maxRisk, 350);
  useEffect(() => {
    if (riskGrid.length === 0) return;
    refreshComparison();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedRisk, startPos[0], startPos[1], destPos[0], destPos[1], riskGrid.length]);

  // Routing preference focuses the matching route (no refetch needed).
  useEffect(() => {
    setSelectedOption(routingMode);
    if (routeComparison) setActiveRoute(routeComparison[routingMode]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routingMode]);

  // Debounced MCDM weight recompute — one grid+route refresh per pause, not per tick.
  const debouncedWeights = useDebouncedValue(weights, 500);
  const weightsFirstRun = useRef(true);
  useEffect(() => {
    if (weightsFirstRun.current) { weightsFirstRun.current = false; return; }
    if (riskGrid.length === 0) return;
    let cancelled = false;
    async function applyWeights() {
      const myId = ++routeReqId.current;
      setIsRouteUpdating(true);
      try {
        const gridRes = await updateWeights(debouncedWeights);
        if (cancelled || myId !== routeReqId.current) return;
        setRiskGrid(gridRes);
        syncDemoFlag();
      } catch (err) {
        console.error('Weight update failed:', err);
        if (!cancelled && myId === routeReqId.current) setIsRouteUpdating(false);
        return;
      }
      await refreshComparison();
    }
    applyWeights();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedWeights]);

  const handleLayerToggle = (layer: keyof DataLayersState) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  const handleRunSimulation = async () => {
    const myId = ++simReqId.current;
    setIsLoading(true);
    setError(null);
    try {
      const mcRes = await predictTrajectory(predictionHours, 200);
      if (myId !== simReqId.current) return;
      setMonteCarloData(mcRes);

      const gridRes = await fetchGridRiskMap();
      if (myId !== simReqId.current) return;
      setRiskGrid(gridRes);

      await refreshComparison();
      syncDemoFlag();
    } catch (err) {
      console.error('Simulation failed:', err);
      setError('Simulation request failed. Please retry — demo data is shown meanwhile.');
    } finally {
      if (myId === simReqId.current) setIsLoading(false);
    }
  };

  const handleCompareRoutes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const compRes = await refreshComparison();
      if (compRes) {
        // Focus the recommended option and mirror it into telemetry.
        setSelectedOption('balanced');
        setRoutingMode('balanced');
        setActiveRoute(compRes.balanced);
      }
    } catch (err) {
      console.error('Compare failed:', err);
      setError('Route comparison failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectOption = (key: RouteOptionKey) => {
    setSelectedOption(key);
    // Mirror the chosen route into the telemetry card so numbers match the map.
    if (routeComparison) setActiveRoute(routeComparison[key]);
  };

  // Slider moves update instantly locally; backend sync happens via debounce above.
  const handleWeightChange = (key: keyof MCDMWeights, val: number) => {
    setWeights((prev) => ({ ...prev, [key]: val }));
  };

  const handleResetWeights = () => {
    setWeights(DEFAULT_WEIGHTS);
  };

  return (
    <div className="flex flex-col h-dvh w-full bg-black text-[#dbe4f0] antialiased">
      <SIHHeader
        onRunSimulation={handleRunSimulation}
        onCompareRoutes={handleCompareRoutes}
        isLoading={isLoading}
        view={view}
        onViewChange={setView}
        alertCount={unackedCount}
      />

      {(error || demoMode) && (
        <div className={`flex items-center justify-center gap-2 border-b px-4 py-1.5 text-[12px] ${
          error ? 'border-amber-900/50 bg-amber-950/40 text-amber-200' : 'border-[#262626] bg-[#090909] text-[#8b98ad]'
        }`}>
          <span>{error ?? 'Demo data mode — backend unreachable. Start it with `uvicorn backend.main:app --reload` for live simulation.'}</span>
          {error && (
            <button onClick={() => { setError(null); handleRunSimulation(); }} className="font-medium underline underline-offset-2 hover:no-underline">
              Retry
            </button>
          )}
        </div>
      )}

      {view === 'alerts' ? (
        <div className="flex-1 min-h-0 flex">
          <AlertsView
            alerts={alerts}
            acknowledged={acknowledged}
            onAcknowledge={acknowledge}
            onAcknowledgeAll={acknowledgeAll}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          <SIHLeftSidebar
            layers={layers}
            onLayerToggle={handleLayerToggle}
            predictionHours={predictionHours}
            onPredictionHoursChange={setPredictionHours}
            routingMode={routingMode}
            onRoutingModeChange={setRoutingMode}
            maxRisk={maxRisk}
            onMaxRiskChange={setMaxRisk}
            weights={weights}
            onWeightChange={handleWeightChange}
            onResetWeights={handleResetWeights}
            originMode={originMode}
            onOriginModeChange={setOriginMode}
            startPlaceId={startPlaceId}
            onStartPlaceChange={setStartPlaceId}
            destPlaceId={destPlaceId}
            onDestPlaceChange={setDestPlaceId}
          />

          <main className="flex-1 relative min-h-[420px] lg:min-h-0 min-w-0 bg-black">
            <SIHMapView
              riskGrid={riskGrid}
              layers={layers}
              icebergs={icebergs}
              monteCarloData={monteCarloData}
              activeRoute={activeRoute}
              routeComparison={routeComparison}
              startPos={startPos}
              destPos={destPos}
              startLabel={startLabel}
              destLabel={destLabel}
              emphasizedRoute={routeComparison ? selectedOption : null}
              onRouteSelect={handleSelectOption}
            />
            {(isLoading || isRouteUpdating) && (
            <div className="absolute inset-0 z-[800] flex items-center justify-center bg-black/55 pointer-events-none">
              <div className="flex items-center gap-2.5 rounded-full border border-[#333333] bg-[#0d0d0d]/95 px-4 py-2 text-[12.5px] text-slate-200 shadow-xl">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-500 border-t-slate-100" />
                  {isLoading ? 'Updating risk map and route…' : 'Recalculating route…'}
                </div>
              </div>
            )}
          </main>

          <SIHRightSidebar
            activeRoute={activeRoute}
            routeComparison={routeComparison}
            icebergs={icebergs}
            predictionConfidence={monteCarloData?.confidence || 85}
            uncertaintyRadiusKm={monteCarloData?.uncertainty_radius_km || 14.2}
            systemStatus={systemStatus}
            selectedOption={selectedOption}
            onSelectOption={handleSelectOption}
          />
        </div>
      )}
    </div>
  );
}

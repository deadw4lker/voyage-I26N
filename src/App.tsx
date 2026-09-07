import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  GridCellData, DataLayersState, MCDMWeights, IcebergData,
  MonteCarloResponse, RouteResponse, RouteComparisonResponse, SystemStatus
} from './types/sih';
import {
  fetchSystemStatus, fetchGridRiskMap, fetchIcebergs, updateWeights,
  predictTrajectory, calculateRoute, compareRoutes, isDemoFallback,
} from './services/api';
import { SIHHeader } from './components/sih/SIHHeader';
import { SIHLeftSidebar } from './components/sih/SIHLeftSidebar';
import { SIHRightSidebar } from './components/sih/SIHRightSidebar';
import { SIHMapView } from './components/sih/SIHMapView';

const START_POS: [number, number] = [-65.2, 42.5];
const DEST_POS: [number, number] = [-69.4, 76.2];

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
  const [activePreset, setActivePreset] = useState<string>('Bharati Supply');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRouteUpdating, setIsRouteUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState<boolean>(false);

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
  const [showComparison, setShowComparison] = useState<boolean>(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  // Single-flight guards so rapid control changes can't stack stale responses.
  const routeReqId = useRef(0);
  const simReqId = useRef(0);

  const syncDemoFlag = useCallback(() => {
    if (isDemoFallback()) setDemoMode(true);
  }, []);

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

        const myId = ++routeReqId.current;
        const routeRes = await calculateRoute(START_POS, DEST_POS, 'balanced', 0.70, 14.0);
        if (cancelled || myId !== routeReqId.current) return;
        setActiveRoute(routeRes);
        syncDemoFlag();
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
  }, [syncDemoFlag]);

  // Debounced route recalc on mode / risk tolerance change.
  const debouncedMode = useDebouncedValue(routingMode, 350);
  const debouncedRisk = useDebouncedValue(maxRisk, 350);
  useEffect(() => {
    if (riskGrid.length === 0) return;
    let cancelled = false;
    async function updateRoute() {
      const myId = ++routeReqId.current;
      setIsRouteUpdating(true);
      try {
        const routeRes = await calculateRoute(START_POS, DEST_POS, debouncedMode, debouncedRisk, 14.0);
        if (cancelled || myId !== routeReqId.current) return;
        setActiveRoute(routeRes);
        syncDemoFlag();
      } catch (err) {
        console.error('Route update failed:', err);
      } finally {
        if (!cancelled && myId === routeReqId.current) setIsRouteUpdating(false);
      }
    }
    updateRoute();
    return () => { cancelled = true; };
  }, [debouncedMode, debouncedRisk, riskGrid.length, syncDemoFlag]);

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
        const routeRes = await calculateRoute(START_POS, DEST_POS, routingMode, maxRisk, 14.0);
        if (cancelled || myId !== routeReqId.current) return;
        setActiveRoute(routeRes);
        if (showComparison) {
          const compRes = await compareRoutes(START_POS, DEST_POS, maxRisk, 14.0);
          if (cancelled || myId !== routeReqId.current) return;
          setRouteComparison(compRes);
        }
        syncDemoFlag();
      } catch (err) {
        console.error('Weight update failed:', err);
      } finally {
        if (!cancelled && myId === routeReqId.current) setIsRouteUpdating(false);
      }
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

      const routeRes = await calculateRoute(START_POS, DEST_POS, routingMode, maxRisk, 14.0);
      if (myId !== simReqId.current) return;
      setActiveRoute(routeRes);

      if (showComparison) {
        const compRes = await compareRoutes(START_POS, DEST_POS, maxRisk, 14.0);
        if (myId !== simReqId.current) return;
        setRouteComparison(compRes);
      }
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
      const compRes = await compareRoutes(START_POS, DEST_POS, maxRisk, 14.0);
      setRouteComparison(compRes);
      setShowComparison(true);
      syncDemoFlag();
    } catch (err) {
      console.error('Compare failed:', err);
      setError('Route comparison failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Slider moves update instantly locally; backend sync happens via debounce above.
  const handleWeightChange = (key: keyof MCDMWeights, val: number) => {
    setWeights((prev) => ({ ...prev, [key]: val }));
  };

  const handleResetWeights = () => {
    setWeights(DEFAULT_WEIGHTS);
  };

  const handlePresetSelect = (preset: string) => {
    setActivePreset(preset);
    if (preset === 'Severe Pack Ice') {
      setWeights((prev) => ({ ...prev, sea_ice_risk: 0.45, iceberg_risk: 0.35 }));
    } else if (preset === 'Prydz Bay Patrol') {
      setRoutingMode('fastest');
    } else {
      setRoutingMode('balanced');
    }
  };

  return (
    <div className="flex flex-col h-dvh w-full bg-[#0a111e] text-[#dbe4f0] antialiased">
      <SIHHeader
        onRunSimulation={handleRunSimulation}
        onCompareRoutes={handleCompareRoutes}
        isLoading={isLoading}
        activePreset={activePreset}
        onPresetSelect={handlePresetSelect}
      />

      {(error || demoMode) && (
        <div className={`flex items-center justify-center gap-2 border-b px-4 py-1.5 text-[12px] ${
          error ? 'border-amber-900/50 bg-amber-950/40 text-amber-200' : 'border-[#1e2b45] bg-[#0c1527] text-[#8b98ad]'
        }`}>
          <span>{error ?? 'Demo data mode — backend unreachable. Start it with `uvicorn backend.main:app --reload` for live simulation.'}</span>
          {error && (
            <button onClick={() => { setError(null); handleRunSimulation(); }} className="font-medium underline underline-offset-2 hover:no-underline">
              Retry
            </button>
          )}
        </div>
      )}

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
        />

        <main className="flex-1 relative min-h-[420px] lg:min-h-0 min-w-0 bg-[#070d18]">
          <SIHMapView
            riskGrid={riskGrid}
            layers={layers}
            icebergs={icebergs}
            monteCarloData={monteCarloData}
            activeRoute={activeRoute}
            routeComparison={routeComparison}
            showComparison={showComparison}
            startPos={START_POS}
            destPos={DEST_POS}
          />
          {(isLoading || isRouteUpdating) && (
            <div className="absolute inset-0 z-[800] flex items-center justify-center bg-[#070d18]/55 pointer-events-none">
              <div className="flex items-center gap-2.5 rounded-full border border-[#2a3c5c] bg-[#0f1a2f]/95 px-4 py-2 text-[12.5px] text-slate-200 shadow-xl">
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
        />
      </div>
    </div>
  );
}

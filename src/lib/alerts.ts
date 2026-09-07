import type {
  GridCellData, IcebergData, MonteCarloResponse, RouteResponse,
} from '../types/sih';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AlertItem {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  source: string;
}

interface AlertInput {
  icebergs: IcebergData[];
  riskGrid: GridCellData[][];
  activeRoute: RouteResponse | null;
  monteCarlo: MonteCarloResponse | null;
}

/**
 * Derives ops alerts from live state — no backend dependency.
 * Rules mirror the SIH risk bands used by the MCDM engine.
 */
export function buildAlerts({ icebergs, riskGrid, activeRoute, monteCarlo }: AlertInput): AlertItem[] {
  const alerts: AlertItem[] = [];

  // 1. High-risk icebergs
  for (const berg of icebergs) {
    if (berg.risk_rating >= 75) {
      alerts.push({
        id: `berg-${berg.id}`,
        severity: 'critical',
        title: `High-risk iceberg ${berg.id} (${berg.size_category})`,
        detail: `Risk rating ${berg.risk_rating}% · drifting ${berg.drift_speed} kn at ${berg.drift_direction}° near ${Math.abs(berg.latitude).toFixed(1)}°S, ${berg.longitude.toFixed(1)}°E.`,
        source: berg.source,
      });
    } else if (berg.risk_rating >= 60) {
      alerts.push({
        id: `berg-${berg.id}`,
        severity: 'warning',
        title: `Iceberg ${berg.id} above watch threshold`,
        detail: `Risk rating ${berg.risk_rating}% · ${berg.size_category} · source ${berg.source}.`,
        source: berg.source,
      });
    }
  }

  // 2. Extreme cells in sector
  if (riskGrid.length > 0) {
    let extreme = 0;
    let maxWind = 0;
    for (const row of riskGrid) {
      for (const cell of row) {
        if (cell.risk_score >= 0.8) extreme++;
        if (cell.wind_speed > maxWind) maxWind = cell.wind_speed;
      }
    }
    if (extreme > 0) {
      alerts.push({
        id: 'sector-extreme',
        severity: extreme > 15 ? 'critical' : 'warning',
        title: `${extreme} extreme-risk cells in sector`,
        detail: 'Cells scoring 80+/100 on the MCDM risk map. Routing treats them as blocked above your risk tolerance.',
        source: 'Risk engine',
      });
    }
    if (maxWind >= 60) {
      alerts.push({
        id: 'gale',
        severity: 'warning',
        title: `Gale conditions — winds to ${maxWind.toFixed(0)} km/h`,
        detail: 'Katabatic outflow raising the weather/wind risk factor across southern cells.',
        source: 'ERA5 schema',
      });
    }
  }

  // 3. Active route findings
  if (activeRoute) {
    if (activeRoute.risk_level === 'HIGH' || activeRoute.risk_level === 'VERY HIGH' || activeRoute.risk_level === 'EXTREME') {
      alerts.push({
        id: 'route-risk',
        severity: activeRoute.risk_level === 'HIGH' ? 'warning' : 'critical',
        title: `Active route rated ${activeRoute.risk_level.charAt(0) + activeRoute.risk_level.slice(1).toLowerCase()}`,
        detail: `Mean risk ${(activeRoute.risk_score * 100).toFixed(0)}/100 over ${activeRoute.distance_km.toFixed(0)} km. Consider the safest alternative.`,
        source: 'Router (A*)',
      });
    }
    if (activeRoute.iceberg_encounters > 0) {
      alerts.push({
        id: 'route-bergs',
        severity: activeRoute.iceberg_encounters > 3 ? 'critical' : 'warning',
        title: `${activeRoute.iceberg_encounters} iceberg-zone crossings on route`,
        detail: 'Route passes through cells with >15% forecast iceberg probability.',
        source: 'Monte Carlo',
      });
    }
    if (activeRoute.safety_margin_percent < 30) {
      alerts.push({
        id: 'route-margin',
        severity: 'critical',
        title: `Thin safety margin — ${activeRoute.safety_margin_percent.toFixed(0)}%`,
        detail: 'Peak cell risk on this route leaves little headroom. Lower risk tolerance or switch to safest.',
        source: 'Router (A*)',
      });
    }
  }

  // 4. Forecast quality
  if (monteCarlo && monteCarlo.confidence < 70) {
    alerts.push({
      id: 'low-confidence',
      severity: 'warning',
      title: `Forecast confidence ${monteCarlo.confidence.toFixed(0)}%`,
      detail: `Trajectory spread ±${monteCarlo.uncertainty_radius_km.toFixed(1)} km at +${monteCarlo.prediction_hours} h. Treat cones as advisory.`,
      source: 'Monte Carlo',
    });
  }

  const rank: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

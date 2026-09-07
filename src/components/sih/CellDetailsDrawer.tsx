import type { GridCellData } from '../../types/sih';
import { X } from 'lucide-react';

interface CellDetailsDrawerProps {
  cell: GridCellData | null;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[7px]">
      <span className="text-[12.5px] text-[#8b98ad]">{label}</span>
      <span className="tabular text-right text-[12.5px] font-medium text-slate-100">{value}</span>
    </div>
  );
}

export function CellDetailsDrawer({ cell, onClose }: CellDetailsDrawerProps) {
  if (!cell) return null;

  const levelLabel = cell.risk_level.charAt(0) + cell.risk_level.slice(1).toLowerCase();
  const dot =
    cell.risk_score >= 0.6
      ? 'bg-rose-400'
      : cell.risk_score >= 0.4
        ? 'bg-orange-400'
        : cell.risk_score >= 0.2
          ? 'bg-amber-300'
          : 'bg-emerald-400';

  return (
    <div className="absolute bottom-4 right-4 z-[1000] w-[300px] max-w-[calc(100%-2rem)] rounded-xl border border-[#2a3c5c] bg-[#0f1a2f]/98 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-slate-50">
            Cell {cell.row}, {cell.col}
          </p>
          <p className="tabular mt-0.5 text-[11.5px] text-[#8b98ad]">
            {Math.abs(cell.latitude).toFixed(2)}°S, {cell.longitude.toFixed(2)}°E
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close cell details"
          className="rounded-md p-1 text-[#8b98ad] hover:bg-[#1c2f4f] hover:text-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#0a1222] px-3 py-2.5">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="tabular text-[15px] font-semibold text-slate-50">
          {(cell.risk_score * 100).toFixed(0)}
        </span>
        <span className="text-[12px] text-[#8b98ad]">/ 100 · {levelLabel} risk</span>
      </div>

      <div className="mt-2 divide-y divide-[#1e2b45]">
        <Row label="Iceberg probability" value={`${((cell.iceberg_probability || 0) * 100).toFixed(0)}%`} />
        <Row label="Sea ice" value={`${(cell.ice_concentration * 100).toFixed(0)}% · ${cell.ice_type}`} />
        <Row label="Current" value={`${cell.current_speed.toFixed(2)} m/s · ${cell.current_direction.toFixed(0)}°`} />
        <Row label="Wind" value={`${cell.wind_speed.toFixed(0)} km/h · ${cell.wind_direction.toFixed(0)}°`} />
        <Row label="Waves" value={`${cell.wave_height.toFixed(1)} m · ${cell.wave_direction.toFixed(0)}°`} />
        <Row label="Depth" value={`${cell.water_depth.toFixed(0)} m`} />
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-[#5c6b84]">
        Click another cell to inspect it, or close this panel to return to the route.
      </p>
    </div>
  );
}

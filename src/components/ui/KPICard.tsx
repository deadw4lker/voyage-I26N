import { cn } from '../../lib/utils';

interface KPICardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta: string;
  deltaType: 'up' | 'down';
}

export function KPICard({ label, value, unit, delta }: KPICardProps) {
  return (
    <div className="panel kpi !p-4">
      <div className="text-[12px] text-ice-faint mb-1.5">{label}</div>
      <div className="text-[24px] font-semibold text-ice tracking-tight flex items-baseline gap-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
        {unit && <small className="font-normal text-[13px] font-medium text-ice-faint">{unit}</small>}
      </div>
      <div className={cn('text-[12px] mt-1.5 text-ice-dim')}>
        {delta}
      </div>
    </div>
  );
}

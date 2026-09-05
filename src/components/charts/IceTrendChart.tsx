import {
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export interface TrendPoint {
  label: string;
  value: number | null;
}

interface IceTrendChartProps {
  title: string;
  legendItems: { color: string; label: string }[];
  observed?: TrendPoint[];
  projected?: TrendPoint[];
  observedName?: string;
  projectedName?: string;
}

const COLORS = {
  grid: '#edf1f5',
  axis: '#8a94a6',
};

const observedData = [
  { label: 'D-7', value: 58 },
  { label: 'D-6', value: 60 },
  { label: 'D-5', value: 61 },
  { label: 'D-4', value: 63 },
  { label: 'D-3', value: 65 },
  { label: 'D-2', value: 64 },
  { label: 'D-1', value: 66 },
  { label: 'D0', value: 67 },
  { label: 'D+1', value: null },
  { label: 'D+2', value: null },
  { label: 'D+3', value: null },
  { label: 'D+4', value: null },
  { label: 'D+5', value: null },
  { label: 'D+6', value: null },
  { label: 'D+7', value: null },
];

const forecastData = [
  { label: 'D-7', value: null },
  { label: 'D-6', value: null },
  { label: 'D-5', value: null },
  { label: 'D-4', value: null },
  { label: 'D-3', value: null },
  { label: 'D-2', value: null },
  { label: 'D-1', value: null },
  { label: 'D0', value: 67 },
  { label: 'D+1', value: 69 },
  { label: 'D+2', value: 71 },
  { label: 'D+3', value: 74 },
  { label: 'D+4', value: 76 },
  { label: 'D+5', value: 79 },
  { label: 'D+6', value: 81 },
  { label: 'D+7', value: 83 },
];



export function IceTrendChart({
  title,
  legendItems,
  observed = observedData,
  projected = forecastData,
  observedName = 'Observed',
  projectedName = 'AI Forecast',
}: IceTrendChartProps) {
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number | null; color: string; name: string }>; label?: string }) => {
    if (!active || !payload) return null;
    return (
      <div className="bg-white border border-border rounded-md p-3" style={{ minWidth: 140 }}>
        <p className="text-[11px] text-ice-faint mb-1">{label}</p>
        {payload.map((entry, index) => (
          entry.value !== null && (
            <p key={index} className="flex items-center gap-2 text-[12px]" style={{ color: entry.color }}>
              <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
              {entry.name}: <span className="text-ice">{entry.value}%</span>
            </p>
          )
        ))}
      </div>
    );
  };

  // Uncertainty band widens with lead time around the projected series.
  const upperBandLive = projected.map((p, i) => ({
    label: p.label,
    value: p.value === null ? null : Math.min(100, p.value + 2 + i * 0.8),
  }));
  const lowerBandLive = projected.map((p, i) => ({
    label: p.label,
    value: p.value === null ? null : Math.max(0, p.value - 2 - i * 0.8),
  }));

  return (
    <div className="panel">
      <div className="panel-head flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="font-display text-[15px] font-semibold">{title}</h2>
        <div className="legend-inline flex gap-4 text-[11px] text-ice-faint items-center flex-wrap">
          {legendItems.map((item, index) => (
            <span key={index} className="flex items-center gap-2">
              <span className="dot w-2.5 h-0.5 rounded" style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>
      <div className="chart-box relative h-56" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={observed} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="observedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1f3a5f" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#1f3a5f" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#64748b" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
            <XAxis
              dataKey="label"
              stroke={COLORS.axis}
              fontSize={11}
              fontFamily="'Inter', sans-serif"
              tickLine={false}
              axisLine={false}
              interval={2}
            />
            <YAxis
              stroke={COLORS.axis}
              fontSize={11}
              fontFamily="'Inter', sans-serif"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}%`}
              interval={5}
            />
            <Tooltip content={<CustomTooltip />} wrapperStyle={{ outline: 'none' }} />
            <Area
              type="monotone"
              dataKey="value"
              data={upperBandLive}
              stroke="transparent"
              fill="#e6ebf1"
              fillOpacity={1}
            />
            <Line
              type="monotone"
              dataKey="value"
              data={lowerBandLive}
              stroke="transparent"
              fill="transparent"
            />
            <Line
              type="monotone"
              dataKey="value"
              data={observed}
              stroke="#1f3a5f"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#1f3a5f', strokeWidth: 2 }}
              strokeDasharray="0"
              connectNulls={false}
              name={observedName}
            />
            <Line
              type="monotone"
              dataKey="value"
              data={projected}
              stroke="#64748b"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 4, fill: '#64748b', strokeWidth: 2 }}
              connectNulls={false}
              name={projectedName}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
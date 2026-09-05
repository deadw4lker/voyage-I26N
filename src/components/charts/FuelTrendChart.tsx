import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const COLORS = {
  grid: '#edf1f5',
  axis: '#8a94a6',
};

const fuelData = [
  { label: 'Voyage 1', value: 4 },
  { label: 'Voyage 2', value: 7 },
  { label: 'Voyage 3', value: 11 },
  { label: 'Voyage 4', value: 13 },
  { label: 'Voyage 5', value: 16 },
  { label: 'Voyage 6', value: 18.4 },
];

interface FuelTrendChartProps {
  title: string;
  hint: string;
}

export function FuelTrendChart({ title, hint }: FuelTrendChartProps) {

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; color: string; name: string }>; label?: string }) => {
    if (!active || !payload) return null;
    return (
      <div className="bg-white border border-border rounded-md p-3" style={{ minWidth: 140 }}>
        <p className="text-[11px] text-ice-faint mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="flex items-center gap-2 text-[12px]" style={{ color: entry.color }}>
            <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            {entry.name}: <span className="text-ice">{entry.value}%</span>
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="panel">
      <div className="panel-head flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="font-display text-[15px] font-semibold">{title}</h2>
        <span className="hint text-[11.5px] text-ice-faint">{hint}</span>
      </div>
      <div className="chart-box relative" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={fuelData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="fuelGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1f3a5f" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#1f3a5f" stopOpacity={0} />
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
            />
            <YAxis
              stroke={COLORS.axis}
              fontSize={11}
              fontFamily="'Inter', sans-serif"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} wrapperStyle={{ outline: 'none' }} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#1f3a5f"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#1f3a5f', strokeWidth: 2 }}
              name="Cumulative fuel saved"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
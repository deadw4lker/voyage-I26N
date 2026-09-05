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

const COLORS = {
  grid: '#edf1f5',
  axis: '#8a94a6',
};

const trajectoryData = [
  { label: 'D0', predicted: 4.2, upper: 4.2, lower: 4.2 },
  { label: 'D1', predicted: 3.6, upper: 4.0, lower: 3.2 },
  { label: 'D2', predicted: 3.0, upper: 3.6, lower: 2.4 },
  { label: 'D3', predicted: 2.6, upper: 3.4, lower: 1.8 },
  { label: 'D4', predicted: 2.4, upper: 3.4, lower: 1.4 },
  { label: 'D5', predicted: 2.5, upper: 3.7, lower: 1.3 },
  { label: 'D6', predicted: 2.7, upper: 4.1, lower: 1.3 },
];

export function BergTrajectoryChart() {

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; color: string; name: string }>; label?: string }) => {
    if (!active || !payload) return null;
    return (
      <div className="bg-white border border-border rounded-md p-3" style={{ minWidth: 160 }}>
        <p className="text-[11px] text-ice-faint mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="flex items-center gap-2 text-[12px]" style={{ color: entry.color }}>
            <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            {entry.name}: <span className="text-ice">{entry.value} nm</span>
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="chart-box relative" style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trajectoryData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="trajectoryGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#64748b" stopOpacity={0.14} />
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
          />
          <YAxis
            stroke={COLORS.axis}
            fontSize={11}
            fontFamily="'Inter', sans-serif"
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value} nm`}
          />
          <Tooltip content={<CustomTooltip />} wrapperStyle={{ outline: 'none' }} />
          <Area
            type="monotone"
            dataKey="upper"
            stroke="transparent"
            fill="#e6ebf1"
            fillOpacity={1}
          />
          <Line
            type="monotone"
            dataKey="lower"
            stroke="transparent"
            fill="transparent"
          />
          <Line
            type="monotone"
            dataKey="predicted"
            stroke="#64748b"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 4, fill: '#64748b', strokeWidth: 2 }}
            name="Predicted distance"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
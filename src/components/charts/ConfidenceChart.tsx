import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ConfidenceChartProps {
  title: string;
  hint?: string;
  data?: { label: string; value: number }[];
}

const COLORS = {
  grid: '#edf1f5',
  axis: '#8a94a6',
};

const confidenceData = [
  { label: 'D0', value: 96 },
  { label: 'D1', value: 94 },
  { label: 'D2', value: 92 },
  { label: 'D3', value: 90 },
  { label: 'D4', value: 88 },
  { label: 'D5', value: 85 },
  { label: 'D6', value: 83 },
  { label: 'D7', value: 80 },
  { label: 'D8', value: 78 },
  { label: 'D9', value: 76 },
  { label: 'D10', value: 74 },
  { label: 'D11', value: 72 },
  { label: 'D12', value: 71 },
  { label: 'D13', value: 70 },
  { label: 'D14', value: 69 },
];

export function ConfidenceChart({ title, hint, data = confidenceData }: ConfidenceChartProps) {

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
      <div className="panel-head mb-4">
        <h2 className="font-display text-[15px] font-semibold">{title}</h2>
        {hint && <span className="hint text-[11.5px] text-ice-faint">{hint}</span>}
      </div>
      <div className="chart-box relative" style={{ height: 170 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1f3a5f" stopOpacity={0.1} />
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
              interval={2}
            />
            <YAxis
              stroke={COLORS.axis}
              fontSize={11}
              fontFamily="'Inter', sans-serif"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}%`}
              interval={10}
              domain={[50, 100]}
            />
            <Tooltip content={<CustomTooltip />} wrapperStyle={{ outline: 'none' }} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#1f3a5f"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#1f3a5f', strokeWidth: 2 }}
              strokeDasharray="0"
              name="Confidence"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
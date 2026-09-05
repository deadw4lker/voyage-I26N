interface SafetyBreakdownChartProps {
  title: string;
  hint: string;
  factors: { label: string; value: number }[];
}

export function SafetyBreakdownChart({ title, hint, factors }: SafetyBreakdownChartProps) {

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        <span className="hint">{hint}</span>
      </div>

      <div className="space-y-2.5">
        {factors.map((factor) => (
          <div key={factor.label} className="factor">
            <div className="flex justify-between text-[12px] text-ice-dim mb-1">
              <span>{factor.label}</span>
              <span className="text-ice" style={{ fontVariantNumeric: 'tabular-nums' }}>{factor.value}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#eef1f5] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#475569]"
                style={{ width: `${factor.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

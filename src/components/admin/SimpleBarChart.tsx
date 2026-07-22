interface BarDatum {
  label: string;
  value: number;
}

interface SimpleBarChartProps {
  data: BarDatum[];
  formatValue?: (value: number) => string;
  height?: number;
  barColorClassName?: string;
}

/** Minimal dependency-free SVG bar chart — used across Dashboard/Analytics/Reports. */
export function SimpleBarChart({ data, formatValue = String, height = 220, barColorClassName = 'fill-admin-orange' }: SimpleBarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barWidth = 100 / Math.max(data.length, 1);

  if (data.length === 0) {
    return <div className="flex h-40 items-center justify-center text-sm text-admin-text-secondary">No data yet.</div>;
  }

  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-56 w-full overflow-visible">
        <line x1={0} y1={height - 30} x2={100} y2={height - 30} className="stroke-admin-border" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {data.map((d, i) => {
          const barHeight = (d.value / max) * (height - 30);
          const x = i * barWidth;
          return (
            <g key={d.label}>
              <rect
                x={x + barWidth * 0.15}
                y={height - 30 - barHeight}
                width={barWidth * 0.7}
                height={Math.max(barHeight, 1)}
                rx={2}
                className={barColorClassName}
              >
                <title>{`${d.label}: ${formatValue(d.value)}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex text-center text-[10px] text-admin-text-secondary">
        {data.map((d) => (
          <div key={d.label} style={{ width: `${barWidth}%` }} className="truncate px-0.5">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

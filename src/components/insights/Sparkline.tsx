import { Area, AreaChart, ResponsiveContainer } from "recharts";

/** Tiny inline area chart. `data` is a numeric series. */
export function Sparkline({ data, color = "hsl(var(--primary))", height = 36 }: { data: number[]; color?: string; height?: number }) {
  const series = (data.length ? data : [0, 0]).map((v, i) => ({ i, v }));
  const id = `spark-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={series} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#${id})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

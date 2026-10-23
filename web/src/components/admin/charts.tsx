"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Single series, one hue (brand red). Thin bars, quiet grid, tooltip on hover. A table view sits beside each chart for accessibility.
export function SalesChart({ data }: { data: { day: string; revenue: number; orders: number }[] }) {
  return (
    <div role="img" aria-label="Daily sales for the last 30 days, in SAR" className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={48} tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
          <Tooltip cursor={{ fill: "var(--accent)" }} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
            formatter={(v, n) => (n === "revenue" ? [`SAR ${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Sales"] : [v, "Orders"])} labelFormatter={(l) => String(l)} />
          <Bar dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HBarList({ rows, unit }: { rows: { label: string; value: number }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="text-sm text-muted-foreground">No data yet.</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="mb-1 flex justify-between gap-3"><span className="truncate">{r.label}</span><span className="tabular-nums text-muted-foreground">{r.value.toLocaleString("en-US")} {unit}</span></div>
          <div className="h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function LineTrend({ data, keys }: { data: Record<string, number | string>[]; keys: { key: string; label: string }[] }) {
  // One series per chart keeps colour meaning unambiguous; the first key is drawn.
  const k = keys[0];
  return (
    <div role="img" aria-label={`${k.label} per day`} className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={36} />
          <Tooltip cursor={{ fill: "var(--accent)" }} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }} formatter={(v) => [v, k.label]} />
          <Bar dataKey={k.key} fill="var(--ink)" radius={[4, 4, 0, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

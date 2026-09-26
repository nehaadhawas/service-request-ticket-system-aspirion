import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DbGate, PageHeader } from "@/components/app";
import { slaState, type DB } from "@/lib/db";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [
    { title: "Analytics — ServiceDesk" },
    { name: "description", content: "Resolution trends, category mix and SLA performance from ticket data." },
    { property: "og:title", content: "Analytics — ServiceDesk" },
    { property: "og:description", content: "Resolution trends, category mix and SLA performance from ticket data." },
  ] }),
  component: () => <DbGate>{(db) => <Analytics db={db} />}</DbGate>,
});

const axis = { fontSize: 11, stroke: "var(--muted-foreground)" };
function Chart({ title, sub, empty, children }: { title: string; sub?: string; empty: boolean; children: ReactNode }) {
  return (
    <div className="card p-4">
      <h2 className="text-sm font-semibold">{title}</h2>{sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      <div className="mt-3 h-64">{empty ? <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Not enough data for this metric yet.</div> : <ResponsiveContainer>{children as never}</ResponsiveContainer>}</div>
    </div>
  );
}

function Analytics({ db }: { db: DB }) {
  const resolved = db.tickets.filter((t) => t.resolved_at);
  const week = (s: string) => { const d = new Date(s); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return d.toISOString().slice(0, 10); };
  const byWeek = new Map<string, { n: number; hrs: number }>();
  resolved.forEach((t) => { const k = week(t.resolved_at!); const v = byWeek.get(k) ?? { n: 0, hrs: 0 }; v.n++; v.hrs += (Date.parse(t.resolved_at!) - Date.parse(t.created_at)) / 3600e3; byWeek.set(k, v); });
  const trend = [...byWeek.entries()].sort().map(([w, v]) => ({ week: w.slice(5), resolved: v.n, avg: Math.round((v.hrs / v.n) * 10) / 10 }));
  const cats = new Map<string, number>(); db.tickets.forEach((t) => cats.set(t.category, (cats.get(t.category) ?? 0) + 1));
  const catData = [...cats.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
  const catRes = new Map<string, { n: number; hrs: number; breach: number; total: number }>();
  db.tickets.forEach((t) => {
    const v = catRes.get(t.category) ?? { n: 0, hrs: 0, breach: 0, total: 0 }; const s = slaState(t);
    v.total++; if (s === "Breached" || s === "Missed") v.breach++;
    if (t.resolved_at) { v.n++; v.hrs += (Date.parse(t.resolved_at) - Date.parse(t.created_at)) / 3600e3; }
    catRes.set(t.category, v);
  });
  const avgRes = [...catRes.entries()].filter(([, v]) => v.n).map(([category, v]) => ({ category, hours: Math.round((v.hrs / v.n) * 10) / 10 }));
  const breach = [...catRes.entries()].map(([category, v]) => ({ category, rate: Math.round((v.breach / v.total) * 1000) / 10 }));
  const allBreach = db.tickets.filter((t) => ["Breached", "Missed"].includes(slaState(t))).length;

  return (
    <>
      <PageHeader title="Analytics" sub={`Overall SLA breach rate: ${db.tickets.length ? ((allBreach / db.tickets.length) * 100).toFixed(1) : 0}% · ${resolved.length} resolved tickets`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Chart title="Tickets resolved over time" sub="Per week" empty={trend.length < 2}>
          <LineChart data={trend}><CartesianGrid stroke="var(--border)" /><XAxis dataKey="week" {...axis} /><YAxis {...axis} /><Tooltip /><Line dataKey="resolved" stroke="var(--chart-1)" strokeWidth={2} dot={false} /></LineChart>
        </Chart>
        <Chart title="Tickets by category" empty={!catData.length}>
          <BarChart data={catData}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="category" {...axis} interval={0} angle={-20} textAnchor="end" height={50} /><YAxis {...axis} /><Tooltip /><Bar dataKey="count" fill="var(--chart-2)" radius={[3, 3, 0, 0]} /></BarChart>
        </Chart>
        <Chart title="Average resolution time" sub="Hours, by category" empty={!avgRes.length}>
          <BarChart data={avgRes}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="category" {...axis} interval={0} angle={-20} textAnchor="end" height={50} /><YAxis {...axis} /><Tooltip /><Bar dataKey="hours" fill="var(--chart-1)" radius={[3, 3, 0, 0]} /></BarChart>
        </Chart>
        <Chart title="SLA breach rate" sub="% of tickets breached or resolved late, by category" empty={!breach.length}>
          <BarChart data={breach}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="category" {...axis} interval={0} angle={-20} textAnchor="end" height={50} /><YAxis {...axis} unit="%" /><Tooltip /><Bar dataKey="rate" fill="var(--chart-5)" radius={[3, 3, 0, 0]} /></BarChart>
        </Chart>
      </div>
    </>
  );
}

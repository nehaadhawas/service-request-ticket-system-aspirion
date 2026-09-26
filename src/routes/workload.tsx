import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DbGate, PageHeader, Badge } from "@/components/app";
import { useStore } from "@/lib/store";
import { isActive, slaState, type DB } from "@/lib/db";

export const Route = createFileRoute("/workload")({
  head: () => ({ meta: [
    { title: "Agent workload — ServiceDesk" },
    { name: "description", content: "Active, high-priority and SLA-at-risk tickets per agent." },
    { property: "og:title", content: "Agent workload — ServiceDesk" },
    { property: "og:description", content: "Active, high-priority and SLA-at-risk tickets per agent." },
  ] }),
  component: () => <DbGate>{(db) => <Workload db={db} />}</DbGate>,
});

function Workload({ db }: { db: DB }) {
  const { priorityOf } = useStore();
  const [q, setQ] = useState("");
  const rows = db.agents.map((a) => {
    const act = db.tickets.filter((t) => t.assigned_agent_id === a.id && isActive(t));
    return { a, active: act.length, high: act.filter((t) => priorityOf(t).label === "High").length, risk: act.filter((t) => ["At risk", "Breached"].includes(slaState(t))).length };
  }).filter((r) => `${r.a.id} ${r.a.skills.join(" ")} ${r.a.experience}`.toLowerCase().includes(q.toLowerCase()))
    .sort((x, y) => y.active - x.active);
  return (
    <>
      <PageHeader title="Agent workload" sub={`${db.agents.length} agents`} action={<input className="field w-64" placeholder="Search agent, skill…" value={q} onChange={(e) => setQ(e.target.value)} />} />
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50"><tr><th className="th">Agent</th><th className="th">Experience</th><th className="th">Skills</th><th className="th text-right">Active</th><th className="th text-right">High priority</th><th className="th text-right">SLA at risk / breached</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.a.id} className="border-b last:border-0">
              <td className="td font-medium">{r.a.id}{!r.a.active && <span className="ml-1 text-xs text-muted-foreground">(inactive)</span>}</td>
              <td className="td">{r.a.experience}</td>
              <td className="td"><div className="flex flex-wrap gap-1">{r.a.skills.map((s) => <Badge key={s} t="brown">{s}</Badge>)}</div></td>
              <td className="td text-right">{r.active}</td>
              <td className="td text-right">{r.high}</td>
              <td className={`td text-right ${r.risk ? "font-medium text-destructive" : ""}`}>{r.risk}</td>
            </tr>))}
            {rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No agents found.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

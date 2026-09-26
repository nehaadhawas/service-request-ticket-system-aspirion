import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Clock, Flame, Inbox, UserX, Users, Plus } from "lucide-react";
import { DbGate, Kpi, PageHeader, TicketTable } from "@/components/app";
import { useStore } from "@/lib/store";
import { isActive, slaState } from "@/lib/db";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [
    { title: "Dashboard — ServiceDesk" },
    { name: "description", content: "Operations overview: open tickets, SLA risk and priority queue." },
    { property: "og:title", content: "Dashboard — ServiceDesk" },
    { property: "og:description", content: "Operations overview: open tickets, SLA risk and priority queue." },
  ] }),
  component: () => <DbGate>{() => <Dashboard />}</DbGate>,
});

function Dashboard() {
  const { db, priorityOf } = useStore();
  const d = db!;
  const active = d.tickets.filter(isActive);
  const sla = active.map((t) => slaState(t));
  const assigned = new Set(active.map((t) => t.assigned_agent_id).filter(Boolean));
  return (
    <>
      <PageHeader title="Operations dashboard" sub={`${d.tickets.length} tickets in database`} action={<Link to="/tickets/new" className="btn"><Plus className="h-4 w-4" />New ticket</Link>} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Open tickets" value={active.length} icon={Inbox} />
        <Kpi label="High priority" value={active.filter((t) => priorityOf(t).label === "High").length} icon={Flame} t="red" />
        <Kpi label="SLA at risk" value={sla.filter((s) => s === "At risk").length} icon={Clock} t="amber" />
        <Kpi label="SLA breached" value={sla.filter((s) => s === "Breached").length} icon={AlertTriangle} t="red" />
        <Kpi label="Unassigned" value={active.filter((t) => !t.assigned_agent_id).length} icon={UserX} t="amber" />
        <Kpi label="Active agents" value={`${assigned.size} / ${d.agents.filter((a) => a.active).length}`} icon={Users} />
      </div>
      <TicketTable db={d} tickets={d.tickets} />
    </>
  );
}

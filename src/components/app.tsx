import { Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { BarChart3, LayoutDashboard, Plus, Settings, Users, Loader2, AlertTriangle, Search, Ticket as TicketIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import { isActive, slaState, STATUSES, type DB, type SlaState, type Ticket } from "@/lib/db";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tickets/new", label: "New ticket", icon: Plus },
  { to: "/workload", label: "Workload", icon: Users },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="bg-sidebar text-sidebar-foreground md:w-56 md:shrink-0">
        <div className="flex items-center gap-2 px-4 py-4 font-semibold"><TicketIcon className="h-5 w-5" />ServiceDesk</div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }} activeOptions={{ exact: true }}>
              <n.icon className="h-4 w-4" />{n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}

export function DbGate({ children }: { children: (db: DB) => ReactNode }) {
  const { db, error } = useStore();
  if (error) return <div className="card flex items-center gap-2 p-4 text-destructive"><AlertTriangle className="h-4 w-4" />Could not load data: {error}</div>;
  if (!db) return <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading database…</div>;
  return <>{children(db)}</>;
}

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-xl font-semibold">{title}</h1>{sub && <p className="text-sm text-muted-foreground">{sub}</p>}</div>
      {action}
    </div>
  );
}

const tone = {
  red: "bg-destructive/10 text-destructive", amber: "bg-warning/15 text-foreground", green: "bg-success/10 text-success",
  brown: "bg-secondary text-secondary-foreground", gray: "bg-muted text-muted-foreground",
};
export function Badge({ t = "gray", children }: { t?: keyof typeof tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${tone[t]}`}>{children}</span>;
}
export const PriorityBadge = ({ label, score }: { label: string; score: number }) =>
  <Badge t={label === "High" ? "red" : label === "Medium" ? "amber" : "gray"}>{label} · {score.toFixed(0)}</Badge>;
export const SlaBadge = ({ s }: { s: SlaState }) =>
  <Badge t={s === "Breached" || s === "Missed" ? "red" : s === "At risk" ? "amber" : "green"}>{s}</Badge>;
export const StatusBadge = ({ s }: { s: string }) =>
  <Badge t={s === "Open" || s === "Reopened" ? "brown" : s === "In Progress" ? "amber" : "gray"}>{s}</Badge>;

export function TicketTable({ db, tickets }: { db: DB; tickets: Ticket[] }) {
  const { priorityOf } = useStore();
  const [q, setQ] = useState(""); const [status, setStatus] = useState("active"); const [prio, setPrio] = useState("");
  const [cat, setCat] = useState(""); const [agent, setAgent] = useState(""); const [limit, setLimit] = useState(50);
  const cust = useMemo(() => new Map(db.customers.map((c) => [c.id, c])), [db.customers]);
  const cats = useMemo(() => [...new Set(db.tickets.map((t) => t.category))].sort(), [db.tickets]);
  const rows = useMemo(() => {
    const s = q.toLowerCase();
    return tickets.map((t) => ({ t, p: priorityOf(t), sla: slaState(t) }))
      .filter(({ t, p }) =>
        (status === "" || (status === "active" ? isActive(t) : t.status === status)) &&
        (!prio || p.label === prio) && (!cat || t.category === cat) &&
        (!agent || (agent === "none" ? !t.assigned_agent_id : t.assigned_agent_id === agent)) &&
        (!s || `${t.id} ${t.subject} ${cust.get(t.customer_id)?.name ?? ""} ${t.tags.join(" ")}`.toLowerCase().includes(s)))
      .sort((a, b) => b.p.score - a.p.score);
  }, [tickets, q, status, prio, cat, agent, priorityOf, cust]);

  return (
    <div className="card">
      <div className="grid gap-2 border-b p-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative"><Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" /><input className="field pl-7" placeholder="Search ID, subject, customer, tag" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}><option value="active">Active (not resolved/closed)</option><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select className="field" value={prio} onChange={(e) => setPrio(e.target.value)}><option value="">All priorities</option><option>High</option><option>Medium</option><option>Low</option></select>
        <select className="field" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
        <select className="field" value={agent} onChange={(e) => setAgent(e.target.value)}><option value="">All assignees</option><option value="none">Unassigned</option>{db.agents.map((a) => <option key={a.id}>{a.id}</option>)}</select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50"><tr><th className="th">Priority</th><th className="th">Ticket</th><th className="th">Customer</th><th className="th">Category</th><th className="th">Status</th><th className="th">SLA</th><th className="th">Assignee</th></tr></thead>
          <tbody>
            {rows.slice(0, limit).map(({ t, p, sla }) => {
              const c = cust.get(t.customer_id);
              return (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="td"><PriorityBadge label={p.label} score={p.score} /></td>
                  <td className="td max-w-xs"><Link to="/tickets/$id" params={{ id: t.id }} className="font-medium text-primary hover:underline">{t.subject}</Link><div className="truncate text-xs text-muted-foreground">{t.id}{t.escalated && " · Escalated"}</div></td>
                  <td className="td">{c?.name}<div className="text-xs text-muted-foreground">{c?.tier}</div></td>
                  <td className="td">{t.category}<div className="text-xs text-muted-foreground">{t.subcategory}</div></td>
                  <td className="td"><StatusBadge s={t.status} /></td>
                  <td className="td"><SlaBadge s={sla} /></td>
                  <td className="td">{t.assigned_agent_id ?? <span className="text-muted-foreground">Unassigned</span>}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No tickets match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
        <span>Showing {Math.min(limit, rows.length)} of {rows.length}</span>
        {rows.length > limit && <button className="btn-ghost" onClick={() => setLimit(limit + 50)}>Show more</button>}
      </div>
    </div>
  );
}

export function Kpi({ label, value, icon: Icon, t }: { label: string; value: number | string; icon: typeof Users; t?: "red" | "amber" }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">{label}<Icon className={`h-4 w-4 ${t === "red" ? "text-destructive" : t === "amber" ? "text-warning" : "text-primary"}`} /></div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

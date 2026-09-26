import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { Badge, DbGate, PageHeader, PriorityBadge, SlaBadge, StatusBadge } from "@/components/app";
import { useStore } from "@/lib/store";
import { STATUSES, recommendAgents, slaState, type DB, type Status, type Ticket } from "@/lib/db";

export const Route = createFileRoute("/tickets/$id")({
  head: ({ params }) => ({ meta: [
    { title: `Ticket ${params.id} — ServiceDesk` },
    { name: "description", content: "Ticket details, priority explanation, SLA and activity history." },
    { property: "og:title", content: `Ticket ${params.id} — ServiceDesk` },
    { property: "og:description", content: "Ticket details, priority explanation, SLA and activity history." },
  ] }),
  component: () => <DbGate>{(db) => <Detail db={db} />}</DbGate>,
});

const fmt = (s: string | null) => (s ? new Date(s).toLocaleString() : "—");

function Detail({ db }: { db: DB }) {
  const { id } = Route.useParams();
  const t = db.tickets.find((x) => x.id === id);
  if (!t) return <div className="card p-8 text-center"><p className="mb-3">Ticket {id} not found.</p><Link to="/dashboard" className="btn-ghost">Back to dashboard</Link></div>;
  return <DetailBody key={t.id + t.updated_at} db={db} t={t} />;
}

function DetailBody({ db, t }: { db: DB; t: Ticket }) {
  const { priorityOf, editTicket } = useStore();
  const c = db.customers.find((x) => x.id === t.customer_id);
  const p = priorityOf(t);
  const recs = recommendAgents(db, t.category, p.score, t.sla_hours);
  const acts = db.activity.filter((a) => a.ticket_id === t.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const [e, setE] = useState({ status: t.status, agent: t.assigned_agent_id ?? "", override: t.priority_override?.toString() ?? "", escalated: t.escalated, tags: t.tags.join(", "), note: "" });
  const [saved, setSaved] = useState(false);

  function save() {
    const patch: Partial<Ticket> = {}; const logs: { action: string; note: string }[] = [];
    if (e.status !== t.status) {
      patch.status = e.status as Status; logs.push({ action: "status_changed", note: `${t.status} → ${e.status}` });
      patch.resolved_at = e.status === "Resolved" || e.status === "Closed" ? new Date().toISOString() : null;
    }
    if ((e.agent || null) !== t.assigned_agent_id) { patch.assigned_agent_id = e.agent || null; logs.push({ action: "assigned", note: e.agent ? `Assigned to ${e.agent}${e.agent === recs[0]?.agent.id ? " (recommended)" : ""}` : "Unassigned" }); }
    const ov = e.override === "" ? null : Math.max(0, Math.min(100, Number(e.override)));
    if (ov !== t.priority_override) { patch.priority_override = ov; logs.push({ action: "priority_override", note: ov == null ? "Override removed" : `Priority overridden to ${ov}` }); }
    if (e.escalated !== t.escalated) { patch.escalated = e.escalated; logs.push({ action: e.escalated ? "escalated" : "de_escalated", note: "" }); }
    const tags = e.tags.split(",").map((s) => s.trim()).filter(Boolean);
    if (tags.join() !== t.tags.join()) { patch.tags = tags; logs.push({ action: "tags_updated", note: tags.join(", ") || "No tags" }); }
    if (e.note.trim()) logs.push({ action: "agent_reply", note: e.note.trim() });
    if (!logs.length) return;
    editTicket(t.id, patch, logs); setSaved(true);
  }

  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex justify-between gap-3 py-1"><span className="text-muted-foreground">{k}</span><span className="text-right">{v}</span></div>;

  return (
    <>
      <Link to="/dashboard" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Dashboard</Link>
      <PageHeader title={t.subject} sub={`${t.id} · ${t.channel} · created ${fmt(t.created_at)}`} action={<div className="flex gap-2"><StatusBadge s={t.status} /><PriorityBadge label={p.label} score={p.score} /><SlaBadge s={slaState(t)} />{t.escalated && <Badge t="red">Escalated</Badge>}</div>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card p-4 text-sm">
            <p className="mb-3">{t.description || <span className="text-muted-foreground">No description</span>}</p>
            <div className="grid gap-x-6 sm:grid-cols-2">
              <Row k="Category" v={`${t.category} / ${t.subcategory}`} /><Row k="Severity" v={t.severity} />
              <Row k="Sentiment" v={t.sentiment.toFixed(2)} /><Row k="SLA" v={`${t.sla_hours}h · due ${fmt(t.deadline_at)}`} />
              <Row k="Resolved" v={fmt(t.resolved_at)} /><Row k="CSAT" v={t.csat ?? "—"} />
              <Row k="Keywords" v={t.keywords.join(", ") || "—"} /><Row k="Attachments" v={t.attachments.join(", ") || "—"} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">{t.tags.map((x) => <Badge key={x} t="brown">{x}</Badge>)}</div>
          </div>

          <div className="card p-4 text-sm">
            <h2 className="mb-2 font-semibold">Why this priority?</h2>
            <table className="w-full"><thead><tr className="border-b"><th className="th pl-0">Factor</th><th className="th">Input</th><th className="th">Raw (0–100)</th><th className="th">Weight</th><th className="th text-right">Points</th></tr></thead>
              <tbody>{p.parts.map((x) => <tr key={x.key} className="border-b"><td className="td pl-0">{x.label}</td><td className="td text-muted-foreground">{x.detail}</td><td className="td">{x.raw}</td><td className="td">{x.weight}%</td><td className="td text-right font-medium">{x.points}</td></tr>)}</tbody>
              <tfoot><tr><td className="td pl-0 font-semibold" colSpan={4}>Calculated score</td><td className="td text-right font-semibold">{p.computed}</td></tr></tfoot></table>
            {p.overridden && <p className="mt-2 text-xs">Manually overridden to <b>{p.score}</b>.</p>}
            {t.source_priority_score != null && <p className="mt-1 text-xs text-muted-foreground">Score in source data: {t.source_priority_score}</p>}
          </div>

          <div className="card p-4 text-sm">
            <h2 className="mb-2 font-semibold">Activity</h2>
            {acts.length === 0 ? <p className="text-muted-foreground">No activity yet.</p> :
              <ol className="space-y-2 border-l pl-4">{acts.map((a) => <li key={a.id}><div className="text-xs text-muted-foreground">{fmt(a.timestamp)} · {a.actor}</div><div><span className="font-medium">{a.action.replace(/_/g, " ")}</span>{a.note && ` — ${a.note}`}</div></li>)}</ol>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card space-y-3 p-4 text-sm">
            <h2 className="font-semibold">Update ticket</h2>
            <div><label className="label">Status</label><select className="field" value={e.status} onChange={(x) => setE({ ...e, status: x.target.value as Status })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label className="label">Assigned agent</label><select className="field" value={e.agent} onChange={(x) => setE({ ...e, agent: x.target.value })}><option value="">Unassigned</option>{db.agents.map((a) => <option key={a.id} value={a.id}>{a.id} · {a.experience}{a.id === recs[0]?.agent.id ? " ★ recommended" : ""}</option>)}</select></div>
            {recs[0] && <div className="rounded-md bg-secondary p-2 text-xs"><div className="flex items-center gap-1 font-medium"><Sparkles className="h-3.5 w-3.5" />Recommended: {recs[0].agent.id}</div>{recs[0].reasons.join(" · ")}
              {e.agent !== recs[0].agent.id && <button type="button" className="mt-1 block underline" onClick={() => setE({ ...e, agent: recs[0].agent.id })}>Use recommendation</button>}</div>}
            <div><label className="label">Priority override (0–100, blank = auto)</label><input className="field" type="number" min={0} max={100} value={e.override} onChange={(x) => setE({ ...e, override: x.target.value })} /></div>
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-primary" checked={e.escalated} onChange={(x) => setE({ ...e, escalated: x.target.checked })} />Escalated</label>
            <div><label className="label">Tags</label><input className="field" value={e.tags} onChange={(x) => setE({ ...e, tags: x.target.value })} /></div>
            <div><label className="label">Add note</label><textarea className="field h-16 py-1" value={e.note} onChange={(x) => setE({ ...e, note: x.target.value })} /></div>
            <button className="btn w-full justify-center" onClick={save}>Save changes</button>
            {saved && <p className="flex items-center gap-1 text-xs text-success"><Check className="h-3.5 w-3.5" />Saved</p>}
          </div>
          <div className="card p-4 text-sm">
            <h2 className="mb-2 font-semibold">Customer</h2>
            {c ? <><Row k="Name" v={c.name} /><Row k="ID" v={c.id} /><Row k="Tier" v={c.tier} /><Row k="Account value" v={c.account_value_usd != null ? `$${c.account_value_usd.toLocaleString()}` : "—"} /><Row k="Tenure" v={c.tenure_months != null ? `${c.tenure_months} months` : "—"} /><Row k="Previous tickets" v={c.past_ticket_count} /></> : <p className="text-muted-foreground">Unknown customer</p>}
          </div>
        </div>
      </div>
    </>
  );
}

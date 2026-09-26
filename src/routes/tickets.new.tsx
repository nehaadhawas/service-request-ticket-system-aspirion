import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { DbGate, PageHeader, PriorityBadge } from "@/components/app";
import { useStore } from "@/lib/store";
import { CHANNELS, SEVERITIES, computePriority, computeSlaHours, recommendAgents, type DB, type Severity, type Ticket } from "@/lib/db";

export const Route = createFileRoute("/tickets/new")({
  head: () => ({ meta: [
    { title: "New ticket — ServiceDesk" },
    { name: "description", content: "Create a service request with automatic SLA, priority and agent recommendation." },
    { property: "og:title", content: "New ticket — ServiceDesk" },
    { property: "og:description", content: "Create a service request with automatic SLA, priority and agent recommendation." },
  ] }),
  component: () => <DbGate>{(db) => <NewTicket db={db} />}</DbGate>,
});

function NewTicket({ db }: { db: DB }) {
  const { createTicket } = useStore();
  const nav = useNavigate();
  const catMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    db.tickets.forEach((t) => { if (!m.has(t.category)) m.set(t.category, new Set()); m.get(t.category)!.add(t.subcategory); });
    return m;
  }, [db.tickets]);
  const cats = [...catMap.keys()].sort();
  const [f, setF] = useState({ subject: "", description: "", customer_id: "", category: cats[0] ?? "", subcategory: "", channel: "Portal", severity: "Medium" as Severity, sentiment: 0, tags: "", assign: "__rec" });
  const [custQ, setCustQ] = useState("");
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f, v: string | number) => setF((p) => ({ ...p, [k]: v }));
  const subs = [...(catMap.get(f.category) ?? [])].sort();
  const cust = db.customers.find((c) => c.id === f.customer_id);
  const custList = db.customers.filter((c) => `${c.id} ${c.name}`.toLowerCase().includes(custQ.toLowerCase())).slice(0, 100);

  const draft: Ticket | null = cust ? (() => {
    const now = new Date(); const sla = computeSlaHours(f.severity, cust.tier);
    return { id: `TCK-N${now.getTime().toString().slice(-7)}`, source: "new", subject: f.subject, description: f.description, customer_id: cust.id,
      category: f.category, subcategory: f.subcategory || subs[0] || "", channel: f.channel, severity: f.severity, sentiment: Number(f.sentiment),
      sla_hours: sla, deadline_at: new Date(now.getTime() + sla * 3600e3).toISOString(), status: "Open", assigned_agent_id: null, escalated: false,
      tags: f.tags.split(",").map((s) => s.trim()).filter(Boolean), keywords: [], attachments: [], created_at: now.toISOString(), updated_at: now.toISOString(),
      resolved_at: null, csat: null, priority_override: null, source_priority_score: null };
  })() : null;
  const prio = draft ? computePriority(draft, cust, db.weights) : null;
  const recs = draft && prio ? recommendAgents(db, draft.category, prio.score, draft.sla_hours) : [];
  const rec = recs[0];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.subject.trim() || !draft) { setErr("Subject and customer are required."); return; }
    const agentId = f.assign === "__rec" ? rec?.agent.id ?? null : f.assign || null;
    const t = { ...draft, assigned_agent_id: agentId, status: agentId ? "In Progress" as const : "Open" as const };
    createTicket(t, `Created via form. SLA ${t.sla_hours}h, priority ${prio!.score} (${prio!.label}). ${agentId ? `Assigned to ${agentId}${f.assign === "__rec" ? " (recommended)" : " (manual override)"}` : "Unassigned"}`);
    nav({ to: "/tickets/$id", params: { id: t.id } });
  }

  return (
    <>
      <PageHeader title="New ticket" sub="SLA, priority and assignee are calculated automatically" />
      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-3">
        <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:col-span-2">
          <div className="sm:col-span-2"><label className="label">Subject *</label><input className="field" value={f.subject} onChange={(e) => set("subject", e.target.value)} /></div>
          <div className="sm:col-span-2"><label className="label">Description</label><textarea className="field h-24 py-1" value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="sm:col-span-2"><label className="label">Customer *</label>
            <div className="grid gap-2 sm:grid-cols-2"><input className="field" placeholder="Search customers…" value={custQ} onChange={(e) => setCustQ(e.target.value)} />
              <select className="field" value={f.customer_id} onChange={(e) => set("customer_id", e.target.value)}><option value="">Select customer ({custList.length})</option>{custList.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.id} · {c.tier}</option>)}</select></div>
          </div>
          <div><label className="label">Category</label><select className="field" value={f.category} onChange={(e) => setF((p) => ({ ...p, category: e.target.value, subcategory: "" }))}>{cats.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className="label">Subcategory</label><select className="field" value={f.subcategory || subs[0]} onChange={(e) => set("subcategory", e.target.value)}>{subs.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className="label">Channel</label><select className="field" value={f.channel} onChange={(e) => set("channel", e.target.value)}>{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className="label">Severity</label><select className="field" value={f.severity} onChange={(e) => set("severity", e.target.value)}>{SEVERITIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className="label">Sentiment ({Number(f.sentiment).toFixed(2)}, −1 angry … +1 happy)</label><input type="range" min={-1} max={1} step={0.05} className="w-full accent-primary" value={f.sentiment} onChange={(e) => set("sentiment", e.target.value)} /></div>
          <div><label className="label">Tags (comma separated)</label><input className="field" value={f.tags} onChange={(e) => set("tags", e.target.value)} /></div>
          <div className="sm:col-span-2"><label className="label">Assignment</label>
            <select className="field" value={f.assign} onChange={(e) => set("assign", e.target.value)}>
              <option value="__rec">Use recommendation{rec ? ` (${rec.agent.id})` : ""}</option><option value="">Leave unassigned</option>
              {recs.map((r) => <option key={r.agent.id} value={r.agent.id}>{r.agent.id} · {r.agent.experience} · {r.load} active</option>)}
            </select></div>
          {err && <p className="text-sm text-destructive sm:col-span-2">{err}</p>}
          <div className="sm:col-span-2"><button className="btn">Create ticket</button></div>
        </div>
        <div className="card h-fit space-y-3 p-4 text-sm">
          <h2 className="font-semibold">Preview</h2>
          {!draft ? <p className="text-muted-foreground">Select a customer to see SLA, priority and the recommended agent.</p> : <>
            <div className="flex justify-between"><span className="text-muted-foreground">SLA</span><span>{draft.sla_hours}h</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Priority</span><PriorityBadge label={prio!.label} score={prio!.score} /></div>
            {rec && <div className="rounded-md bg-secondary p-3"><div className="flex items-center gap-1.5 font-medium"><Sparkles className="h-4 w-4" />Recommended: {rec.agent.id}</div>
              <ul className="mt-1 list-disc pl-5 text-xs text-secondary-foreground">{rec.reasons.map((r) => <li key={r}>{r}</li>)}</ul></div>}
          </>}
        </div>
      </form>
    </>
  );
}

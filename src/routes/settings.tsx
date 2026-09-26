import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { DbGate, PageHeader } from "@/components/app";
import { useStore } from "@/lib/store";
import { DEFAULT_WEIGHTS, type DB, type Weights } from "@/lib/db";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [
    { title: "Settings — ServiceDesk" },
    { name: "description", content: "Manage agents and priority scoring weights." },
    { property: "og:title", content: "Settings — ServiceDesk" },
    { property: "og:description", content: "Manage agents and priority scoring weights." },
  ] }),
  component: () => <DbGate>{(db) => <SettingsPage db={db} />}</DbGate>,
});

const LABELS: Record<keyof Weights, string> = { severity: "Severity", tier: "Customer tier", sla: "SLA urgency", sentiment: "Sentiment", repeat: "Repeat tickets", escalation: "Escalation" };

function SettingsPage({ db }: { db: DB }) {
  const { setWeights, upsertAgent, reset } = useStore();
  const [w, setW] = useState<Weights>(db.weights);
  const [saved, setSaved] = useState(false);
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  const [na, setNa] = useState({ id: "", experience: "Mid", skills: "" });
  const [err, setErr] = useState("");
  const cats = [...new Set(db.tickets.map((t) => t.category))].sort();

  function addAgent() {
    if (!/^AGT-\w+$/.test(na.id)) return setErr("ID must look like AGT-200");
    if (db.agents.some((a) => a.id === na.id)) return setErr("Agent ID already exists");
    upsertAgent({ id: na.id, experience: na.experience, skills: na.skills.split(",").map((s) => s.trim()).filter(Boolean), active: true });
    setNa({ id: "", experience: "Mid", skills: "" }); setErr("");
  }

  return (
    <>
      <PageHeader title="Settings" action={<button className="btn-ghost" onClick={() => { if (confirm("Reset all data to the imported CSV/JSON? Your changes will be lost.")) reset(); }}><RotateCcw className="h-4 w-4" />Reset data</button>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card h-fit space-y-3 p-4 text-sm">
          <h2 className="font-semibold">Priority weights</h2>
          {(Object.keys(LABELS) as (keyof Weights)[]).map((k) => (
            <div key={k}><div className="flex justify-between"><span>{LABELS[k]}</span><span className="font-medium">{w[k]}%</span></div>
              <input type="range" min={0} max={60} className="w-full accent-primary" value={w[k]} onChange={(e) => { setSaved(false); setW({ ...w, [k]: Number(e.target.value) }); }} /></div>
          ))}
          <p className={`text-xs ${total === 100 ? "text-muted-foreground" : "text-destructive"}`}>Total {total}% {total !== 100 && "(scores are normalised, but 100% is recommended)"}</p>
          <p className="text-xs text-muted-foreground">Labels: 70+ High · 40–69 Medium · below 40 Low</p>
          <div className="flex gap-2"><button className="btn" onClick={() => { setWeights(w); setSaved(true); }}>Save weights</button><button className="btn-ghost" onClick={() => setW(DEFAULT_WEIGHTS)}>Defaults</button></div>
          {saved && <p className="flex items-center gap-1 text-xs text-success"><Check className="h-3.5 w-3.5" />Saved — all priorities recalculated</p>}
        </div>
        <div className="card lg:col-span-2">
          <div className="border-b p-4 text-sm"><h2 className="mb-2 font-semibold">Agents</h2>
            <div className="grid gap-2 sm:grid-cols-4">
              <input className="field" placeholder="AGT-200" value={na.id} onChange={(e) => setNa({ ...na, id: e.target.value })} />
              <select className="field" value={na.experience} onChange={(e) => setNa({ ...na, experience: e.target.value })}><option>Junior</option><option>Mid</option><option>Senior</option></select>
              <input className="field" placeholder={`Skills, e.g. ${cats.slice(0, 2).join(", ")}`} value={na.skills} onChange={(e) => setNa({ ...na, skills: e.target.value })} />
              <button className="btn justify-center" onClick={addAgent}>Add agent</button>
            </div>{err && <p className="mt-1 text-xs text-destructive">{err}</p>}
          </div>
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full text-sm"><thead className="sticky top-0 border-b bg-muted"><tr><th className="th">Agent</th><th className="th">Experience</th><th className="th">Skills</th><th className="th">Active</th></tr></thead>
              <tbody>{db.agents.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="td font-medium">{a.id}</td>
                  <td className="td"><select className="field w-28" value={a.experience} onChange={(e) => upsertAgent({ ...a, experience: e.target.value })}><option>Junior</option><option>Mid</option><option>Senior</option></select></td>
                  <td className="td"><input className="field" defaultValue={a.skills.join(", ")} onBlur={(e) => upsertAgent({ ...a, skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></td>
                  <td className="td"><input type="checkbox" className="accent-primary" checked={a.active} onChange={(e) => upsertAgent({ ...a, active: e.target.checked })} /></td>
                </tr>))}</tbody></table>
          </div>
        </div>
      </div>
    </>
  );
}

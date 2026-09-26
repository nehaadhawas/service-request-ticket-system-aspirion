import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { computePriority, loadDb, saveDb, resetDb, type Activity, type DB, type Ticket, type Weights, type Agent } from "./db";

interface Ctx {
  db: DB | null; error: string | null;
  update: (fn: (db: DB) => DB) => void;
  createTicket: (t: Ticket, note: string) => void;
  editTicket: (id: string, patch: Partial<Ticket>, logs: { action: string; note: string }[]) => void;
  setWeights: (w: Weights) => void;
  upsertAgent: (a: Agent) => void;
  reset: () => void;
  priorityOf: (t: Ticket) => ReturnType<typeof computePriority>;
}
const StoreCtx = createContext<Ctx | null>(null);
let actSeq = 0;
const newAct = (ticket_id: string, action: string, note: string, actor = "admin"): Activity => ({
  id: `ACT-N${Date.now()}-${actSeq++}`, ticket_id, timestamp: new Date().toISOString(), actor, action, note,
});

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { loadDb().then(setDb).catch((e) => setError(String(e))); }, []);

  const update = useCallback((fn: (db: DB) => DB) => {
    setDb((cur) => { if (!cur) return cur; const next = fn(cur); try { saveDb(next); } catch (e) { setError(String(e)); } return next; });
  }, []);

  const value = useMemo<Ctx>(() => {
    const custMap = new Map(db?.customers.map((c) => [c.id, c]));
    return {
      db, error, update,
      createTicket: (t, note) => update((d) => ({ ...d, tickets: [t, ...d.tickets], activity: [...d.activity, newAct(t.id, "ticket_created", note, "system")] })),
      editTicket: (id, patch, logs) => update((d) => ({
        ...d,
        tickets: d.tickets.map((t) => (t.id === id ? { ...t, ...patch, updated_at: new Date().toISOString() } : t)),
        activity: [...d.activity, ...logs.map((l) => newAct(id, l.action, l.note))],
      })),
      setWeights: (w) => update((d) => ({ ...d, weights: w })),
      upsertAgent: (a) => update((d) => ({ ...d, agents: d.agents.some((x) => x.id === a.id) ? d.agents.map((x) => (x.id === a.id ? a : x)) : [...d.agents, a] })),
      reset: () => { resetDb(); setDb(null); loadDb().then(setDb); },
      priorityOf: (t) => computePriority(t, custMap.get(t.customer_id), db!.weights),
    };
  }, [db, error, update]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside provider");
  return c;
}

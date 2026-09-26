// Local database: seeded from the uploaded CSV/JSON, persisted in browser localStorage.
export type Tier = "Free" | "Silver" | "Gold" | "Enterprise";
export type Severity = "Low" | "Medium" | "High" | "Critical";
export type Status = "Open" | "In Progress" | "Resolved" | "Closed" | "Reopened";
export const STATUSES: Status[] = ["Open", "In Progress", "Resolved", "Closed", "Reopened"];
export const SEVERITIES: Severity[] = ["Low", "Medium", "High", "Critical"];
export const CHANNELS = ["Chat", "Email", "Phone", "Portal", "Social Media"];

export interface Customer {
  id: string; name: string; tier: Tier;
  account_value_usd: number | null; tenure_months: number | null; past_ticket_count: number;
}
export interface Agent { id: string; experience: string; skills: string[]; active: boolean }
export interface Ticket {
  id: string; source: "historical" | "live" | "new";
  subject: string; description: string; customer_id: string;
  category: string; subcategory: string; channel: string;
  severity: Severity; sentiment: number; sla_hours: number; deadline_at: string;
  status: Status; assigned_agent_id: string | null; escalated: boolean;
  tags: string[]; keywords: string[]; attachments: string[];
  created_at: string; updated_at: string; resolved_at: string | null;
  csat: number | null; priority_override: number | null; source_priority_score: number | null;
}
export interface Activity { id: string; ticket_id: string; timestamp: string; actor: string; action: string; note: string }
export interface Weights { severity: number; tier: number; sla: number; sentiment: number; repeat: number; escalation: number }
export interface DB { customers: Customer[]; agents: Agent[]; tickets: Ticket[]; activity: Activity[]; weights: Weights }

export const DEFAULT_WEIGHTS: Weights = { severity: 35, tier: 15, sla: 30, sentiment: 10, repeat: 5, escalation: 5 };
const KEY = "srtm-db-v1";

export async function loadDb(): Promise<DB> {
  const raw = localStorage.getItem(KEY);
  if (raw) return JSON.parse(raw);
  const seed = (await import("@/data/seed.json")).default as unknown as Omit<DB, "weights">;
  const db: DB = { ...seed, weights: { ...DEFAULT_WEIGHTS } };
  saveDb(db);
  return db;
}
export function saveDb(db: DB) { localStorage.setItem(KEY, JSON.stringify(db)); }
export function resetDb() { localStorage.removeItem(KEY); }

// ---------- SLA ----------
export type SlaState = "On track" | "At risk" | "Breached" | "Met" | "Missed";
export function slaState(t: Ticket, now = Date.now()): SlaState {
  const dl = Date.parse(t.deadline_at);
  if (t.status === "Resolved" || t.status === "Closed") {
    const end = t.resolved_at ? Date.parse(t.resolved_at) : now;
    return end <= dl ? "Met" : "Missed";
  }
  const left = dl - now;
  if (left < 0) return "Breached";
  if (left < Math.max(4 * 3600e3, t.sla_hours * 3600e3 * 0.25)) return "At risk";
  return "On track";
}
export const isActive = (t: Ticket) => t.status !== "Resolved" && t.status !== "Closed";
export const SLA_HOURS: Record<Severity, number> = { Critical: 8, High: 24, Medium: 48, Low: 72 };
const TIER_SLA: Record<Tier, number> = { Enterprise: 0.5, Gold: 0.7, Silver: 0.85, Free: 1 };
export function computeSlaHours(sev: Severity, tier: Tier) { return Math.round(SLA_HOURS[sev] * TIER_SLA[tier] * 10) / 10; }

// ---------- Priority ----------
const SEV: Record<string, number> = { Low: 25, Medium: 50, High: 80, Critical: 100 };
const TIER: Record<string, number> = { Free: 25, Silver: 50, Gold: 75, Enterprise: 100 };
export interface PriorityPart { key: keyof Weights; label: string; raw: number; weight: number; points: number; detail: string }
export interface Priority { score: number; label: "High" | "Medium" | "Low"; parts: PriorityPart[]; overridden: boolean; computed: number }

export function labelFor(score: number): Priority["label"] { return score >= 70 ? "High" : score >= 40 ? "Medium" : "Low"; }

export function computePriority(t: Ticket, c: Customer | undefined, w: Weights, now = Date.now()): Priority {
  const total = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  let slaRaw = 0; let slaDetail = "Ticket closed";
  if (isActive(t)) {
    const left = (Date.parse(t.deadline_at) - now) / 3600e3;
    slaRaw = left <= 0 ? 100 : Math.max(0, Math.min(100, 100 * (1 - left / t.sla_hours)));
    slaDetail = left <= 0 ? `Breached ${Math.abs(left).toFixed(1)}h ago` : `${left.toFixed(1)}h of ${t.sla_hours}h left`;
  }
  const past = c?.past_ticket_count ?? 0;
  const rows: [keyof Weights, string, number, string][] = [
    ["severity", "Severity", SEV[t.severity] ?? 25, t.severity],
    ["tier", "Customer tier", TIER[c?.tier ?? "Free"] ?? 25, c?.tier ?? "Unknown"],
    ["sla", "SLA urgency", slaRaw, slaDetail],
    ["sentiment", "Sentiment", ((1 - t.sentiment) / 2) * 100, `Score ${t.sentiment.toFixed(2)}`],
    ["repeat", "Repeat tickets", Math.min(past / 5, 1) * 100, `${past} previous tickets`],
    ["escalation", "Escalation", t.escalated ? 100 : 0, t.escalated ? "Escalated" : "Not escalated"],
  ];
  const parts = rows.map(([key, label, raw, detail]) => ({ key, label, raw: Math.round(raw), weight: w[key], points: Math.round((raw * w[key]) / total * 10) / 10, detail }));
  const computed = Math.round(parts.reduce((a, p) => a + p.points, 0) * 10) / 10;
  const score = t.priority_override ?? computed;
  return { score, computed, label: labelFor(score), parts, overridden: t.priority_override != null };
}

// ---------- Agent recommendation ----------
export interface Recommendation { agent: Agent; score: number; reasons: string[]; load: number }
export function recommendAgents(db: DB, category: string, priority: number, slaHours: number): Recommendation[] {
  const load = new Map<string, number>();
  db.tickets.forEach((t) => { if (isActive(t) && t.assigned_agent_id) load.set(t.assigned_agent_id, (load.get(t.assigned_agent_id) ?? 0) + 1); });
  const urgent = priority >= 70 || slaHours <= 12;
  const exp: Record<string, number> = { Senior: 3, Mid: 2, Junior: 1 };
  return db.agents.filter((a) => a.active).map((a) => {
    const l = load.get(a.id) ?? 0; const skill = a.skills.includes(category); const e = exp[a.experience] ?? 1;
    const score = (skill ? 40 : 0) + e * (urgent ? 15 : 7) - l * 6;
    const reasons = [skill ? `Handles ${category}` : `No ${category} history`, `${a.experience} experience${urgent ? " (urgent ticket favours seniority)" : ""}`, `${l} active tickets`];
    return { agent: a, score, reasons, load: l };
  }).sort((a, b) => b.score - a.score);
}

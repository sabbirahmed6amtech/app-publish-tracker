import type { AppRow } from "@/lib/types";

export type FlowDay = { date: string; opened: number; closed: number };

/** Daily counts from the apps themselves — no synthetic event rows needed. */
export function buildDailyFlow(rows: AppRow[], windowDays = 30): FlowDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days: FlowDay[] = [];
  const index = new Map<string, FlowDay>();

  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10);
    const entry = { date: d, opened: 0, closed: 0 };
    days.push(entry);
    index.set(d, entry);
  }

  for (const r of rows) {
    const openedOn = index.get(r.created_at.slice(0, 10));
    if (openedOn) openedOn.opened += 1;

    if (r.status === "production") {
      const closedOn = index.get(r.status_changed_at.slice(0, 10));
      if (closedOn) closedOn.closed += 1;
    }
  }

  return days;
}

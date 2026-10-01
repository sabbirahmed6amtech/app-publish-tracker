"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { ExternalLinkIcon, MoreHorizontalIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { AppPreviewSheet } from "@/components/AppPreviewRow";
import { StatusMenuItems } from "@/components/RowActions";
import { StatusGlyph } from "@/components/StatusGlyph";
import { ProjectLogo } from "@/components/ProjectLogo";
import { StoreIcon } from "@/components/StoreIcon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PIPELINE_ORDER, PLATFORMS, STATUSES, daysSince, isStale } from "@/lib/constants";
import { setAppStatus } from "@/lib/actions";
import type { AppRow, AppStatus, Keystore, LineBadge, TeamMember } from "@/lib/types";

/** Live apps pile up forever; by default the column shows only recent ones. */
const RECENT_LIVE_DAYS = 14;
const FILTERS_KEY = "board-filters";

type Focus = "all" | "attention" | "stuck" | "unassigned";
type Filters = { q: string; client: string; assignee: string; platform: string; focus: Focus };
const NO_FILTERS: Filters = {
  q: "",
  client: "all",
  assignee: "all",
  platform: "all",
  focus: "all",
};

const FOCUS: { key: Exclude<Focus, "all">; label: string; hint: string }[] = [
  { key: "attention", label: "Rejected or on hold", hint: "Someone has to act" },
  { key: "stuck", label: "Stuck 7+ days", hint: "No status change in a week" },
  { key: "unassigned", label: "Unassigned", hint: "Nobody owns these yet" },
];

function inFocus(r: AppRow, focus: Focus, status: AppStatus): boolean {
  if (focus === "attention") return STATUSES[status].group === "attention";
  if (focus === "stuck") return isStale(status, r.status_changed_at);
  if (focus === "unassigned") return !r.assigned_to;
  return true;
}

export function StatusBoard({
  rows,
  team,
  clients,
  keystores,
  meId,
  badges,
}: {
  rows: AppRow[];
  team: TeamMember[];
  clients: { id: string; name: string }[];
  keystores: Keystore[];
  meId: string | null;
  /** project name -> product line logo */
  badges: Record<string, LineBadge>;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  // The board always opens on your own work; Clear comes back here too.
  const defaults: Filters = meId ? { ...NO_FILTERS, assignee: "me" } : NO_FILTERS;
  const [filters, setFilters] = useState<Filters>(defaults);
  const [showAllLive, setShowAllLive] = useState(false);
  // Moves show immediately; the server catches up behind them.
  const [moved, setMoved] = useState<Record<string, AppStatus>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<AppStatus | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Fresh server data supersedes optimistic moves.
  useEffect(() => setMoved({}), [rows]);

  // Remember filters per browser — a convenience, so failures are ignored.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FILTERS_KEY);
      // Client and store are remembered; the person always starts as you.
      if (saved) {
        const { client, platform } = { ...NO_FILTERS, ...JSON.parse(saved) };
        setFilters((f) => ({ ...f, client, platform }));
      }
    } catch {}
  }, []);
  function update(patch: Partial<Filters>) {
    setFilters((f) => {
      const next = { ...f, ...patch };
      try {
        localStorage.setItem(FILTERS_KEY, JSON.stringify({ ...next, q: "" }));
      } catch {}
      return next;
    });
  }

  const keystoreById = useMemo(() => new Map(keystores.map((k) => [k.id, k])), [keystores]);
  const statusOf = (r: AppRow) => moved[r.id] ?? r.status;

  // Everything the person/client/store filters allow, before focus and search.
  const scoped = useMemo(
    () =>
      rows.filter((r) => {
        if (filters.client !== "all" && r.client_id !== filters.client) return false;
        if (filters.platform !== "all" && r.platform !== filters.platform) return false;
        if (filters.assignee === "me" && r.assigned_to !== meId) return false;
        if (filters.assignee === "none" && r.assigned_to) return false;
        if (
          !["all", "me", "none"].includes(filters.assignee) &&
          r.assigned_to !== filters.assignee
        )
          return false;
        return true;
      }),
    [rows, filters.client, filters.platform, filters.assignee, meId],
  );

  const visible = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return scoped.filter((r) => {
      if (!inFocus(r, filters.focus, moved[r.id] ?? r.status)) return false;
      if (!q) return true;
      return [
        r.app_name,
        r.project_name,
        r.client_name,
        r.ticket,
        r.release_version,
        r.build_version,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [scoped, filters.q, filters.focus, moved]);

  // `current` is passed by Undo, whose closure would otherwise read stale state.
  function move(
    row: AppRow,
    to: AppStatus,
    { quiet = false, current }: { quiet?: boolean; current?: AppStatus } = {},
  ) {
    const from = current ?? statusOf(row);
    if (from === to) return;
    setMoved((m) => ({ ...m, [row.id]: to }));
    start(async () => {
      const res = await setAppStatus(row.id, to);
      if (!res.ok) {
        setMoved((m) => ({ ...m, [row.id]: from }));
        toast.error(`Couldn't move ${row.app_name || row.project_name}: ${res.error}`);
        return;
      }
      if (!quiet) {
        toast.success(`${row.app_name || row.project_name} → ${STATUSES[to].label}`, {
          action: {
            label: "Undo",
            onClick: () => move(row, from, { quiet: true, current: to }),
          },
        });
      }
      router.refresh();
    });
  }

  function onDrop(e: DragEvent, to: AppStatus) {
    e.preventDefault();
    setOverColumn(null);
    const row = rows.find((r) => r.id === e.dataTransfer.getData("text/plain"));
    if (row) move(row, to);
    setDragId(null);
  }

  const preview = previewId ? rows.find((r) => r.id === previewId) : undefined;
  const filtered = (Object.keys(defaults) as (keyof Filters)[]).some(
    (k) => filters[k] !== defaults[k],
  );

  // Unassigned work is everyone's problem, so it ignores the person filter.
  const focusCounts = {
    attention: scoped.filter((r) => inFocus(r, "attention", statusOf(r))).length,
    stuck: scoped.filter((r) => inFocus(r, "stuck", statusOf(r))).length,
    unassigned: rows.filter((r) => !r.assigned_to && statusOf(r) !== "production").length,
  };

  return (
    <>
      {/* what needs someone, at a glance */}
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {FOCUS.map((f) => {
          const on = filters.focus === f.key;
          const count = focusCounts[f.key];
          return (
            <button
              key={f.key}
              type="button"
              onClick={() =>
                update(
                  on
                    ? { focus: "all" }
                    : f.key === "unassigned"
                      ? { focus: f.key, assignee: "all" }
                      : { focus: f.key },
                )
              }
              aria-pressed={on}
              className={`flex items-center gap-3 rounded-xl border bg-card px-3.5 py-2.5 text-left shadow-xs transition-colors ${
                on ? "border-foreground ring-1 ring-foreground" : "hover:border-ring/60"
              }`}
            >
              <span
                className={`text-[22px] font-semibold tabular-nums ${
                  count && f.key !== "unassigned"
                    ? f.key === "attention"
                      ? "text-[#9b2c2c]"
                      : "text-[#8a5a00]"
                    : ""
                }`}
              >
                {count}
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block text-[13px] font-medium">{f.label}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {on ? "Showing only these — click to clear" : f.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-60">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filters.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="Filter apps…"
            className="field h-8 pl-8"
          />
        </div>

        <FilterSelect
          value={filters.assignee}
          onChange={(assignee) => update({ assignee })}
          label="Assignee"
          options={[
            { value: "all", label: "Everyone" },
            ...(meId ? [{ value: "me", label: "Assigned to me" }] : []),
            { value: "none", label: "Unassigned" },
            "---",
            ...team.map((m) => ({ value: m.id, label: m.name })),
          ]}
        />
        <FilterSelect
          value={filters.client}
          onChange={(client) => update({ client })}
          label="Client"
          options={[
            { value: "all", label: "All clients" },
            "---",
            ...clients.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <FilterSelect
          value={filters.platform}
          onChange={(platform) => update({ platform })}
          label="Store"
          options={[
            { value: "all", label: "Both stores" },
            { value: "play_store", label: PLATFORMS.play_store.label },
            { value: "app_store", label: PLATFORMS.app_store.label },
          ]}
        />

        {filtered && (
          <button className="btn btn-ghost" onClick={() => update(defaults)}>
            Clear
          </button>
        )}
        <span className="ml-auto text-[12px] text-muted-foreground">
          {visible.length} {visible.length === 1 ? "app" : "apps"} · drag a card to change its
          status
        </span>
      </div>

      {/* columns */}
      <div className="-mx-4 overflow-x-auto px-4 pb-4 lg:-mx-5 lg:px-5">
        {/* Equal columns that fill the width (scrolling below 260px each) and the
            height, so the whole dotted area accepts a drop. */}
        <div className="grid min-h-[calc(100dvh-20rem)] auto-cols-[minmax(260px,1fr)] grid-flow-col items-stretch gap-3">
          {PIPELINE_ORDER.map((status) => {
            const meta = STATUSES[status];
            let cards = visible
              .filter((r) => statusOf(r) === status)
              .sort((a, b) => a.status_changed_at.localeCompare(b.status_changed_at));
            let hidden = 0;
            if (status === "production" && !showAllLive) {
              const recent = cards.filter(
                (r) => moved[r.id] || daysSince(r.status_changed_at) <= RECENT_LIVE_DAYS,
              );
              hidden = cards.length - recent.length;
              cards = recent;
            }
            // Newest live first; everything else oldest-waiting first.
            if (status === "production") cards.reverse();

            return (
              <section
                key={status}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (overColumn !== status) setOverColumn(status);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverColumn(null);
                }}
                onDrop={(e) => onDrop(e, status)}
                className={`flex min-w-0 flex-col rounded-xl border-2 border-dashed transition-colors ${
                  overColumn === status && dragId
                    ? "border-foreground/40 bg-muted"
                    : dragId
                      ? "border-border bg-muted/50"
                      : "border-border/80 bg-muted/30"
                }`}
              >
                <header className="flex items-center gap-2 px-3 py-2.5">
                  <StatusGlyph status={status} size={12} />
                  <h2 className="text-[13px] font-semibold">{meta.label}</h2>
                  <span className="rounded-full bg-background px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground ring-1 ring-border">
                    {cards.length + hidden}
                  </span>
                </header>

                <div className="flex flex-1 flex-col gap-3 px-2 pb-2">
                  {groupByClient(cards).map((group) => (
                    <div key={group.clientId} className="space-y-1.5">
                      <div className="flex items-center gap-1.5 px-1 pt-1">
                        <span className="truncate text-[11px] font-semibold">
                          {group.clientName}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          #{group.ticket}
                        </span>
                        <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                          {group.rows.length}
                        </span>
                      </div>
                      {group.rows.map((r) => (
                        <BoardCard
                          key={r.id}
                          row={r}
                          badge={badges[r.project_name]}
                          status={statusOf(r)}
                          dragging={dragId === r.id}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", r.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDragId(r.id);
                          }}
                          onDragEnd={() => {
                            setDragId(null);
                            setOverColumn(null);
                          }}
                          onOpen={() => setPreviewId(r.id)}
                          onMove={(to) => move(r, to)}
                        />
                      ))}
                    </div>
                  ))}

                  {cards.length === 0 && (
                    <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                      {dragId ? "Drop here" : hidden ? "Nothing live recently" : "Nothing here"}
                    </p>
                  )}

                  {status === "production" && (hidden > 0 || showAllLive) && (
                    <button
                      className="btn btn-ghost h-7 text-[12px]"
                      onClick={() => setShowAllLive((v) => !v)}
                    >
                      {showAllLive
                        ? `Only the last ${RECENT_LIVE_DAYS} days`
                        : `Show ${hidden} older live`}
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {preview && (
        <AppPreviewSheet
          open
          onClose={() => setPreviewId(null)}
          app={{ ...preview, status: statusOf(preview) }}
          accountLabel={`${PLATFORMS[preview.platform].label} — ${
            preview.account_name || "unnamed account"
          }`}
          assigneeName={preview.assignee_name}
          keystore={(preview.keystore_id && keystoreById.get(preview.keystore_id)) || null}
        />
      )}
    </>
  );
}

function BoardCard({
  row,
  badge,
  status,
  dragging,
  onDragStart,
  onDragEnd,
  onOpen,
  onMove,
}: {
  row: AppRow;
  badge?: LineBadge;
  status: AppStatus;
  dragging: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onOpen: () => void;
  onMove: (to: AppStatus) => void;
}) {
  const days = daysSince(row.status_changed_at);
  const stale = isStale(status, row.status_changed_at);

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button, [role=menuitem]")) return;
        onOpen();
      }}
      className={`group cursor-grab rounded-lg border bg-card p-2.5 shadow-xs transition
                  hover:border-ring/60 hover:shadow-sm active:cursor-grabbing ${
                    dragging ? "opacity-40" : ""
                  }`}
      style={{ borderLeftColor: STATUSES[status].hex, borderLeftWidth: 3 }}
    >
      <div className="flex items-start gap-2">
        <ProjectLogo badge={badge} project={row.project_name} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">
            {row.app_name || row.project_name}
          </div>
          <div className="truncate text-[12px] text-muted-foreground">
            v{row.release_version} · {row.project_name}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Card actions"
            className="btn btn-ghost -mr-1 -mt-0.5 size-6 px-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreHorizontalIcon className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-[11px] text-muted-foreground">
              Move to
            </DropdownMenuLabel>
            <StatusMenuItems current={status} onPick={onMove} />
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="text-[13px]">
              <Link href={`/releases/${row.release_id}`}>Open release</Link>
            </DropdownMenuItem>
            {row.store_url && (
              <DropdownMenuItem asChild className="text-[13px]">
                <a href={row.store_url} target="_blank" rel="noreferrer">
                  Store listing <ExternalLinkIcon className="ml-auto size-3.5" />
                </a>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <StoreIcon platform={row.platform} size={13} />
        {row.build_version && (
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {row.build_version}
          </span>
        )}
        <span
          className={`ml-auto text-[11px] tabular-nums ${
            stale ? "font-semibold text-[#8a5a00]" : "text-muted-foreground"
          }`}
          title={`${days} days in ${STATUSES[status].label}`}
        >
          {days}d
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={`grid size-5 place-items-center rounded-full text-[9px] font-semibold uppercase ${
                row.assignee_name
                  ? "bg-primary text-primary-foreground"
                  : "border border-dashed text-muted-foreground"
              }`}
            >
              {row.assignee_name ? initials(row.assignee_name) : "?"}
            </span>
          </TooltipTrigger>
          <TooltipContent>{row.assignee_name ?? "Unassigned"}</TooltipContent>
        </Tooltip>
      </div>
    </article>
  );
}

/**
 * Keep a client's cards together within a column. Groups appear in the order
 * their first card did, so the column's sort (oldest waiting first) still
 * decides which client comes first.
 */
function groupByClient(rows: AppRow[]) {
  const groups = new Map<
    string,
    { clientId: string; clientName: string; ticket: string; rows: AppRow[] }
  >();
  for (const r of rows) {
    const g = groups.get(r.client_id);
    if (g) g.rows.push(r);
    else {
      groups.set(r.client_id, {
        clientId: r.client_id,
        clientName: r.client_name,
        ticket: r.ticket,
        rows: [r],
      });
    }
  }
  return [...groups.values()];
}

type Option = { value: string; label: string } | "---";

function FilterSelect({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: Option[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label={label} className="h-8 min-w-36 bg-card text-[13px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o, i) =>
          o === "---" ? (
            <SelectSeparator key={`sep-${i}`} />
          ) : (
            <SelectItem key={o.value} value={o.value} className="text-[13px]">
              {o.label}
            </SelectItem>
          ),
        )}
      </SelectContent>
    </Select>
  );
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2);
  return words[0][0] + words[1][0];
}

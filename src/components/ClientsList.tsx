"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RELEASE_STATES, formatDate } from "@/lib/constants";
import type { ReleaseState } from "@/lib/types";

export type ClientCard = {
  id: string;
  ticket: string;
  name: string;
  accounts: { platform: string; label: string; accountName: string }[];
  releaseCount: number;
  totalApps: number;
  latest: {
    id: string;
    version: string;
    state: ReleaseState;
    assignee: string | null;
    date: string;
  } | null;
};

export function ClientsList({ clients }: { clients: ClientCard[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((c) =>
      [
        c.ticket,
        c.name,
        ...c.accounts.map((a) => `${a.label} ${a.accountName}`),
        c.latest?.version ?? "",
        c.latest?.assignee ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [clients, q]);

  return (
    <>
      <div className="card mb-3 flex items-center gap-2 px-3 py-2">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0 text-neutral-400" aria-hidden>
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search clients by name, ticket, store account, version or person"
          className="field flex-1 border-0 shadow-none"
          autoComplete="off"
        />
        {q && (
          <button className="btn btn-ghost px-2 py-1" onClick={() => setQ("")}>
            Clear
          </button>
        )}
        <span className="shrink-0 px-1 text-[12px] tabular-nums text-neutral-400">
          {filtered.length}/{clients.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <p className="text-[14px] font-medium text-neutral-800">No client matches that.</p>
          <p className="mt-1 text-[13px] text-neutral-500">
            Try a ticket number, a store account, or a person&rsquo;s name.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={c.latest ? `/releases/${c.latest.id}` : `/clients/${c.id}`}
              className="card block px-4 py-3.5 transition-colors hover:border-neutral-300 hover:bg-neutral-50/60"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[15px] font-semibold text-neutral-900">{c.name}</span>
                    <span className="font-mono text-[11px] text-neutral-400">#{c.ticket}</span>
                  </div>
                  {/* one element per account — joined spaces collapse in HTML
                      and run two account names together */}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-neutral-500">
                    {c.accounts.length === 0 ? (
                      <span className="text-neutral-400">No store account yet</span>
                    ) : (
                      c.accounts.map((a) => (
                        <span key={a.platform} className="inline-flex items-center gap-1.5">
                          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600">
                            {a.label}
                          </span>
                          <span className="truncate">{a.accountName || "—"}</span>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-5 text-[12px] text-neutral-500">
                  <span>
                    {c.releaseCount} {c.releaseCount === 1 ? "release" : "releases"} ·{" "}
                    {c.totalApps} apps
                  </span>
                  {c.latest ? (
                    <span className="text-right">
                      <span className="flex items-center justify-end gap-1.5 text-[13px] font-medium text-neutral-900">
                        <span className={`size-2 rounded-full ${RELEASE_STATES[c.latest.state].dot}`} />
                        v{c.latest.version}
                      </span>
                      <span className="text-[11px] text-neutral-400">
                        {c.latest.assignee ? `${c.latest.assignee} · ` : ""}
                        {formatDate(c.latest.date)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-neutral-400">No releases</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

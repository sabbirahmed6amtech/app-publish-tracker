"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { RELEASE_STATES } from "@/lib/constants";
import { signOut } from "@/lib/actions";
import type { ReleaseState } from "@/lib/types";

export type SidebarRelease = {
  id: string;
  version: string;
  title: string | null;
  assignedTo: string | null;
  appCount: number;
  state: ReleaseState;
};

export type SidebarClient = {
  id: string;
  ticket: string;
  name: string;
  releases: SidebarRelease[];
};

const NAV = [
  { href: "/", label: "Dashboard", icon: "▚" },
  { href: "/apps", label: "All apps", icon: "▤" },
  { href: "/clients", label: "Clients", icon: "◲" },
  { href: "/team", label: "Team", icon: "◍" },
  { href: "/import", label: "Import / export", icon: "⇅" },
];

export function Sidebar({
  clients,
  email,
}: {
  clients: SidebarClient[];
  email: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Inside a client, the rail becomes that client's release history.
  const clientMatch = pathname.match(/^\/clients\/([0-9a-f-]+)/i);
  const releaseMatch = pathname.match(/^\/releases\/([0-9a-f-]+)/i);

  const activeClient = clientMatch
    ? clients.find((c) => c.id === clientMatch[1])
    : releaseMatch
      ? clients.find((c) => c.releases.some((r) => r.id === releaseMatch[1]))
      : undefined;

  const activeReleaseId = releaseMatch?.[1];

  return (
    <>
      <div className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-2.5 lg:hidden">
        <button
          className="btn btn-secondary px-2 py-1"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          ☰
        </button>
        <span className="text-[14px] font-semibold">Publish Tracker</span>
      </div>

      <aside
        className={`${open ? "block" : "hidden"} w-full shrink-0 border-r border-neutral-200
                    bg-white lg:block lg:w-[276px]`}
      >
        <div className="flex h-full flex-col lg:sticky lg:top-0 lg:h-screen">
          {activeClient ? (
            <ReleaseRail
              client={activeClient}
              activeReleaseId={activeReleaseId}
              onNavigate={() => setOpen(false)}
            />
          ) : (
            <>
              <div className="hidden items-center gap-2.5 px-4 py-4 lg:flex">
                <span className="grid size-7 place-items-center rounded-md bg-neutral-900 text-[13px] font-bold text-white">
                  P
                </span>
                <div className="leading-tight">
                  <div className="text-[14px] font-semibold text-neutral-900">
                    Publish Tracker
                  </div>
                  <div className="text-[11px] text-neutral-500">Store submissions</div>
                </div>
              </div>

              <nav className="px-2 pb-2 pt-2 lg:pt-0">
                {NAV.map((item) => {
                  const active =
                    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px]
                                  font-medium transition-colors ${
                                    active
                                      ? "bg-neutral-100 text-neutral-900"
                                      : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                                  }`}
                    >
                      <span className="w-3.5 text-center text-[11px] text-neutral-400">
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="flex-1" />
            </>
          )}

          {email && (
            <div className="border-t border-neutral-200 px-4 py-3">
              <div className="truncate text-[11px] text-neutral-500" title={email}>
                {email}
              </div>
              <form action={signOut}>
                <button className="mt-1 text-[12px] font-medium text-neutral-600 hover:text-neutral-900">
                  Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function ReleaseRail({
  client,
  activeReleaseId,
  onNavigate,
}: {
  client: SidebarClient;
  activeReleaseId?: string;
  onNavigate: () => void;
}) {
  return (
    <>
      <div className="px-3 py-3.5">
        <Link
          href="/clients"
          onClick={onNavigate}
          className="mb-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-neutral-500 hover:text-neutral-900"
        >
          ← All clients
        </Link>
        <Link
          href={`/clients/${client.id}`}
          onClick={onNavigate}
          className="block px-0.5"
        >
          <div className="truncate text-[15px] font-semibold text-neutral-900">
            {client.name}
          </div>
          <div className="font-mono text-[11px] text-neutral-400">#{client.ticket}</div>
        </Link>
      </div>

      <div className="flex items-center justify-between border-t border-neutral-200 px-4 pb-2 pt-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Releases
        </span>
        <span className="text-[11px] text-neutral-400">{client.releases.length}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {client.releases.length === 0 && (
          <p className="px-2.5 py-2 text-[12px] text-neutral-400">
            No releases yet.
          </p>
        )}

        {client.releases.map((r) => {
          const active = r.id === activeReleaseId;
          const meta = RELEASE_STATES[r.state];

          return (
            <Link
              key={r.id}
              href={`/releases/${r.id}`}
              prefetch
              onClick={onNavigate}
              className={`block rounded-md border-l-2 px-2.5 py-2 transition-colors ${
                active
                  ? "border-neutral-900 bg-neutral-100"
                  : "border-transparent hover:bg-neutral-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`size-2 shrink-0 rounded-full ${meta.dot}`} />
                <span className="truncate text-[13px] font-medium text-neutral-900">
                  Version {r.version}
                </span>
              </div>
              <div className="mt-0.5 truncate pl-4 text-[11px] text-neutral-500">
                {r.appCount === 0
                  ? "No apps"
                  : `${r.appCount} ${r.appCount === 1 ? "app" : "apps"}`}
                {r.assignedTo ? ` · ${r.assignedTo}` : ""}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="border-t border-neutral-200 px-3 py-2.5">
        <Link
          href={`/clients/${client.id}?new=release`}
          onClick={onNavigate}
          className="btn btn-secondary w-full justify-center"
        >
          + New release
        </Link>
      </div>
    </>
  );
}

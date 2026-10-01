import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { STATUS_ORDER } from "@/lib/constants";
import type {
  App,
  AppEvent,
  AppRow,
  AppStatus,
  Client,
  ClientFull,
  Keystore,
  Platform,
  PublisherAccount,
  Release,
  ReleaseWithApps,
  TeamMember,
} from "@/lib/types";

const CLIENT_TREE = "*, publisher_accounts(*), keystores(*), releases(*, apps(*))";

function sortTree(c: ClientFull): ClientFull {
  c.publisher_accounts = (c.publisher_accounts ?? []).sort((a, b) =>
    a.platform.localeCompare(b.platform),
  );
  c.keystores = (c.keystores ?? []).sort((a, b) => a.name.localeCompare(b.name));
  // Newest release first — that is the one being worked on.
  c.releases = (c.releases ?? []).sort(
    (a, b) => b.started_on.localeCompare(a.started_on) || b.version.localeCompare(a.version),
  );
  for (const r of c.releases) {
    r.apps = (r.apps ?? []).sort(
      (a, b) => a.sort_order - b.sort_order || a.project_name.localeCompare(b.project_name),
    );
  }
  return c;
}

/**
 * Deduplicated per request: the layout and the page both need this, and
 * `cache` collapses them into a single round trip.
 */
export const getTeam = cache(async function getTeam(): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("team_members").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as TeamMember[];
});

/** Only active members belong in the assignment pickers. */
export function activeMembers(team: TeamMember[]): TeamMember[] {
  return team.filter((m) => m.active);
}

/** id -> display name, for resolving assignments without a join per row. */
export function teamIndex(team: TeamMember[]): Map<string, string> {
  return new Map(team.map((m) => [m.id, m.name]));
}

export const getClients = cache(async function getClients(): Promise<ClientFull[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_TREE)
    .eq("archived", false)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ClientFull[]).map(sortTree);
});

export const getClient = cache(async function getClient(id: string): Promise<ClientFull | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_TREE)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? sortTree(data as unknown as ClientFull) : null;
});

export type ReleaseDetail = {
  release: ReleaseWithApps;
  client: Client;
  accounts: PublisherAccount[];
  keystores: Keystore[];
  siblings: Release[];
};

export const getRelease = cache(async function getRelease(
  releaseId: string,
): Promise<ReleaseDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("releases")
    .select("*, apps(*), clients(*, publisher_accounts(*), keystores(*), releases(*))")
    .eq("id", releaseId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as unknown as Release & {
    apps: App[];
    clients: Client & {
      publisher_accounts: PublisherAccount[];
      keystores: Keystore[];
      releases: Release[];
    };
  };

  const { clients, apps, ...release } = row;

  return {
    release: {
      ...release,
      apps: (apps ?? []).sort(
        (a, b) => a.sort_order - b.sort_order || a.project_name.localeCompare(b.project_name),
      ),
    },
    client: clients,
    accounts: (clients.publisher_accounts ?? []).sort((a, b) =>
      a.platform.localeCompare(b.platform),
    ),
    keystores: (clients.keystores ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    siblings: (clients.releases ?? []).sort(
      (a, b) => b.started_on.localeCompare(a.started_on) || b.version.localeCompare(a.version),
    ),
  };
});

/** Everything flattened to one row per app — the sheet view. */
export function flatten(clients: ClientFull[], names?: Map<string, string>): AppRow[] {
  const nameOf = (id: string | null) => (id ? (names?.get(id) ?? null) : null);
  const rows: AppRow[] = [];

  for (const c of clients) {
    const accounts = new Map(c.publisher_accounts.map((a) => [a.id, a]));

    for (const release of c.releases) {
      for (const app of release.apps) {
        const account = accounts.get(app.account_id);
        if (!account) continue;

        rows.push({
          ...app,
          client_id: c.id,
          ticket: c.ticket,
          client_name: c.name,
          release_version: release.version,
          release_title: release.title,
          release_note: release.note,
          assignee_name: nameOf(app.assigned_to),
          release_assignee_name: nameOf(release.assigned_to),
          platform: account.platform,
          account_name: account.account_name,
          account_type: account.account_type,
        });
      }
    }
  }
  return rows;
}

export type Stats = {
  totalApps: number;
  totalClients: number;
  totalReleases: number;
  openReleases: number;
  byStatus: { status: AppStatus; count: number }[];
  byPlatform: { platform: Platform; count: number }[];
  needsAttention: AppRow[];
  waiting: AppRow[];
};

export function buildStats(clients: ClientFull[], rows: AppRow[]): Stats {
  const releases = clients.flatMap((c) => c.releases);

  const olderFirst = (a: AppRow, b: AppRow) =>
    new Date(a.status_changed_at).getTime() - new Date(b.status_changed_at).getTime();

  return {
    totalApps: rows.length,
    totalClients: clients.length,
    totalReleases: releases.length,
    openReleases: releases.filter((r) => !r.released_on).length,
    byStatus: STATUS_ORDER.map((status) => ({
      status,
      count: rows.filter((r) => r.status === status).length,
    })),
    byPlatform: (["play_store", "app_store"] as Platform[]).map((platform) => ({
      platform,
      count: rows.filter((r) => r.platform === platform).length,
    })),
    needsAttention: rows
      .filter((r) => r.status === "rejected" || r.status === "on_hold")
      .sort(olderFirst),
    waiting: rows
      .filter((r) => r.status === "in_review" || r.status === "closed_testing")
      .sort(olderFirst),
  };
}

export async function getActivityForApps(appIds: string[], limit = 30): Promise<AppEvent[]> {
  if (appIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_events")
    .select("*")
    .in("app_id", appIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as AppEvent[];
}

export async function getRecentActivity(limit = 15) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_events")
    .select("*, apps(app_name, project_name, release_id)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as (AppEvent & {
    apps: { app_name: string; project_name: string; release_id: string } | null;
  })[];
}

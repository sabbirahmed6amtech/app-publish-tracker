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
  LineBadge,
  Product,
  ProductLine,
  Platform,
  PublisherAccount,
  Release,
  ReleaseWithApps,
  TeamMember,
} from "@/lib/types";

const CLIENT_TREE =
  "*, publisher_accounts(*), keystores(*), products(*), releases(*, apps(*))";

function sortTree(c: ClientFull): ClientFull {
  c.publisher_accounts = (c.publisher_accounts ?? []).sort((a, b) =>
    a.platform.localeCompare(b.platform),
  );
  c.keystores = (c.keystores ?? []).sort((a, b) => a.name.localeCompare(b.name));
  c.products = sortProducts(c.products ?? []);
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

export function sortProducts(products: Product[]): Product[] {
  return products.sort(
    (a, b) => a.sort_order - b.sort_order || a.project_name.localeCompare(b.project_name),
  );
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
  products: Product[];
  siblings: Release[];
};

export const getRelease = cache(async function getRelease(
  releaseId: string,
): Promise<ReleaseDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("releases")
    .select(
      "*, apps(*), clients(*, publisher_accounts(*), keystores(*), products(*), releases(*))",
    )
    .eq("id", releaseId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as unknown as Release & {
    apps: App[];
    clients: Client & {
      publisher_accounts: PublisherAccount[];
      keystores: Keystore[];
      products: Product[];
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
    products: sortProducts(clients.products ?? []),
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

/** The signed-in user's team member id — what "Me" means in filters. */
export const getCurrentMemberId = cache(async function getCurrentMemberId(): Promise<
  string | null
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("team_members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  return data?.id ?? null;
});

/** Product lines with their projects, in display order. */
export const getProductLines = cache(async function getProductLines(): Promise<ProductLine[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_lines")
    .select("id, name, logo_path, sort_order, product_line_projects(project_name, sort_order)")
    .order("sort_order")
    .order("name");
  if (error) throw new Error(error.message);

  return (data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    logo_path: l.logo_path,
    logo_url: l.logo_path
      ? supabase.storage.from("logos").getPublicUrl(l.logo_path).data.publicUrl
      : null,
    sort_order: l.sort_order,
    projects: (l.product_line_projects ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((p) => p.project_name),
  }));
});

/** project name -> its line's name and logo, for badges anywhere an app shows. */
export function lineBadges(lines: ProductLine[]): Record<string, LineBadge> {
  const out: Record<string, LineBadge> = {};
  for (const l of lines) {
    for (const p of l.projects) out[p] = { line: l.name, logo: l.logo_url };
  }
  return out;
}

/** Every project worth suggesting: the product lines' plus any already in use. */
export function projectSuggestions(lines: ProductLine[], clients: ClientFull[]): string[] {
  const names = new Set(lines.flatMap((l) => l.projects));
  for (const c of clients) for (const p of c.products) names.add(p.project_name);
  return [...names].sort((a, b) => a.localeCompare(b));
}

// ----------------------------------------------------------- public tracker

export type TrackerMatch = { ticket: string; name: string; apps: string | null };

export type TrackerApp = {
  app_name: string;
  project: string;
  platform: Platform;
  status: AppStatus;
  build: string | null;
  status_changed_at: string;
  /** Display name only. */
  assignee: string | null;
  store_url: string | null;
  line: string | null;
  /** Public logo URL, resolved from the line's stored path. */
  logo: string | null;
};

export type TrackerRelease = {
  version: string;
  title: string | null;
  started_on: string;
  released_on: string | null;
  /** Who is running this release — display name only. */
  assignee: string | null;
  apps: TrackerApp[];
};

export type TrackerClient = {
  ticket: string;
  name: string;
  releases: TrackerRelease[];
  activity: {
    app: string;
    platform: Platform;
    version: string;
    from: AppStatus | null;
    to: AppStatus | null;
    at: string;
  }[];
};

/** Public search: clients by name, ticket or store listing name. */
export async function trackerSearch(q: string): Promise<TrackerMatch[]> {
  if (q.trim().length < 2) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tracker_search", { q });
  if (error) throw new Error(error.message);
  return (data ?? []) as TrackerMatch[];
}

/** Public status of one client, or null if there's no such client. */
export async function trackerClient(ticket: string): Promise<TrackerClient | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tracker_client", { p_ticket: ticket });
  if (error) throw new Error(error.message);
  if (!data) return null;

  const client = data as Omit<TrackerClient, "releases"> & {
    releases: (Omit<TrackerRelease, "apps"> & {
      apps: (Omit<TrackerApp, "logo"> & { logo_path: string | null })[];
    })[];
  };
  return {
    ...client,
    releases: client.releases.map((r) => ({
      ...r,
      apps: r.apps.map(({ logo_path, ...a }) => ({
        ...a,
        logo: logo_path
          ? supabase.storage.from("logos").getPublicUrl(logo_path).data.publicUrl
          : null,
      })),
    })),
  };
}

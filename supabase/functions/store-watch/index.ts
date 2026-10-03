// Store Watch — is each app live on its store, and which version?
//
// Looks apps up on the stores' public pages (no store logins) and saves what
// it finds on the product: live, version, when the store last changed, and the
// store link the first time it's seen live. See migration 016.
//
// Only running apps are checked: those whose latest submission isn't in
// Production yet. Once an app is live and moved to Production it's done.
//
// Called by the hourly schedule (with the Vault key in x-store-watch-key) or
// by a signed-in team member's "Check now" (their session token).
// Body: {} for every running app, or { productId } for one.

import { createClient } from "jsr:@supabase/supabase-js@2";

type Product = {
  id: string;
  package_name: string | null;
  store_url: string | null;
  archived: boolean;
  publisher_accounts: { platform: "play_store" | "app_store" } | null;
  apps: { status: string; created_at: string }[];
};

type Found = {
  live: boolean;
  version: string | null;
  updatedAt: string | null;
  url: string | null;
};

/** The status of an app's most recent submission. */
const latestStatus = (p: Product) =>
  [...p.apps].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.status;
const BROWSER =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Google Play: the public listing. 404 = not public; otherwise read its data. */
async function checkPlay(pkg: string): Promise<Found> {
  const url = `https://play.google.com/store/apps/details?id=${encodeURIComponent(pkg)}`;
  // English, so the page always reads the same wherever this runs.
  const res = await fetch(`${url}&hl=en`, { headers: { "User-Agent": BROWSER } });
  if (res.status === 404) return { live: false, version: null, updatedAt: null, url: null };
  if (!res.ok) throw new Error(`Google Play answered ${res.status}`);
  const page = await res.text();
  // The "About this app" data: version, then the update time in seconds.
  const version = page.match(/"141":\[\[\["([^"]+)"\]\]/)?.[1] ?? null;
  const seconds = page.match(/"146":\[\["[^"]*",\[(\d+)/)?.[1];
  return {
    live: true,
    version,
    updatedAt: seconds ? new Date(Number(seconds) * 1000).toISOString() : null,
    url,
  };
}

/** App Store: Apple's public lookup by bundle ID. No result = not on the store. */
async function checkAppStore(bundleId: string): Promise<Found> {
  const res = await fetch(`https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(bundleId)}`);
  if (!res.ok) throw new Error(`Apple answered ${res.status}`);
  const data = await res.json();
  const app = data?.results?.[0];
  if (!app) return { live: false, version: null, updatedAt: null, url: null };
  return {
    live: true,
    version: app.version ?? null,
    updatedAt: app.currentVersionReleaseDate ?? app.releaseDate ?? null,
    // Drop Apple's tracking parameters.
    url: typeof app.trackViewUrl === "string" ? app.trackViewUrl.split("?")[0] : null,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ── who's asking: the schedule's key, or a signed-in team member ──
  let allowed = false;
  const key = req.headers.get("x-store-watch-key");
  if (key) {
    const { data } = await admin.rpc("store_watch_key");
    allowed = typeof data === "string" && data.length > 0 && data === key;
  }
  if (!allowed) {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (token) {
      const { data } = await admin.auth.getUser(token);
      allowed = !!data?.user;
    }
  }
  if (!allowed) return json({ error: "Not allowed." }, 401);

  const body = await req.json().catch(() => ({}));
  const productId: string | undefined = body?.productId;

  // ── which apps ──
  let query = admin
    .from("products")
    .select("id, package_name, store_url, archived, publisher_accounts(platform), apps(status, created_at)")
    .not("package_name", "is", null);
  query = productId ? query.eq("id", productId) : query.eq("archived", false);
  const { data: rows, error } = await query;
  if (error) return json({ error: error.message }, 500);

  const products = (rows as unknown as Product[]).filter((p) => {
    if (!p.package_name?.trim() || !p.publisher_accounts) return false;
    // A "Check now" on one app always runs; the schedule only checks running
    // apps — submitted at least once, and the latest isn't in Production.
    if (productId) return true;
    const status = latestStatus(p);
    return !!status && status !== "production";
  });

  // ── check them one by one, gently ──
  const results: Record<string, unknown>[] = [];
  for (const [i, p] of products.entries()) {
    if (i > 0) await sleep(800);
    const id = p.package_name!.trim();
    const store = p.publisher_accounts!.platform;
    const now = new Date().toISOString();
    try {
      const found = store === "app_store" ? await checkAppStore(id) : await checkPlay(id);
      const update: Record<string, unknown> = {
        store_live: found.live,
        store_version: found.version,
        store_updated_at: found.updatedAt,
        store_checked_at: now,
        store_error: null,
      };
      // The link is filled in the first time the app is seen live; never overwritten.
      if (found.live && found.url && !p.store_url?.trim()) update.store_url = found.url;
      await admin.from("products").update(update).eq("id", p.id);
      results.push({ id: p.id, store, live: found.live, version: found.version });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await admin.from("products").update({ store_checked_at: now, store_error: message }).eq("id", p.id);
      results.push({ id: p.id, store, error: message });
    }
  }

  return json({ checked: results.length, results });
});

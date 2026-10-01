"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as db } from "@/lib/supabase/server";
import { bumpBuild, suggestNextVersion } from "@/lib/constants";
import type { AccountType, AppStatus, Platform } from "@/lib/types";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function nullable(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}

function refresh() {
  revalidatePath("/", "layout");
}

/** Private storage bucket holding keystore files. */
const JKS_BUCKET = "jks";

// ------------------------------------------------------------------ clients

export async function saveClient(fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id");
  const ticket = str(fd, "ticket");
  const name = str(fd, "name");

  if (!ticket) return { ok: false, error: "Ticket number is required." };
  if (!name) return { ok: false, error: "Client name is required." };

  const supabase = await db();
  const payload = { ticket, name, note: nullable(fd, "note") };

  const { data, error } = id
    ? await supabase.from("clients").update(payload).eq("id", id).select("id").single()
    : await supabase.from("clients").insert(payload).select("id").single();

  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? `Ticket ${ticket} already exists.` : error.message,
    };
  }
  refresh();
  return { ok: true, id: data.id };
}

export async function deleteClient(id: string): Promise<ActionResult> {
  const supabase = await db();
  // Keystore rows cascade with the client; their files have to go by hand.
  const { data: keystores } = await supabase
    .from("keystores")
    .select("file_path")
    .eq("client_id", id);
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  const paths = (keystores ?? []).flatMap((k) => (k.file_path ? [k.file_path] : []));
  if (paths.length) await supabase.storage.from(JKS_BUCKET).remove(paths);
  refresh();
  redirect("/clients");
}

export type SetupApp = { project_name: string; app_name: string; stores: Platform[] };

/**
 * Everything a new client needs, from the setup wizard, in one go: the client,
 * its store accounts, its apps, an optional keystore, and the first release.
 * If any step fails the half-made client is removed again.
 */
export async function createClientSetup(fd: FormData): Promise<ActionResult> {
  const ticket = str(fd, "ticket");
  const name = str(fd, "name");
  if (!ticket) return { ok: false, error: "Ticket number is required." };
  if (!name) return { ok: false, error: "Client name is required." };

  const stores = (["play_store", "app_store"] as Platform[]).filter(
    (p) => str(fd, `${p}_enabled`) === "1",
  );
  if (stores.length === 0) return { ok: false, error: "Pick at least one store." };

  let apps: SetupApp[] = [];
  try {
    apps = JSON.parse(str(fd, "apps") || "[]");
  } catch {
    return { ok: false, error: "The app list couldn't be read." };
  }
  apps = apps
    .map((a) => ({ ...a, project_name: a.project_name.trim(), app_name: a.app_name.trim() }))
    .filter((a) => a.project_name && a.stores.some((p) => stores.includes(p)));

  const supabase = await db();
  const { data: client, error } = await supabase
    .from("clients")
    .insert({ ticket, name, note: nullable(fd, "note") })
    .select("id")
    .single();
  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? `Ticket ${ticket} already exists.` : error.message,
    };
  }

  const fail = async (message: string): Promise<ActionResult> => {
    await supabase.from("clients").delete().eq("id", client.id);
    return { ok: false, error: message };
  };

  // ---- store accounts
  const { data: accounts, error: accountError } = await supabase
    .from("publisher_accounts")
    .insert(
      stores.map((platform) => ({
        client_id: client.id,
        platform,
        account_name: str(fd, `${platform}_account_name`),
        account_type: (str(fd, `${platform}_account_type`) || "organization") as AccountType,
      })),
    )
    .select("id, platform");
  if (accountError) return fail(accountError.message);
  const accountFor = new Map(accounts.map((a) => [a.platform as Platform, a.id as string]));

  // ---- keystore
  let keystoreId: string | null = null;
  const file = fd.get("keystore_file");
  const upload = file instanceof File && file.size > 0 ? file : null;
  const details = nullable(fd, "keystore_details");
  if (upload || details) {
    const { data: keystore, error: keystoreError } = await supabase
      .from("keystores")
      .insert({
        client_id: client.id,
        name: str(fd, "keystore_name") || "Main keystore",
        details,
      })
      .select("id")
      .single();
    if (keystoreError) return fail(keystoreError.message);
    keystoreId = keystore.id;
    if (upload) {
      const uploadError = await uploadKeystoreFile(supabase, keystore.id, upload);
      if (uploadError) {
        return fail(`The keystore file couldn't be uploaded: ${uploadError}`);
      }
    }
  }

  // ---- apps, one per store each ships to
  const products = apps.flatMap((a) =>
    a.stores
      .filter((p) => accountFor.has(p))
      .map((p) => ({
        client_id: client.id,
        account_id: accountFor.get(p)!,
        project_name: a.project_name,
        app_name: a.app_name,
        keystore_id: p === "play_store" ? keystoreId : null,
      })),
  );
  if (products.length) {
    const { error: productError } = await supabase
      .from("products")
      .insert(products.map((p, i) => ({ ...p, sort_order: i })));
    if (productError) return fail(duplicateProduct(productError));
  }

  // ---- first release
  if (str(fd, "start_release") === "1" && products.length) {
    const created = await startNewRelease(client.id);
    if (!created.ok) return fail(created.error);
  }

  refresh();
  return { ok: true, id: client.id };
}

// ----------------------------------------------------------------- accounts

export async function saveAccount(fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id");
  const account_name = str(fd, "account_name");
  if (!account_name) return { ok: false, error: "Account name is required." };

  const supabase = await db();
  const payload = {
    client_id: str(fd, "client_id"),
    platform: str(fd, "platform") as Platform,
    account_name,
    account_type: str(fd, "account_type") as AccountType,
    note: nullable(fd, "note"),
  };

  const { error } = id
    ? await supabase.from("publisher_accounts").update(payload).eq("id", id)
    : await supabase.from("publisher_accounts").insert(payload);

  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "This client already has an account on that platform."
          : error.message,
    };
  }
  refresh();
  return { ok: true };
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  const supabase = await db();
  const { error } = await supabase.from("publisher_accounts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// ----------------------------------------------------------------- releases

export async function saveRelease(fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id");
  const client_id = str(fd, "client_id");
  const version = str(fd, "version");

  if (!version) return { ok: false, error: "Version is required." };

  const supabase = await db();

  // Whoever owns the release owns its apps by default. The checkbox is the
  // intent, so this runs on every save it is ticked for — that is what lets
  // you repair a release whose apps drifted out of step with its owner.
  const cascade = fd.get("cascade_assignee") !== null;
  const payload = {
    client_id,
    version,
    title: nullable(fd, "title"),
    assigned_to: nullable(fd, "assigned_to"),
    note: nullable(fd, "note"),
    started_on: str(fd, "started_on") || new Date().toISOString().slice(0, 10),
  };

  const { data, error } = id
    ? await supabase.from("releases").update(payload).eq("id", id).select("id").single()
    : await supabase.from("releases").insert(payload).select("id").single();

  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? `This client already has a release ${version}.`
          : error.message,
    };
  }

  if (cascade && payload.assigned_to) {
    const { error: cascadeError } = await supabase
      .from("apps")
      .update({ assigned_to: payload.assigned_to })
      .eq("release_id", data.id);
    if (cascadeError) return { ok: false, error: cascadeError.message };
  }

  refresh();
  return { ok: true, id: data.id };
}

export async function deleteRelease(id: string): Promise<ActionResult> {
  const supabase = await db();
  const { data: release } = await supabase
    .from("releases")
    .select("client_id")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("releases").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  // The page being viewed no longer exists.
  if (release) redirect(`/clients/${release.client_id}?tab=releases`);
  return { ok: true };
}

/** The signed-in user's team member id, for "assign to me" defaults. */
async function currentMemberId(supabase: Awaited<ReturnType<typeof db>>) {
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
}

/**
 * Submit products into a release as fresh "ongoing" submissions. The Flutter
 * version carries over from each product's most recent submission, and its
 * build number is bumped (1.0.6+9 -> 1.0.7+10).
 */
async function submitProducts(
  supabase: Awaited<ReturnType<typeof db>>,
  releaseId: string,
  productIds: string[],
  assignee: string | null,
) {
  if (productIds.length === 0) return null;

  const [{ data: existing }, { data: previous }] = await Promise.all([
    supabase.from("apps").select("product_id").eq("release_id", releaseId),
    supabase
      .from("apps")
      .select("product_id, flutter_version, build_version, created_at")
      .in("product_id", productIds)
      .order("created_at", { ascending: false }),
  ]);

  const already = new Set((existing ?? []).map((a) => a.product_id));
  // Newest first, so the first value seen per product is the latest one.
  const flutter = new Map<string, string | null>();
  const build = new Map<string, string>();
  for (const p of previous ?? []) {
    if (!flutter.has(p.product_id)) flutter.set(p.product_id, p.flutter_version);
    if (!build.has(p.product_id) && p.build_version) build.set(p.product_id, p.build_version);
  }

  const { data: products } = await supabase
    .from("products")
    .select("id, sort_order")
    .in("id", productIds);

  const rows = (products ?? [])
    .filter((p) => !already.has(p.id))
    .map((p) => ({
      release_id: releaseId,
      product_id: p.id,
      sort_order: p.sort_order,
      status: "ongoing" as AppStatus,
      assigned_to: assignee,
      flutter_version: flutter.get(p.id) ?? null,
      build_version: bumpBuild(build.get(p.id)),
    }));
  if (rows.length === 0) return null;

  const { error } = await supabase.from("apps").insert(rows);
  return error;
}

/**
 * The one-click way to begin a release: next version, assigned to whoever
 * clicked, with every one of the client's active apps submitted as "ongoing".
 */
export async function startNewRelease(clientId: string): Promise<ActionResult> {
  const supabase = await db();

  const [{ data: releases, error: readError }, { data: products }, me] = await Promise.all([
    supabase.from("releases").select("version").eq("client_id", clientId),
    supabase.from("products").select("id").eq("client_id", clientId).eq("archived", false),
    currentMemberId(supabase),
  ]);
  if (readError) return { ok: false, error: readError.message };

  const { data: created, error } = await supabase
    .from("releases")
    .insert({
      client_id: clientId,
      version: suggestNextVersion((releases ?? []).map((r) => r.version)),
      assigned_to: me,
      started_on: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const submitError = await submitProducts(
    supabase,
    created.id,
    (products ?? []).map((p) => p.id),
    me,
  );
  if (submitError) return { ok: false, error: submitError.message };

  refresh();
  return { ok: true, id: created.id };
}

/** Start a release with the same apps as a previous one. */
export async function copyAppsFromRelease(
  fromReleaseId: string,
  toReleaseId: string,
): Promise<ActionResult> {
  const supabase = await db();

  const [{ data: source, error: readError }, { data: target }] = await Promise.all([
    supabase.from("apps").select("product_id").eq("release_id", fromReleaseId),
    // The copies belong to whoever is running the new release.
    supabase.from("releases").select("assigned_to").eq("id", toReleaseId).maybeSingle(),
  ]);
  if (readError) return { ok: false, error: readError.message };

  const error = await submitProducts(
    supabase,
    toReleaseId,
    (source ?? []).map((a) => a.product_id),
    target?.assigned_to ?? null,
  );
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/** Add some of the client's apps to an existing release. */
export async function addProductsToRelease(
  releaseId: string,
  productIds: string[],
): Promise<ActionResult> {
  const supabase = await db();
  const [{ data: release }, me] = await Promise.all([
    supabase.from("releases").select("assigned_to").eq("id", releaseId).maybeSingle(),
    currentMemberId(supabase),
  ]);
  const error = await submitProducts(supabase, releaseId, productIds, release?.assigned_to ?? me);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// ----------------------------------------------------------------- products

/**
 * Create or edit one of a client's permanent apps. Creating takes one or more
 * store accounts and makes one app per store, since each store has its own
 * listing.
 */
export async function saveProduct(fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id");
  const client_id = str(fd, "client_id");
  const project_name = str(fd, "project_name");
  if (!project_name) return { ok: false, error: "Project is required." };

  const fields = {
    project_name,
    app_name: str(fd, "app_name"),
    keystore_id: nullable(fd, "keystore_id"),
    store_url: nullable(fd, "store_url"),
    note: nullable(fd, "note"),
  };

  const supabase = await db();

  if (id) {
    const { error } = await supabase
      .from("products")
      .update({ ...fields, account_id: str(fd, "account_id") })
      .eq("id", id);
    if (error) return { ok: false, error: duplicateProduct(error) };
    refresh();
    return { ok: true, id };
  }

  const accountIds = fd.getAll("account_ids").map(String).filter(Boolean);
  if (accountIds.length === 0) return { ok: false, error: "Pick at least one store." };

  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("client_id", client_id);

  const { error } = await supabase.from("products").insert(
    accountIds.map((account_id, i) => ({
      ...fields,
      client_id,
      account_id,
      sort_order: (count ?? 0) + i,
    })),
  );
  if (error) return { ok: false, error: duplicateProduct(error) };
  refresh();
  return { ok: true };
}

function duplicateProduct(error: { code?: string; message: string }) {
  return error.code === "23505"
    ? "That project already exists on this store for this client."
    : error.message;
}

/** Archived apps stay in history but aren't submitted in new releases. */
export async function setProductArchived(id: string, archived: boolean): Promise<ActionResult> {
  const supabase = await db();
  const { error } = await supabase.from("products").update({ archived }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/** Only apps never submitted can be deleted; the rest are archived. */
export async function deleteProduct(id: string): Promise<ActionResult> {
  const supabase = await db();
  const { count } = await supabase
    .from("apps")
    .select("id", { count: "exact", head: true })
    .eq("product_id", id);
  if (count) {
    return {
      ok: false,
      error: `This app has ${count} submission${count === 1 ? "" : "s"} in past releases. Archive it instead.`,
    };
  }
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- keystores

/** Store a keystore file and point the keystore at it; returns an error message. */
async function uploadKeystoreFile(
  supabase: Awaited<ReturnType<typeof db>>,
  keystoreId: string,
  file: File,
): Promise<string | null> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `keystores/${keystoreId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from(JKS_BUCKET)
    .upload(path, file, { contentType: "application/octet-stream" });
  if (error) return error.message;
  const { error: updateError } = await supabase
    .from("keystores")
    .update({ file_path: path, file_name: file.name })
    .eq("id", keystoreId);
  return updateError?.message ?? null;
}

export async function saveKeystore(fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id");
  const client_id = str(fd, "client_id");
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Give the keystore a name." };

  const file = fd.get("file");
  const upload = file instanceof File && file.size > 0 ? file : null;
  const removeFile = str(fd, "file_remove") === "1";

  const supabase = await db();
  const payload = {
    client_id,
    name,
    details: nullable(fd, "details"),
    note: nullable(fd, "note"),
  };

  let previousPath: string | null = null;
  if (id && (upload || removeFile)) {
    const { data } = await supabase
      .from("keystores")
      .select("file_path")
      .eq("id", id)
      .maybeSingle();
    previousPath = data?.file_path ?? null;
  }

  const { data: saved, error } = id
    ? await supabase.from("keystores").update(payload).eq("id", id).select("id").single()
    : await supabase.from("keystores").insert(payload).select("id").single();

  if (error) return { ok: false, error: error.message };

  if (upload) {
    const uploadError = await uploadKeystoreFile(supabase, saved.id, upload);
    if (uploadError) {
      refresh();
      return {
        ok: false,
        error: `Keystore saved, but the file upload failed: ${uploadError}`,
      };
    }
    if (previousPath) await supabase.storage.from(JKS_BUCKET).remove([previousPath]);
  } else if (removeFile && previousPath) {
    await supabase
      .from("keystores")
      .update({ file_path: null, file_name: null })
      .eq("id", saved.id);
    await supabase.storage.from(JKS_BUCKET).remove([previousPath]);
  }

  refresh();
  return { ok: true, id: saved.id };
}

/** Apps that used it are unlinked, not deleted. */
export async function deleteKeystore(id: string): Promise<ActionResult> {
  const supabase = await db();
  const { data } = await supabase
    .from("keystores")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("keystores").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (data?.file_path) await supabase.storage.from(JKS_BUCKET).remove([data.file_path]);
  refresh();
  return { ok: true };
}

/** Short-lived link that downloads the keystore file under its original name. */
export async function getKeystoreDownloadUrl(
  keystoreId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = await db();
  const { data } = await supabase
    .from("keystores")
    .select("file_path, file_name")
    .eq("id", keystoreId)
    .maybeSingle();
  if (!data?.file_path) return { ok: false, error: "This keystore has no file." };

  const { data: signed, error } = await supabase.storage
    .from(JKS_BUCKET)
    .createSignedUrl(data.file_path, 60, { download: data.file_name ?? true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, url: signed.signedUrl };
}

// --------------------------------------------------------------------- apps

/** Edit one submission — the per-release facts. Identity lives on the product. */
export async function saveApp(fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id");
  if (!id) return { ok: false, error: "Add apps to a release from the client's app list." };

  const supabase = await db();
  const { error } = await supabase
    .from("apps")
    .update({
      status: str(fd, "status") as AppStatus,
      assigned_to: nullable(fd, "assigned_to"),
      build_version: nullable(fd, "build_version"),
      flutter_version: nullable(fd, "flutter_version"),
      note: nullable(fd, "note"),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/** The fields that can be edited straight from a table cell. */
const INLINE_FIELDS = ["build_version", "flutter_version", "assigned_to", "note"] as const;
export type InlineField = (typeof INLINE_FIELDS)[number];

export async function updateAppField(
  id: string,
  field: InlineField,
  value: string | null,
): Promise<ActionResult> {
  if (!INLINE_FIELDS.includes(field)) return { ok: false, error: "That field can't be edited here." };
  const trimmed = value?.trim() || null;
  const supabase = await db();
  const { error } = await supabase
    .from("apps")
    .update({ [field]: trimmed })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function setAppStatus(id: string, status: AppStatus): Promise<ActionResult> {
  const supabase = await db();
  const { error } = await supabase.from("apps").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteApp(id: string): Promise<ActionResult> {
  const supabase = await db();
  const { error } = await supabase.from("apps").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// ------------------------------------------------------------------- import

export type ImportRow = {
  ticket: string;
  client_name: string;
  release_version: string;
  release_title: string;
  assigned_to: string;
  platform: Platform;
  account_name: string;
  account_type: AccountType;
  project_name: string;
  app_name: string;
  status: AppStatus;
  app_assigned_to: string;
  build_version: string;
  flutter_version: string;
  jks: string;
  note: string;
  store_url: string;
};

/**
 * Upsert parsed rows. Clients match on ticket, store accounts on
 * (client, platform), releases on (client, version) and apps on
 * (release, account, project) — so re-importing an edited export updates
 * rather than duplicates.
 */
export async function importRows(
  rows: ImportRow[],
): Promise<{ ok: boolean; error?: string; created: number; updated: number }> {
  const supabase = await db();
  let created = 0;
  let updated = 0;

  // Cache lookups so a 40-row paste does not make 160 round trips.
  // Names in a paste are matched to the roster, and added if unseen.
  const memberIds = new Map<string, string | null>();
  async function memberId(name: string): Promise<string | null> {
    const key = name.trim().toLowerCase();
    if (!key) return null;
    if (memberIds.has(key)) return memberIds.get(key)!;

    const { data: found } = await supabase
      .from("team_members")
      .select("id")
      .ilike("name", name.trim())
      .maybeSingle();

    let id = found?.id as string | undefined;
    if (!id) {
      const { data, error } = await supabase
        .from("team_members")
        .insert({ name: name.trim() })
        .select("id")
        .single();
      if (error) throw error;
      id = data.id;
    }
    memberIds.set(key, id!);
    return id!;
  }

  const clientIds = new Map<string, string>();
  const accountIds = new Map<string, string>();
  const releaseIds = new Map<string, string>();
  const productIds = new Map<string, string>();

  try {
    for (const r of rows) {
      // ---- client
      let clientId = clientIds.get(r.ticket);
      if (!clientId) {
        const { data: found } = await supabase
          .from("clients")
          .select("id")
          .eq("ticket", r.ticket)
          .maybeSingle();

        if (found) {
          clientId = found.id;
        } else {
          const { data, error } = await supabase
            .from("clients")
            .insert({ ticket: r.ticket, name: r.client_name })
            .select("id")
            .single();
          if (error) throw error;
          clientId = data.id;
        }
        clientIds.set(r.ticket, clientId!);
      }

      // ---- store account
      const accountKey = `${clientId}:${r.platform}`;
      let accountId = accountIds.get(accountKey);
      if (!accountId) {
        const { data: found } = await supabase
          .from("publisher_accounts")
          .select("id")
          .eq("client_id", clientId!)
          .eq("platform", r.platform)
          .maybeSingle();

        if (found) {
          accountId = found.id;
        } else {
          const { data, error } = await supabase
            .from("publisher_accounts")
            .insert({
              client_id: clientId!,
              platform: r.platform,
              account_name: r.account_name,
              account_type: r.account_type,
            })
            .select("id")
            .single();
          if (error) throw error;
          accountId = data.id;
        }
        accountIds.set(accountKey, accountId!);
      }

      // ---- release
      const releaseKey = `${clientId}:${r.release_version}`;
      let releaseId = releaseIds.get(releaseKey);
      if (!releaseId) {
        const { data: found } = await supabase
          .from("releases")
          .select("id")
          .eq("client_id", clientId!)
          .eq("version", r.release_version)
          .maybeSingle();

        if (found) {
          releaseId = found.id;
        } else {
          const { data, error } = await supabase
            .from("releases")
            .insert({
              client_id: clientId!,
              version: r.release_version,
              title: r.release_title || null,
              assigned_to: await memberId(r.assigned_to),
            })
            .select("id")
            .single();
          if (error) throw error;
          releaseId = data.id;
        }
        releaseIds.set(releaseKey, releaseId!);
      }

      // ---- product (the client's permanent app)
      const productKey = `${accountId}:${r.project_name}`;
      let productId = productIds.get(productKey);
      if (!productId) {
        const { data: found } = await supabase
          .from("products")
          .select("id")
          .eq("account_id", accountId!)
          .eq("project_name", r.project_name)
          .maybeSingle();

        if (found) {
          productId = found.id;
        } else {
          const { data, error } = await supabase
            .from("products")
            .insert({ client_id: clientId!, account_id: accountId!, project_name: r.project_name })
            .select("id")
            .single();
          if (error) throw error;
          productId = data.id;
        }
        productIds.set(productKey, productId!);
      }

      // The sheet's name and link describe the app itself.
      const identity: Record<string, string> = {};
      if (r.app_name) identity.app_name = r.app_name;
      if (r.store_url) identity.store_url = r.store_url;
      if (Object.keys(identity).length) {
        const { error } = await supabase.from("products").update(identity).eq("id", productId!);
        if (error) throw error;
      }

      // ---- submission
      const payload = {
        release_id: releaseId!,
        product_id: productId!,
        status: r.status,
        assigned_to: await memberId(r.app_assigned_to),
        build_version: r.build_version || null,
        flutter_version: r.flutter_version || null,
        jks: r.jks || null,
        note: r.note || null,
      };

      const { data: existingApp } = await supabase
        .from("apps")
        .select("id")
        .eq("release_id", releaseId!)
        .eq("product_id", productId!)
        .maybeSingle();

      if (existingApp) {
        const { error } = await supabase.from("apps").update(payload).eq("id", existingApp.id);
        if (error) throw error;
        updated++;
      } else {
        const { error } = await supabase.from("apps").insert(payload);
        if (error) throw error;
        created++;
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message, created, updated };
  }

  refresh();
  return { ok: true, created, updated };
}

// ------------------------------------------------------------ product lines

const LOGO_BUCKET = "logos";
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const LOGO_MAX_BYTES = 1024 * 1024;

/**
 * Create or edit a product line: its name, logo and projects (one per line in
 * the form). The project list is replaced as a whole.
 */
export async function saveProductLine(fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id");
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Give the product line a name." };

  const projects = [
    ...new Set(
      str(fd, "projects")
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean),
    ),
  ];

  const file = fd.get("logo");
  const logo = file instanceof File && file.size > 0 ? file : null;
  if (logo && !LOGO_TYPES.includes(logo.type)) {
    return { ok: false, error: "The logo must be a PNG, JPG, WebP or SVG image." };
  }
  if (logo && logo.size > LOGO_MAX_BYTES) {
    return { ok: false, error: "The logo must be 1 MB or smaller." };
  }
  const removeLogo = str(fd, "logo_remove") === "1";

  const supabase = await db();

  // A project belongs to one line; say which line already has it.
  if (projects.length) {
    const { data: taken } = await supabase
      .from("product_line_projects")
      .select("project_name, product_lines(name)")
      .in("project_name", projects)
      .neq("line_id", id || "00000000-0000-0000-0000-000000000000");
    if (taken?.length) {
      const t = taken[0] as unknown as { project_name: string; product_lines: { name: string } };
      return {
        ok: false,
        error: `"${t.project_name}" is already in ${t.product_lines?.name ?? "another line"}.`,
      };
    }
  }

  let previousLogo: string | null = null;
  if (id) {
    const { data } = await supabase
      .from("product_lines")
      .select("logo_path")
      .eq("id", id)
      .maybeSingle();
    previousLogo = data?.logo_path ?? null;
  }

  const { data: saved, error } = id
    ? await supabase.from("product_lines").update({ name }).eq("id", id).select("id").single()
    : await (async () => {
        const { count } = await supabase
          .from("product_lines")
          .select("id", { count: "exact", head: true });
        return supabase
          .from("product_lines")
          .insert({ name, sort_order: count ?? 0 })
          .select("id")
          .single();
      })();
  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? `There's already a line called ${name}.` : error.message,
    };
  }

  // ---- projects
  const { error: clearError } = await supabase
    .from("product_line_projects")
    .delete()
    .eq("line_id", saved.id);
  if (clearError) return { ok: false, error: clearError.message };
  if (projects.length) {
    const { error: projectError } = await supabase
      .from("product_line_projects")
      .insert(
        projects.map((project_name, i) => ({ line_id: saved.id, project_name, sort_order: i })),
      );
    if (projectError) return { ok: false, error: projectError.message };
  }

  // ---- logo
  if (logo) {
    const safeName = logo.name.replace(/[^\w.\-]+/g, "_");
    const path = `product-lines/${saved.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from(LOGO_BUCKET)
      .upload(path, logo, { contentType: logo.type });
    if (uploadError) {
      refresh();
      return { ok: false, error: `Saved, but the logo upload failed: ${uploadError.message}` };
    }
    await supabase.from("product_lines").update({ logo_path: path }).eq("id", saved.id);
    if (previousLogo) await supabase.storage.from(LOGO_BUCKET).remove([previousLogo]);
  } else if (removeLogo && previousLogo) {
    await supabase.from("product_lines").update({ logo_path: null }).eq("id", saved.id);
    await supabase.storage.from(LOGO_BUCKET).remove([previousLogo]);
  }

  refresh();
  return { ok: true, id: saved.id };
}

/** Apps keep their project names; they just lose the line's logo. */
export async function deleteProductLine(id: string): Promise<ActionResult> {
  const supabase = await db();
  const { data } = await supabase
    .from("product_lines")
    .select("logo_path")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("product_lines").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (data?.logo_path) await supabase.storage.from(LOGO_BUCKET).remove([data.logo_path]);
  refresh();
  return { ok: true };
}

// ------------------------------------------------------------------- team

export async function saveTeamMember(fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id");
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Name is required." };

  const supabase = await db();
  const payload = {
    name,
    email: nullable(fd, "email"),
    active: fd.get("active") !== null,
  };

  const { error } = id
    ? await supabase.from("team_members").update(payload).eq("id", id)
    : await supabase.from("team_members").insert(payload);

  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/**
 * Members are referenced by assignments, so deactivating is the usual move —
 * it hides them from the pickers without rewriting history.
 */
export async function setTeamMemberActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const supabase = await db();
  const { error } = await supabase.from("team_members").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteTeamMember(id: string): Promise<ActionResult> {
  const supabase = await db();
  const { error } = await supabase.from("team_members").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// --------------------------------------------------------------------- auth

export async function signOut() {
  const supabase = await db();
  await supabase.auth.signOut();
  redirect("/login");
}

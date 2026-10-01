"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as db } from "@/lib/supabase/server";
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
  const { error } = await supabase.from("releases").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/**
 * Start a release by copying the app list from a previous one — the usual
 * case, since the same three or four apps ship every round.
 */
export async function copyAppsFromRelease(
  fromReleaseId: string,
  toReleaseId: string,
): Promise<ActionResult> {
  const supabase = await db();

  const { data: source, error: readError } = await supabase
    .from("apps")
    .select("account_id, project_name, app_name, keystore_id, jks, sort_order")
    .eq("release_id", fromReleaseId);

  if (readError) return { ok: false, error: readError.message };
  if (!source || source.length === 0) return { ok: true };

  // The copies belong to whoever is running the new round, not to whoever
  // happened to handle them last time.
  const { data: target } = await supabase
    .from("releases")
    .select("assigned_to")
    .eq("id", toReleaseId)
    .maybeSingle();

  const { error } = await supabase.from("apps").insert(
    source.map((a) => ({
      ...a,
      release_id: toReleaseId,
      status: "ongoing" as AppStatus,
      assigned_to: target?.assigned_to ?? null,
    })),
  );

  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- keystores

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
    const safeName = upload.name.replace(/[^\w.\-]+/g, "_");
    const path = `keystores/${saved.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from(JKS_BUCKET)
      .upload(path, upload, { contentType: "application/octet-stream" });
    if (uploadError) {
      refresh();
      return {
        ok: false,
        error: `Keystore saved, but the file upload failed: ${uploadError.message}`,
      };
    }
    await supabase
      .from("keystores")
      .update({ file_path: path, file_name: upload.name })
      .eq("id", saved.id);
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

export async function saveApp(fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id");
  const project_name = str(fd, "project_name");
  const account_id = str(fd, "account_id");

  if (!project_name) return { ok: false, error: "Project is required." };
  if (!account_id) return { ok: false, error: "Pick which store account this goes to." };

  const supabase = await db();
  const payload = {
    release_id: str(fd, "release_id"),
    account_id,
    project_name,
    app_name: str(fd, "app_name"),
    status: str(fd, "status") as AppStatus,
    assigned_to: nullable(fd, "assigned_to"),
    build_version: nullable(fd, "build_version"),
    flutter_version: nullable(fd, "flutter_version"),
    keystore_id: nullable(fd, "keystore_id"),
    store_url: nullable(fd, "store_url"),
    note: nullable(fd, "note"),
    sort_order: Number(str(fd, "sort_order") || 0),
  };

  const { error } = id
    ? await supabase.from("apps").update(payload).eq("id", id)
    : await supabase.from("apps").insert(payload);

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

      // ---- app
      const payload = {
        release_id: releaseId!,
        account_id: accountId!,
        project_name: r.project_name,
        app_name: r.app_name,
        status: r.status,
        assigned_to: await memberId(r.app_assigned_to),
        build_version: r.build_version || null,
        flutter_version: r.flutter_version || null,
        jks: r.jks || null,
        store_url: r.store_url || null,
        note: r.note || null,
      };

      const { data: existingApp } = await supabase
        .from("apps")
        .select("id")
        .eq("release_id", releaseId!)
        .eq("account_id", accountId!)
        .eq("project_name", r.project_name)
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

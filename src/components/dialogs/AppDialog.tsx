"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { Spinner } from "@/components/Spinner";
import { saveApp } from "@/lib/actions";
import { PLATFORMS, PROJECT_SUGGESTIONS, STATUSES, STATUS_ORDER } from "@/lib/constants";
import type { App, Keystore, PublisherAccount, TeamMember } from "@/lib/types";

export function AppDialog({
  releaseId,
  accounts,
  keystores,
  app,
  team,
  defaultAccountId,
  defaultAssignee,
  nextSortOrder = 0,
  trigger,
  className = "btn btn-secondary",
}: {
  releaseId: string;
  accounts: PublisherAccount[];
  keystores: Keystore[];
  app?: App;
  team: TeamMember[];
  defaultAccountId?: string;
  defaultAssignee?: string | null;
  nextSortOrder?: number;
  trigger: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function openDialog() {
    setError(null);
    setOpen(true);
  }

  function submit(fd: FormData) {
    setError(null);
    start(async () => {
      const res = await saveApp(fd);
      if (!res.ok) return setError(res.error);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button className={className} onClick={openDialog}>
        {trigger}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={app ? "Edit app" : "Add app to this release"}
        subtitle="One row per build submitted to a store."
      >
        <form action={submit}>
          <div className="space-y-3 px-5 py-4">
            <input type="hidden" name="id" defaultValue={app?.id ?? ""} />
            <input type="hidden" name="release_id" defaultValue={releaseId} />
            <input
              type="hidden"
              name="sort_order"
              defaultValue={app?.sort_order ?? nextSortOrder}
            />

            {accounts.length === 0 ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                This client has no store account yet. Add one on the client page first —
                an app has to be published under an account.
              </p>
            ) : (
              <div>
                <label className="label" htmlFor="account_id">
                  Publish to
                </label>
                <select
                  id="account_id"
                  name="account_id"
                  required
                  defaultValue={app?.account_id ?? defaultAccountId ?? accounts[0]?.id}
                  className="field"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {PLATFORMS[a.platform].label} — {a.account_name || "unnamed account"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="project_name">
                  Project
                </label>
                <input
                  id="project_name"
                  name="project_name"
                  required
                  list="project-options"
                  defaultValue={app?.project_name ?? ""}
                  placeholder="Project name"
                  className="field"
                />
                <datalist id="project-options">
                  {PROJECT_SUGGESTIONS.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="label" htmlFor="app_name">
                  App name
                </label>
                <input
                  id="app_name"
                  name="app_name"
                  defaultValue={app?.app_name ?? ""}
                  placeholder="App name"
                  className="field"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label" htmlFor="status">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue={app?.status ?? "ongoing"}
                  className="field"
                >
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {STATUSES[s].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="assigned_to">
                  Assigned to
                </label>
                <select
                  id="assigned_to"
                  name="assigned_to"
                  defaultValue={app?.assigned_to ?? defaultAssignee ?? ""}
                  className="field"
                >
                  <option value="">Unassigned</option>
                  {team.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="build_version">
                  Build
                </label>
                <input
                  id="build_version"
                  name="build_version"
                  defaultValue={app?.build_version ?? ""}
                  placeholder="1.0.0+4"
                  className="field font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="flutter_version">
                  Flutter version
                </label>
                <input
                  id="flutter_version"
                  name="flutter_version"
                  defaultValue={app?.flutter_version ?? ""}
                  placeholder="3.44.2"
                  className="field font-mono"
                />
              </div>
              <div>
                <label className="label" htmlFor="keystore_id">
                  Keystore
                </label>
                <select
                  id="keystore_id"
                  name="keystore_id"
                  defaultValue={
                    app
                      ? (app.keystore_id ?? "")
                      : keystores.length === 1
                        ? keystores[0].id
                        : ""
                  }
                  className="field"
                >
                  <option value="">None</option>
                  {keystores.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.file_name ? `${k.name} — ${k.file_name}` : k.name}
                    </option>
                  ))}
                </select>
                {keystores.length === 0 && (
                  <p className="mt-1 text-[11px] text-neutral-500">
                    Add one on the client page to link it here.
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="store_url">
                Store link
              </label>
              <input
                id="store_url"
                name="store_url"
                type="url"
                defaultValue={app?.store_url ?? ""}
                placeholder="https://apps.apple.com/…"
                className="field"
              />
            </div>

            <div>
              <label className="label" htmlFor="app-note">
                Note
              </label>
              <textarea
                id="app-note"
                name="note"
                rows={2}
                defaultValue={app?.note ?? ""}
                placeholder="Anything the next person should know."
                className="field resize-none"
              />
            </div>

            {error && (
              <p className="rounded-md bg-rose-50 px-2.5 py-2 text-[12px] text-rose-700">
                {error}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3">
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || accounts.length === 0}
              className="btn btn-primary"
            >
              {pending ? (
                <>
                  <Spinner /> Saving…
                </>
              ) : (
                "Save app"
              )}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

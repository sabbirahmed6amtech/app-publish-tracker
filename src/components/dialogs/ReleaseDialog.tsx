"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { Spinner } from "@/components/Spinner";
import { copyAppsFromRelease, saveRelease } from "@/lib/actions";
import { suggestNextVersion } from "@/lib/constants";
import type { Release, TeamMember } from "@/lib/types";

export function ReleaseDialog({
  clientId,
  release,
  existingVersions,
  team,
  copyableReleases = [],
  appCount = 0,
  trigger,
  className = "btn btn-primary",
  defaultOpen = false,
}: {
  clientId: string;
  release?: Release;
  existingVersions: string[];
  team: TeamMember[];
  copyableReleases?: { id: string; version: string; appCount: number }[];
  appCount?: number;
  trigger: string;
  className?: string;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const suggested = release?.version ?? suggestNextVersion(existingVersions);

  function submit(fd: FormData) {
    setError(null);
    const copyFrom = String(fd.get("copy_from") ?? "");

    start(async () => {
      const res = await saveRelease(fd);
      if (!res.ok) return setError(res.error);

      // A new release usually ships the same apps as the last one.
      if (!release && copyFrom && res.id) {
        const copied = await copyAppsFromRelease(copyFrom, res.id);
        if (!copied.ok) return setError(copied.error);
      }

      setOpen(false);
      if (!release && res.id) router.push(`/releases/${res.id}`);
      router.refresh();
    });
  }

  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>
        {trigger}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={release ? `Edit version ${release.version}` : "New release"}
        subtitle="One versioned release for this client."
        width="max-w-lg"
      >
        <form action={submit}>
          <div className="space-y-3 px-5 py-4">
            <input type="hidden" name="id" defaultValue={release?.id ?? ""} />
            <input type="hidden" name="client_id" defaultValue={clientId} />
            {!release && <input type="hidden" name="cascade_assignee" value="on" />}

            <div className="grid grid-cols-[130px_1fr] gap-3">
              <div>
                <label className="label" htmlFor="version">
                  Version
                </label>
                <input
                  id="version"
                  name="version"
                  required
                  defaultValue={suggested}
                  placeholder="1.1.0"
                  className="field font-mono"
                />
              </div>
              <div>
                <label className="label" htmlFor="title">
                  Title <span className="font-normal normal-case">(optional)</span>
                </label>
                <input
                  id="title"
                  name="title"
                  defaultValue={release?.title ?? ""}
                  placeholder="Short label"
                  className="field"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="assigned_to">
                  Assigned to
                </label>
                <select
                  id="assigned_to"
                  name="assigned_to"
                  defaultValue={release?.assigned_to ?? ""}
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
                <label className="label" htmlFor="started_on">
                  Started on
                </label>
                <input
                  id="started_on"
                  name="started_on"
                  type="date"
                  defaultValue={release?.started_on ?? new Date().toISOString().slice(0, 10)}
                  className="field"
                />
              </div>
            </div>

            {release && appCount > 0 && (
              <label className="flex cursor-pointer select-none items-start gap-2 rounded-md bg-neutral-50 px-3 py-2 text-[13px] text-neutral-700">
                <input
                  type="checkbox"
                  name="cascade_assignee"
                  defaultChecked
                  className="mt-0.5 size-3.5 accent-neutral-900"
                />
                <span>
                  Also assign the {appCount} {appCount === 1 ? "app" : "apps"} in this
                  release
                  <span className="mt-0.5 block text-[11px] text-neutral-500">
                    Uncheck to keep per-app assignments as they are.
                  </span>
                </span>
              </label>
            )}

            {!release && copyableReleases.length > 0 && (
              <div>
                <label className="label" htmlFor="copy_from">
                  Start from
                </label>
                <select id="copy_from" name="copy_from" defaultValue="" className="field">
                  <option value="">Empty — add apps myself</option>
                  {copyableReleases
                    .filter((r) => r.appCount > 0)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        Copy the {r.appCount} apps from version {r.version}
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-[11px] text-neutral-500">
                  Copies the app list and store accounts across, each one reset to Ongoing.
                </p>
              </div>
            )}

            <div>
              <label className="label" htmlFor="release-note">
                Note
              </label>
              <textarea
                id="release-note"
                name="note"
                rows={2}
                defaultValue={release?.note ?? ""}
                placeholder="What changed in this release."
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
            <button type="submit" disabled={pending} className="btn btn-primary">
              {pending ? (
                <>
                  <Spinner /> Saving…
                </>
              ) : release ? (
                "Save release"
              ) : (
                "Create release"
              )}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

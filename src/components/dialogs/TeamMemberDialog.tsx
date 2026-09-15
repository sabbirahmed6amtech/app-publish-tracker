"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { Spinner } from "@/components/Spinner";
import { saveTeamMember } from "@/lib/actions";
import type { TeamMember } from "@/lib/types";

export function TeamMemberDialog({
  member,
  trigger,
  className = "btn btn-primary",
}: {
  member?: TeamMember;
  trigger: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(fd: FormData) {
    setError(null);
    start(async () => {
      const res = await saveTeamMember(fd);
      if (!res.ok) return setError(res.error);
      setOpen(false);
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
        title={member ? "Edit member" : "Add member"}
        subtitle="Someone work can be assigned to."
        width="max-w-md"
      >
        <form action={submit}>
          <div className="space-y-3 px-5 py-4">
            <input type="hidden" name="id" defaultValue={member?.id ?? ""} />

            <div>
              <label className="label" htmlFor="member-name">
                Display name
              </label>
              <input
                id="member-name"
                name="name"
                required
                defaultValue={member?.name ?? ""}
                placeholder="Full name"
                className="field"
              />
            </div>

            <div>
              <label className="label" htmlFor="member-email">
                Email <span className="font-normal normal-case">(optional)</span>
              </label>
              <input
                id="member-email"
                name="email"
                type="email"
                defaultValue={member?.email ?? ""}
                placeholder="name@example.com"
                className="field"
              />
              {member?.user_id && (
                <p className="mt-1 text-[11px] text-neutral-500">
                  Linked to a Supabase Auth login. Changing this does not change how they
                  sign in.
                </p>
              )}
            </div>

            <label className="flex cursor-pointer select-none items-center gap-2 text-[13px] text-neutral-700">
              <input
                type="checkbox"
                name="active"
                defaultChecked={member?.active ?? true}
                className="size-3.5 accent-neutral-900"
              />
              Active — show in the assignment dropdowns
            </label>

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
              ) : (
                "Save member"
              )}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

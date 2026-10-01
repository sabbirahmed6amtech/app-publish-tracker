"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { Spinner } from "@/components/Spinner";
import { saveAccount } from "@/lib/actions";
import { ACCOUNT_TYPES, PLATFORMS } from "@/lib/constants";
import type { PublisherAccount } from "@/lib/types";

export function AccountDialog({
  clientId,
  account,
  trigger,
  className = "btn btn-secondary",
}: {
  clientId: string;
  account?: PublisherAccount;
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
      const res = await saveAccount(fd);
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
        title={account ? "Edit store account" : "Add store account"}
        subtitle="The developer account the client's apps are published under."
        width="max-w-md"
      >
        <form action={submit}>
          <div className="space-y-3 px-5 py-4">
            <input type="hidden" name="id" defaultValue={account?.id ?? ""} />
            <input type="hidden" name="client_id" defaultValue={clientId} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="platform">
                  Platform
                </label>
                <select
                  id="platform"
                  name="platform"
                  defaultValue={account?.platform ?? "play_store"}
                  className="field"
                >
                  {Object.entries(PLATFORMS).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="account_type">
                  Account type
                </label>
                <select
                  id="account_type"
                  name="account_type"
                  defaultValue={account?.account_type ?? "organization"}
                  className="field"
                >
                  {Object.entries(ACCOUNT_TYPES).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="account_name">
                Account name
              </label>
              <input
                id="account_name"
                name="account_name"
                required
                defaultValue={account?.account_name ?? ""}
                placeholder="Developer account name"
                className="field"
              />
            </div>

            <div>
              <label className="label" htmlFor="account-note">
                Note
              </label>
              <textarea
                id="account-note"
                name="note"
                rows={2}
                defaultValue={account?.note ?? ""}
                placeholder="Anything specific to this account."
                className="field resize-none"
              />
            </div>

            {error && (
              <p className="rounded-md bg-bad-soft px-2.5 py-2 text-[12px] text-bad">
                {error}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className="btn btn-primary">
              {pending ? (
                <>
                  <Spinner /> Saving…
                </>
              ) : (
                "Save account"
              )}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

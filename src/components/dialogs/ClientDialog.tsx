"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { Spinner } from "@/components/Spinner";
import { saveClient } from "@/lib/actions";
import type { Client } from "@/lib/types";

export function ClientDialog({
  client,
  trigger,
  className = "btn btn-primary",
}: {
  client?: Client;
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
      const res = await saveClient(fd);
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
        title={client ? "Edit client" : "New client"}
        subtitle="One record per support ticket."
        width="max-w-md"
      >
        <form action={submit}>
          <div className="space-y-3 px-5 py-4">
            <input type="hidden" name="id" defaultValue={client?.id ?? ""} />

            <div className="grid grid-cols-[110px_1fr] gap-3">
              <div>
                <label className="label" htmlFor="ticket">
                  Ticket
                </label>
                <input
                  id="ticket"
                  name="ticket"
                  required
                  defaultValue={client?.ticket ?? ""}
                  placeholder="12345"
                  className="field font-mono"
                />
              </div>
              <div>
                <label className="label" htmlFor="name">
                  Client name
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  defaultValue={client?.name ?? ""}
                  placeholder="Client name"
                  className="field"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="client-note">
                Note
              </label>
              <textarea
                id="client-note"
                name="note"
                rows={2}
                defaultValue={client?.note ?? ""}
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
            <button type="submit" disabled={pending} className="btn btn-primary">
              {pending ? (
                <>
                  <Spinner /> Saving…
                </>
              ) : (
                "Save client"
              )}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

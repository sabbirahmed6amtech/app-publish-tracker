"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Modal } from "@/components/Modal";
import { Spinner } from "@/components/Spinner";
import { saveClientPlayDetails } from "@/lib/actions";
import { PLAY_LANGUAGES } from "@/lib/constants";
import type { Client } from "@/lib/types";

const FIELDS: {
  name: keyof Client;
  label: string;
  type?: string;
  placeholder: string;
  list?: string;
}[] = [
  { name: "play_privacy_url", label: "Privacy policy URL", type: "url", placeholder: "https://client.com/privacy-policy" },
  { name: "play_delete_account_url", label: "Delete-account URL", type: "url", placeholder: "https://client.com/delete-account" },
  { name: "play_contact_email", label: "Contact email", type: "email", placeholder: "support@client.com" },
  { name: "play_listing_email", label: "Store listing email", type: "email", placeholder: "Same as contact email" },
  { name: "play_contact_phone", label: "Contact phone", placeholder: "+1 555 123 4567" },
  { name: "play_website", label: "Website", type: "url", placeholder: "https://client.com" },
  { name: "play_default_language", label: "Default language", placeholder: "English (United Kingdom) – en-GB", list: "play-languages" },
];

/** The Play Console details every app of this client shares. */
export function ClientPlayDialog({
  client,
  trigger = "Edit",
  className = "btn btn-secondary",
}: {
  client: Client;
  trigger?: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(fd: FormData) {
    setError(null);
    start(async () => {
      const res = await saveClientPlayDetails(fd);
      if (!res.ok) return setError(res.error);
      toast.success("Play details saved");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {trigger}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Play Store details"
        subtitle="Shared by every Play Store app of this client."
        width="max-w-lg"
      >
        <form action={submit}>
          <input type="hidden" name="id" value={client.id} />
          <datalist id="play-languages">
            {PLAY_LANGUAGES.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
          <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.name} className={f.name === "play_default_language" ? "sm:col-span-2" : ""}>
                <label className="label" htmlFor={`cp-${f.name}`}>
                  {f.label}
                </label>
                <input
                  id={`cp-${f.name}`}
                  name={f.name}
                  type={f.type ?? "text"}
                  list={f.list}
                  defaultValue={(client[f.name] as string | null) ?? ""}
                  placeholder={f.placeholder}
                  className="field"
                />
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground sm:col-span-2">
              The default language must match Play Console&apos;s wording exactly — pick it from
              the list.
            </p>
            {error && (
              <p className="rounded-md bg-bad-soft px-2.5 py-2 text-[12px] text-bad sm:col-span-2">
                {error}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t px-5 py-3">
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className="btn btn-primary">
              {pending ? <Spinner /> : null} Save
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

"use client";

import { useState } from "react";
import { Spinner } from "@/components/Spinner";
import { getKeystoreDownloadUrl } from "@/lib/actions";

/** Fetches a short-lived signed link and hands the file to the browser. */
export function KeystoreDownloadButton({
  keystoreId,
  className = "btn btn-secondary px-2 py-0.5 text-[12px]",
}: {
  keystoreId: string;
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setError(null);
    setPending(true);
    const res = await getKeystoreDownloadUrl(keystoreId);
    setPending(false);
    if (!res.ok) return setError(res.error);
    window.location.href = res.url;
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-2">
      <button type="button" className={className} onClick={download} disabled={pending}>
        {pending ? <Spinner /> : "Download"}
      </button>
      {error && <span className="text-[12px] text-bad">{error}</span>}
    </span>
  );
}

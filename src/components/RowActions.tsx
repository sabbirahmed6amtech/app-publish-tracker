"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { STATUSES, STATUS_ORDER } from "@/lib/constants";
import { Spinner } from "@/components/Spinner";
import { setAppStatus } from "@/lib/actions";
import type { AppStatus } from "@/lib/types";

/** Inline status change — the one edit made often enough to deserve no modal. */
export function StatusSelect({ appId, status }: { appId: string; status: AppStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <span className="relative inline-flex items-center">
      {pending && (
        <span className="pointer-events-none absolute -left-4 text-neutral-400">
          <Spinner />
        </span>
      )}
      <select
      value={status}
      disabled={pending}
      aria-label="Change status"
      onChange={(e) => {
        const next = e.target.value as AppStatus;
        start(async () => {
          await setAppStatus(appId, next);
          router.refresh();
        });
      }}
      className={`cursor-pointer rounded-full border-0 py-0.5 pl-2 pr-6 text-[12px] font-medium
                  ring-1 ring-inset transition-opacity ${STATUSES[status].chip}
                  ${pending ? "opacity-50" : ""}`}
    >
      {STATUS_ORDER.map((s) => (
        <option key={s} value={s}>
          {STATUSES[s].label}
        </option>
      ))}
      </select>
    </span>
  );
}

export function DeleteButton({
  label,
  confirmText,
  action,
  className = "btn btn-ghost px-2 py-1",
}: {
  label: string;
  confirmText: string;
  action: () => Promise<{ ok: boolean; error?: string }>;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() => {
        if (!confirm(confirmText)) return;
        start(async () => {
          const res = await action();
          if (!res.ok && res.error) alert(res.error);
          router.refresh();
        });
      }}
    >
      {pending ? <Spinner /> : label}
    </button>
  );
}

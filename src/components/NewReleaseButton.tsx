"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/Spinner";
import { startNewRelease } from "@/lib/actions";

/** Next version, last release's apps, assigned to you — no form. */
export function NewReleaseButton({
  clientId,
  className = "btn btn-primary",
}: {
  clientId: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() =>
        start(async () => {
          const res = await startNewRelease(clientId);
          if (!res.ok) {
            toast.error(`Couldn't start a new release: ${res.error}`);
            return;
          }
          toast.success("New release started");
          router.push(`/releases/${res.id}`);
          router.refresh();
        })
      }
    >
      {pending ? <Spinner /> : <PlusIcon className="size-4" />}
      Start new release
    </button>
  );
}

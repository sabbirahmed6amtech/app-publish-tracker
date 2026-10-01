"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArchiveIcon, ArchiveRestoreIcon } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/Spinner";
import { setProductArchived } from "@/lib/actions";

/** Retire an app from future releases, or bring it back. History is kept. */
export function ArchiveToggle({ productId, archived }: { productId: string; archived: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="btn btn-ghost size-7 px-0"
      aria-label={archived ? "Restore app" : "Archive app"}
      title={archived ? "Restore — include in new releases again" : "Archive — leave out of new releases"}
      onClick={() =>
        start(async () => {
          const res = await setProductArchived(productId, !archived);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success(archived ? "Restored" : "Archived — left out of new releases");
          router.refresh();
        })
      }
    >
      {pending ? (
        <Spinner />
      ) : archived ? (
        <ArchiveRestoreIcon className="size-3.5" />
      ) : (
        <ArchiveIcon className="size-3.5" />
      )}
    </button>
  );
}

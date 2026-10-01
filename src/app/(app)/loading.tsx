import { BrandLoader } from "@/components/BrandLoader";
import { PageHeaderSkeleton } from "@/components/Skeleton";

/** My work: the loader over the board's shape — focus cards, then six columns. */
export default function MyWorkLoading() {
  return (
    <>
      <BrandLoader
        messages={["Loading your board…", "Gathering every app…", "Sorting by status…"]}
      />
      <PageHeaderSkeleton />
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-14 rounded-xl" />
        ))}
      </div>
      <div className="grid auto-cols-[minmax(260px,1fr)] grid-flow-col gap-3 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-xl border-2 border-dashed p-2">
            <div className="skeleton h-4 w-24" />
            {Array.from({ length: 3 - (i % 3) }).map((_, j) => (
              <div key={j} className="skeleton h-20 rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

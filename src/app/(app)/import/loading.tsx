import { PageHeaderSkeleton } from "@/components/Skeleton";

export default function ImportLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <section className="card overflow-hidden">
        <div className="space-y-2 border-b border-neutral-200 px-4 py-2.5">
          <div className="skeleton h-3 w-28 rounded" />
          <div className="skeleton h-3 w-80 rounded" />
        </div>
        <div className="space-y-3 px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: 17 }).map((_, i) => (
              <div key={i} className="skeleton h-4 w-20 rounded" />
            ))}
          </div>
          <div className="skeleton h-48 w-full rounded-md" />
        </div>
      </section>
    </>
  );
}

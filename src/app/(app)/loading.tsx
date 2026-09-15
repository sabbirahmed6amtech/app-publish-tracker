import {
  ListCardSkeleton,
  PageHeaderSkeleton,
  StatStripSkeleton,
} from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <StatStripSkeleton />
      <div className="card mb-4 space-y-3 px-4 py-4">
        <div className="skeleton h-3 w-20 rounded" />
        <div className="skeleton h-2 w-full rounded-full" />
        <div className="flex gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-3 w-24 rounded" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ListCardSkeleton rows={5} />
        <ListCardSkeleton rows={3} />
      </div>
    </>
  );
}

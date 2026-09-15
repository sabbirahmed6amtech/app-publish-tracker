import { PageHeaderSkeleton, TableSkeleton } from "@/components/Skeleton";

export default function TeamLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="card mb-4 px-4 py-3">
        <div className="skeleton h-3 w-2/3 rounded" />
      </div>
      <TableSkeleton rows={5} cols={6} title={false} />
    </>
  );
}

import { FilterBarSkeleton, Line, PageHeaderSkeleton, TableSkeleton } from "@/components/Skeleton";

export default function AppsLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <FilterBarSkeleton />
      <div className="mb-3 px-1">
        <Line w="110px" h={11} />
      </div>
      <div className="space-y-3">
        <TableSkeleton rows={3} cols={7} />
        <TableSkeleton rows={4} cols={7} />
        <TableSkeleton rows={3} cols={7} />
      </div>
    </>
  );
}

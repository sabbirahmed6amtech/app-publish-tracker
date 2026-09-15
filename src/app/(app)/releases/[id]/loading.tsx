import {
  PageHeaderSkeleton,
  StatStripSkeleton,
  TableSkeleton,
} from "@/components/Skeleton";

export default function ReleaseLoading() {
  return (
    <>
      <PageHeaderSkeleton tags />
      <StatStripSkeleton />
      <div className="space-y-4">
        <TableSkeleton rows={3} cols={7} />
        <TableSkeleton rows={3} cols={7} />
      </div>
    </>
  );
}

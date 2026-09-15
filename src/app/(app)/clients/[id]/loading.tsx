import { ListCardSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/Skeleton";

export default function ClientLoading() {
  return (
    <>
      <PageHeaderSkeleton tags />
      <div className="mb-4">
        <TableSkeleton rows={2} cols={4} />
      </div>
      <ListCardSkeleton rows={3} />
    </>
  );
}

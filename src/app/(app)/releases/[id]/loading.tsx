import { BrandLoader } from "@/components/BrandLoader";
import {
  PageHeaderSkeleton,
  StatStripSkeleton,
  TableSkeleton,
} from "@/components/Skeleton";

export default function ReleaseLoading() {
  return (
    <>
      <BrandLoader
        messages={["Opening the release…", "Loading submissions…", "Checking store status…"]}
      />
      <PageHeaderSkeleton tags />
      <StatStripSkeleton />
      <div className="space-y-4">
        <TableSkeleton rows={3} cols={7} />
        <TableSkeleton rows={3} cols={7} />
      </div>
    </>
  );
}

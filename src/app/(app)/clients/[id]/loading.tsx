import { BrandLoader } from "@/components/BrandLoader";
import { ListCardSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/Skeleton";

export default function ClientLoading() {
  return (
    <>
      <BrandLoader
        messages={["Opening the client…", "Loading its apps…", "Checking the current release…"]}
      />
      <PageHeaderSkeleton tags />
      <div className="mb-4">
        <TableSkeleton rows={2} cols={4} />
      </div>
      <ListCardSkeleton rows={3} />
    </>
  );
}

import { BrandLoader } from "@/components/BrandLoader";
import { Line, PageHeaderSkeleton } from "@/components/Skeleton";

export default function ClientsLoading() {
  return (
    <>
      <BrandLoader
        messages={["Loading clients…", "Checking their releases…", "Almost there…"]}
      />
      <PageHeaderSkeleton />
      <div className="space-y-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card flex items-start justify-between gap-3 px-4 py-3.5">
            <div className="space-y-2">
              <Line w={`${140 + ((i * 29) % 90)}px`} h={15} />
              <Line w={`${220 + ((i * 37) % 140)}px`} h={12} />
            </div>
            <div className="flex items-center gap-5">
              <Line w="120px" h={12} />
              <div className="space-y-1.5">
                <Line w="56px" h={13} />
                <Line w="84px" h={11} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

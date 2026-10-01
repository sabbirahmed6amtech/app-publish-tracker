import { BrandLoader } from "@/components/BrandLoader";
import { ListCardSkeleton, PageHeaderSkeleton } from "@/components/Skeleton";

export default function SettingsLoading() {
  return (
    <>
      <BrandLoader
        messages={["Loading settings…", "Fetching the team…", "Almost there…"]}
      />
      <PageHeaderSkeleton />
      <ListCardSkeleton rows={4} />
    </>
  );
}

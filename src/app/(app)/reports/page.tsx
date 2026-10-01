import { PageHeader } from "@/components/PageHeader";
import { PageTabs, pickTab } from "@/components/PageTabs";
import { ReportsOverview } from "@/components/views/ReportsOverview";
import { ReportsSheet, type SheetParams } from "@/components/views/ReportsSheet";

export const dynamic = "force-dynamic";

const TABS = ["overview", "sheet"] as const;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SheetParams & { tab?: string }>;
}) {
  const params = await searchParams;
  const tab = pickTab(params.tab, TABS);

  return (
    <>
      <PageHeader
        title="Reports"
        meta="Where everything stands, across every client."
      />
      <PageTabs
        base="/reports"
        current={tab}
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "sheet", label: "All submissions" },
        ]}
      />
      {tab === "overview" ? <ReportsOverview /> : <ReportsSheet params={params} />}
    </>
  );
}

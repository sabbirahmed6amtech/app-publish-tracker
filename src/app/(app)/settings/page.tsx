import { PageHeader } from "@/components/PageHeader";
import { PageTabs, pickTab } from "@/components/PageTabs";
import { TeamSettings } from "@/components/views/TeamSettings";
import { DataSettings } from "@/components/views/DataSettings";
import { ProductLinesSettings } from "@/components/views/ProductLinesSettings";

export const dynamic = "force-dynamic";

const TABS = ["team", "products", "data"] as const;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const tab = pickTab((await searchParams).tab, TABS);

  return (
    <>
      <PageHeader
        title="Settings"
        meta="The team, the products you sell, and getting data in and out."
      />
      <PageTabs
        base="/settings"
        current={tab}
        tabs={[
          { key: "team", label: "Team" },
          { key: "products", label: "Product lines" },
          { key: "data", label: "Import / export" },
        ]}
      />
      {tab === "team" && <TeamSettings />}
      {tab === "products" && <ProductLinesSettings />}
      {tab === "data" && <DataSettings />}
    </>
  );
}

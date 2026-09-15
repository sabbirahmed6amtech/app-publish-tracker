import { PageHeader } from "@/components/PageHeader";
import { AppsTable } from "@/components/AppsTable";
import { flatten, getClients, getTeam, teamIndex } from "@/lib/queries";
import { PLATFORMS, STATUSES } from "@/lib/constants";
import type { AppStatus, Platform } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AppsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; platform?: string; attention?: string; minAge?: string }>;
}) {
  const params = await searchParams;
  const [clients, roster] = await Promise.all([getClients(), getTeam()]);
  const rows = flatten(clients, teamIndex(roster));

  const status =
    params.status && params.status in STATUSES ? (params.status as AppStatus) : "";
  const platform =
    params.platform && params.platform in PLATFORMS ? (params.platform as Platform) : "";

  return (
    <>
      <PageHeader
        title="All apps"
        meta="Every submission across every client — the sheet, with filters that work."
      />
      <AppsTable
        rows={rows}
        initialStatus={status}
        initialPlatform={platform}
        initialAttention={params.attention === "1"}
        initialMinAge={Number(params.minAge) || 0}
      />
    </>
  );
}

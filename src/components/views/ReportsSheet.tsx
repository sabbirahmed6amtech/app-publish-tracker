import { AppsTable } from "@/components/AppsTable";
import {
  activeMembers,
  flatten,
  getClients,
  getProductLines,
  getTeam,
  lineBadges,
  teamIndex,
} from "@/lib/queries";
import { PLATFORMS, STATUSES } from "@/lib/constants";
import type { AppStatus, Platform } from "@/lib/types";

export type SheetParams = {
  status?: string;
  platform?: string;
  attention?: string;
  minAge?: string;
};

/** Every submission across every client — the sheet, with filters that work. */
export async function ReportsSheet({ params }: { params: SheetParams }) {
  const [clients, roster, lines] = await Promise.all([
    getClients(),
    getTeam(),
    getProductLines(),
  ]);
  const rows = flatten(clients, teamIndex(roster));

  const status =
    params.status && params.status in STATUSES ? (params.status as AppStatus) : "";
  const platform =
    params.platform && params.platform in PLATFORMS ? (params.platform as Platform) : "";

  return (
    <AppsTable
      rows={rows}
      team={activeMembers(roster)}
      badges={lineBadges(lines)}
      lineNames={lines.map((l) => l.name)}
      initialStatus={status}
      initialPlatform={platform}
      initialAttention={params.attention === "1"}
      initialMinAge={Number(params.minAge) || 0}
    />
  );
}

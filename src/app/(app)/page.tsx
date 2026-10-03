import { PageHeader } from "@/components/PageHeader";
import { StatusBoard } from "@/components/StatusBoard";
import { imagesOf, type AppImages } from "@/lib/appImages";
import {
  activeMembers,
  flatten,
  getClients,
  getCurrentMemberId,
  getProductLines,
  getTeam,
  lineBadges,
  teamIndex,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Home: every app by status, opening on your own work. */
export default async function MyWorkPage() {
  const [clients, roster, meId, lines] = await Promise.all([
    getClients(),
    getTeam(),
    getCurrentMemberId(),
    getProductLines(),
  ]);
  const rows = flatten(clients, teamIndex(roster));

  return (
    <>
      <PageHeader
        title="My work"
        meta="Drag a card to change its status. Click it for details and credentials."
      />
      <StatusBoard
        rows={rows}
        team={activeMembers(roster)}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        keystores={clients.flatMap((c) => c.keystores)}
        meId={meId}
        badges={lineBadges(lines)}
        images={Object.fromEntries(
          clients.flatMap((c) => c.products).map((p) => [p.id, imagesOf(p) as AppImages]),
        )}
        publishing={Object.fromEntries(
          clients.flatMap(({ products, releases, keystores, publisher_accounts, ...client }) =>
            products.map((product) => [product.id, { client, product }]),
          ),
        )}
      />
    </>
  );
}

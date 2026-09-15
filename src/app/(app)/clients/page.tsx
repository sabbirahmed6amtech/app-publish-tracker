import { PageHeader } from "@/components/PageHeader";
import { ClientDialog } from "@/components/dialogs/ClientDialog";
import { ClientsList, type ClientCard } from "@/components/ClientsList";
import { getClients, getTeam, teamIndex } from "@/lib/queries";
import { PLATFORMS, releaseState } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const [clients, roster] = await Promise.all([getClients(), getTeam()]);
  const names = teamIndex(roster);

  // Flattened to just what the card renders, so the client bundle stays small.
  const cards: ClientCard[] = clients.map((c) => {
    const latest = c.releases[0];
    return {
      id: c.id,
      ticket: c.ticket,
      name: c.name,
      accounts: c.publisher_accounts.map((a) => ({
        platform: a.platform,
        label: PLATFORMS[a.platform].label,
        accountName: a.account_name,
      })),
      releaseCount: c.releases.length,
      totalApps: c.releases.reduce((n, r) => n + r.apps.length, 0),
      latest: latest
        ? {
            id: latest.id,
            version: latest.version,
            state: releaseState(latest.apps),
            assignee: (latest.assigned_to && names.get(latest.assigned_to)) || null,
            date: latest.released_on ?? latest.started_on,
          }
        : null,
    };
  });

  return (
    <>
      <PageHeader
        title="Clients"
        meta={`${clients.length} active engagements`}
        actions={<ClientDialog trigger="+ New client" />}
      />

      {clients.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <p className="text-[14px] font-medium text-neutral-800">No clients yet.</p>
          <p className="mt-1 text-[13px] text-neutral-500">
            Add one, then create a release to record its first publication round.
          </p>
        </div>
      ) : (
        <ClientsList clients={cards} />
      )}
    </>
  );
}

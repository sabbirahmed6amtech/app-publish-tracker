import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Tag } from "@/components/PageHeader";
import { DeleteButton } from "@/components/RowActions";
import { CopyButton } from "@/components/CopyButton";
import { ClientDialog } from "@/components/dialogs/ClientDialog";
import { AccountDialog } from "@/components/dialogs/AccountDialog";
import { ReleaseDialog } from "@/components/dialogs/ReleaseDialog";
import { getClient, activeMembers, getTeam, teamIndex } from "@/lib/queries";
import { deleteAccount, deleteClient } from "@/lib/actions";
import {
  ACCOUNT_TYPES,
  PLATFORMS,
  RELEASE_STATES,
  formatDate,
  releaseState,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const { new: newParam } = await searchParams;

  const [client, roster] = await Promise.all([getClient(id), getTeam()]);
  if (!client) notFound();

  // Names resolve from the whole roster so a deactivated person's past work
  // still reads correctly; only active people are offered in the pickers.
  const team = activeMembers(roster);
  const names = teamIndex(roster);
  const totalApps = client.releases.reduce((n, r) => n + r.apps.length, 0);
  const versions = client.releases.map((r) => r.version);

  const releaseDialog = (
    <ReleaseDialog
      clientId={client.id}
      existingVersions={versions}
      team={team}
      copyableReleases={client.releases.map((r) => ({
        id: r.id,
        version: r.version,
        appCount: r.apps.length,
      }))}
      trigger="+ New release"
      defaultOpen={newParam === "release"}
    />
  );

  return (
    <>
      <PageHeader
        eyebrow={<span className="font-mono">Ticket #{client.ticket}</span>}
        title={client.name}
        meta={
          <>
            {client.releases.length}{" "}
            {client.releases.length === 1 ? "release" : "releases"} · {totalApps} apps ·{" "}
            {client.publisher_accounts.length}{" "}
            {client.publisher_accounts.length === 1 ? "store account" : "store accounts"}
          </>
        }
        tags={
          <>
            {client.publisher_accounts.map((a) => (
              <Tag key={a.id}>{PLATFORMS[a.platform].label}</Tag>
            ))}
            {client.note && <Tag>{client.note}</Tag>}
          </>
        }
        actions={
          <>
            <ClientDialog client={client} trigger="Edit" className="btn btn-secondary" />
            {releaseDialog}
          </>
        }
      />

      {/* store accounts — stable across releases, so they live on the client */}
      <section className="card mb-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2.5">
          <div>
            <h2 className="text-[13px] font-semibold text-neutral-900">Store accounts</h2>
            <p className="text-[11px] text-neutral-500">
              The developer accounts this client publishes under. Shared by every release.
            </p>
          </div>
          <AccountDialog
            clientId={client.id}
            trigger="+ Account"
            className="btn btn-secondary"
          />
        </div>

        {client.publisher_accounts.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-neutral-400">
            No store account yet — add one before creating a release.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {client.publisher_accounts.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-24 shrink-0 text-[13px] font-medium text-neutral-800">
                  {PLATFORMS[a.platform].label}
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-1">
                  <span className="truncate text-[13px] text-neutral-600">
                    {a.account_name || <span className="text-neutral-300">unnamed</span>}
                  </span>
                  {a.account_name && (
                    <CopyButton value={a.account_name} label="Copy account name" />
                  )}
                </span>
                <Tag>{ACCOUNT_TYPES[a.account_type].label}</Tag>
                <AccountDialog
                  clientId={client.id}
                  account={a}
                  trigger="Edit"
                  className="btn btn-ghost px-2 py-1"
                />
                <DeleteButton
                  label="✕"
                  confirmText={`Delete the ${PLATFORMS[a.platform].label} account? Apps published under it will be removed from every release.`}
                  action={async () => {
                    "use server";
                    return deleteAccount(a.id);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* release history */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2.5">
          <div>
            <h2 className="text-[13px] font-semibold text-neutral-900">Releases</h2>
            <p className="text-[11px] text-neutral-500">
              Each publication round, newest first.
            </p>
          </div>
        </div>

        {client.releases.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-[14px] font-medium text-neutral-800">No releases yet.</p>
            <p className="mx-auto mt-1 max-w-md text-[13px] text-neutral-500">
              Create one to record this round of work — its version, who ran it, and the apps
              that went out.
            </p>
            <div className="mt-4 flex justify-center">{releaseDialog}</div>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {client.releases.map((r) => {
              const state = releaseState(r.apps);
              const live = r.apps.filter((a) => a.status === "production").length;

              return (
                <li key={r.id}>
                  <Link
                    href={`/releases/${r.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-neutral-50"
                  >
                    <span className={`size-2 shrink-0 rounded-full ${RELEASE_STATES[state].dot}`} />
                    <span className="text-[14px] font-semibold text-neutral-900">
                      Version {r.version}
                    </span>
                    {r.title && (
                      <span className="text-[13px] text-neutral-500">{r.title}</span>
                    )}
                    <span className="ml-auto flex items-center gap-4 text-[12px] text-neutral-500">
                      <span>{(r.assigned_to && names.get(r.assigned_to)) || "Unassigned"}</span>
                      <span>
                        {r.apps.length} apps · {live} live
                      </span>
                      <span className="w-24 text-right">
                        {formatDate(r.released_on ?? r.started_on)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
        <p className="text-[12px] text-neutral-500">
          Deleting a client removes its store accounts, all {client.releases.length} releases
          and {totalApps} apps.
        </p>
        <DeleteButton
          label="Delete client"
          confirmText={`Delete ${client.name}, all releases and ${totalApps} apps? This cannot be undone.`}
          action={async () => {
            "use server";
            return deleteClient(client.id);
          }}
          className="btn btn-secondary text-rose-700 hover:bg-rose-50"
        />
      </div>
    </>
  );
}

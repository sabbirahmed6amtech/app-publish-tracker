import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Tag } from "@/components/PageHeader";
import { StatusSelect, DeleteButton } from "@/components/RowActions";
import { CopyButton } from "@/components/CopyButton";
import { CopyReportButton } from "@/components/CopyReportButton";
import { buildReport } from "@/lib/report";
import { ReleaseDialog } from "@/components/dialogs/ReleaseDialog";
import { AppDialog } from "@/components/dialogs/AppDialog";
import { AppPreviewRow } from "@/components/AppPreviewRow";
import { getActivityForApps, getRelease, activeMembers, getTeam, teamIndex } from "@/lib/queries";
import { deleteApp, deleteRelease } from "@/lib/actions";
import {
  ACCOUNT_TYPES,
  PLATFORMS,
  RELEASE_STATES,
  STATUSES,
  daysSince,
  formatDate,
  isStale,
  releaseState,
} from "@/lib/constants";
import type { App, Keystore, PublisherAccount, TeamMember } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReleasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, roster] = await Promise.all([getRelease(id), getTeam()]);
  if (!detail) notFound();

  const { release, client, accounts, keystores, siblings } = detail;
  const apps = release.apps;
  const live = apps.filter((a) => a.status === "production").length;
  const state = releaseState(apps);
  // Names resolve from the whole roster so a deactivated person's past work
  // still reads correctly; only active people are offered in the pickers.
  const team = activeMembers(roster);
  const names = teamIndex(roster);
  const events = await getActivityForApps(apps.map((a) => a.id)).catch(() => []);
  const appNames = new Map(apps.map((a) => [a.id, a.app_name || a.project_name]));

  // Apps are grouped by the store account they were submitted to.
  const used = accounts.filter((acc) => apps.some((a) => a.account_id === acc.id));

  const accountPlatform = new Map(accounts.map((a) => [a.id, a.platform]));
  const report = buildReport([
    {
      ticket: client.ticket,
      clientName: client.name,
      version: release.version,
      title: release.title,
      note: release.note,
      apps: apps
        .filter((a) => accountPlatform.has(a.account_id))
        .map((a) => ({
          platform: accountPlatform.get(a.account_id)!,
          projectName: a.project_name,
          status: a.status,
          storeUrl: a.store_url,
          note: a.note,
          sortOrder: a.sort_order,
        })),
    },
  ]);
  const orphaned = apps.filter((a) => !accounts.some((acc) => acc.id === a.account_id));

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={`/clients/${client.id}`} className="hover:text-neutral-900 hover:underline">
            {client.name} · <span className="font-mono">#{client.ticket}</span>
          </Link>
        }
        title={
          <span className="flex flex-wrap items-baseline gap-2.5">
            Version {release.version}
            {release.title && (
              <span className="text-[15px] font-normal text-neutral-500">{release.title}</span>
            )}
          </span>
        }
        meta={
          <>
            {apps.length} {apps.length === 1 ? "app" : "apps"} · {live} live ·{" "}
            {used.length} {used.length === 1 ? "store" : "stores"}
            {release.note ? ` · ${release.note}` : ""}
          </>
        }
        tags={
          <>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px]
                          font-medium ring-1 ring-inset ${RELEASE_STATES[state].chip}`}
            >
              <span className={`size-2 rounded-full ${RELEASE_STATES[state].dot}`} />
              {RELEASE_STATES[state].label}
            </span>
            {used.map((a) => (
              <Tag key={a.id}>{PLATFORMS[a.platform].label}</Tag>
            ))}
          </>
        }
        actions={
          <>
            <CopyReportButton report={report} />
            <ReleaseDialog
              clientId={client.id}
              release={release}
              existingVersions={siblings.map((r) => r.version)}
              team={team}
              appCount={apps.length}
              trigger="Edit"
              className="btn btn-secondary"
            />
            <AppDialog
              releaseId={release.id}
              accounts={accounts}
              keystores={keystores}
              team={team}
              defaultAssignee={release.assigned_to}
              nextSortOrder={apps.length}
              trigger="+ Add app"
              className="btn btn-primary"
            />
          </>
        }
      />

      {/* the facts you would otherwise dig out of the tables */}
      <div className="card mb-4 grid grid-cols-2 divide-neutral-200 sm:grid-cols-4 sm:divide-x">
        <Field
          label="Assigned to"
          value={
            (release.assigned_to && names.get(release.assigned_to)) || <Muted>Unassigned</Muted>
          }
        />
        <Field
          label="State"
          value={
            <span className="inline-flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${RELEASE_STATES[state].dot}`} />
              {RELEASE_STATES[state].label}
            </span>
          }
        />
        <Field label="Apps" value={apps.length === 0 ? <Muted>None</Muted> : `${apps.length} · ${live} live`} />
        <Field
          label={release.released_on ? "Released" : "Started"}
          value={formatDate(release.released_on ?? release.started_on)}
        />
      </div>

      {accounts.length === 0 && (
        <div className="card mb-4 border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          <strong className="font-semibold">No store account on this client.</strong> Add the
          Play Store or App Store account on the{" "}
          <Link href={`/clients/${client.id}`} className="underline">
            client page
          </Link>{" "}
          before adding apps.
        </div>
      )}

      {apps.length === 0 && accounts.length > 0 && (
        <div className="card px-6 py-14 text-center">
          <p className="text-[14px] font-medium text-neutral-800">Nothing submitted yet.</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-neutral-500">
            Add the apps going out in version {release.version}. Each one records its own
            status, build and who worked it.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {used.map((account) => (
          <AccountSection
            key={account.id}
            account={account}
            apps={apps.filter((a) => a.account_id === account.id)}
            releaseId={release.id}
            accounts={accounts}
            keystores={keystores}
            team={team}
            names={names}
            defaultAssignee={release.assigned_to}
          />
        ))}

        {orphaned.length > 0 && (
          <div className="card border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-800">
            {orphaned.length} app(s) point at a store account that no longer exists. Edit them
            to pick a current account.
          </div>
        )}
      </div>

      {events.length > 0 && (
        <section className="card mt-4 overflow-hidden">
          <div className="border-b border-neutral-200 px-4 py-2.5">
            <h2 className="text-[13px] font-semibold text-neutral-900">Activity</h2>
          </div>
          <ul className="divide-y divide-neutral-100">
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                <span className="w-28 shrink-0 text-[11px] text-neutral-400">
                  {new Date(e.created_at).toLocaleDateString()}
                </span>
                <span className="min-w-0 flex-1 truncate text-neutral-600">
                  <strong className="font-medium text-neutral-900">
                    {appNames.get(e.app_id) ?? "App"}
                  </strong>{" "}
                  {e.kind === "status" && e.from_status && e.to_status
                    ? `${STATUSES[e.from_status].label} → ${STATUSES[e.to_status].label}`
                    : e.message || e.kind}
                </span>
                {e.actor && <span className="text-[11px] text-neutral-500">{e.actor}</span>}
                <span className="w-16 text-right text-[11px] text-neutral-400">
                  {daysSince(e.created_at)}d ago
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
        <p className="text-[12px] text-neutral-500">
          Deleting version {release.version} removes its {apps.length} app rows and their
          history. The client and its store accounts stay.
        </p>
        <DeleteButton
          label="Delete release"
          confirmText={`Delete version ${release.version} and its ${apps.length} apps?`}
          action={async () => {
            "use server";
            return deleteRelease(release.id);
          }}
          className="btn btn-secondary text-rose-700 hover:bg-rose-50"
        />
      </div>
    </>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="font-normal text-neutral-400">{children}</span>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 truncate text-[13px] font-medium text-neutral-900">{value}</div>
    </div>
  );
}

function AccountSection({
  account,
  apps,
  releaseId,
  accounts,
  keystores,
  team,
  names,
  defaultAssignee,
}: {
  account: PublisherAccount;
  apps: App[];
  releaseId: string;
  accounts: PublisherAccount[];
  keystores: Keystore[];
  team: TeamMember[];
  names: Map<string, string>;
  defaultAssignee: string | null;
}) {
  const live = apps.filter((a) => a.status === "production").length;
  const keystoreById = new Map(keystores.map((k) => [k.id, k]));

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 bg-neutral-50/60 px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[14px] font-semibold text-neutral-900">
              {PLATFORMS[account.platform].label}
            </h2>
            <Tag>{ACCOUNT_TYPES[account.account_type].label}</Tag>
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-[12px] text-neutral-500">
            <span className="truncate">
              {account.account_name || "No account name set"}
            </span>
            {account.account_name && (
              <CopyButton value={account.account_name} label="Copy account name" />
            )}
            <span className="shrink-0">
              · {apps.length} apps · {live} live
            </span>
          </p>
        </div>
        <AppDialog
          releaseId={releaseId}
          accounts={accounts}
          keystores={keystores}
          team={team}
          defaultAccountId={account.id}
          defaultAssignee={defaultAssignee}
          nextSortOrder={apps.length}
          trigger="+ App"
          className="btn btn-secondary"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="th">Project</th>
              <th className="th">App name</th>
              <th className="th">Assigned to</th>
              <th className="th">Status</th>
              <th className="th">Build</th>
              <th className="th">Note</th>
              <th className="th text-right">Link</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => (
              <AppPreviewRow
                key={app.id}
                app={app}
                accountLabel={`${PLATFORMS[account.platform].label} — ${
                  account.account_name || "unnamed account"
                }`}
                assigneeName={(app.assigned_to && names.get(app.assigned_to)) || null}
                keystore={(app.keystore_id && keystoreById.get(app.keystore_id)) || null}
                className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/70"
              >
                <td className="td whitespace-nowrap font-medium text-neutral-800">
                  {app.project_name}
                </td>
                <td className="td">
                  {app.app_name || <span className="text-neutral-300">—</span>}
                </td>
                <td className="td whitespace-nowrap">
                  {(app.assigned_to && names.get(app.assigned_to)) || (
                    <span className="text-neutral-300">—</span>
                  )}
                </td>
                <td className="td">
                  <div className="flex items-center gap-2">
                    <StatusSelect appId={app.id} status={app.status} />
                    {isStale(app.status, app.status_changed_at) && (
                      <span
                        className="text-[11px] font-medium text-neutral-400"
                        title={`No change in ${daysSince(app.status_changed_at)} days`}
                      >
                        {daysSince(app.status_changed_at)}d
                      </span>
                    )}
                  </div>
                </td>
                <td className="td whitespace-nowrap font-mono text-[12px]">
                  {app.build_version || <span className="font-sans text-neutral-300">—</span>}
                </td>
                <td className="td max-w-[200px] truncate" title={app.note ?? ""}>
                  {app.note || <span className="text-neutral-300">—</span>}
                </td>
                <td className="td text-right">
                  {app.store_url ? (
                    <a
                      href={app.store_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[12px] font-medium text-blue-600 hover:underline"
                    >
                      Store ↗
                    </a>
                  ) : (
                    <span className="text-neutral-300">—</span>
                  )}
                </td>
                <td className="td">
                  <div className="flex items-center justify-end gap-0.5">
                    <AppDialog
                      releaseId={releaseId}
                      accounts={accounts}
                      keystores={keystores}
                      app={app}
                      team={team}
                      defaultAssignee={defaultAssignee}
                      trigger="Edit"
                      className="btn btn-ghost px-2 py-1"
                    />
                    <DeleteButton
                      label="✕"
                      confirmText={`Delete ${app.app_name || app.project_name}?`}
                      action={async () => {
                        "use server";
                        return deleteApp(app.id);
                      }}
                    />
                  </div>
                </td>
              </AppPreviewRow>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

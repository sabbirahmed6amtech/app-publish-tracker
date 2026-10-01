import { ExternalLinkIcon } from "lucide-react";
import { StatusSelect, DeleteButton } from "@/components/RowActions";
import { CopyReportButton } from "@/components/CopyReportButton";
import { AppPreviewRow } from "@/components/AppPreviewRow";
import { InlineAssignee, InlineText } from "@/components/InlineEdit";
import { ReleaseDialog } from "@/components/dialogs/ReleaseDialog";
import { SubmissionDialog } from "@/components/dialogs/SubmissionDialog";
import { AddToReleaseDialog } from "@/components/dialogs/AddToReleaseDialog";
import { buildReport } from "@/lib/report";
import { deleteApp } from "@/lib/actions";
import { activeMembers, lineBadges, teamIndex } from "@/lib/queries";
import { ProjectLogo } from "@/components/ProjectLogo";
import { StoreIcon } from "@/components/StoreIcon";
import {
  PLATFORMS,
  RELEASE_STATES,
  daysSince,
  formatDate,
  isStale,
  releaseState,
} from "@/lib/constants";
import type {
  Keystore,
  Product,
  ProductLine,
  PublisherAccount,
  Release,
  ReleaseWithApps,
  TeamMember,
} from "@/lib/types";

/**
 * One release of a client: what's in it, where each app stands, and everything
 * a developer edits day to day — inline, without dialogs.
 */
export function ReleaseView({
  release,
  client,
  accounts,
  keystores,
  products,
  siblings,
  roster,
  lines,
}: {
  release: ReleaseWithApps;
  client: { id: string; name: string; ticket: string };
  accounts: PublisherAccount[];
  keystores: Keystore[];
  products: Product[];
  siblings: Release[];
  roster: TeamMember[];
  lines: ProductLine[];
}) {
  const apps = release.apps;
  const badges = lineBadges(lines);
  const team = activeMembers(roster);
  const names = teamIndex(roster);
  const state = releaseState(apps);
  const live = apps.filter((a) => a.status === "production").length;

  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const keystoreById = new Map(keystores.map((k) => [k.id, k]));
  const platformOrder = (accountId: string) =>
    accountById.get(accountId)?.platform === "app_store" ? 1 : 0;
  const rows = [...apps].sort(
    (a, b) =>
      platformOrder(a.account_id) - platformOrder(b.account_id) || a.sort_order - b.sort_order,
  );

  // Play Store and App Store each get their own section.
  const groups = (["play_store", "app_store"] as const)
    .map((platform) => {
      const inGroup = rows.filter(
        (a) => (accountById.get(a.account_id)?.platform ?? "play_store") === platform,
      );
      const account = accounts.find((a) => a.platform === platform);
      return { platform, accountName: account?.account_name ?? "", rows: inGroup };
    })
    .filter((g) => g.rows.length > 0);

  const inRelease = new Set(apps.map((a) => a.product_id));
  const candidates = products
    .filter((p) => !p.archived && !inRelease.has(p.id))
    .map((p) => {
      const account = accountById.get(p.account_id);
      return {
        id: p.id,
        label: p.app_name || p.project_name,
        sub: `${account ? PLATFORMS[account.platform].label : "Unknown store"} · ${p.project_name}`,
      };
    });

  const report = buildReport(
    [
      {
        ticket: client.ticket,
        clientName: client.name,
        version: release.version,
        title: release.title,
        note: release.note,
        apps: rows
          .filter((a) => accountById.has(a.account_id))
          .map((a) => ({
            platform: accountById.get(a.account_id)!.platform,
            projectName: a.project_name,
            status: a.status,
            storeUrl: a.store_url,
            note: a.note,
            sortOrder: a.sort_order,
          })),
      },
    ],
    lines.map((l) => l.name),
  );

  return (
    <section className="card overflow-hidden">
      {/* release header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-semibold">Version {release.version}</h2>
            {release.title && (
              <span className="text-[13px] text-muted-foreground">{release.title}</span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${RELEASE_STATES[state].chip}`}
            >
              <span className={`size-1.5 rounded-full ${RELEASE_STATES[state].dot}`} />
              {RELEASE_STATES[state].label}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {(release.assigned_to && names.get(release.assigned_to)) || "Unassigned"} ·{" "}
            {release.released_on
              ? `Released ${formatDate(release.released_on)}`
              : `Started ${formatDate(release.started_on)}`}{" "}
            · {live}/{apps.length} live
            {release.note ? ` · ${release.note}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopyReportButton report={report} />
          <AddToReleaseDialog releaseId={release.id} candidates={candidates} clientId={client.id} />
          <ReleaseDialog
            clientId={client.id}
            release={release}
            existingVersions={siblings.map((r) => r.version)}
            team={team}
            appCount={apps.length}
            trigger="Edit release"
            className="btn btn-secondary"
          />
        </div>
      </div>

      {apps.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-[14px] font-medium">Nothing in this release yet.</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-muted-foreground">
            Use <strong className="font-medium text-foreground">Add apps</strong> to submit this
            client&apos;s apps in version {release.version}.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="th">App</th>
                <th className="th">Status</th>
                <th className="th">Assigned to</th>
                <th className="th">Build number</th>
                <th className="th">Note</th>
                <th className="th w-0" />
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group.platform}>
                <tr className="border-b bg-muted/60">
                  <td colSpan={6} className="px-3 py-1.5">
                    <div className="flex items-center gap-2 text-[12px]">
                      <StoreIcon platform={group.platform} size={14} />
                      <span className="font-semibold">{PLATFORMS[group.platform].label}</span>
                      {group.accountName && (
                        <span className="text-muted-foreground">{group.accountName}</span>
                      )}
                      <span className="ml-auto tabular-nums text-muted-foreground">
                        {group.rows.filter((a) => a.status === "production").length}/
                        {group.rows.length} live
                      </span>
                    </div>
                  </td>
                </tr>
                {group.rows.map((app) => {
                  const account = accountById.get(app.account_id);
                  const platform = account?.platform ?? "play_store";
                  return (
                    <AppPreviewRow
                      key={app.id}
                      app={app}
                      accountLabel={`${PLATFORMS[platform].label} — ${
                        account?.account_name || "unnamed account"
                      }`}
                      assigneeName={(app.assigned_to && names.get(app.assigned_to)) || null}
                      keystore={(app.keystore_id && keystoreById.get(app.keystore_id)) || null}
                      className="border-b last:border-0 hover:bg-muted/40"
                    >
                      <td className="td">
                        <div className="flex items-center gap-2.5">
                          <ProjectLogo
                            badge={badges[app.project_name]}
                            project={app.project_name}
                          />
                          <div className="min-w-0 leading-tight">
                            <div className="truncate font-medium">
                              {app.app_name || app.project_name}
                            </div>
                            <div className="truncate text-[11px] text-muted-foreground">
                              {app.project_name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-2">
                          <StatusSelect appId={app.id} status={app.status} />
                          {isStale(app.status, app.status_changed_at) && (
                            <span
                              className="text-[11px] font-medium text-[#8a5a00]"
                              title={`No change in ${daysSince(app.status_changed_at)} days`}
                            >
                              {daysSince(app.status_changed_at)}d
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="td whitespace-nowrap">
                        <InlineAssignee
                          appId={app.id}
                          value={app.assigned_to}
                          team={team}
                          name={app.assigned_to ? names.get(app.assigned_to) : null}
                        />
                      </td>
                      <td className="td whitespace-nowrap">
                        <InlineText
                          appId={app.id}
                          field="build_version"
                          value={app.build_version}
                          placeholder="Add build number"
                          mono
                          className="w-36"
                        />
                      </td>
                      <td className="td max-w-[240px]">
                        <InlineText
                          appId={app.id}
                          field="note"
                          value={app.note}
                          placeholder="Add note"
                          className="w-full"
                        />
                      </td>
                      <td className="td">
                        <div className="flex items-center justify-end gap-0.5">
                          {app.store_url && (
                            <a
                              href={app.store_url}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-ghost size-7 px-0"
                              aria-label="Open store listing"
                              title="Open store listing"
                            >
                              <ExternalLinkIcon className="size-3.5" />
                            </a>
                          )}
                          <SubmissionDialog
                            app={app}
                            platform={platform}
                            clientId={client.id}
                            team={team}
                          />
                          <DeleteButton
                            label="✕"
                            confirmText={`Remove ${app.app_name || app.project_name} from version ${release.version}? The app itself stays on the client.`}
                            action={async () => {
                              "use server";
                              return deleteApp(app.id);
                            }}
                            className="btn btn-ghost size-7 px-0"
                          />
                        </div>
                      </td>
                    </AppPreviewRow>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </section>
  );
}

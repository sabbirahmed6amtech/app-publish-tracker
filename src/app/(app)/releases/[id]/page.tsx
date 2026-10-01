import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRightIcon } from "lucide-react";
import { DeleteButton } from "@/components/RowActions";
import { ReleaseView } from "@/components/ReleaseView";
import { getActivityForApps, getProductLines, getRelease, getTeam } from "@/lib/queries";
import { deleteRelease } from "@/lib/actions";
import { STATUSES, daysSince } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function ReleasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, roster, lines] = await Promise.all([
    getRelease(id),
    getTeam(),
    getProductLines(),
  ]);
  if (!detail) notFound();

  const { release, client, accounts, keystores, products, siblings } = detail;
  const apps = release.apps;
  const events = await getActivityForApps(apps.map((a) => a.id)).catch(() => []);
  const appNames = new Map(apps.map((a) => [a.id, a.app_name || a.project_name]));
  const isCurrent = siblings[0]?.id === release.id;

  return (
    <>
      <nav className="mb-4 flex items-center gap-1 text-[13px] text-muted-foreground">
        <Link href={`/clients/${client.id}`} className="font-medium hover:text-foreground">
          {client.name}
        </Link>
        <ChevronRightIcon className="size-3.5" />
        <Link href={`/clients/${client.id}?tab=releases`} className="hover:text-foreground">
          Releases
        </Link>
        <ChevronRightIcon className="size-3.5" />
        <span className="text-foreground">Version {release.version}</span>
        {isCurrent && (
          <span className="ml-1.5 rounded-md border bg-card px-1.5 text-[11px]">Current</span>
        )}
      </nav>

      <ReleaseView
        release={release}
        client={client}
        accounts={accounts}
        keystores={keystores}
        products={products}
        siblings={siblings}
        roster={roster}
        lines={lines}
      />

      {events.length > 0 && (
        <section className="card mt-4 overflow-hidden">
          <div className="border-b px-4 py-2.5">
            <h2 className="text-[13px] font-semibold">Activity</h2>
          </div>
          <ul className="divide-y">
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                <span className="w-24 shrink-0 text-[11px] text-muted-foreground">
                  {new Date(e.created_at).toLocaleDateString()}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <strong className="font-medium">{appNames.get(e.app_id) ?? "App"}</strong>{" "}
                  <span className="text-muted-foreground">
                    {e.kind === "status" && e.from_status && e.to_status
                      ? `${STATUSES[e.from_status].label} → ${STATUSES[e.to_status].label}`
                      : e.message || e.kind}
                  </span>
                </span>
                {e.actor && <span className="text-[11px] text-muted-foreground">{e.actor}</span>}
                <span className="w-16 text-right text-[11px] text-muted-foreground">
                  {daysSince(e.created_at)}d ago
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        <p className="text-[12px] text-muted-foreground">
          Deleting version {release.version} removes its {apps.length} submissions and their
          history. The client and its apps stay.
        </p>
        <DeleteButton
          label="Delete release"
          confirmText={`Delete version ${release.version} and its ${apps.length} submissions?`}
          action={async () => {
            "use server";
            return deleteRelease(release.id);
          }}
          className="btn btn-secondary text-destructive hover:bg-destructive/10"
        />
      </div>
    </>
  );
}

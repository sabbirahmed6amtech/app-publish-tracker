import { PageHeader } from "@/components/PageHeader";
import { ImportForm } from "@/components/ImportForm";
import { ExportButton } from "@/components/ExportButton";
import { flatten, getClients, getTeam, teamIndex } from "@/lib/queries";
import { EXPORT_HEADERS } from "@/lib/csv";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const [clients, roster] = await Promise.all([getClients(), getTeam()]);
  const rows = flatten(clients, teamIndex(roster));

  return (
    <>
      <PageHeader
        title="Import / export"
        meta="Move the old sheet in, or take a snapshot out."
        actions={<ExportButton rows={rows} label={`Export all ${rows.length} apps`} />}
      />

      <ImportForm />

      <section className="card mt-4 px-4 py-4">
        <h2 className="text-[13px] font-semibold text-neutral-900">How re-importing works</h2>
        <ul className="mt-2 space-y-1.5 text-[13px] text-neutral-600">
          <li>
            Clients match on <strong className="font-medium">ticket number</strong>.
          </li>
          <li>
            Store accounts match on{" "}
            <strong className="font-medium">client + platform</strong> — one per store.
          </li>
          <li>
            Releases match on <strong className="font-medium">client + version</strong>, so all
            rows sharing a version land in the same release.
          </li>
          <li>
            Apps match on{" "}
            <strong className="font-medium">release + account + project name</strong>, so
            re-importing an edited export updates rather than duplicates.
          </li>
        </ul>

        <h2 className="mt-5 text-[13px] font-semibold text-neutral-900">Export columns</h2>
        <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-neutral-500">
          {EXPORT_HEADERS.join(" · ")}
        </p>
      </section>
    </>
  );
}

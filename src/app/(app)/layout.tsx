import { Sidebar, type SidebarClient } from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { getClients, getTeam, teamIndex } from "@/lib/queries";
import { releaseState } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  let clients: SidebarClient[] = [];
  let loadError: string | null = null;
  let user: { email?: string } | null = null;

  try {
    // Session, roster and client tree are independent — fetch them together.
    const [auth, roster, tree] = await Promise.all([
      supabase.auth.getUser(),
      getTeam(),
      getClients(),
    ]);
    user = auth.data.user;
    const names = teamIndex(roster);
    clients = tree.map((c) => ({
      id: c.id,
      ticket: c.ticket,
      name: c.name,
      releases: c.releases.map((r) => ({
        id: r.id,
        version: r.version,
        title: r.title,
        assignedTo: (r.assigned_to && names.get(r.assigned_to)) || null,
        appCount: r.apps.length,
        state: releaseState(r.apps),
      })),
    }));
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar clients={clients} email={user?.email ?? null} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1400px] px-5 py-6 lg:px-8 lg:py-8">
          {loadError && (
            <div className="card mb-5 border-rose-200 bg-rose-50 p-4 text-[13px] text-rose-800">
              <strong className="font-semibold">Could not load data.</strong> {loadError}
              <div className="mt-1 text-rose-700">
                If the tables look wrong, re-run{" "}
                <code className="font-mono">supabase/schema.sql</code> — it resets to the
                release-based schema.
              </div>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

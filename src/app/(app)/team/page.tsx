import { PageHeader, Tag } from "@/components/PageHeader";
import { DeleteButton } from "@/components/RowActions";
import { TeamMemberDialog } from "@/components/dialogs/TeamMemberDialog";
import { flatten, getClients, getTeam, teamIndex } from "@/lib/queries";
import { deleteTeamMember, setTeamMemberActive } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const [team, clients] = await Promise.all([getTeam(), getClients()]);
  const rows = flatten(clients, teamIndex(team));

  const workload = new Map<string, number>();
  for (const r of rows) {
    if (!r.assigned_to) continue;
    workload.set(r.assigned_to, (workload.get(r.assigned_to) ?? 0) + 1);
  }

  const active = team.filter((m) => m.active);

  return (
    <>
      <PageHeader
        title="Team"
        meta={`${active.length} active · ${team.length} total`}
        actions={<TeamMemberDialog trigger="+ Add member" />}
      />

      <div className="card mb-4 px-4 py-3 text-[13px] text-neutral-600">
        Anyone you add under{" "}
        <strong className="font-medium text-neutral-900">Authentication → Users</strong> in
        Supabase appears here automatically and can be assigned work. Add someone here
        directly if they do the work but never sign in.
      </div>

      <section className="card overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="th">Name</th>
              <th className="th">Email</th>
              <th className="th">Login</th>
              <th className="th">Assigned apps</th>
              <th className="th">Status</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody>
            {team.map((m) => {
              const count = workload.get(m.id) ?? 0;
              return (
                <tr
                  key={m.id}
                  className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/70"
                >
                  <td className="td font-medium text-neutral-900">{m.name}</td>
                  <td className="td text-neutral-600">
                    {m.email || <span className="text-neutral-300">—</span>}
                  </td>
                  <td className="td">
                    {m.user_id ? (
                      <Tag>Supabase Auth</Tag>
                    ) : (
                      <span className="text-[12px] text-neutral-400">No login</span>
                    )}
                  </td>
                  <td className="td">{count}</td>
                  <td className="td">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[12px] font-medium ring-1 ring-inset ${
                        m.active
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                          : "bg-neutral-100 text-neutral-500 ring-neutral-500/20"
                      }`}
                    >
                      {m.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="td">
                    <div className="flex items-center justify-end gap-0.5">
                      <TeamMemberDialog
                        member={m}
                        trigger="Edit"
                        className="btn btn-ghost px-2 py-1"
                      />
                      <DeleteButton
                        label={m.active ? "Deactivate" : "Reactivate"}
                        confirmText={
                          m.active
                            ? `Hide ${m.name} from the assignment dropdowns? Existing assignments are kept.`
                            : `Show ${m.name} in the assignment dropdowns again?`
                        }
                        action={async () => {
                          "use server";
                          return setTeamMemberActive(m.id, !m.active);
                        }}
                        className="btn btn-ghost px-2 py-1"
                      />
                      {count === 0 && !m.user_id && (
                        <DeleteButton
                          label="✕"
                          confirmText={`Delete ${m.name}? They have no assignments.`}
                          action={async () => {
                            "use server";
                            return deleteTeamMember(m.id);
                          }}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {team.length === 0 && (
          <p className="px-4 py-10 text-center text-[13px] text-neutral-400">
            No members yet. Add a Supabase Auth user, or add someone here directly.
          </p>
        )}
      </section>
    </>
  );
}

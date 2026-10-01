import { Tag } from "@/components/PageHeader";
import { DeleteButton } from "@/components/RowActions";
import { TeamMemberDialog } from "@/components/dialogs/TeamMemberDialog";
import { flatten, getClients, getTeam, teamIndex } from "@/lib/queries";
import { deleteTeamMember, setTeamMemberActive } from "@/lib/actions";

export async function TeamSettings() {
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[13px] text-muted-foreground">
          {active.length} active · {team.length} total. Anyone you add under{" "}
          <strong className="font-medium text-foreground">Authentication → Users</strong> in
          Supabase appears here automatically and can be assigned work. Add someone here
          directly if they do the work but never sign in.
        </p>
        <TeamMemberDialog trigger="+ Add member" className="btn btn-primary" />
      </div>

      <section className="card overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
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
                  className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                >
                  <td className="td font-medium text-foreground">{m.name}</td>
                  <td className="td text-foreground/70">
                    {m.email || <span className="text-muted-foreground/50">—</span>}
                  </td>
                  <td className="td">
                    {m.user_id ? (
                      <Tag>Supabase Auth</Tag>
                    ) : (
                      <span className="text-[12px] text-muted-foreground/80">No login</span>
                    )}
                  </td>
                  <td className="td">{count}</td>
                  <td className="td">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[12px] font-medium ring-1 ring-inset ${
                        m.active
                          ? "bg-good-soft text-good ring-good/30"
                          : "bg-muted text-muted-foreground ring-border"
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
          <p className="px-4 py-10 text-center text-[13px] text-muted-foreground/80">
            No members yet. Add a Supabase Auth user, or add someone here directly.
          </p>
        )}
      </section>
    </>
  );
}

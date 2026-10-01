export function SetupNotice() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-xl font-semibold text-foreground">Connect Supabase to continue</h1>
      <p className="mt-2 text-[14px] text-foreground/70">
        The tracker needs a Supabase project before it can store anything.
      </p>
      <ol className="mt-6 space-y-3 text-[13px] text-foreground/85">
        <li>
          <strong className="font-semibold">1.</strong> Create a project at{" "}
          <a
            className="underline"
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noreferrer"
          >
            supabase.com/dashboard
          </a>
          .
        </li>
        <li>
          <strong className="font-semibold">2.</strong> Run{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono">
            supabase/schema.sql
          </code>{" "}
          then{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono">
            supabase/seed.sql
          </code>{" "}
          in the SQL editor.
        </li>
        <li>
          <strong className="font-semibold">3.</strong> Copy{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono">.env.example</code> to{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono">.env.local</code> and
          paste in your project URL and anon key.
        </li>
        <li>
          <strong className="font-semibold">4.</strong> Add a team member under
          Authentication → Users, then restart{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono">npm run dev</code>.
        </li>
      </ol>
    </div>
  );
}

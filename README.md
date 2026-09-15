# Publish Tracker

Tracks Play Store / App Store publication for client Flutter apps.
Next.js 15 + Supabase (Postgres).

## The model

Clients are published in rounds. Each round is a **release** with its own
version, its own dates, and the person who ran it:

```
client                       one support ticket
  ├── publisher_account      the store accounts they own — stable across rounds
  └── release                one publication round: version, assigned_to, dates
        └── app              what was submitted, and to which account

team_member                  who work is assigned to
```

So a client's history reads as v1.0.0 → v1.1.0 → v2.0.0, and you can see who
did each one. Store accounts hang off the client, not the release, because the
Play Store account does not change between rounds.

Every status change is written to `app_events`, which powers the activity feed
and the "sitting in review for 12 days" flags.

## Setup

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. SQL editor → run `supabase/schema.sql`.
   **It drops and recreates every table**, so it wipes existing data.
   Already have data? Run the files in `supabase/migrations/` instead — they
   are incremental and preserve what is there.
3. `cp .env.example .env.local` and paste in **Project URL** and **anon public**
   key from Settings → API.
4. Authentication → Users → add each teammate. No self-signup; RLS gives any
   signed-in user full read/write.
5. `npm install && npm run dev` → http://localhost:3000

`supabase/seed.sql` is optional and not needed for a fresh start — it only
exists so the old follow-up sheet is recoverable, restated as one release per
client.

## Who work is assigned to

`team_member` rows are the assignment dropdown. The table stays in sync with
Supabase Auth — a trigger on `auth.users` adds a member whenever you create a
login under Authentication → Users, and existing users are backfilled when you
run the schema. You can also add a member with no login on `/team`, for someone
who does the work but never signs in.

Assignment exists at two levels, because they diverge: `release.assigned_to` is
who owns the round, `app.assigned_to` is who handled that one submission.

Members are referenced by assignments, so **deactivate** rather than delete —
it hides them from the dropdowns without rewriting history. Delete is only
offered for a member with no assignments and no login.

## Pages

| Route | What it does |
| --- | --- |
| `/` | Open releases oldest-first, pipeline breakdown, what needs attention, activity |
| `/releases/[id]` | **The main view.** One release: summary strip, apps grouped by store account, activity |
| `/clients` | All clients with their latest release |
| `/clients/[id]` | Store accounts + full release history; where you create a release |
| `/apps` | Every app across every client, filterable, grouped by release, CSV export |
| `/team` | The assignment roster; synced from Supabase Auth |
| `/import` | Paste rows in; export a snapshot out |

The sidebar is contextual: it lists clients at the top level, and switches to
that client's releases once you are inside one.

## Creating a release

`+ New release` on the client page (or in the release rail). It suggests the
next version from what the client already shipped, and **Start from** copies
the app list off a previous release with every status reset to Ongoing —
which is the normal case, since the same three or four apps ship each round.

## Statuses

`Ongoing → In Review → Production`, plus `Closed Testing` (Play), `Rejected`,
and `On Hold`. Anything not in Production that has not moved in
`STALE_AFTER_DAYS` (7, in `src/lib/constants.ts`) is flagged stale.

A release's own state is derived, never stored: anything rejected or on hold
makes it *Needs attention*; all-Production makes it *Complete*. `released_on`
is stamped by a trigger when the last app goes live.

## Deploying

Vercel: import the repo, set the two `NEXT_PUBLIC_SUPABASE_*` env vars, deploy.
The anon key is safe to expose — RLS requires an authenticated user.

## Working on it

Do not run `next build` while `next dev` is running: they share `.next` and the
build strips the dev server's CSS. Use `npx tsc --noEmit` to typecheck instead.

"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  Building2Icon,
  CheckIcon,
  KeyRoundIcon,
  MailPlusIcon,
  EyeIcon,
  EyeOffIcon,
  PartyPopperIcon,
} from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { Spinner } from "@/components/Spinner";
import { StoreIcon } from "@/components/StoreIcon";
import { ProjectLogo } from "@/components/ProjectLogo";
import { submitIntake } from "@/lib/actions";
import { APP_STORE_LIMITS, PLAY_LIMITS, displayName } from "@/lib/constants";
import type { Intake, IntakeAccount, IntakeApp } from "@/lib/types";

type Values = Record<string, string>;

/** The address clients invite to their store accounts. */
const TEAM_EMAIL = "frontend.6amtech@gmail.com";

/** One app as the client thinks of it — its Play and/or App Store listing. */
type Group = {
  key: string;
  title: string;
  project: string;
  line: string | null;
  logo: string | null;
  indexes: number[];
  play?: number;
  ios?: number;
  hasPassword: boolean;
};

const text = (v: string | null | undefined) => (v ?? "").trim();

function groupApps(apps: IntakeApp[]): Group[] {
  const groups = new Map<string, Group>();
  apps.forEach((a, i) => {
    const g = groups.get(a.project_name) ?? {
      key: a.project_name,
      title: "",
      project: a.project_name,
      line: a.line,
      logo: a.logo,
      indexes: [],
      hasPassword: false,
    };
    g.indexes.push(i);
    if (a.platform === "play_store" && g.play === undefined) g.play = i;
    if (a.platform === "app_store" && g.ios === undefined) g.ios = i;
    g.hasPassword ||= a.has_demo_password;
    groups.set(a.project_name, g);
  });
  for (const g of groups.values()) {
    g.title =
      g.indexes.map((i) => apps[i].app_name).find(Boolean) ||
      displayName(g.project.replace(/[-_]+/g, " "));
  }
  return [...groups.values()];
}

const storesOf = (g: Group) =>
  g.play !== undefined && g.ios !== undefined
    ? "Play & App Store"
    : g.play !== undefined
      ? "Google Play"
      : "App Store";

/**
 * The form a client fills in through their private link — only what we
 * can't know ourselves: how users reach them, their policy pages, and per app
 * its name, description and a login the store reviewers can use. One tab for
 * the business, one per app.
 */
export function IntakeForm({ token, form }: { token: string; form: Intake }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(form.submitted_at);
  const [dirty, setDirty] = useState(false);
  const [done, setDone] = useState(false);

  const groups = groupApps(form.apps);
  const hasPlay = groups.some((g) => g.play !== undefined);
  const hasIos = groups.some((g) => g.ios !== undefined);
  const c = form.client;

  const [biz, setBiz] = useState<Values>({
    email: text(c.play_contact_email) || text(c.review_contact_email),
    phone: text(c.play_contact_phone) || text(c.review_contact_phone),
    website: text(c.play_website),
    privacy: text(c.play_privacy_url),
    deleteAccount: text(c.play_delete_account_url),
    support: text(c.store_support_url),
    contact: [text(c.review_contact_first_name), text(c.review_contact_last_name)]
      .filter(Boolean)
      .join(" "),
  });
  // Per app; each value is the first one either store already has.
  const [apps, setApps] = useState<Values[]>(() =>
    groups.map((g) => {
      const first = (k: keyof IntakeApp) =>
        g.indexes.map((i) => text(form.apps[i][k] as string | null)).find(Boolean) ?? "";
      return {
        name: first("app_name"),
        short: g.play !== undefined ? text(form.apps[g.play].short_description) : "",
        description: first("long_description"),
        login: first("demo_login"),
        password: "",
        notes: first("demo_details"),
      };
    }),
  );

  // The client's store accounts — name, type and how we get in.
  const [accounts, setAccounts] = useState<Values[]>(() =>
    form.accounts.map((a) => ({
      name: text(a.account_name),
      type: a.account_type,
      method: a.access_method ?? "",
      email: a.access_method === "login" ? text(a.access_email) : "",
      password: "",
    })),
  );
  const setAcc = (i: number, k: string) => (v: string) => {
    setAccounts((list) =>
      list.map((a, j) => {
        if (j !== i) return a;
        const next = { ...a, [k]: v };
        // A personal Apple account can't add team members, so it has to be the login.
        if (form.accounts[i].platform === "app_store" && next.type === "personal" && next.method === "invite") {
          next.method = "login";
        }
        return next;
      }),
    );
    setDirty(true);
  };

  // Don't let a closed tab lose typed answers.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const setB = (k: string) => (v: string) => {
    setBiz((b) => ({ ...b, [k]: v }));
    setDirty(true);
  };
  const setA = (i: number, k: string) => (v: string) => {
    setApps((list) => list.map((a, j) => (j === i ? { ...a, [k]: v } : a)));
    setDirty(true);
  };

  // ── what each tab still needs ──
  const bizNeeds = [
    biz.email,
    biz.phone,
    biz.privacy,
    ...(hasPlay ? [biz.deleteAccount] : []),
    ...(hasIos ? [biz.support, biz.contact] : []),
  ];
  const appNeeds = (g: Group, i: number) => [
    apps[i].name,
    ...(g.play !== undefined ? [apps[i].short] : []),
    apps[i].description,
    apps[i].login,
    g.hasPassword || apps[i].password ? "set" : "",
  ];
  const accountNeeds = accounts.flatMap((a, i) => [
    a.name,
    a.method,
    ...(a.method === "login"
      ? [a.email, form.accounts[i].has_login_password || a.password ? "set" : ""]
      : []),
  ]);
  const tabs = [
    { key: "business", title: "Your business", sub: "Contact & policies", needs: bizNeeds },
    ...(form.accounts.length
      ? [{ key: "accounts", title: "Store accounts", sub: "Name & access", needs: accountNeeds }]
      : []),
    ...groups.map((g, i) => ({ key: g.key, title: g.title, sub: storesOf(g), needs: appNeeds(g, i), group: g })),
  ];
  const count = (needs: string[]) => needs.filter((v) => v.trim()).length;
  const filled = tabs.reduce((n, t) => n + count(t.needs), 0);
  const total = tabs.reduce((n, t) => n + t.needs.length, 0);

  const [tab, setTab] = useState(0);
  const current = tabs[tab];
  const last = tab === tabs.length - 1;

  function save(then?: () => void) {
    if (!dirty) return then?.();
    setError(null);
    const [first, ...rest] = biz.contact.trim().split(/\s+/);
    const client: Values = {
      play_contact_email: biz.email,
      play_contact_phone: biz.phone,
      play_website: biz.website,
      play_privacy_url: biz.privacy,
      ...(hasPlay ? { play_delete_account_url: biz.deleteAccount } : {}),
      ...(hasIos
        ? {
            store_support_url: biz.support,
            // Apple's reviewers reach the same person by the same email and phone.
            review_contact_first_name: first ?? "",
            review_contact_last_name: rest.join(" "),
            review_contact_email: biz.email,
            review_contact_phone: biz.phone,
          }
        : {}),
    };
    const rows = groups.flatMap((g, i) =>
      g.indexes.map((index) => ({
        id: form.apps[index].id,
        app_name: apps[i].name,
        long_description: apps[i].description,
        demo_login: apps[i].login,
        demo_password: apps[i].password,
        demo_details: apps[i].notes,
        ...(index === g.play ? { short_description: apps[i].short } : {}),
      })),
    );

    start(async () => {
      const res = await submitIntake(
        token,
        client,
        rows,
        accounts.map((a, i) => ({
          id: form.accounts[i].id,
          account_name: a.name,
          account_type: a.type,
          access_method: a.method,
          // An invite always goes to the team's address.
          access_email: a.method === "invite" ? TEAM_EMAIL : a.email,
          login_password: a.method === "login" ? a.password : "",
        })),
      );
      if (!res.ok) return setError(res.error);
      setDirty(false);
      setSavedAt(new Date().toISOString());
      setApps((list) => list.map((a) => ({ ...a, password: "" })));
      setAccounts((list) => list.map((a) => ({ ...a, password: "" })));
      router.refresh();
      then?.();
    });
  }

  const go = (to: number) => {
    setError(null);
    setDone(false);
    setTab(to);
  };

  return (
    <div className="tracker-rise overflow-hidden rounded-2xl border bg-card shadow-sm">
      {/* ── header ── */}
      <header className="relative overflow-hidden border-b px-5 py-5 sm:px-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(120% 90% at 0% 0%, color-mix(in oklch, var(--st-production) 14%, transparent), transparent 60%), radial-gradient(90% 80% at 100% 0%, color-mix(in oklch, var(--st-ongoing) 16%, transparent), transparent 60%)",
          }}
        />
        <div className="relative flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {form.name} · Ticket #{form.ticket}
            </p>
            <h1 className="mt-0.5 text-[20px] font-semibold leading-tight tracking-tight sm:text-[22px]">
              Details to publish your apps
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              About 5 minutes. Save as you go — this link stays open.
            </p>
          </div>
          <Ring value={filled} total={total} />
        </div>
      </header>

      <div className="grid md:grid-cols-[260px_minmax(0,1fr)]">
        {/* ── tabs ── */}
        <nav className="min-w-0 border-b bg-muted/30 p-2.5 md:border-b-0 md:border-r md:p-3">
          <ul className="flex gap-1.5 overflow-x-auto md:flex-col md:overflow-visible">
            {tabs.map((t, i) => {
              const n = count(t.needs);
              const complete = n === t.needs.length;
              const on = i === tab && !done;
              return (
                <li key={t.key} className="shrink-0 md:shrink">
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-current={on ? "page" : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-all ${
                      on
                        ? "bg-card shadow-sm ring-1 ring-border"
                        : "hover:bg-card/60"
                    }`}
                  >
                    {"group" in t && t.group ? (
                      <ProjectLogo
                        badge={t.group.line ? { line: t.group.line, logo: t.group.logo } : null}
                        project={t.group.project}
                      />
                    ) : (
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-info-soft text-info">
                        {t.key === "accounts" ? (
                          <KeyRoundIcon className="size-3.5" />
                        ) : (
                          <Building2Icon className="size-3.5" />
                        )}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[13px] ${on ? "font-semibold" : "font-medium"}`}>
                        {t.title}
                      </span>
                      <span className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                        {"group" in t && t.group ? (
                          <>
                            {t.group.play !== undefined && <StoreIcon platform="play_store" size={10} />}
                            {t.group.ios !== undefined && <StoreIcon platform="app_store" size={10} />}
                          </>
                        ) : null}
                        {t.sub}
                      </span>
                    </span>
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-full text-[9px] font-semibold tabular-nums ${
                        complete
                          ? "bg-[var(--st-production)] text-white"
                          : "text-muted-foreground ring-1 ring-border"
                      }`}
                      title={`${n} of ${t.needs.length} filled`}
                    >
                      {complete ? <CheckIcon className="pub-pop size-3" strokeWidth={3} /> : t.needs.length - n}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 hidden px-2.5 text-[11px] text-muted-foreground md:block">
            {dirty
              ? "Unsaved changes"
              : savedAt
                ? `Saved ${new Date(savedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
                : "Nothing saved yet"}
          </p>
        </nav>

        {/* ── the open tab ── */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(() => (last ? setDone(true) : go(tab + 1)));
          }}
          className="flex min-w-0 flex-col"
        >
          {done ? (
            <div className="tracker-rise flex flex-1 flex-col items-center justify-center px-6 py-14 text-center">
              <span className="grid size-14 place-items-center rounded-full bg-good-soft text-good">
                <PartyPopperIcon className="size-7" />
              </span>
              <h2 className="mt-4 text-[18px] font-semibold">Thank you!</h2>
              <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
                {filled === total
                  ? "We have everything we need. We'll take it from here."
                  : `Saved. ${total - filled} detail${total - filled === 1 ? " is" : "s are"} still missing — come back to this link any time.`}
              </p>
              <button type="button" className="btn btn-secondary mt-5" onClick={() => go(0)}>
                Review my answers
              </button>
            </div>
          ) : (
            <>
              <div key={current.key} className="tracker-rise flex-1 px-5 py-5 sm:px-7 sm:py-6">
                <h2 className="text-[16px] font-semibold tracking-tight">{current.title}</h2>
                <p className="mb-5 text-[13px] text-muted-foreground">
                  {current.key === "business"
                    ? "How your users can reach you, and your policy pages."
                    : current.key === "accounts"
                      ? "The store accounts your apps are published under, and how we can get in."
                      : "As it should appear on the store, and a login for the reviewers."}
                </p>

                {current.key === "accounts" ? (
                  <div className="space-y-4">
                    {form.accounts.map((acc, i) => (
                      <AccountCard
                        key={acc.id}
                        account={acc}
                        values={accounts[i]}
                        set={(k) => setAcc(i, k)}
                      />
                    ))}
                  </div>
                ) : current.key === "business" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Support email" type="email" value={biz.email} onChange={setB("email")} placeholder="support@yourcompany.com" />
                    <Input label="Support phone" type="tel" value={biz.phone} onChange={setB("phone")} placeholder="+1 555 010 0199" />
                    <Input label="Website" optional type="url" value={biz.website} onChange={setB("website")} placeholder="https://yourcompany.com" wide />
                    <Input
                      label="Privacy policy link"
                      type="url"
                      value={biz.privacy}
                      onChange={setB("privacy")}
                      placeholder="https://yourcompany.com/privacy-policy"
                      wide
                    />
                    {hasPlay && (
                      <Input
                        label="Delete account link"
                        hint="A page where users can ask to delete their account."
                        type="url"
                        value={biz.deleteAccount}
                        onChange={setB("deleteAccount")}
                        placeholder="https://yourcompany.com/delete-account"
                        wide
                      />
                    )}
                    {hasIos && (
                      <>
                        <Input
                          label="Support page link"
                          type="url"
                          value={biz.support}
                          onChange={setB("support")}
                          placeholder="https://yourcompany.com/support"
                          wide
                        />
                        <Input
                          label="Contact person"
                          hint="Who Apple can reach during review, at the email and phone above."
                          value={biz.contact}
                          onChange={setB("contact")}
                          placeholder="John Doe"
                          wide
                        />
                      </>
                    )}
                  </div>
                ) : (
                  (() => {
                    const i = groups.findIndex((x) => x.key === current.key);
                    const g = groups[i];
                    const a = apps[i];
                    return (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="App name" value={a.name} onChange={setA(i, "name")} max={Math.min(APP_STORE_LIMITS.appName, PLAY_LIMITS.appName)} wide />
                        {g.play !== undefined && (
                          <Input
                            label="Short description"
                            hint="One line about the app."
                            value={a.short}
                            onChange={setA(i, "short")}
                            max={PLAY_LIMITS.shortDescription}
                            wide
                          />
                        )}
                        <TextArea
                          label="Description"
                          hint="What the app does, as it should appear on the store."
                          value={a.description}
                          onChange={setA(i, "description")}
                          max={PLAY_LIMITS.longDescription}
                        />

                        <div className="rounded-xl border bg-muted/30 p-4 sm:col-span-2">
                          <p className="text-[13px] font-semibold">Test account</p>
                          <p className="mb-3 text-[12px] text-muted-foreground">
                            The store reviewers sign in with this to test the app. Only our team sees it.
                          </p>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Input label="Email or phone" value={a.login} onChange={setA(i, "login")} autoComplete="off" />
                            <Password value={a.password} onChange={setA(i, "password")} saved={g.hasPassword} />
                            <Input
                              label="Notes for the reviewer"
                              optional
                              value={a.notes}
                              onChange={setA(i, "notes")}
                              placeholder="e.g. Use the OTP 1234"
                              wide
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}

                {error && (
                  <p className="mt-4 rounded-lg bg-bad-soft px-3 py-2.5 text-[13px] text-bad">{error}</p>
                )}
              </div>

              <footer className="flex items-center gap-2 border-t bg-muted/20 px-5 py-3 sm:px-7">
                {tab > 0 && (
                  <button type="button" className="btn btn-ghost" onClick={() => go(tab - 1)}>
                    <ArrowLeftIcon className="size-4" /> Back
                  </button>
                )}
                <span className="ml-auto text-[12px] text-muted-foreground md:hidden">
                  {dirty ? "Unsaved" : ""}
                </span>
                <button
                  type="submit"
                  disabled={pending}
                  className="group inline-flex h-10 items-center gap-2 rounded-xl px-5 text-[14px] font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 md:ml-auto"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--st-production), color-mix(in oklch, var(--st-production) 55%, var(--st-ongoing)))",
                  }}
                >
                  {pending ? <Spinner /> : null}
                  {last ? "Save & finish" : dirty ? "Save & continue" : "Continue"}
                  {!pending && !last && (
                    <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                  )}
                </button>
              </footer>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── pieces ──

/** One store account: its name, type, and how the team gets in. */
function AccountCard({
  account,
  values,
  set,
}: {
  account: IntakeAccount;
  values: Values;
  set: (key: string) => (value: string) => void;
}) {
  const apple = account.platform === "app_store";
  const inviteBlocked = apple && values.type === "personal";
  const usersPage = apple ? "App Store Connect → Users and Access" : "Play Console → Users and permissions";

  return (
    <section className="rounded-xl border p-4">
      <h3 className="mb-4 flex items-center gap-2 text-[14px] font-semibold">
        <StoreIcon platform={account.platform} size={15} />
        {apple ? "Apple Developer account" : "Google Play Console account"}
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Account name"
          hint="The developer name shown on the store."
          value={values.name}
          onChange={set("name")}
          placeholder="Acme Inc."
        />
        <div>
          <span className="label">Account type</span>
          <Segmented
            value={values.type}
            onChange={set("type")}
            options={[
              { value: "organization", label: "Organization" },
              { value: "personal", label: "Personal" },
            ]}
          />
        </div>

        <div className="sm:col-span-2">
          <span className="label">How will we get access?</span>
          <div className="grid gap-2 sm:grid-cols-2">
            <Choice
              on={values.method === "invite"}
              disabled={inviteBlocked}
              onClick={() => set("method")("invite")}
              icon={<MailPlusIcon className="size-4" />}
              title="Invite our team"
              detail={
                inviteBlocked
                  ? "Personal Apple accounts can't add team members — share the login instead."
                  : "Add our team email as an admin — no password needed."
              }
            />
            <Choice
              on={values.method === "login"}
              onClick={() => set("method")("login")}
              icon={<KeyRoundIcon className="size-4" />}
              title="Share the login"
              detail="We sign in with your account. If a verification code is needed, we'll message you."
            />
          </div>
        </div>

        {values.method === "invite" && (
          <div className="rounded-xl border border-dashed bg-muted/30 p-3.5 sm:col-span-2">
            <p className="text-[12px] text-muted-foreground">Invite this email as an admin:</p>
            <p className="mt-1 flex items-center gap-1 text-[14px] font-semibold">
              {TEAM_EMAIL}
              <CopyButton value={TEAM_EMAIL} label="Copy email" />
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">In {usersPage}.</p>
          </div>
        )}
        {values.method === "login" && (
          <>
            <Input
              label="Login email"
              type="email"
              value={values.email}
              onChange={set("email")}
              placeholder="you@yourcompany.com"
              autoComplete="off"
            />
            <Password
              value={values.password}
              onChange={set("password")}
              saved={account.has_login_password}
            />
            <p className="-mt-2 text-[11px] text-muted-foreground sm:col-span-2">
              Only our team sees this, and it's never shown on this page again.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`h-8 rounded-md text-[13px] font-medium transition-all ${
              on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Choice({
  on,
  disabled,
  onClick,
  icon,
  title,
  detail,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-55 ${
        on ? "border-[var(--st-production)]/60 bg-good-soft ring-1 ring-[var(--st-production)]/40" : "hover:border-ring/60"
      }`}
    >
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-lg ${
          on ? "bg-[var(--st-production)] text-white" : "bg-muted text-muted-foreground"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold">{title}</span>
        <span className="block text-[12px] leading-snug text-muted-foreground">{detail}</span>
      </span>
    </button>
  );
}

/** A circular gauge that sweeps up to its value, as in the publish popup. */
function Ring({ value, total, size = 58 }: { value: number; total: number; size?: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setShown(value), 60);
    return () => clearTimeout(t);
  }, [value]);
  const r = size / 2 - 5;
  const circumference = 2 * Math.PI * r;
  const pct = total ? shown / total : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={`${value} of ${total} filled`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="5" className="stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          stroke={value === total ? "var(--st-production)" : "var(--st-in-review)"}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.2, 0.7, 0.2, 1)" }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[12px] font-semibold tabular-nums">
        {total ? Math.round((value / total) * 100) : 0}%
      </span>
    </div>
  );
}

function Field({
  id,
  label,
  optional,
  hint,
  wide,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="label" htmlFor={id}>
        {label}
        {optional && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** "N characters left", once the client has started typing. */
function left(value: string, max: number, hint?: string) {
  return value ? `${max - value.length} characters left` : hint;
}

function Input({
  label,
  optional,
  hint,
  value,
  onChange,
  type = "text",
  placeholder,
  max,
  wide,
  autoComplete,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  max?: number;
  wide?: boolean;
  autoComplete?: string;
}) {
  const id = useId();
  return (
    <Field id={id} label={label} optional={optional} hint={max ? left(value, max, hint) : hint} wide={wide}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={max}
        autoComplete={autoComplete}
        className="field"
      />
    </Field>
  );
}

function TextArea({
  label,
  hint,
  value,
  onChange,
  max,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
}) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={max ? left(value, max, hint) : hint} wide>
      <textarea
        id={id}
        rows={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={max}
        className="field resize-y"
      />
    </Field>
  );
}

function Password({
  value,
  onChange,
  saved,
}: {
  value: string;
  onChange: (value: string) => void;
  saved: boolean;
}) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <Field id={id} label="Password">
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password"
          placeholder={saved ? "Saved — type to change" : ""}
          className="field pr-9"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
        </button>
      </div>
    </Field>
  );
}

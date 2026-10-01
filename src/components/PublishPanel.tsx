"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  Loader2Icon,
  PartyPopperIcon,
  PauseIcon,
  PuzzleIcon,
  RocketIcon,
  ShieldCheckIcon,
  TerminalIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { StoreIcon } from "@/components/StoreIcon";
import { ProjectLogo } from "@/components/ProjectLogo";
import { CopyReportButton } from "@/components/CopyReportButton";
import { ListingDialog } from "@/components/dialogs/ListingDialog";
import { ClientPlayDialog } from "@/components/dialogs/ClientPlayDialog";
import {
  usePublisherBridge,
  type PublisherState,
  type PublisherStep,
} from "@/lib/publisherBridge";
import { publishChecks, publishData, type PublishCheck } from "@/lib/publish";
import type { Client, LineBadge, Product } from "@/lib/types";

/**
 * Hands a Play Store app to the "Play Console Publisher" extension: it opens
 * Play Console in a new tab and fills the 13 setup sections, while this panel
 * shows its progress. Uploading the build and submitting stay manual.
 */
export function PublishPanel({
  client,
  product,
  accountName,
  badge,
}: {
  client: Client;
  product: Product;
  /** The Play developer account this app must be created under. */
  accountName: string;
  /** The app's product-line logo, for the header. */
  badge?: LineBadge;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost h-7 gap-1 px-2 text-[12px]"
        onClick={() => setOpen(true)}
        title="Fill Play Console for this app"
      >
        <RocketIcon className="size-3.5" />
        Publish
      </button>
      {open && (
        // A wide popup rather than a side drawer: details on the left, the
        // 13-step timeline on the right.
        <Dialog open onOpenChange={(next) => !next && setOpen(false)}>
          <DialogContent
            data-modal
            className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-[min(1240px,calc(100vw-2rem))]"
          >
            <DialogTitle className="sr-only">
              Publish {product.app_name || product.project_name}
            </DialogTitle>
            <DialogDescription className="sr-only">Fill Play Console for this app</DialogDescription>
            <PanelBody
              client={client}
              product={product}
              accountName={accountName}
              badge={badge}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────── body ──

function PanelBody({
  client,
  product,
  accountName,
  badge,
}: {
  client: Client;
  product: Product;
  accountName: string;
  badge?: LineBadge;
}) {
  const bridge = usePublisherBridge();
  const [confirmed, setConfirmed] = useState(false);
  const [launching, setLaunching] = useState(false);

  const data = publishData(client, product);
  const checks = publishChecks(data);
  const blocking = checks.filter((c) => c.required && !c.ok);

  const run = bridge.state;
  const active = !!run && ["starting", "running", "paused"].includes(run.phase);
  const ours = !!run && run.phase !== "idle" && run.jobId === product.id;
  const someoneElse = active && !ours;

  // Check → Confirm → Launch (4 = launched and every section filled)
  const finishedClean =
    ours && run?.phase === "done" && run.steps.every((st) => st.status === "done");
  const stage = finishedClean ? 4 : ours ? 3 : confirmed && blocking.length === 0 ? 2 : 1;

  async function start() {
    setLaunching(true);
    const res = await bridge.start({
      jobId: product.id,
      appData: data,
      expectedAccount: accountName,
    });
    if (!res.ok) {
      setLaunching(false);
      toast.error(res.error ?? "Couldn't start the run.");
    } else {
      toast.success("Play Console is opening in a new tab");
      setTimeout(() => setLaunching(false), 800);
    }
  }

  const canStart =
    !!bridge.installed && !bridge.stale && blocking.length === 0 && confirmed && !someoneElse;

  return (
    <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
      <Hero product={product} badge={badge} stage={stage} />

      <div className="grid min-h-0 flex-1 md:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px]">
        <div className="min-h-0 space-y-4 overflow-y-auto p-5">
          <ExtensionStatus
            installed={bridge.installed}
            stale={bridge.stale}
            version={bridge.version}
          />

          {ours && run ? (
            <RunSummary
              run={run}
              onContinue={() => bridge.send("CONTINUE")}
              onStop={() => bridge.send("STOP")}
              onReset={() => bridge.send("RESET")}
            />
          ) : (
            <>
              {/* On wide screens: the checklist beside the account, switch and launch. */}
              <div className="grid items-start gap-4 xl:grid-cols-2">
                <Readiness checks={checks} client={client} product={product} />
                <div className="space-y-4">
                  <AccountCard accountName={accountName} />

                  <Toggle
                    checked={confirmed}
                    onChange={setConfirmed}
                    title="Package name verified"
                    detail={
                      <>
                        <span className="font-mono">{data.packageName || "—"}</span> matches
                        applicationId in build.gradle. It can&apos;t change after publishing.
                      </>
                    }
                  />

                  {someoneElse && (
                    <p className="tracker-rise rounded-xl bg-muted px-3.5 py-2.5 text-[12px] text-muted-foreground">
                      Another app is publishing right now ({run?.appData?.appName}). Wait for it to
                      finish, or stop it first.
                    </p>
                  )}

                  <LaunchButton
                    disabled={!canStart || launching}
                    launching={launching}
                    onClick={start}
                  />
                  <p className="text-center text-[12px] text-muted-foreground">
                    {blocking.length > 0
                      ? `Add the ${blocking.map((b) => b.label.toLowerCase()).join(" and ")} to continue.`
                      : !confirmed
                        ? "Confirm the package name to continue."
                        : "Play Console opens in a new tab and fills 13 sections."}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <aside className="min-h-0 overflow-y-auto border-t bg-muted/30 p-5 md:border-l md:border-t-0">
          <Timeline steps={ours && run ? run.steps : PREVIEW_STEPS} live={!!ours} />
        </aside>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── hero ──

const STAGES = ["Check", "Confirm", "Launch"];

function Hero({
  product,
  badge,
  stage,
}: {
  product: Product;
  badge?: LineBadge;
  stage: number;
}) {
  return (
    <header className="relative overflow-hidden border-b px-5 pb-4 pt-5">
      {/* a soft brand wash behind the header */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(120% 90% at 0% 0%, color-mix(in oklch, var(--st-production) 14%, transparent), transparent 60%), radial-gradient(90% 80% at 100% 0%, color-mix(in oklch, var(--st-ongoing) 16%, transparent), transparent 60%)",
        }}
      />
      <div className="relative flex items-center gap-3.5 pr-8">
        <div className="relative">
          <ProjectLogo badge={badge} project={product.project_name} size="lg" />
          <span className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full border bg-card shadow-xs">
            <StoreIcon platform="play_store" size={11} />
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Publish to Play Store
          </p>
          <h2 className="truncate text-[18px] font-semibold leading-tight">
            {product.app_name || product.project_name}
          </h2>
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {product.package_name || "no package name yet"}
          </p>
        </div>
      </div>

      <ol className="relative mt-4 flex items-center">
        {STAGES.map((label, i) => {
          const n = i + 1;
          const done = stage > n;
          const current = stage === n;
          return (
            <li key={label} className="flex flex-1 items-center last:flex-none">
              <span className="flex items-center gap-1.5">
                <span
                  className={`grid size-5 place-items-center rounded-full text-[10px] font-semibold transition-colors ${
                    done
                      ? "bg-[var(--st-production)] text-white"
                      : current
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <CheckIcon className="pub-pop size-3" strokeWidth={3} /> : n}
                </span>
                <span
                  className={`text-[12px] font-medium ${
                    current || done ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </span>
              {n < STAGES.length && (
                <span className="relative mx-2 h-0.5 flex-1 overflow-hidden rounded-full bg-border">
                  <span
                    className="absolute inset-y-0 left-0 bg-[var(--st-production)] transition-[width] duration-500"
                    style={{ width: done ? "100%" : "0%" }}
                  />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </header>
  );
}

// ────────────────────────────────────────────────────────── readiness ──

function Readiness({
  checks,
  client,
  product,
}: {
  checks: PublishCheck[];
  client: Client;
  product: Product;
}) {
  const ready = checks.filter((c) => c.ok).length;
  const complete = ready === checks.length;
  const [open, setOpen] = useState(true);

  return (
    <section className="tracker-rise rounded-2xl border bg-card p-4 shadow-xs">
      <div className="flex items-center gap-4">
        <Ring value={ready} total={checks.length} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold">
            {complete
              ? "Everything's ready"
              : `${checks.length - ready} detail${checks.length - ready === 1 ? "" : "s"} missing`}
          </h3>
          <p className="text-[12px] text-muted-foreground">
            {complete
              ? "All the details Play Console asks for are filled."
              : "Missing ones are left for you to fill by hand — or add them now."}
          </p>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-foreground/80 hover:text-foreground"
          >
            {open ? "Hide details" : "Show details"}
            <ChevronDownIcon
              className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {open && (
        <>
          <ul className="mt-4 grid grid-cols-2 gap-1.5">
            {checks.map((c, i) => (
              <li
                key={c.label}
                className={`tracker-rise flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[12px] ${
                  c.ok
                    ? "border-transparent bg-muted/50"
                    : c.required
                      ? "border-bad/40 bg-bad-soft"
                      : "border-dashed"
                }`}
                style={{ animationDelay: `${i * 35}ms` }}
              >
                <span
                  className={`grid size-4 shrink-0 place-items-center rounded-full ${
                    c.ok
                      ? "bg-[var(--st-production)] text-white"
                      : c.required
                        ? "bg-[var(--st-rejected)] text-white"
                        : "border border-muted-foreground/40"
                  }`}
                >
                  {c.ok ? (
                    <CheckIcon
                      className="pub-pop size-2.5"
                      strokeWidth={3.5}
                      style={{ animationDelay: `${150 + i * 35}ms` }}
                    />
                  ) : c.required ? (
                    <XIcon className="size-2.5" strokeWidth={3.5} />
                  ) : null}
                </span>
                <span className={`truncate ${c.ok ? "" : "font-medium"}`}>{c.label}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <ListingDialog
              product={product}
              trigger="Edit app listing"
              className="btn btn-secondary h-8 text-[12px]"
            />
            <ClientPlayDialog
              client={client}
              trigger="Edit client Play details"
              className="btn btn-secondary h-8 text-[12px]"
            />
          </div>
        </>
      )}
    </section>
  );
}

/** A circular gauge that sweeps up to its value when it appears. */
function Ring({ value, total, size = 56 }: { value: number; total: number; size?: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setShown(value), 60);
    return () => clearTimeout(t);
  }, [value]);

  const r = size / 2 - 5;
  const circumference = 2 * Math.PI * r;
  const pct = total ? shown / total : 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
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
      <span className="absolute inset-0 grid place-items-center text-[13px] font-semibold tabular-nums">
        {value}/{total}
      </span>
    </div>
  );
}

// ──────────────────────────────────────────────── account and toggle ──

function AccountCard({ accountName }: { accountName: string }) {
  return (
    <section
      className="tracker-rise flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-xs"
      style={{ animationDelay: "80ms" }}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-info-soft text-info">
        <ShieldCheckIcon className="size-4" />
      </span>
      <div className="min-w-0 text-[12px] leading-relaxed">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Developer account
        </p>
        <p className="truncate text-[14px] font-semibold text-foreground">
          {accountName || "Not set"}
        </p>
        <p className="text-muted-foreground">
          Picked by name the first time, then remembered. A wrong account wastes the package name
          for good.
        </p>
      </div>
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  title,
  detail,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  detail: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`tracker-rise flex w-full items-start gap-3 rounded-2xl border p-4 text-left shadow-xs transition-colors ${
        checked ? "border-[var(--st-production)]/50 bg-good-soft" : "bg-card hover:border-ring/60"
      }`}
      style={{ animationDelay: "140ms" }}
    >
      <span
        className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-[var(--st-production)]" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </span>
      <span className="min-w-0 text-[12px] leading-relaxed">
        <span className="block text-[13px] font-semibold text-foreground">{title}</span>
        <span className="text-muted-foreground">{detail}</span>
      </span>
    </button>
  );
}

function LaunchButton({
  disabled,
  launching,
  onClick,
}: {
  disabled: boolean;
  launching: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-[15px] font-semibold text-white shadow-md transition-all disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none ${
        disabled ? "" : "pub-shine hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
      }`}
      style={{
        background:
          "linear-gradient(135deg, var(--st-production), color-mix(in oklch, var(--st-production) 55%, var(--st-ongoing)))",
      }}
    >
      <RocketIcon
        className={`size-5 transition-transform ${
          launching ? "pub-launch" : "group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        }`}
      />
      {launching ? "Launching…" : "Open Play Console and start"}
    </button>
  );
}

// ─────────────────────────────────────────────────────────── progress ──

function RunSummary({
  run,
  onContinue,
  onStop,
  onReset,
}: {
  run: PublisherState;
  onContinue: () => void;
  onStop: () => void;
  onReset: () => void;
}) {
  const { phase, steps, pauseMessage, logs } = run;
  const done = steps.filter((s) => s.status === "done").length;
  const failed = steps.filter((s) => s.status === "failed").length;
  const finished = phase === "done";
  const allGood = finished && failed === 0 && done === steps.length;
  // Open by default: in the wide popup there's room to watch it work.
  const [showLog, setShowLog] = useState(true);

  // Time since the run started (its first log line), ticking while it runs.
  const startedAt = logs[0]?.at;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (finished) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [finished]);
  const endAt = finished ? (logs.at(-1)?.at ?? now) : now;
  const elapsed = startedAt ? Math.max(0, Math.round((endAt - startedAt) / 1000)) : 0;

  return (
    <section className="space-y-4">
      <div className="tracker-rise relative overflow-hidden rounded-2xl border bg-card p-4 shadow-xs">
        {allGood && <Confetti />}
        <div className="flex items-center gap-4">
          <Ring value={done} total={steps.length} size={64} />
          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold">
              {allGood ? (
                <>
                  <PartyPopperIcon className="size-4 text-good" /> All {steps.length} sections
                  filled
                </>
              ) : finished ? (
                `Finished — ${failed} need${failed === 1 ? "s" : ""} you`
              ) : phase === "paused" ? (
                "Waiting for you"
              ) : phase === "starting" ? (
                "Opening Play Console…"
              ) : (
                "Filling Play Console…"
              )}
            </h3>
            <p className="text-[12px] tabular-nums text-muted-foreground">
              {done} done{failed ? ` · ${failed} failed` : ""} · {formatElapsed(elapsed)}
            </p>
          </div>
          {!finished && (
            <button type="button" className="btn btn-ghost h-8 text-bad" onClick={onStop}>
              Stop
            </button>
          )}
        </div>
      </div>

      {phase === "paused" && (
        <div className="pub-attention tracker-rise rounded-2xl border border-warn/50 bg-warn-soft p-4">
          <p className="flex items-center gap-2 text-[13px] font-semibold">
            <PauseIcon className="size-4 text-warn" /> {pauseMessage || "The run is paused."}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Sort it out in the Play Console tab, then continue.
          </p>
          <button type="button" className="btn btn-primary mt-3 h-8" onClick={onContinue}>
            Continue
          </button>
        </div>
      )}

      {logs.length > 0 && (
        <div className="rounded-2xl border bg-card">
          <div className="flex items-center justify-between px-3.5 py-2">
            <button
              type="button"
              onClick={() => setShowLog((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-foreground/80 hover:text-foreground"
            >
              <TerminalIcon className="size-3.5" /> Activity log
              <ChevronDownIcon
                className={`size-3.5 transition-transform ${showLog ? "rotate-180" : ""}`}
              />
            </button>
            <CopyReportButton
              report={logs.map((l) => l.msg).join("\n")}
              label="Copy log"
              className="btn btn-ghost h-7 px-2 text-[12px]"
            />
          </div>
          {showLog && (
            <pre className="max-h-[min(420px,45dvh)] overflow-y-auto whitespace-pre-wrap border-t bg-[oklch(0.2_0.006_260)] p-3.5 font-mono text-[11px] leading-relaxed text-[oklch(0.85_0.02_150)]">
              {logs
                .slice(-40)
                .map((l) => l.msg)
                .join("\n")}
            </pre>
          )}
        </div>
      )}

      {finished && (
        <div className="tracker-rise space-y-2">
          <div className="flex flex-wrap gap-2">
            <a
              href="https://play.google.com/console"
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary h-9"
            >
              Open Play Console <ExternalLinkIcon className="size-3.5" />
            </a>
            <button type="button" className="btn btn-ghost h-9" onClick={onReset}>
              Clear run
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Next, by hand: review every section, upload the AAB under Release → Production (or
            Internal testing first), add release notes, and submit for review.
          </p>
        </div>
      )}
    </section>
  );
}

// What the extension fills, in order — shown before a run as a preview. It
// mirrors the extension's own step list.
const PREVIEW_STEPS: PublisherStep[] = [
  "Create app",
  "Privacy policy",
  "Sign in details",
  "Ads",
  "Content rating",
  "Target audience",
  "Data safety",
  "Government apps",
  "Financial features",
  "Health",
  "Store settings",
  "Store listings",
  "Advertising ID",
].map((name) => ({ name, status: "pending" as const }));

/** The sections as a vertical timeline: a preview before the run, live during it. */
function Timeline({ steps, live }: { steps: PublisherStep[]; live: boolean }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-[13px] font-semibold">
          {live ? "Progress" : `What gets filled · ${steps.length} sections`}
        </h3>
        {!live && (
          <span className="text-[11px] text-muted-foreground">in this order</span>
        )}
      </div>
      <ol className="relative">
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          const settled = s.status === "done" || s.status === "failed";
          return (
            <li key={s.name} className="relative flex gap-3 pb-3 last:pb-0">
              {!last && (
                <span
                  aria-hidden
                  className="absolute left-[11px] top-6 h-[calc(100%-12px)] w-0.5 overflow-hidden rounded-full bg-border"
                >
                  <span
                    className="absolute inset-x-0 top-0 bg-[var(--st-production)] transition-[height] duration-500"
                    style={{ height: settled ? "100%" : "0%" }}
                  />
                </span>
              )}
              <span className="relative z-10 grid size-6 shrink-0 place-items-center">
                {s.status === "done" ? (
                  <span className="pub-pop grid size-6 place-items-center rounded-full bg-[var(--st-production)] text-white">
                    <CheckIcon className="size-3.5" strokeWidth={3} />
                  </span>
                ) : s.status === "failed" ? (
                  <span className="pub-pop grid size-6 place-items-center rounded-full bg-[var(--st-rejected)] text-white">
                    <XIcon className="size-3.5" strokeWidth={3} />
                  </span>
                ) : s.status === "running" ? (
                  <span className="grid size-6 place-items-center rounded-full border-2 border-foreground/15 bg-card">
                    <Loader2Icon className="size-4 animate-spin" />
                  </span>
                ) : (
                  <span className="grid size-6 place-items-center rounded-full border-2 bg-card text-[10px] font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                )}
              </span>
              <div
                className={`min-w-0 flex-1 rounded-xl px-3 py-1.5 transition-colors ${
                  s.status === "running" ? "bg-muted" : ""
                }`}
              >
                <p
                  className={`text-[13px] ${
                    s.status === "pending" ? "text-muted-foreground" : "font-medium"
                  }`}
                >
                  {s.name}
                </p>
                {s.status === "running" && (
                  <p className="text-[11px] text-muted-foreground">Working on it…</p>
                )}
                {s.error && (
                  <p className="tracker-rise mt-0.5 text-[11px] leading-snug text-bad">{s.error}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {!live && (
        <p className="mt-4 rounded-xl border border-dashed bg-card px-3.5 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
          Advertising ID is answered &quot;No&quot;. Uploading the AAB, release notes and
          submitting for review stay with you — review everything before you submit.
        </p>
      )}
    </section>
  );
}

/** A short burst of confetti from the headline card when every step passed. */
function Confetti() {
  const colors = [
    "var(--st-production)",
    "var(--st-ongoing)",
    "var(--st-in-review)",
    "var(--st-on-hold)",
    "var(--st-closed-testing)",
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: 26 }, (_, i) => {
        const angle = (i / 26) * Math.PI * 2;
        const distance = 70 + (i % 5) * 18;
        return (
          <span
            key={i}
            className="pub-confetti absolute left-12 top-10 h-2 w-1 rounded-sm"
            style={
              {
                background: colors[i % colors.length],
                "--dx": `${Math.cos(angle) * distance}px`,
                "--dy": `${Math.sin(angle) * distance * 0.7 + 30}px`,
                "--rot": `${(i % 2 ? 1 : -1) * (180 + i * 20)}deg`,
                animationDelay: `${(i % 4) * 40}ms`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}

// ─────────────────────────────────────────────────────── extension ──

function ExtensionStatus({
  installed,
  stale,
  version,
}: {
  installed: boolean | null;
  stale: boolean;
  version: string | null;
}) {
  if (stale) {
    return (
      <section className="tracker-rise rounded-2xl border border-warn/40 bg-warn-soft p-4 text-[12px]">
        <p className="flex items-center gap-2 font-semibold text-warn">
          <PuzzleIcon className="size-4" /> The publisher extension was updated
        </p>
        <p className="mt-1 text-foreground/80">Reload this page to reconnect to the new version.</p>
        <button
          type="button"
          className="btn btn-secondary mt-2.5 h-8"
          onClick={() => window.location.reload()}
        >
          Reload page
        </button>
      </section>
    );
  }
  if (installed === null) {
    return (
      <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Loader2Icon className="size-3.5 animate-spin" /> Looking for the publisher extension…
      </p>
    );
  }
  if (installed) {
    return (
      <p className="inline-flex items-center gap-1.5 rounded-full bg-good-soft px-2.5 py-1 text-[11px] font-medium text-good">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--st-production)] opacity-60" />
          <span className="relative inline-flex size-1.5 rounded-full bg-[var(--st-production)]" />
        </span>
        Extension connected{version ? ` · v${version}` : ""}
      </p>
    );
  }
  return (
    <section className="tracker-rise rounded-2xl border border-bad/30 bg-bad-soft p-4 text-[12px]">
      <p className="flex items-center gap-2 font-semibold text-bad">
        <AlertTriangleIcon className="size-4" /> Publisher extension not found
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-foreground/80">
        <li>
          Open <span className="font-mono">chrome://extensions</span> and turn on Developer mode
        </li>
        <li>
          <span className="font-medium">Load unpacked</span> → choose the{" "}
          <span className="font-mono">app-publishing-bot/extension</span> folder
        </li>
        <li>Reload this page</li>
      </ol>
      <p className="mt-2 text-muted-foreground">Chrome on a desktop only.</p>
    </section>
  );
}

import type { AccountType, App, AppStatus, Platform, ReleaseState } from "./types";

/**
 * Status colors come from the data-viz palette and are validated, not chosen
 * by eye: the pipeline order below clears every adjacent CVD gate
 * (worst 14.7 deutan) and the normal-vision floor (16.7).
 *
 * Red and green are inherently close for deuteranopes — that is true of any
 * semantic status palette — so every status also carries a distinct SHAPE and
 * a visible label. Colour never carries meaning on its own here.
 */
export const STATUSES: Record<
  AppStatus,
  {
    label: string;
    hex: string;
    dot: string;
    chip: string;
    glyph: StatusGlyph;
    group: "active" | "attention" | "done";
  }
> = {
  ongoing: {
    label: "Ongoing",
    hex: "#3987e5",
    dot: "bg-[#3987e5]",
    chip: "bg-[#e8f1fc] text-[#184f95] ring-[#3987e5]/25",
    glyph: "circle",
    group: "active",
  },
  in_review: {
    label: "In Review",
    hex: "#fab219",
    dot: "bg-[#fab219]",
    chip: "bg-[#fef5e1] text-[#8a5a00] ring-[#fab219]/40",
    glyph: "half",
    group: "active",
  },
  closed_testing: {
    label: "Closed Testing",
    hex: "#4a3aa7",
    dot: "bg-[#4a3aa7]",
    chip: "bg-[#eceafa] text-[#372b7d] ring-[#4a3aa7]/25",
    glyph: "target",
    group: "active",
  },
  production: {
    label: "Production",
    hex: "#0ca30c",
    dot: "bg-[#0ca30c]",
    chip: "bg-[#e7f6e7] text-[#076b07] ring-[#0ca30c]/25",
    glyph: "check",
    group: "done",
  },
  on_hold: {
    label: "On Hold",
    hex: "#e87ba4",
    dot: "bg-[#e87ba4]",
    chip: "bg-[#fdeef3] text-[#a63b64] ring-[#e87ba4]/35",
    glyph: "pause",
    group: "attention",
  },
  rejected: {
    label: "Rejected",
    hex: "#d03b3b",
    dot: "bg-[#d03b3b]",
    chip: "bg-[#fbebeb] text-[#9b2c2c] ring-[#d03b3b]/25",
    glyph: "cross",
    group: "attention",
  },
};

/** Shape channel, so a status is never identified by colour alone. */
export type StatusGlyph = "circle" | "half" | "target" | "check" | "pause" | "cross";

/** Left-to-right pipeline order — this exact sequence is what was validated. */
export const PIPELINE_ORDER: AppStatus[] = [
  "ongoing",
  "in_review",
  "closed_testing",
  "production",
  "on_hold",
  "rejected",
];

export const STATUS_ORDER: AppStatus[] = [
  "rejected",
  "in_review",
  "closed_testing",
  "ongoing",
  "on_hold",
  "production",
];

export const PLATFORMS: Record<Platform, { label: string; short: string }> = {
  play_store: { label: "Play Store", short: "Play" },
  app_store: { label: "App Store", short: "iOS" },
};

export const ACCOUNT_TYPES: Record<AccountType, { label: string }> = {
  organization: { label: "Organization" },
  personal: { label: "Personal" },
};

/** How many days in a non-terminal status before we flag it as stale. */
export const STALE_AFTER_DAYS = 7;

export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function isStale(status: AppStatus, statusChangedAt: string): boolean {
  if (status === "production") return false;
  return daysSince(statusChangedAt) >= STALE_AFTER_DAYS;
}

export const RELEASE_STATES: Record<
  ReleaseState,
  { label: string; dot: string; chip: string }
> = {
  empty: {
    label: "No apps",
    dot: "bg-neutral-300",
    chip: "bg-neutral-100 text-neutral-500 ring-neutral-500/20",
  },
  in_progress: {
    label: "In progress",
    dot: "bg-[#3987e5]",
    chip: "bg-[#e8f1fc] text-[#184f95] ring-[#3987e5]/25",
  },
  waiting: {
    label: "With the stores",
    dot: "bg-[#fab219]",
    chip: "bg-[#fef5e1] text-[#8a5a00] ring-[#fab219]/40",
  },
  attention: {
    label: "Needs attention",
    dot: "bg-[#d03b3b]",
    chip: "bg-[#fbebeb] text-[#9b2c2c] ring-[#d03b3b]/25",
  },
  complete: {
    label: "Complete",
    dot: "bg-[#0ca30c]",
    chip: "bg-[#e7f6e7] text-[#076b07] ring-[#0ca30c]/25",
  },
};

/**
 * A release shows the least-finished thing happening inside it: anything
 * blocked outranks anything waiting, which outranks work still in progress.
 */
export function releaseState(apps: Pick<App, "status">[]): ReleaseState {
  if (apps.length === 0) return "empty";
  if (apps.some((a) => a.status === "rejected" || a.status === "on_hold"))
    return "attention";
  if (apps.every((a) => a.status === "production")) return "complete";
  if (apps.some((a) => a.status === "in_review" || a.status === "closed_testing"))
    return "waiting";
  return "in_progress";
}

/** Suggest a next version from what the client already shipped. */
export function suggestNextVersion(existing: string[]): string {
  const numeric = existing
    .map((v) => v.trim().match(/^(\d+)\.(\d+)(?:\.(\d+))?$/))
    .filter(Boolean) as RegExpMatchArray[];

  if (numeric.length === 0) return "1.0.0";

  const latest = numeric
    .map((m) => [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] as const)
    .sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2])[0];

  return `${latest[0]}.${latest[1] + 1}.0`;
}

/**
 * The next build number for a new release: the last version part and the
 * build after "+" both go up by one — 1.0.6+9 -> 1.0.7+10, 2.1 -> 2.2.
 * Anything that doesn't end in a number gives null, to be filled in by hand.
 */
export function bumpBuild(build: string | null | undefined): string | null {
  const [version, code, ...rest] = (build ?? "").trim().split("+");
  if (!version || rest.length) return null;

  const bumped = version.match(/^(.*?)(\d+)$/);
  if (!bumped) return null;
  const nextVersion = `${bumped[1]}${Number(bumped[2]) + 1}`;

  if (code === undefined) return nextVersion;
  if (!/^\d+$/.test(code)) return null;
  return `${nextVersion}+${Number(code) + 1}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Relative effort each state actually demands of the person holding it.
 * A fresh build is real work — assets, metadata, submission — while an app
 * sitting in review is just waiting, so one Ongoing app outweighs three
 * In Review ones (4 > 3 x 1). Rejected costs about as much as a fresh build,
 * because it means rework and resubmission.
 *
 * Tune these to match how the work actually feels.
 */
export const EFFORT_WEIGHT: Record<AppStatus, number> = {
  ongoing: 4,
  rejected: 4,
  closed_testing: 1,
  in_review: 1,
  on_hold: 1,
  production: 0,
};

import { CheckIcon, PauseIcon, XIcon } from "lucide-react";
import type { AppStatus, Platform } from "@/lib/types";

type Step = { key: AppStatus; label: string };

/** The road to live. Closed testing is a Play Console track, so only Play has it. */
function stepsFor(platform: Platform): Step[] {
  return platform === "play_store"
    ? [
        { key: "ongoing", label: "Preparing" },
        { key: "in_review", label: "In review" },
        { key: "closed_testing", label: "Testing" },
        { key: "production", label: "Live" },
      ]
    : [
        { key: "ongoing", label: "Preparing" },
        { key: "in_review", label: "In review" },
        { key: "production", label: "Live" },
      ];
}

/**
 * Where an app is on its way to the store. Rejected sits on the review step
 * (that's where it was sent back); on hold sits on the first step.
 */
export function StageTrack({ status, platform }: { status: AppStatus; platform: Platform }) {
  const steps = stepsFor(platform);
  const at =
    status === "rejected"
      ? steps.findIndex((s) => s.key === "in_review")
      : status === "on_hold"
        ? 0
        : Math.max(0, steps.findIndex((s) => s.key === status));
  const problem = status === "rejected" ? "rejected" : status === "on_hold" ? "hold" : null;
  const live = status === "production";

  return (
    <ol className="flex items-center" aria-label="Progress">
      {steps.map((step, i) => {
        const done = i < at || (live && i === at);
        const current = i === at && !live;
        const tone = done
          ? "bg-[var(--st-production)] text-white border-[var(--st-production)]"
          : current && problem === "rejected"
            ? "bg-[var(--st-rejected)] text-white border-[var(--st-rejected)]"
            : current && problem === "hold"
              ? "bg-[var(--st-on-hold)] text-white border-[var(--st-on-hold)]"
              : current
                ? "bg-background border-foreground"
                : "bg-background border-border";

        return (
          <li key={step.key} className="flex items-center">
            {i > 0 && (
              <span className="relative h-0.5 w-4 overflow-hidden bg-border sm:w-7" aria-hidden>
                {i <= at && (
                  // Finished segments draw in left to right, one after another.
                  <span
                    className="tracker-fill absolute inset-0 bg-[var(--st-production)]"
                    style={{ animationDelay: `${0.35 + i * 0.18}s` }}
                  />
                )}
              </span>
            )}
            <span
              className={`grid size-4 place-items-center rounded-full border-2 ${tone} ${
                current && !problem ? "tracker-pulse" : ""
              } ${live && i === at ? "tracker-glow" : ""}`}
              title={step.label}
            >
              {done && <CheckIcon className="size-2.5" strokeWidth={4} />}
              {current && problem === "rejected" && <XIcon className="size-2.5" strokeWidth={4} />}
              {current && problem === "hold" && <PauseIcon className="size-2.5" strokeWidth={4} />}
              {current && !problem && <span className="size-1.5 rounded-full bg-foreground" />}
            </span>
            <span className="sr-only">
              {step.label}
              {done ? " (done)" : current ? " (current)" : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

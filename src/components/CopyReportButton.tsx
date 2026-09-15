"use client";

import { useEffect, useRef, useState } from "react";
import { writeToClipboard } from "@/components/CopyButton";

/** Copies a ready-to-paste status report for the team lead. */
export function CopyReportButton({
  report,
  label = "Copy report",
  className = "btn btn-secondary",
  count,
}: {
  report: string;
  label?: string;
  className?: string;
  count?: number;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copy() {
    setState((await writeToClipboard(report)) ? "copied" : "failed");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1800);
  }

  const disabled = report.trim() === "";

  return (
    <button
      type="button"
      onClick={copy}
      disabled={disabled}
      title={
        disabled
          ? "Nothing to report yet"
          : state === "failed"
            ? "Could not copy — check clipboard permissions"
            : `${report.split("\n").length} lines`
      }
      className={`${className} ${state === "copied" ? "text-emerald-700" : ""} ${
        state === "failed" ? "text-rose-700" : ""
      }`}
    >
      {state === "copied" ? (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="m5 13 4 4L19 7"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Copied
        </>
      ) : state === "failed" ? (
        "Copy failed"
      ) : (
        <>
          {label}
          {count !== undefined && count > 1 && (
            <span className="text-neutral-400">({count})</span>
          )}
        </>
      )}
    </button>
  );
}

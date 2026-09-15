import { STATUSES } from "@/lib/constants";
import type { AppStatus } from "@/lib/types";

/**
 * The shape channel. Red and green sit ~4 ΔE apart for deuteranopes in any
 * semantic status palette, so each status also gets its own silhouette and
 * never relies on hue alone.
 */
export function StatusGlyph({
  status,
  size = 12,
  className = "",
}: {
  status: AppStatus;
  size?: number;
  className?: string;
}) {
  const { hex, glyph, label } = STATUSES[status];
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    className: `shrink-0 ${className}`,
    style: { color: hex },
    role: "img" as const,
    "aria-label": label,
  };

  switch (glyph) {
    case "check": // Production — done
      return (
        <svg {...common} fill="none">
          <circle cx="12" cy="12" r="10" fill="currentColor" />
          <path d="m7.5 12.5 3 3 6-6.5" stroke="#fff" strokeWidth="2.6"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "cross": // Rejected — sent back
      return (
        <svg {...common} fill="none">
          <circle cx="12" cy="12" r="10" fill="currentColor" />
          <path d="m8.5 8.5 7 7m0-7-7 7" stroke="#fff" strokeWidth="2.6"
            strokeLinecap="round" />
        </svg>
      );
    case "pause": // On Hold — parked
      return (
        <svg {...common} fill="none">
          <circle cx="12" cy="12" r="10" fill="currentColor" />
          <path d="M10 8.5v7m4-7v7" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      );
    case "half": // In Review — waiting on the store
      return (
        <svg {...common} fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
          <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" />
        </svg>
      );
    case "target": // Closed Testing — a limited track
      return (
        <svg {...common} fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
          <circle cx="12" cy="12" r="3.5" fill="currentColor" />
        </svg>
      );
    default: // Ongoing — open, not yet submitted
      return (
        <svg {...common} fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
        </svg>
      );
  }
}

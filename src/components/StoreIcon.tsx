import { PLATFORMS } from "@/lib/constants";
import type { Platform } from "@/lib/types";

/**
 * The stores' own marks: Google Play's four-colour triangle and the Apple
 * logo. Drawn inline so they stay sharp at any size and need no image files.
 */
export function StoreIcon({
  platform,
  size = 14,
  className = "",
}: {
  platform: Platform;
  size?: number;
  className?: string;
}) {
  const label = PLATFORMS[platform].label;

  if (platform === "play_store") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        role="img"
        aria-label={label}
        className={`shrink-0 ${className}`}
      >
        <title>{label}</title>
        <path fill="#00C3FF" d="M3.6 1.8C3.3 2.1 3.2 2.6 3.2 3.2v17.6c0 .6.1 1.1.4 1.4l.1.1 9.9-9.9v-.2L3.7 1.7z" />
        <path fill="#FFBC00" d="M16.8 15.6 13.5 12.3v-.2l3.3-3.3.1.1 3.9 2.2c1.1.6 1.1 1.7 0 2.3l-3.9 2.2z" />
        <path fill="#FF3A44" d="M16.9 15.5 13.5 12.2l-9.9 9.9c.4.4 1 .4 1.7.1l11.6-6.7" />
        <path fill="#00D86C" d="M16.9 8.9 5.3 2.3C4.6 1.9 4 2 3.6 2.4l9.9 9.8z" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={label}
      className={`shrink-0 fill-current ${className}`}
    >
      <title>{label}</title>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

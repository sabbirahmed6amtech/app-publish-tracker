"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** A panel that slides in from the right; closes on Escape or a backdrop click. */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  // Portalled so it isn't trapped inside the table row that opens it.
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-neutral-900/25 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="drawer-in absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-neutral-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-neutral-900">{title}</h2>
            {subtitle && <div className="mt-0.5 text-[12px] text-neutral-500">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost -mr-1.5 -mt-1 px-2 py-1 text-base leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}

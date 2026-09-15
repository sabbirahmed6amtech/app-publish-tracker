import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  meta,
  tags,
  actions,
  backHref,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  tags?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 pb-5">
      <div className="min-w-0">
        {backHref && (
          <Link
            href={backHref}
            className="mb-1.5 inline-flex items-center gap-1 text-[12px] font-medium
                       text-neutral-500 hover:text-neutral-900"
          >
            ← Back
          </Link>
        )}
        {eyebrow && (
          <div className="text-[12px] font-medium text-neutral-500">{eyebrow}</div>
        )}
        <h1 className="truncate text-[22px] font-semibold tracking-tight text-neutral-900">
          {title}
        </h1>
        {meta && <div className="mt-1 text-[13px] text-neutral-500">{meta}</div>}
        {tags && <div className="mt-2 flex flex-wrap items-center gap-1.5">{tags}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span
      className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5
                 text-[11px] font-medium text-neutral-600"
    >
      {children}
    </span>
  );
}

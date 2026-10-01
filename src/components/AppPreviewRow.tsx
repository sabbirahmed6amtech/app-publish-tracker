"use client";

import { useCallback, useState, type MouseEvent, type ReactNode } from "react";
import { Drawer } from "@/components/Drawer";
import { StatusChip } from "@/components/StatusChip";
import { CopyButton } from "@/components/CopyButton";
import { CodeEditor } from "@/components/CodeEditor";
import { KeystoreDownloadButton } from "@/components/KeystoreDownloadButton";
import { formatDate } from "@/lib/constants";
import type { App, Keystore } from "@/lib/types";

// Clicks on these keep doing their own job instead of opening the preview.
const INTERACTIVE = "a, button, input, select, textarea, label, [data-modal]";

/**
 * A table row that opens a read-only preview of the app when clicked. The
 * cells are passed in as children so the page can keep rendering them.
 */
export function AppPreviewRow({
  app,
  accountLabel,
  assigneeName,
  keystore,
  className,
  children,
}: {
  app: App;
  accountLabel: string;
  assigneeName: string | null;
  keystore: Keystore | null;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  function onClick(e: MouseEvent<HTMLTableRowElement>) {
    // React bubbles portal clicks (the drawer itself) up to this row too.
    if (!e.currentTarget.contains(e.target as Node)) return;
    if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
    // Selecting text in a cell shouldn't count as a click.
    if (window.getSelection()?.toString()) return;
    setOpen(true);
  }

  return (
    <>
      <tr className={`cursor-pointer ${className ?? ""}`} onClick={onClick}>
        {children}
      </tr>

      <AppPreviewSheet
        open={open}
        onClose={close}
        app={app}
        accountLabel={accountLabel}
        assigneeName={assigneeName}
        keystore={keystore}
      />
    </>
  );
}

/** The read-only app preview; shared by table rows and board cards. */
export function AppPreviewSheet({
  open,
  onClose,
  app,
  accountLabel,
  assigneeName,
  keystore,
}: {
  open: boolean;
  onClose: () => void;
  app: App;
  accountLabel: string;
  assigneeName: string | null;
  keystore: Keystore | null;
}) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={app.app_name || app.project_name}
      subtitle={app.app_name ? app.project_name : undefined}
    >
      <dl className="divide-y divide-border px-5">
        <Field label="Status">
          <StatusChip status={app.status} since={app.status_changed_at} />
        </Field>
        <Field label="Published to">{accountLabel}</Field>
        <Field label="Project" copy={app.project_name}>
          {app.project_name}
        </Field>
        <Field label="App name" copy={app.app_name || undefined}>
          {app.app_name || null}
        </Field>
        <Field label="Assigned to">{assigneeName}</Field>
        <Field label="Build number" copy={app.build_version ?? undefined} mono>
          {app.build_version}
        </Field>
        <Field label="Flutter version" copy={app.flutter_version ?? undefined} mono>
          {app.flutter_version}
        </Field>
        <Field label="Store link" copy={app.store_url ?? undefined}>
          {app.store_url && (
            <a
              href={app.store_url}
              target="_blank"
              rel="noreferrer"
              className="break-all text-blue-600 hover:underline"
            >
              {app.store_url}
            </a>
          )}
        </Field>
        <Field label="Keystore">{keystore?.name}</Field>
        <Field label="JKS file">
          {keystore?.file_path && (
            <div className="flex items-center gap-2">
              <span
                className="min-w-0 truncate font-mono text-[12px]"
                title={keystore.file_name ?? ""}
              >
                {keystore.file_name}
              </span>
              <KeystoreDownloadButton keystoreId={keystore.id} />
            </div>
          )}
        </Field>
        <div className="py-2.5">
          <dt className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            JKS details
          </dt>
          <dd>
            {keystore?.details ? (
              <CodeEditor
                key={keystore.id + keystore.updated_at}
                name="jks-preview"
                defaultValue={keystore.details}
                rows={1}
                readOnly
              />
            ) : (
              <span className="text-[13px] text-neutral-300">—</span>
            )}
          </dd>
        </div>
        <Field label="Note">
          {app.note && <p className="whitespace-pre-wrap">{app.note}</p>}
        </Field>
        <Field label="Status changed">{formatDate(app.status_changed_at)}</Field>
        <Field label="Added">{formatDate(app.created_at)}</Field>
        <Field label="Last updated">{formatDate(app.updated_at)}</Field>
      </dl>
    </Drawer>
  );
}

function Field({
  label,
  copy,
  mono,
  children,
}: {
  label: string;
  copy?: string;
  mono?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-start gap-3 py-2.5">
      <dt className="pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </dt>
      <dd
        className={`flex min-w-0 items-start gap-1 text-[13px] text-neutral-800 ${
          mono ? "font-mono text-[12px]" : ""
        }`}
      >
        <div className="min-w-0 flex-1">
          {children ?? <span className="font-sans text-neutral-300">—</span>}
        </div>
        {copy && <CopyButton value={copy} label={`Copy ${label.toLowerCase()}`} />}
      </dd>
    </div>
  );
}

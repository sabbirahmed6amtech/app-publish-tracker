import type { AppRow } from "./types";
import { ACCOUNT_TYPES, PLATFORMS, STATUSES } from "./constants";

export const EXPORT_HEADERS = [
  "Ticket",
  "Client",
  "Release Version",
  "Release Title",
  "Assigned To",
  "Platform",
  "Account Name",
  "Account Type",
  "Project Name",
  "App Name",
  "Status",
  "Assignee",
  "Build Version",
  "Flutter Version",
  "JKS",
  "Note",
  "Link",
] as const;

function escape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function rowsToCsv(rows: AppRow[]): string {
  const lines = [EXPORT_HEADERS.join(",")];

  for (const r of rows) {
    lines.push(
      [
        r.ticket,
        r.client_name,
        r.release_version,
        r.release_title ?? "",
        r.release_assignee_name ?? "",
        PLATFORMS[r.platform].label,
        r.account_name,
        ACCOUNT_TYPES[r.account_type].label,
        r.project_name,
        r.app_name,
        STATUSES[r.status].label,
        r.assignee_name ?? "",
        r.build_version ?? "",
        r.flutter_version ?? "",
        r.jks ?? "",
        r.note ?? "",
        r.store_url ?? "",
      ]
        .map((v) => escape(String(v ?? "")))
        .join(","),
    );
  }

  return lines.join("\n");
}

/** Split one delimited line, honouring "quoted, fields". */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseDelimited(text: string): string[][] {
  const raw = text.replace(/\r\n?/g, "\n").trim();
  if (!raw) return [];
  // Copying a block out of Sheets gives tabs; a downloaded file gives commas.
  const delimiter = raw.split("\n")[0].includes("\t") ? "\t" : ",";
  return raw
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => splitLine(l, delimiter));
}

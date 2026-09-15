"use client";

import { rowsToCsv } from "@/lib/csv";
import type { AppRow } from "@/lib/types";

export function ExportButton({
  rows,
  label = "Download CSV",
  className = "btn btn-secondary",
}: {
  rows: AppRow[];
  label?: string;
  className?: string;
}) {
  function download() {
    const blob = new Blob([rowsToCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `publish-tracker-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button className={className} onClick={download}>
      {label}
    </button>
  );
}

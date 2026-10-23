"use client";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

// Spreadsheet-injection guard: prefix cells that start with = + - @ so Excel treats them as text.
const cell = (v: unknown) => { let s = v == null ? "" : String(v); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export function CsvButton({ filename, rows, label = "Export CSV" }: { filename: string; rows: Record<string, unknown>[]; label?: string }) {
  return (
    <Button size="sm" variant="outline" disabled={!rows.length} onClick={() => {
      const cols = Object.keys(rows[0]);
      const csv = "﻿" + [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
    }}><Download className="size-4" />{label}</Button>
  );
}

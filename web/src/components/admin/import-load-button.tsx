"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { DatabaseZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadCatalogueExtraction } from "@/lib/admin/import-actions";
import { run } from "@/lib/admin/client";

export function LoadExtractionButton() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button disabled={busy} onClick={async () => {
      setBusy(true);
      const d = await run(loadCatalogueExtraction(), (x) => `Loaded: ${x.created.length ? x.created.join("; ") : "nothing new"}${x.skipped.length ? ` (already loaded: ${x.skipped.length})` : ""}`);
      setBusy(false); if (d) router.refresh();
    }}><DatabaseZap className="size-4" />{busy ? "Loading images… (about a minute)" : "Load catalogue extraction"}</Button>
  );
}

import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Panel, Empty } from "@/components/admin/ui";
import { LoadExtractionButton } from "@/components/admin/import-load-button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Catalogue import" };

export default async function ImportPage() {
  const sb = await createClient();
  const { data: batches } = await sb.from("import_batches").select("id, source_name, notes, created_at, import_items(status)").order("created_at");
  let flags: { page: number; kind: string; text: string }[] = [];
  try { flags = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/catalogue-import/import.json"), "utf8")).branding_flags ?? []; } catch { /* package not bundled */ }

  return (
    <>
      <PageHeader title="Catalogue import review" description="Extracted catalogue data is staged here. Nothing is shown to customers until you approve it, publish it to a draft product, and then publish the product."
        actions={<LoadExtractionButton />} />
      {flags.length > 0 && (
        <Panel title="Unrelated branding found in the catalogue" className="mb-6 border-amber-300 bg-amber-50">
          <ul className="space-y-1.5 text-sm">{flags.map((f, i) => <li key={i} className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" /><span><strong>Page {f.page}:</strong> {f.text}</span></li>)}</ul>
          <p className="mt-3 text-xs text-muted-foreground">Only KANZ CORNER EST. branding is used on the website. Other companies&apos; logos are never imported; items whose photos show third-party branding are flagged for you to replace.</p>
        </Panel>
      )}
      {!batches?.length ? <Empty>Nothing loaded yet. Click “Load catalogue extraction” to stage the products extracted from your catalogue.</Empty> : (
        <div className="grid gap-4 md:grid-cols-2">
          {batches.map((b) => {
            const c = { pending: 0, approved: 0, rejected: 0, published: 0 } as Record<string, number>;
            (b.import_items as { status: string }[]).forEach((i) => c[i.status]++);
            return (
              <Link key={b.id} href={`/admin/import/${b.id}`} className="rounded-xl border bg-card p-5 transition hover:border-primary">
                <h2 className="font-semibold">{b.source_name}</h2><p className="mt-1 text-sm text-muted-foreground">{b.notes}</p>
                <div className="mt-3 flex flex-wrap gap-2"><Badge variant="warning">{c.pending} pending</Badge><Badge variant="info">{c.approved} approved</Badge><Badge variant="secondary">{c.rejected} rejected</Badge><Badge variant="success">{c.published} drafted</Badge></div>
                <p className="mt-3 text-xs text-muted-foreground">Loaded {formatDateTime(b.created_at)}</p>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

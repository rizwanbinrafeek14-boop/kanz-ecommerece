"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "./ui";
import { createClient } from "@/lib/supabase/browser";
import { setProductRelations } from "@/lib/admin/product-actions";
import { run } from "@/lib/admin/client";

export interface RelRow { id: string; name: string }

function Picker({ productId, relation, title, initial }: { productId: string; relation: "related" | "alternative"; title: string; initial: RelRow[] }) {
  const router = useRouter();
  const [items, setItems] = React.useState(initial); const [q, setQ] = React.useState(""); const [hits, setHits] = React.useState<RelRow[]>([]); const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(async () => {
      const term = q.replace(/[%,()*\\]/g, " ").trim();
      const { data } = await createClient().from("products").select("id, name_en").ilike("name_en", `%${term}%`).neq("id", productId).limit(8);
      setHits((data ?? []).map((d) => ({ id: d.id, name: d.name_en })));
    }, 250);
    return () => clearTimeout(t);
  }, [q, productId]);
  const shown = q.trim().length >= 2 ? hits.filter((h) => !items.some((i) => i.id === h.id)) : [];
  return (
    <Panel title={title}>
      <ul className="mb-3 flex flex-wrap gap-2">{items.map((i) => <li key={i.id} className="flex items-center gap-1.5 rounded-full border bg-muted/40 py-1 ps-3 pe-1 text-sm">{i.name}<button className="rounded-full p-1 hover:bg-accent" aria-label={`Remove ${i.name}`} onClick={() => setItems((l) => l.filter((x) => x.id !== i.id))}><X className="size-3.5" /></button></li>)}{!items.length && <li className="text-sm text-muted-foreground">None selected.</li>}</ul>
      <Input placeholder="Search products to add…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      {shown.length > 0 && <ul className="mt-2 max-w-sm rounded-lg border">{shown.map((h) => <li key={h.id}><button className="w-full px-3 py-2 text-start text-sm hover:bg-accent" onClick={() => { setItems((l) => [...l, h]); setQ(""); }}>{h.name}</button></li>)}</ul>}
      <Button className="mt-4" disabled={busy} onClick={async () => { setBusy(true); const r = await run(setProductRelations(productId, relation, items.map((i) => i.id)), "Saved"); setBusy(false); if (r !== undefined) router.refresh(); }}>Save</Button>
    </Panel>
  );
}

export function ProductRelations({ productId, related, alternatives }: { productId: string; related: RelRow[]; alternatives: RelRow[] }) {
  return <div className="grid gap-4 lg:grid-cols-2"><Picker productId={productId} relation="related" title="Related products" initial={related} /><Picker productId={productId} relation="alternative" title="Alternative products" initial={alternatives} /></div>;
}

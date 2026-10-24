"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/input";
import { Panel } from "./ui";
import { setProductCertifications } from "@/lib/admin/contact-actions";
import { run } from "@/lib/admin/client";

export function ProductCerts({ productId, all, selected }: { productId: string; all: { id: string; name: string }[]; selected: string[] }) {
  const router = useRouter(); const [sel, setSel] = React.useState(new Set(selected)); const [busy, setBusy] = React.useState(false);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <Panel title="Certifications shown on this product">
      {!all.length ? <p className="text-sm text-muted-foreground">No certifications exist yet. Add the real ones under <Link className="underline" href="/admin/certifications">Certifications</Link>.</p> : (
        <div className="space-y-3">
          <ul className="space-y-2">{all.map((c) => <li key={c.id}><label className="flex items-center gap-2 text-sm"><Checkbox checked={sel.has(c.id)} onChange={() => toggle(c.id)} />{c.name}</label></li>)}</ul>
          <Button disabled={busy} onClick={async () => { setBusy(true); const ok = await run(setProductCertifications(productId, [...sel]), "Certifications saved"); setBusy(false); if (ok) router.refresh(); }}>{busy ? "Saving…" : "Save certifications"}</Button>
        </div>)}
    </Panel>
  );
}

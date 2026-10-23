"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Panel } from "./ui";
import { saveProductAttributes } from "@/lib/admin/product-actions";
import { run } from "@/lib/admin/client";

export interface AttrDef { id: string; key: string; name_en: string; is_filterable: boolean }
export interface AttrValue { attribute_id: string; value_en: string; value_ar: string | null; sort_order: number }

export function ProductAttributes({ productId, defs, values }: { productId: string; defs: AttrDef[]; values: AttrValue[] }) {
  const router = useRouter();
  const init = () => Object.fromEntries(defs.map((d) => { const v = values.filter((x) => x.attribute_id === d.id).sort((a, b) => a.sort_order - b.sort_order); return [d.key, { en: v.map((x) => x.value_en).join("\n"), ar: v.map((x) => x.value_ar ?? "").join("\n") }]; }));
  const [state, setState] = React.useState<Record<string, { en: string; ar: string }>>(init);
  const [busy, setBusy] = React.useState(false);
  return (
    <Panel title="Technical specifications">
      <p className="mb-4 text-sm text-muted-foreground">One value per line. Arabic lines match English lines by position. Attributes marked <em>filterable</em> appear as filters on the website. Manage the list of attributes under <strong>Attributes</strong>.</p>
      <div className="grid gap-5 lg:grid-cols-2">
        {defs.map((d) => (
          <div key={d.id} className="rounded-lg border p-3">
            <p className="mb-2 text-sm font-semibold">{d.name_en} {d.is_filterable && <span className="ms-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal uppercase text-muted-foreground">filter</span>}</p>
            <div className="grid grid-cols-2 gap-2">
              <Textarea rows={4} placeholder="English" value={state[d.key]?.en ?? ""} onChange={(e) => setState((s) => ({ ...s, [d.key]: { ...s[d.key], en: e.target.value } }))} className="font-mono text-xs" />
              <Textarea rows={4} dir="rtl" placeholder="العربية" value={state[d.key]?.ar ?? ""} onChange={(e) => setState((s) => ({ ...s, [d.key]: { ...s[d.key], ar: e.target.value } }))} className="font-mono text-xs" />
            </div>
          </div>
        ))}
      </div>
      <Button className="mt-5" disabled={busy} onClick={async () => {
        setBusy(true);
        const payload = Object.fromEntries(Object.entries(state).map(([k, v]) => [k, { en: v.en.split("\n"), ar: v.ar.split("\n") }]));
        const r = await run(saveProductAttributes(productId, payload), "Specifications saved"); setBusy(false); if (r !== undefined) router.refresh();
      }}>Save specifications</Button>
    </Panel>
  );
}

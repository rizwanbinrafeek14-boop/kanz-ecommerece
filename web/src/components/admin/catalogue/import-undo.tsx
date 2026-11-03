"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { previewImportUndo, undoImport } from "@/lib/admin/catalogue-actions";

type Plan = { remove: { id: string; name: string }[]; keep: { id: string; name: string; reason: string }[] };

/** "Undo this import": preview first (what is removed, what is kept and why), then confirm. */
export function ImportUndo({ runId }: { runId: string }) {
  const router = useRouter(); const [plan, setPlan] = React.useState<Plan | null>(null); const [busy, setBusy] = React.useState(false);
  const open = async () => { setBusy(true); const r = await previewImportUndo(runId); setBusy(false); if (!r.ok) toast.error(r.error); else setPlan(r.data); };
  const go = async () => {
    setBusy(true); const r = await undoImport(runId); setBusy(false);
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(`${r.data.removed} draft(s) removed${r.data.kept ? `, ${r.data.kept} kept` : ""}${r.data.filesLeft ? ` (${r.data.filesLeft} file(s) could not be deleted)` : ""}`);
    setPlan(null); router.refresh();
  };
  return (<>
    <Button size="sm" variant="ghost" className="h-7 px-2" disabled={busy} onClick={open} data-undo-import><Undo2 className="size-3.5" />Undo…</Button>
    <Dialog open={!!plan} onOpenChange={(o) => { if (!o) setPlan(null); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Undo this import?</DialogTitle>
          <DialogDescription>Only drafts that were never published or edited, and are not used anywhere, are removed. Their records go back to “approved”, so they can be imported again.</DialogDescription></DialogHeader>
        {plan && <div className="max-h-80 space-y-4 overflow-y-auto text-sm" data-undo-plan>
          <div><p className="font-medium">Remove ({plan.remove.length})</p>
            {plan.remove.length ? <ul className="mt-1 list-disc ps-5">{plan.remove.map((p) => <li key={p.id}>{p.name}</li>)}</ul> : <p className="text-muted-foreground">Nothing can be removed.</p>}</div>
          {plan.keep.length > 0 && <div><p className="font-medium">Keep ({plan.keep.length})</p>
            <ul className="mt-1 list-disc ps-5" data-undo-keep>{plan.keep.map((p) => <li key={p.id}><Link href={`/admin/products/${p.id}`} className="underline">{p.name}</Link> — {p.reason}</li>)}</ul></div>}
        </div>}
        <DialogFooter><Button variant="outline" onClick={() => setPlan(null)}>Cancel</Button>
          <Button variant="destructive" disabled={busy || !plan?.remove.length} onClick={go} data-undo-confirm>Remove {plan?.remove.length ?? 0} draft(s)</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>);
}

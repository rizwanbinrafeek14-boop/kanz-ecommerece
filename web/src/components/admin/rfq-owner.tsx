"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserCheck } from "lucide-react";
import { NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { assignRfq } from "@/lib/admin/sales-actions";

/** Owner picker on the RFQ page; compact "Take" button in the list. */
export function RfqOwner({ rfqId, owner, staff, me, compact }: { rfqId: string; owner: string | null; staff: { id: string; name: string }[]; me: string; compact?: boolean }) {
  const router = useRouter(); const [busy, start] = React.useTransition();
  const set = (id: string | null) => start(async () => { const r = await assignRfq(rfqId, id); if (!r.ok) toast.error(r.error); else { toast.success(id ? "Owner set" : "Owner removed"); router.refresh(); } });
  if (compact) return <Button size="sm" variant="outline" disabled={busy} onClick={() => set(me)} data-rfq-take><UserCheck className="size-4" />Take</Button>;
  return (
    <div className="flex flex-wrap items-center gap-2" data-rfq-owner>
      <label htmlFor="rfq-owner" className="text-sm font-medium">Owner</label>
      <NativeSelect id="rfq-owner" value={owner ?? ""} disabled={busy} onChange={(e) => set(e.target.value || null)} className="w-52">
        <option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}{s.id === me ? " (me)" : ""}</option>)}
      </NativeSelect>
      {owner !== me && <Button size="sm" variant="outline" disabled={busy} onClick={() => set(me)}><UserCheck className="size-4" />Assign to me</Button>}
    </div>);
}

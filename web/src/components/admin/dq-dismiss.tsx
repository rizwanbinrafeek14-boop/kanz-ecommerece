"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setDataQualityDismissed } from "@/lib/admin/catalog-actions";

export function DqDismiss({ productId, check, dismissed }: { productId: string; check: string; dismissed: boolean }) {
  const router = useRouter(); const [busy, start] = React.useTransition();
  return <Button size="sm" variant="ghost" disabled={busy} data-dq-dismiss
    onClick={() => start(async () => { const r = await setDataQualityDismissed(productId, check, !dismissed); if (!r.ok) toast.error(r.error); else router.refresh(); })}>
    {dismissed ? "Undo" : "Fine as it is"}</Button>;
}

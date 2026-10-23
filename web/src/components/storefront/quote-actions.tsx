"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { respondRfqAction } from "@/app/[lang]/actions";
import { Button } from "@/components/ui/button";

export function QuoteActions({ token, labels }: { token: string; labels: { accept: string; decline: string } }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  async function go(accept: boolean) {
    setBusy(true); setError(null);
    const r = await respondRfqAction(token, accept);
    setBusy(false);
    if (!r.ok) setError(r.error); else router.refresh();
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2"><Button disabled={busy} onClick={() => go(true)}>{labels.accept}</Button><Button disabled={busy} variant="outline" onClick={() => go(false)}>{labels.decline}</Button></div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </div>
  );
}

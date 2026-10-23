"use client";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border bg-card p-8 text-center">
      <h1 className="text-lg font-bold">This page hit an error</h1>
      <p className="mt-2 text-sm text-muted-foreground">Your data is safe. Try again; if it repeats, send the reference below to your developer.</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted-foreground">Ref: {error.digest}</p>}
      <Button className="mt-5" onClick={reset}>Try again</Button>
    </div>
  );
}

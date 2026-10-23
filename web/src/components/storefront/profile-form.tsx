"use client";
import * as React from "react";
import { updateProfileAction } from "@/app/[lang]/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function ProfileForm({ dict, profile }: { dict: Dictionary; profile: Record<string, string | null> | null }) {
  const [state, action, pending] = React.useActionState(updateProfileAction, null);
  const f = (id: string, label: string) => (
    <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label><Input id={id} name={id} defaultValue={profile?.[id] ?? ""} /></div>
  );
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {f("full_name", dict.account.fullName)}{f("phone", dict.account.phone)}{f("company_name", dict.account.company)}
      {f("cr_number", dict.account.cr)}{f("vat_number", dict.account.vatNo)}
      <div className="flex items-end gap-3 sm:col-span-2">
        <Button disabled={pending}>{dict.common.save}</Button>
        {state?.ok && <span className="text-sm text-success">{dict.account.saved}</span>}
        {state && !state.ok && <span className="text-sm text-destructive">{state.error}</span>}
      </div>
    </form>
  );
}

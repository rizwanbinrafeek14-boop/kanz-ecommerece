"use client";
import * as React from "react";
import Link from "next/link";
import { signInAction, signUpAction } from "@/app/[lang]/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

function Field({ id, label, ...p }: { id: string; label: string } & React.ComponentProps<"input">) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label><Input id={id} name={id} {...p} /></div>;
}

export function LoginForm({ lang, dict, next }: { lang: Locale; dict: Dictionary; next?: string }) {
  const [state, action, pending] = React.useActionState(signInAction, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="lang" value={lang} /><input type="hidden" name="next" value={next ?? ""} />
      <Field id="email" label={dict.account.email} type="email" required autoComplete="email" />
      <Field id="password" label={dict.account.password} type="password" required minLength={8} autoComplete="current-password" />
      {state && !state.ok && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <Button className="w-full" disabled={pending}>{pending ? dict.common.loading : dict.account.login}</Button>
      <p className="text-center text-sm text-muted-foreground">{dict.account.noAccount} <Link className="font-semibold text-primary" href={`/${lang}/account/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}>{dict.account.register}</Link></p>
    </form>
  );
}

export function RegisterForm({ lang, dict, next }: { lang: Locale; dict: Dictionary; next?: string }) {
  const [state, action, pending] = React.useActionState(signUpAction, null);
  if (state?.ok) return <p className="rounded-lg bg-green-50 p-4 text-sm text-green-800">{dict.account.checkEmail}</p>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="lang" value={lang} /><input type="hidden" name="next" value={next ?? ""} />
      <Field id="full_name" label={dict.account.fullName} required autoComplete="name" />
      <Field id="company_name" label={dict.account.company} autoComplete="organization" />
      <Field id="phone" label={dict.account.phone} type="tel" autoComplete="tel" />
      <Field id="email" label={dict.account.email} type="email" required autoComplete="email" />
      <Field id="password" label={dict.account.password} type="password" required minLength={8} autoComplete="new-password" />
      {state && !state.ok && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <Button className="w-full" disabled={pending}>{pending ? dict.common.loading : dict.account.register}</Button>
      <p className="text-center text-sm text-muted-foreground">{dict.account.haveAccount} <Link className="font-semibold text-primary" href={`/${lang}/account/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}>{dict.account.login}</Link></p>
    </form>
  );
}

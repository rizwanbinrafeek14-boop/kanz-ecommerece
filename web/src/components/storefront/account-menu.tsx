"use client";
import * as React from "react";
import Link from "next/link";
import { User } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

export function AccountMenu({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const configured = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const [email, setEmail] = React.useState<string | null | undefined>(configured ? undefined : null);
  React.useEffect(() => {
    if (!configured) return;
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setEmail(s?.user?.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, [configured]);
  const href = email ? `/${lang}/account` : `/${lang}/account/login`;
  return (
    <Link href={href} className="flex flex-col items-center gap-0.5 text-xs hover:text-white/80" aria-label={dict.nav.account}>
      <User className="size-5" />
      <span className="hidden sm:block">{email ? dict.nav.account : dict.nav.signIn}</span>
    </Link>
  );
}

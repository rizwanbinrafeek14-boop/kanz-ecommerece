import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { RegisterForm } from "@/components/storefront/auth-forms";

export const metadata = { title: "Create account", robots: { index: false } };

export default async function RegisterPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ next?: string; reason?: string }> }) {
  const { lang } = await params; const { next, reason } = await searchParams;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      {reason === "datasheet" && <p role="status" className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">{dict.account.datasheetGate}</p>}
      <h1 className="mb-6 text-2xl font-bold">{dict.account.register}</h1>
      <div className="rounded-xl border bg-card p-6"><RegisterForm lang={lang} dict={dict} next={next} /></div>
    </div>
  );
}

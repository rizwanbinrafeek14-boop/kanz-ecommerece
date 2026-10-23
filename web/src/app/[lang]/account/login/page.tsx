import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LoginForm } from "@/components/storefront/auth-forms";

export const metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ next?: string }> }) {
  const { lang } = await params; const { next } = await searchParams;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold">{dict.account.login}</h1>
      <div className="rounded-xl border bg-card p-6"><LoginForm lang={lang} dict={dict} next={next} /></div>
    </div>
  );
}

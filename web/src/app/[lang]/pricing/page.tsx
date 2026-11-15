import { permanentRedirect } from "next/navigation";

/** /pricing is a common address for a price list (people and agents try it): it is the Prices page. */
export default async function Pricing({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  permanentRedirect(`/${lang === "ar" ? "ar" : "en"}/prices`);
}

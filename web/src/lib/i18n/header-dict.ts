import type { Dictionary } from "@/lib/i18n/dictionaries";

/** The few labels the header's interactive parts need — sent to the browser on every page instead of the whole dictionary. */
export type HeaderDict = {
  common: Pick<Dictionary["common"], "category" | "search">; search: Pick<Dictionary["search"], "placeholder" | "suggestions" | "viewAllResults">;
  nav: Pick<Dictionary["nav"], "account" | "signIn" | "cart" | "quote">; cart: Pick<Dictionary["cart"], "quoteList">;
};
export const headerDict = (d: Dictionary): HeaderDict => ({
  common: { category: d.common.category, search: d.common.search },
  search: { placeholder: d.search.placeholder, suggestions: d.search.suggestions, viewAllResults: d.search.viewAllResults },
  nav: { account: d.nav.account, signIn: d.nav.signIn, cart: d.nav.cart, quote: d.nav.quote }, cart: { quoteList: d.cart.quoteList },
});

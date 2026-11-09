# Agent readiness (AI assistants and browser agents)

What the site offers to AI agents, where it lives in the code, and what to change. All of it serves only published, public catalogue data — the same as the website. Nothing logs in, and nothing is written, except one thing: a browser agent can *prepare* the RFQ form, which the visitor then reviews and submits themselves.

| What | Where | Code |
|---|---|---|
| Content signals | `/robots.txt`: `Content-Signal: search=yes, ai-input=yes, ai-train=no` | `web/src/app/robots.txt/route.ts` (`CONTENT_SIGNAL`) |
| Site summary for LLMs | `/llms.txt` (company, pricing policy, key pages, categories, contact) | `web/src/app/llms.txt/route.ts`, `web/src/lib/agent/content.ts` |
| Markdown pages | `/md/en`, `/md/en/products?q=…`, `/md/en/category/<slug>`, `/md/en/product/<slug>`, `/md/en/brand/<slug>` (also `/md/ar/…`). The normal URLs return the same Markdown when requested with `Accept: text/markdown`. A spiral wound gasket page is 19 KB as Markdown versus 534 KB as HTML. | `web/src/app/md/[[...path]]/route.ts`, `web/src/proxy.ts` (`prefersMarkdown`) |
| Link headers (RFC 8288) | Homepage: `llms.txt` (describedby), Markdown version (alternate), MCP server card (service-desc), sitemap. Catalogue pages: their Markdown version. | `web/next.config.mjs` (`headers()`) |
| Structured data | Homepage: `WebSite` + `SearchAction`, `OfferCatalog` of categories, `ItemList` of featured `Product`s, `WebPage`, plus the site-wide `LocalBusiness`. | `web/src/lib/agent/home-jsonld.ts` |
| MCP server | `POST /mcp` (Streamable HTTP, stateless JSON). Read-only tools: `search_products`, `get_product`, `list_categories`, `get_company_info`. | `web/src/lib/agent/mcp.ts`, `web/src/app/mcp/route.ts` |
| MCP Server Card | `/.well-known/mcp/server-card.json` (also `/.well-known/mcp.json`) | `serverCard()` in `web/src/lib/agent/mcp.ts` |
| WebMCP (in-browser agents) | Registered on page load: `search_products`, `get_product`, `list_categories`, `prepare_quotation_request`. The header search form is a declarative tool (`toolname="search_catalogue"`). | `web/src/components/agent/webmcp-tools.tsx`, `web/src/components/storefront/search-box.tsx` |

## Prices
- **Price list page `/en/prices` (and `/ar/prices`):**
  - Lists every published product that has a real price, with `ItemList` → `Product` → `Offer` / `AggregateOffer` (SAR) markup.
  - Explains that everything else is priced by quotation.
  - Works without JavaScript or login.
  - Linked from every page's footer ("Prices"), and from `llms.txt`, the Markdown homepage and the sitemap. Markdown version: `/md/en/prices`.
- An `Offer` with price and SAR currency is added only where a real price is set: a product's base price or a size's price, when the product is not quote-only.
- Quote-only products get no price in structured data, Markdown or MCP; they say "price on request".
- The homepage check for "prices reachable" passes only when a featured product has a real price. If every product is quote-only, that is a business choice, and the pricing policy is stated in `llms.txt` and the Markdown pages instead.

## Page size (token budget)
The homepage went from 318 KB to 227 KB (Arabic: 292 KB to 236 KB):
- The mobile menu receives only names and links, instead of full category records and the whole translation dictionary.
- The header's interactive parts receive only their few labels.
- The category mega-menu and "More" menu are built only when opened, instead of every page carrying a hidden copy.
- The brands strip sends each brand once; the repeats for the loop are added in the browser.
- Icon drawing attributes are set once per icon.
- The homepage category catalogue lists top-level categories only.

Next.js embeds a second, data copy of the page for interactivity, so the HTML cannot shrink much further without a different architecture. Agents get the same content far smaller from the Markdown version: `/md/en` is about 5 KB, linked by the homepage `Link` header and `<link rel="alternate" type="text/markdown">`.

## Bot protection
The app does not block any user agent. If a checker reports AI agents blocked, the block comes from the host's firewall, CDN or bot protection (Hostinger hPanel, or Cloudflare if used). Allow the AI user agents there, at least on public pages: GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, Claude-User, Claude-SearchBot, PerplexityBot, Perplexity-User, Google-Extended.

## Notes
- **Drafts:** WebMCP (Chrome's browser-agent API) and MCP Server Cards (SEP-1649 / SEP-2127) are still drafts. The code supports both API spellings (`document.modelContext` and `navigator.modelContext`) and serves the card at both proposed paths. Recheck both specs when they are finalised.
- **Markdown pages** are `noindex`; the HTML pages remain the canonical ones for search engines.
- **`Vary: Accept`:** Next.js sets its own `Vary` header on HTML pages, so `Vary: Accept` is present only on the Markdown responses. A cache can therefore never serve Markdown to a browser. At worst it may serve HTML to an agent, which can still use `/md/…`.
- **Tests:** 37 checks (`agent.mjs`).

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
- An `Offer` with price and SAR currency is added only where a real price is set: a product's base price or a size's price, when the product is not quote-only.
- Quote-only products get no price in structured data, Markdown or MCP; they say "price on request".
- The homepage check for "prices reachable" passes only when a featured product has a real price. If every product is quote-only, that is a business choice, and the pricing policy is stated in `llms.txt` and the Markdown pages instead.

## Notes
- **Drafts:** WebMCP (Chrome's browser-agent API) and MCP Server Cards (SEP-1649 / SEP-2127) are still drafts. The code supports both API spellings (`document.modelContext` and `navigator.modelContext`) and serves the card at both proposed paths. Recheck both specs when they are finalised.
- **Markdown pages** are `noindex`; the HTML pages remain the canonical ones for search engines.
- **`Vary: Accept`:** Next.js sets its own `Vary` header on HTML pages, so `Vary: Accept` is present only on the Markdown responses. A cache can therefore never serve Markdown to a browser. At worst it may serve HTML to an agent, which can still use `/md/…`.
- **Tests:** 37 checks (`agent.mjs`).

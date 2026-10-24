# SEO guide — KANZ CORNER EST.

Plain-language guide to what the website now does for search, what you manage in the admin panel, and what needs *your* Google account.
Technical completion is **not** the same as ranking: results depend on Google crawling and trusting the pages, your competitors, your content over time and
factors we do not control. No rankings, traffic or "SEO scores" are promised or reported here.

Related documents: [KEYWORD-MAP.md](KEYWORD-MAP.md) · [REDIRECT-MAP.md](REDIRECT-MAP.md) · [GOOGLE-BUSINESS-PROFILE-CHECKLIST.md](GOOGLE-BUSINESS-PROFILE-CHECKLIST.md) · [PLAN-30-60-90.md](PLAN-30-60-90.md)

## Facts used (from your answers)
* Business location: **Al Khobar, Eastern Province** (address from Content & settings). Delivery: **across Saudi Arabia**. No other branch is claimed.
* Priority categories: grooved fittings, pipes, pipe fittings & flanges, valves.
* Customers: contractors/MEP, oil & gas/petrochemical, water/fire-fighting/utilities, industrial plants/maintenance, small-trade buyers.
* No Google Business Profile or Search Console yet. No Google Analytics (decision: keep anonymous first-party counting, so no cookie banner is needed).

## What is implemented on the website
| Area | Implementation |
|---|---|
| Titles & descriptions | Every public page has its own title and description in each language. Product and category defaults are generated from real data (name, SKU, brand, sizes, grades, short description); admins can override. |
| Canonical & language | Every page has a self-referencing canonical, `hreflang` for `en`, `ar` and `x-default`, correct `lang`/`dir`. A language version is only linked/indexed when it has real content: an Arabic product page without an Arabic name is `noindex` and is not listed in `hreflang` or the sitemap. |
| Duplicate URLs | Filter, search, sort and availability URLs (`?q=`, `?sort=`, `?f.size=` …) are `noindex,follow` and point their canonical at the clean listing. Pagination (`?page=2`) is self-canonical. Empty categories are `noindex` and left out of the sitemap until they hold published products. |
| Sitemap | `/sitemap.xml` is generated on request from the live catalogue: only published, indexable pages, both languages with `hreflang` alternates, no admin/account/cart/parameter URLs. |
| robots.txt | Blocks admin, API, auth, account, cart and checkout for polite crawlers. It is **not** a security control: those areas are protected by login and also send `noindex`. |
| Status codes & redirects | Unknown URLs return a real 404. When a product or category address (slug) is changed, a permanent redirect from the old address to the new one is created automatically (database trigger, chains kept to one hop). `non-www → www` and `http → https` are redirected permanently when `NEXT_PUBLIC_SITE_URL` is your real domain. |
| Structured data (JSON-LD) | `LocalBusiness` (name, phone, email, Al Khobar address, Saudi Arabia area served, social profiles you added), `BreadcrumbList` on products, categories and contact, `Product` on product pages. |
| Product data | Specifications, variants/SKUs, verified certifications, datasheets, buying guides on categories, related products, image alt text per language. |
| Contact & local | Contact page with address, phone, email, WhatsApp, opening hours (only if you enter them), "Get directions" link and a clear statement that you are based in Al Khobar and supply across Saudi Arabia. No city pages were created (see below). |
| Measurement | First-party counts: product views, RFQ submissions, WhatsApp clicks, phone clicks, datasheet downloads (Admin → Reports). |

### Structured data: honest limits
* **Product rich results** (price, availability in search) need an offer with a real price. Quotation-only products have **no `offers`** (no fake price of zero), so they are valid Product markup but are not eligible for price/availability rich results. Products with a price get `Offer`/`AggregateOffer` in SAR, ex-VAT, matching the visible price.
* **Availability** is only declared (`InStock`) when the system really holds available stock; otherwise it is omitted rather than guessed.
* **No `aggregateRating` or `review`** is output, because there are no real reviews. Google's review snippets therefore cannot appear.
* **LocalBusiness** does not output opening hours, geo coordinates or a price range because they are not stored as structured data. Enter your hours in Google Business Profile.
* Rich-result eligibility is decided by Google; validate with Google's Rich Results Test after deploying (see "Needs your Google account").

### Service-area pages: deliberately not created
You supply across Saudi Arabia from one location. Pages such as "Pipes supplier Dammam", "Pipes supplier Jubail" … with only the city name changed would be thin, near-duplicate "doorway" pages. Instead, regional intent is served by the home page, the Contact page (Al Khobar / Eastern Province / Saudi Arabia) and the category pages. Create a service-area page later **only** if you can give genuinely distinct information for that area (for example a real delivery arrangement, local project references with permission, or a real branch/pick-up point).

## Admin controls
* **Products → edit → SEO tab:** SEO title and description (English and Arabic), social sharing title/description/image (choose one of the product's images), index/noindex, and a *Search result preview (approximation)*. Empty fields use generated defaults. Canonical addresses are intentionally **not** editable.
* **Products → edit → General:** URL slug (changing it creates the redirect automatically). **Images tab:** alt text in English and Arabic for each image (describe what the image shows).
* **Categories → edit:** SEO title/description (EN/AR), buying guide (EN/AR), noindex, slug.
* **Content & settings:** Arabic address, opening hours (EN/AR) shown on the Contact page, default SEO text, and the **Google Search Console verification code**.

## Needs your Google account (not possible from the website)
1. **Search Console** (free): <https://search.google.com/search-console> → Add property → "URL prefix" `https://www.kanzcorner.com`. Choose **HTML tag**, copy only the value of `content="…"`, paste it in Admin → Content & settings → *Google Search Console verification code*, save, wait a minute, then press **Verify**. (Alternative: verify the whole domain by DNS at your domain provider.)
2. In Search Console → **Sitemaps** → enter `sitemap.xml` → Submit. Then use **URL inspection** on the home page, one category and one product → *Request indexing*.
3. **Rich Results Test** (<https://search.google.com/test/rich-results>): test one priced product page and one category page; the page *Schema.org validator* (<https://validator.schema.org>) can check the LocalBusiness markup.
4. **Google Business Profile**: follow the checklist document. Verification (postcard/phone/video) can only be done by you.
5. **PageSpeed Insights** (<https://pagespeed.web.dev>): run the home page and a product page on mobile for real field data once there is enough traffic.
6. Look at Search Console → *Performance* after 4–8 weeks to see the real queries (the only honest source of keyword data).

## What was and was not verified
Verified locally (production build against a real PostgreSQL/PostgREST database and Chromium): rendered HTML, titles/descriptions, canonical, hreflang, robots meta, JSON-LD content, sitemap content, robots.txt, 404/redirect status codes (including slug-change redirects), filter/sort noindex, admin SEO fields, alt text, event tracking, mobile overflow at 390 px, accessibility scan (axe, WCAG 2.1 A/AA) on contact/category/product pages.
**Not verified:** anything that needs the live domain or your Google accounts (Search Console indexing, Rich Results Test, real-world Core Web Vitals, Google Business Profile), the non-www/http redirect on your real host (its logic is unit-tested, it is active only when `NEXT_PUBLIC_SITE_URL` is your domain), and Arabic copy quality (needs a native reviewer).
Local lab numbers are not field performance: on a local server the product page loaded in ~0.2 s with ~70 KB transferred; real figures depend on hosting and network.

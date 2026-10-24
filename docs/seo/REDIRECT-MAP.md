# Redirect map

**No indexed URL structure was changed by the SEO work**, so no bulk redirects were needed. The URL patterns are unchanged and stay stable:
`/{en|ar}`, `/{lang}/products`, `/{lang}/category/{slug}`, `/{lang}/product/{slug}`, `/{lang}/rfq`, `/{lang}/contact`, `/{lang}/about`, `/{lang}/quality`, `/{lang}/privacy`, `/{lang}/terms`.

| From | To | Type | How |
|---|---|---|---|
| `/` | `/en` or `/ar` (cookie, then browser language) | temporary (307) | `proxy.ts` — language choice depends on the visitor, so it is not permanent |
| `http://…` and non-canonical host (e.g. `kanzcorner.com` ↔ `www.kanzcorner.com`) | `https://` + host of `NEXT_PUBLIC_SITE_URL` (same path and query) | permanent (308) | `proxy.ts`, active only when the site URL is a real domain |
| `/{lang}/product/{old-slug}` after a slug change | `/{lang}/product/{new-slug}` | permanent (308) | table `slug_redirects`, filled automatically by a database trigger; chains are collapsed to one hop; returning to a previous slug removes the redirect |
| `/{lang}/category/{old-slug}` after a slug change | `/{lang}/category/{new-slug}` | permanent (308) | same mechanism |
| Trailing-slash URLs | same URL without the slash | permanent (308) | Next.js default |
| Any unknown URL | 404 page | — | real HTTP 404 |

Before changing a slug in admin, consider whether you need to: if the address has never been indexed, no redirect is needed, but one is created anyway (harmless).
Check `slug_redirects` in Supabase (Table editor) to see all current redirects. Deleting a product (rather than renaming it) returns 404; archive or unpublish only if you want the page gone.

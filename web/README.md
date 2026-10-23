# KANZ CORNER EST. — web application

Next.js 16 (App Router, TypeScript) + Tailwind CSS v4 + Supabase. Storefront at `/en` and `/ar`, admin portal at `/admin`.

* Setup for non-developers: [`../docs/nextjs/03-SETUP-GUIDE.md`](../docs/nextjs/03-SETUP-GUIDE.md)
* Architecture and schema: [`../docs/nextjs/01-ARCHITECTURE.md`](../docs/nextjs/01-ARCHITECTURE.md)
* Verification record and limitations: [`../docs/nextjs/02-STATUS.md`](../docs/nextjs/02-STATUS.md)

```bash
cp .env.example .env.local   # fill in Supabase URL + keys
npm install
npm run dev                  # http://localhost:3000
npm run lint && npm run build
npm run security:check       # API security probe (needs env + a customer test account)
```

Source map: `src/app/[lang]` storefront · `src/app/admin` portal · `src/lib/admin/*-actions.ts` server actions (each re-checks the caller's role) · `src/lib/pdf` quotation/invoice PDFs · `src/proxy.ts` locale routing + session refresh + admin redirect · `data/catalogue-import` staged catalogue extraction.

> This project uses a Next.js version with breaking changes (e.g. `middleware` is now `proxy`, async `params`). Read `node_modules/next/dist/docs/` before changing framework-level code.

#!/usr/bin/env node
/**
 * Black-box security probe for the Supabase API behind the shop.
 * It tries things a visitor or a normal customer must NOT be able to do, and reports any that succeed.
 * Read-only against real data: every write attempt is expected to be rejected (nothing is created if the rules are right).
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   SECURITY_TEST_EMAIL=customer@example.com SECURITY_TEST_PASSWORD=... node scripts/security-check.mjs
 *
 * SECURITY_TEST_* must be an ordinary CUSTOMER account (never an admin). Without it only the anonymous checks run.
 */
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_ || !ANON) { console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"); process.exit(2); }
const results = [];
const rec = (name, pass, detail = "") => { results.push({ name, pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

async function call(path, { method = "GET", token, body, headers = {} } = {}) {
  const r = await fetch(`${URL_}${path}`, { method, headers: { apikey: ANON, Authorization: `Bearer ${token ?? ANON}`, "content-type": "application/json", Prefer: "return=representation", ...headers }, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await r.json(); } catch { /* empty */ }
  return { status: r.status, json };
}
const denied = (r) => r.status >= 400 || (Array.isArray(r.json) && r.json.length === 0);
const rest = (t) => `/rest/v1/${t}`;
const PRIVATE_TABLES = ["product_costs", "variant_costs", "stock_levels", "stock_movements", "warehouses", "order_item_costs", "internal_notes", "import_batches", "import_items", "analytics_events", "audit_log"];
const OWNER_TABLES = ["orders", "order_items", "payments", "shipments", "invoices", "rfqs", "rfq_items", "rfq_events", "addresses", "profiles", "order_status_history"];
const PRIVILEGED_RPC = [["stock_apply", { p_variant: "00000000-0000-0000-0000-000000000000", p_warehouse: "00000000-0000-0000-0000-000000000000", p_type: "stock_in", p_qty: 1 }], ["staff_stock_apply", { p_variant: "00000000-0000-0000-0000-000000000000", p_warehouse: "00000000-0000-0000-0000-000000000000", p_type: "stock_in", p_qty: 1 }], ["admin_dashboard", {}], ["admin_sales_report", { p_from: "2020-01-01", p_to: "2030-01-01" }], ["admin_issue_invoice", { p_order: "00000000-0000-0000-0000-000000000000" }], ["admin_set_order_status", { p_order: "00000000-0000-0000-0000-000000000000", p_status: "completed" }], ["admin_convert_rfq", { p_rfq: "00000000-0000-0000-0000-000000000000" }]];

console.log(`\n== Anonymous visitor ==`);
for (const t of [...PRIVATE_TABLES, ...OWNER_TABLES]) { const r = await call(`${rest(t)}?select=*&limit=1`); rec(`anon cannot read ${t}`, denied(r), `status ${r.status}${Array.isArray(r.json) ? `, ${r.json.length} rows` : ""}`); }
{ const r = await call(`${rest("products")}?select=*&limit=1`); const leaks = r.json?.[0] ? Object.keys(r.json[0]).filter((k) => /cost|purchase/i.test(k)) : []; rec("public product rows expose no cost columns", leaks.length === 0, leaks.join(",")); }
{ const r = await call(`${rest("products")}?select=id&status=neq.published&limit=1`); rec("anon cannot see unpublished products", Array.isArray(r.json) ? r.json.length === 0 : true); }
{ const r = await call(`${rest("site_settings")}?select=key`); rec("anon only sees public.* settings", Array.isArray(r.json) && r.json.every((x) => x.key.startsWith("public."))); }
for (const [t, b] of [["products", { slug: "x", name_en: "x" }], ["orders", { vat_rate: 15, subtotal: 1, vat_total: 1, grand_total: 1, customer_name: "x", customer_email: "x@x.com" }], ["banners", { placement: "home_hero" }], ["site_settings", { key: "public.vat_rate", value: 0 }], ["profiles", { id: "00000000-0000-0000-0000-000000000000", role: "admin" }]]) { const r = await call(rest(t), { method: "POST", body: b }); rec(`anon cannot insert into ${t}`, r.status >= 400, `status ${r.status}`); }
for (const [t, q, b] of [["products", "?id=not.is.null", { name_en: "hacked" }], ["site_settings", "?key=eq.public.vat_rate", { value: 0 }], ["profiles", "?id=not.is.null", { role: "admin" }]]) { const r = await call(rest(t) + q, { method: "PATCH", body: b }); rec(`anon cannot update ${t}`, r.status >= 400 || (Array.isArray(r.json) && r.json.length === 0), `status ${r.status}`); }
for (const [t, b] of [["social_links", { platform: "custom", name: "x", url: "https://example.com", accessible_label: "x" }], ["certifications", { name_en: "Fake certification" }]]) { const r = await call(rest(t), { method: "POST", body: b }); rec(`anon cannot create ${t}`, r.status >= 400, `status ${r.status}`); }
{ const r = await call(`${rest("contact_widget")}?id=eq.1`, { method: "PATCH", body: { whatsapp_number: "966500000000" } }); rec("anon cannot change the WhatsApp number", r.status >= 400 || (Array.isArray(r.json) && r.json.length === 0), `status ${r.status}`); }
{ const r = await call(`${rest("products")}?id=not.is.null`, { method: "DELETE" }); rec("anon cannot delete products", r.status >= 400 || (Array.isArray(r.json) && r.json.length === 0), `status ${r.status}`); }
for (const [fn, args] of PRIVILEGED_RPC.concat([["place_order", { p_items: [], p_delivery: "pickup", p_payment: "bank_transfer" }]])) { const r = await call(`/rest/v1/rpc/${fn}`, { method: "POST", body: args }); rec(`anon cannot call ${fn}()`, r.status >= 400, `status ${r.status}`); }
{ const r = await fetch(`${URL_}/storage/v1/object/product-images/security-probe.txt`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "content-type": "text/plain" }, body: "x" }); rec("anon cannot upload to product-images", r.status >= 400, `status ${r.status}`); }
{ const r = await fetch(`${URL_}/storage/v1/object/product-mtc/probe.pdf`, { headers: { apikey: ANON } }); rec("anon cannot download private MTC bucket", r.status >= 400, `status ${r.status}`); }

const email = process.env.SECURITY_TEST_EMAIL, password = process.env.SECURITY_TEST_PASSWORD;
if (email && password) {
  console.log(`\n== Signed-in ordinary customer (${email}) ==`);
  const login = await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email, password }) }).then((r) => r.json());
  const token = login.access_token, uid = login.user?.id;
  if (!token) { rec("customer login", false, "could not sign in"); }
  else {
    const me = await call(`${rest("profiles")}?select=role&id=eq.${uid}`, { token }); rec("test account is a customer, not staff", me.json?.[0]?.role === "customer", `role=${me.json?.[0]?.role}`);
    { const r = await call(`${rest("profiles")}?id=eq.${uid}`, { method: "PATCH", token, body: { role: "admin" } }); const after = await call(`${rest("profiles")}?select=role&id=eq.${uid}`, { token }); rec("customer cannot promote themselves to admin", r.status >= 400 || after.json?.[0]?.role === "customer", `status ${r.status}, role now ${after.json?.[0]?.role}`); }
    { const r = await call(`${rest("profiles")}?select=id`, { token }); rec("customer sees only their own profile", Array.isArray(r.json) && r.json.length <= 1, `${r.json?.length} rows`); }
    for (const t of PRIVATE_TABLES) { const r = await call(`${rest(t)}?select=*&limit=1`, { token }); rec(`customer cannot read ${t}`, denied(r), `status ${r.status}`); }
    { const r = await call(`${rest("orders")}?select=user_id`, { token }); rec("customer sees only their own orders", Array.isArray(r.json) && r.json.every((o) => o.user_id === uid)); }
    { const r = await call(rest("orders"), { method: "POST", token, body: { vat_rate: 0, subtotal: 0, vat_total: 0, grand_total: 0, customer_name: "x", customer_email: "x@x.com" } }); rec("customer cannot insert an order directly (prices must come from place_order)", r.status >= 400, `status ${r.status}`); }
    { const r = await call(`${rest("orders")}?user_id=eq.${uid}`, { method: "PATCH", token, body: { payment_status: "paid" } }); rec("customer cannot mark their own order paid", r.status >= 400 || (Array.isArray(r.json) && r.json.length === 0), `status ${r.status}`); }
    for (const t of ["products", "categories", "banners", "site_settings"]) { const r = await call(`${rest(t)}?id=not.is.null`, { method: "PATCH", token, body: { name_en: "hacked", value: 0 } }); rec(`customer cannot update ${t}`, r.status >= 400 || (Array.isArray(r.json) && r.json.length === 0), `status ${r.status}`); }
    for (const [fn, args] of PRIVILEGED_RPC) { const r = await call(`/rest/v1/rpc/${fn}`, { method: "POST", token, body: args }); rec(`customer gets nothing from ${fn}()`, r.status >= 400 || (Array.isArray(r.json) && r.json.length === 0), `status ${r.status}`); }
    { const r = await fetch(`${URL_}/storage/v1/object/banners/security-probe.txt`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${token}`, "content-type": "text/plain" }, body: "x" }); rec("customer cannot upload banners", r.status >= 400, `status ${r.status}`); }
  }
} else console.log("\n(skipping customer checks: set SECURITY_TEST_EMAIL / SECURITY_TEST_PASSWORD)");

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? ` — ${failed.length} FAILED:\n  ` + failed.map((f) => f.name).join("\n  ") : ""}`);
process.exit(failed.length ? 1 : 0);

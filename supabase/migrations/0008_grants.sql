-- Explicit API privileges, so the setup does not depend on Supabase's default grants (which have changed between releases).
-- These grants only make tables *reachable*; Row Level Security (migration 0004) still decides which rows each role may see or change.
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- Functions the public storefront calls directly (everything else stays staff/authenticated-only, see 0004).
grant execute on function search_products(text,uuid,jsonb,text,text,text,int,int), product_facets(text,uuid), search_suggestions(text,int), public_best_sellers(int),
  submit_rfq(jsonb,jsonb), get_rfq_by_token(uuid), respond_rfq(uuid,boolean), track_event(text,text,text,uuid,uuid,text,text) to anon, authenticated;
grant execute on function is_staff(), is_admin(), setting_numeric(text,numeric), product_display_price(uuid), category_descendants(uuid), sku_in_use(text,uuid,uuid) to anon, authenticated;

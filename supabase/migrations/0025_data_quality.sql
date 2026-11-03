-- 0025: data-quality queue for staff. One function lists what each product is missing; staff can mark an item
-- "fine as it is" (dismissed), which hides it until undone. Additive and safe to run again.
create table if not exists data_quality_dismissed (
  product_id uuid not null references products(id) on delete cascade,
  check_code text not null,
  dismissed_by uuid references profiles(id) on delete set null,
  dismissed_at timestamptz not null default now(),
  primary key (product_id, check_code)
);
alter table data_quality_dismissed enable row level security;
drop policy if exists "dq dismissed staff" on data_quality_dismissed;
create policy "dq dismissed staff" on data_quality_dismissed for all using (is_staff()) with check (is_staff());
grant select, insert, delete on data_quality_dismissed to authenticated;

-- Checks (code · severity 1 = must fix before it misleads a buyer, 2 = should fix, 3 = nice to have):
--   unpriced      1  published, can be bought (not quote-only) but has no price on the product or any size
--   no_category   1  not in any category (cannot be found by browsing)
--   no_photo      2  no image at all (placeholder drawing shown)
--   no_name_ar    2  no Arabic name
--   thin_text     2  description and short description together under 40 characters
--   temp_photo    3  only a temporary catalogue image or drawing
--   no_brand      3  no brand / manufacturer
--   materials     3  material suggestions waiting for review
--   old_draft     3  draft not touched for 30 days
create or replace function admin_data_quality(p_include_dismissed boolean default false)
returns table (product_id uuid, slug text, name text, status text, check_code text, severity int, dismissed boolean, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'Staff only' using errcode = '42501'; end if;
  return query
  with issues as (
    select p.id, 'unpriced'::text as code, 1 as sev from products p
      where p.status = 'published' and not p.is_quote_only and p.base_price is null
        and not exists (select 1 from product_variants v where v.product_id = p.id and v.price is not null)
    union all select p.id, 'no_category', 1 from products p where p.category_id is null and p.status <> 'archived'
    union all select p.id, 'no_photo', 2 from products p where p.image_status = 'none' and p.status <> 'archived'
    union all select p.id, 'no_name_ar', 2 from products p where coalesce(btrim(p.name_ar), '') = '' and p.status <> 'archived'
    union all select p.id, 'thin_text', 2 from products p
      where length(coalesce(p.description_en, '') || coalesce(p.short_desc_en, '')) < 40 and p.status <> 'archived'
    union all select p.id, 'temp_photo', 3 from products p where p.image_status = 'temporary' and p.status <> 'archived'
    union all select p.id, 'no_brand', 3 from products p where p.brand_id is null and p.status <> 'archived'
    union all select p.id, 'materials', 3 from products p
      where exists (select 1 from product_materials m where m.product_id = p.id and m.status = 'unverified') and p.status <> 'archived'
    union all select p.id, 'old_draft', 3 from products p where p.status = 'draft' and p.updated_at < now() - interval '30 days'
  )
  select p.id, p.slug, p.name_en, p.status::text, i.code, i.sev, (d.product_id is not null), p.updated_at
  from issues i join products p on p.id = i.id
  left join data_quality_dismissed d on d.product_id = i.id and d.check_code = i.code
  where p_include_dismissed or d.product_id is null
  order by i.sev, (p.status = 'published') desc, p.name_en;
end $$;
revoke all on function admin_data_quality(boolean) from public, anon;
grant execute on function admin_data_quality(boolean) to authenticated;

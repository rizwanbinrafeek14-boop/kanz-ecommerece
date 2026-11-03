-- 0026: undo a catalogue import run. Removes only products that are still exactly as the import left them:
-- never published, still a draft, not edited afterwards (product, sizes, images, documents, materials, costs, certificates,
-- audit log) and not used anywhere (quotation requests, orders, stock, other products' related links).
-- Everything else is kept and reported with the reason. The extracted records go back to "approved" so they can be
-- imported again. Returns the storage files that no remaining row uses, for the app to delete. Additive, safe to re-run.
alter table catalogue_import_runs add column if not exists undone_at timestamptz, add column if not exists undone_by uuid references profiles(id) on delete set null;

create or replace function catalogue_undo_import(p_run uuid, p_dry_run boolean default true) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r catalogue_import_runs; t timestamptz; pid uuid; reason text; nm text;
  gone jsonb := '[]'; kept jsonb := '[]'; files jsonb := '[]'; ids uuid[] := '{}';
begin
  if not is_staff() then raise exception 'Staff only' using errcode = '42501'; end if;
  select * into r from catalogue_import_runs where id = p_run for update;
  if r.id is null then raise exception 'Import run not found'; end if;
  if r.undone_at is not null then raise exception 'This import was already undone'; end if;
  t := r.created_at;
  for pid in select (jsonb_array_elements_text(coalesce(r.summary->'product_ids', '[]')))::uuid loop
    select name_en into nm from products where id = pid;
    if nm is null then continue; end if;   -- already deleted by hand
    reason := case
      when exists (select 1 from products where id = pid and (status <> 'draft' or published_at is not null)) then 'has been published'
      when exists (select 1 from products where id = pid and updated_at > t) then 'edited after the import'
      when exists (select 1 from product_variants where product_id = pid and (updated_at > t or created_at > t)) then 'sizes edited after the import'
      when exists (select 1 from product_images where product_id = pid and (updated_at > t or created_at > t)) then 'images changed after the import'
      when exists (select 1 from product_documents where product_id = pid and created_at > t) then 'documents added after the import'
      when exists (select 1 from product_materials where product_id = pid and (updated_at > t or edited_by_admin)) then 'materials reviewed after the import'
      when exists (select 1 from product_certifications where product_id = pid) then 'certificates assigned'
      when exists (select 1 from product_costs where product_id = pid)
        or exists (select 1 from variant_costs c join product_variants v on v.id = c.variant_id where v.product_id = pid) then 'purchase costs entered'
      when exists (select 1 from audit_log a where a.created_at > t and (a.entity_id = pid::text or a.detail->'ids' ? pid::text)) then 'edited after the import'
      when exists (select 1 from rfq_items where product_id = pid) or exists (select 1 from rfq_items i join product_variants v on v.id = i.variant_id where v.product_id = pid) then 'used in a quotation request'
      when exists (select 1 from order_items where product_id = pid) or exists (select 1 from order_items i join product_variants v on v.id = i.variant_id where v.product_id = pid) then 'used in an order'
      when exists (select 1 from stock_movements m join product_variants v on v.id = m.variant_id where v.product_id = pid)
        or exists (select 1 from stock_levels s join product_variants v on v.id = s.variant_id where v.product_id = pid and (s.on_hand <> 0 or s.reserved <> 0)) then 'has stock records'
      else null end;
    if reason is null and exists (select 1 from product_relations where related_id = pid
        and product_id not in (select (jsonb_array_elements_text(coalesce(r.summary->'product_ids', '[]')))::uuid)) then reason := 'linked from another product'; end if;
    if reason is null then gone := gone || jsonb_build_object('id', pid, 'name', nm); ids := ids || pid;
    else kept := kept || jsonb_build_object('id', pid, 'name', nm, 'reason', reason); end if;
  end loop;
  if p_dry_run or cardinality(ids) = 0 then return jsonb_build_object('remove', gone, 'keep', kept, 'files', '[]'::jsonb); end if;

  -- files of the removed products, kept only if another row still uses them
  with f(bucket, path) as (
    select 'product-images', x from product_images i, unnest(array[i.storage_path, i.thumb_path, i.previous_path, i.previous_thumb_path]) x where i.product_id = any(ids) and x is not null
    union select 'product-images', drawing_path from dimension_tables where product_id = any(ids) and drawing_path is not null
    union select 'product-docs', storage_path from product_documents where product_id = any(ids) and storage_path is not null
  ) select coalesce(jsonb_agg(distinct jsonb_build_object('bucket', bucket, 'path', path)), '[]') into files from f;
  update extracted_products set status = 'approved', updated_at = now() where imported_product_id = any(ids);
  delete from products where id = any(ids);
  select coalesce(jsonb_agg(x), '[]') into files from jsonb_array_elements(files) x
    where not exists (select 1 from product_images i where x->>'path' in (i.storage_path, i.thumb_path, i.previous_path, i.previous_thumb_path))
      and not exists (select 1 from dimension_tables d where d.drawing_path = x->>'path')
      and not exists (select 1 from product_documents d where d.storage_path = x->>'path')
      and not exists (select 1 from product_families pf where pf.image_path = x->>'path');
  update catalogue_import_runs set undone_at = now(), undone_by = auth.uid(),
    summary = summary || jsonb_build_object('undo', jsonb_build_object('removed', cardinality(ids), 'kept', kept)) where id = p_run;
  return jsonb_build_object('remove', gone, 'keep', kept, 'files', files);
end $$;
revoke all on function catalogue_undo_import(uuid, boolean) from public, anon;
grant execute on function catalogue_undo_import(uuid, boolean) to authenticated;

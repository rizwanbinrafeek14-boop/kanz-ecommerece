-- Customer response to a quotation (by emailed token or while signed in). No direct table write is granted.
create or replace function respond_rfq(p_token uuid, p_accept boolean) returns text
language plpgsql security definer set search_path = public as $$
declare r rfqs%rowtype;
begin
  select * into r from rfqs where access_token = p_token for update;
  if not found then raise exception 'Quotation not found'; end if;
  if r.status <> 'quoted' then raise exception 'This quotation can no longer be changed'; end if;
  if r.quote_valid_until is not null and r.quote_valid_until < current_date then
    update rfqs set status = 'expired' where id = r.id;
    insert into rfq_events (rfq_id, event, detail) values (r.id, 'expired', 'Validity date passed');
    raise exception 'This quotation has expired; please request a new one';
  end if;
  update rfqs set status = case when p_accept then 'accepted'::rfq_status else 'rejected'::rfq_status end where id = r.id;
  insert into rfq_events (rfq_id, event, detail, actor) values (r.id, case when p_accept then 'customer_accepted' else 'customer_rejected' end, null, auth.uid());
  return case when p_accept then 'accepted' else 'rejected' end;
end $$;
grant execute on function respond_rfq(uuid, boolean) to anon, authenticated;

-- Mark overdue quotations as expired (call from a scheduled job or on admin page load).
create or replace function expire_overdue_quotations() returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  update rfqs set status = 'expired' where status = 'quoted' and quote_valid_until < current_date;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function expire_overdue_quotations() from public, anon;
grant execute on function expire_overdue_quotations() to authenticated;

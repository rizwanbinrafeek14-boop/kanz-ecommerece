-- 0024: an owner (sales person) per quotation request, for the admin list's owner / age filters and export.
-- Additive and safe to run again.
alter table rfqs
  add column if not exists assigned_to uuid references profiles(id) on delete set null,
  add column if not exists assigned_at timestamptz;
create index if not exists rfqs_assigned_idx on rfqs(assigned_to) where assigned_to is not null;
create index if not exists rfqs_status_created_idx on rfqs(status, created_at);

-- The owner must be an active staff member; assigned_at follows the owner.
create or replace function rfq_owner_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to then
    if new.assigned_to is not null and not exists (select 1 from profiles where id = new.assigned_to and is_active and role in ('staff','admin')) then
      raise exception 'The owner must be an active staff member' using errcode = '23514';
    end if;
    new.assigned_at := case when new.assigned_to is null then null else now() end;
  end if;
  return new;
end $$;
drop trigger if exists rfqs_owner_guard on rfqs;
create trigger rfqs_owner_guard before insert or update of assigned_to on rfqs for each row execute function rfq_owner_guard();

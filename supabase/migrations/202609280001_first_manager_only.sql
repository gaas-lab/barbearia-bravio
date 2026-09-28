-- Only the first manager signup may initialize a shop. Public auth metadata
-- is user supplied, so the `role = manager` claim alone is not sufficient.
create or replace function public.create_manager_shop_for_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.raw_user_meta_data->>'role' = 'manager' then
    -- Serialize concurrent signups so two requests cannot both become owner.
    perform pg_catalog.pg_advisory_xact_lock(71420831, 1);

    if not exists (select 1 from public.shops) then
      insert into public.shops(owner_id, name)
      values (
        new.id,
        coalesce(nullif(trim(new.raw_user_meta_data->>'shop_name'), ''), 'Bravio Studio')
      )
      on conflict (owner_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

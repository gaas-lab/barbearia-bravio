-- Recover the first manager's shop when an account exists but its signup trigger did not run.
-- The advisory lock and empty-shops check preserve the single-shop ownership model.
create or replace function public.ensure_manager_shop_for_current_user()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_shop_id uuid;
  v_shop_name text;
  v_user_role text;
begin
  if v_user_id is null then
    raise exception 'É necessário entrar para recuperar o acesso.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(71420831, 1);

  select id into v_shop_id
  from public.shops
  where owner_id = v_user_id;
  if v_shop_id is not null then
    return v_shop_id;
  end if;

  if exists (select 1 from public.shops) then
    raise exception 'Esta conta não é a responsável pela barbearia cadastrada.';
  end if;

  select u.raw_user_meta_data->>'role',
         coalesce(nullif(trim(u.raw_user_meta_data->>'shop_name'), ''), 'Bravio Studio')
    into v_user_role, v_shop_name
  from auth.users u
  where u.id = v_user_id;

  if v_user_role is distinct from 'manager' or v_shop_name is null then
    raise exception 'Esta conta não tem perfil de responsável pela barbearia.';
  end if;

  insert into public.shops(owner_id, name)
  values (v_user_id, v_shop_name)
  on conflict (owner_id) do update set owner_id = excluded.owner_id
  returning id into v_shop_id;

  return v_shop_id;
end;
$$;

revoke all on function public.ensure_manager_shop_for_current_user() from public;
grant execute on function public.ensure_manager_shop_for_current_user() to authenticated;


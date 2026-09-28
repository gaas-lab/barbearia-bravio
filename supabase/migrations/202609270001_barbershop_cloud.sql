-- Bravio Studio: multi-device storage with manager/barber row security.
-- Apply with "supabase db push" only after linking a Supabase project.
create extension if not exists pgcrypto;

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default 'Bravio Studio',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_barber_accounts (
  shop_id uuid not null references public.shops(id) on delete cascade,
  barber_id text not null,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (shop_id, barber_id),
  unique (shop_id, email)
);

create table if not exists public.barber_block_requests (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  barber_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  barber_name text not null,
  request_date date not null,
  starts_at time not null,
  ends_at time not null,
  reason text not null default 'Indisponível',
  status text not null default 'Pendente'
    check (status in ('Pendente', 'Aprovado', 'Recusado')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint valid_block_request_range check (ends_at > starts_at),
  constraint block_request_barber_fk
    foreign key (shop_id, barber_id)
    references public.shop_barber_accounts(shop_id, barber_id) on delete cascade
);

create index if not exists barber_block_requests_shop_status_date_idx
  on public.barber_block_requests(shop_id, status, request_date, starts_at);
create index if not exists barber_block_requests_user_created_idx
  on public.barber_block_requests(user_id, created_at desc);

alter table public.shops enable row level security;
alter table public.shop_barber_accounts enable row level security;
alter table public.barber_block_requests enable row level security;

create or replace function public.is_shop_owner(p_shop_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shops s
    where s.id = p_shop_id and s.owner_id = (select auth.uid())
  );
$$;

revoke all on function public.is_shop_owner(uuid) from public;
grant execute on function public.is_shop_owner(uuid) to authenticated;

drop policy if exists shops_owner_select on public.shops;
create policy shops_owner_select on public.shops
  for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists shops_owner_insert on public.shops;
create policy shops_owner_insert on public.shops
  for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists shops_owner_update on public.shops;
create policy shops_owner_update on public.shops
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

grant select, insert, update on public.shops to authenticated;
revoke insert on public.shops from authenticated;
revoke delete on public.shops from authenticated;

create or replace function public.create_manager_shop_for_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.raw_user_meta_data->>'role' = 'manager' then
    insert into public.shops(owner_id, name)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data->>'shop_name'), ''), 'Bravio Studio')
    )
    on conflict (owner_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists auth_user_creates_manager_shop on auth.users;
create trigger auth_user_creates_manager_shop
  after insert on auth.users
  for each row execute function public.create_manager_shop_for_new_user();

drop policy if exists barber_accounts_read_own_or_owner on public.shop_barber_accounts;
create policy barber_accounts_read_own_or_owner on public.shop_barber_accounts
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_shop_owner(shop_id));
grant select on public.shop_barber_accounts to authenticated;
revoke insert, update, delete on public.shop_barber_accounts from authenticated;

drop policy if exists block_requests_read_own_or_owner on public.barber_block_requests;
create policy block_requests_read_own_or_owner on public.barber_block_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_shop_owner(shop_id));
grant select on public.barber_block_requests to authenticated;
revoke insert, update, delete on public.barber_block_requests from authenticated;

create or replace function public.get_barber_workspace()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_account public.shop_barber_accounts%rowtype;
  v_data jsonb;
  v_barbers jsonb;
  v_appointments jsonb;
  v_withdrawals jsonb;
  v_blocks jsonb;
  v_requests jsonb;
begin
  select * into v_account
  from public.shop_barber_accounts
  where user_id = (select auth.uid()) and active = true;
  if not found then raise exception 'Acesso de barbeiro não encontrado.'; end if;

  select s.data into v_data from public.shops s where s.id = v_account.shop_id;
  select coalesce(jsonb_agg(x.value), '[]'::jsonb) into v_barbers
  from jsonb_array_elements(coalesce(v_data->'barbers', '[]'::jsonb)) x(value)
  where x.value->>'id' = v_account.barber_id;
  select coalesce(jsonb_agg(x.value), '[]'::jsonb) into v_appointments
  from jsonb_array_elements(coalesce(v_data->'appointments', '[]'::jsonb)) x(value)
  where x.value->>'barberId' = v_account.barber_id;
  select coalesce(jsonb_agg(x.value), '[]'::jsonb) into v_withdrawals
  from jsonb_array_elements(coalesce(v_data->'withdrawals', '[]'::jsonb)) x(value)
  where x.value->>'barberId' = v_account.barber_id;
  select coalesce(jsonb_agg(x.value), '[]'::jsonb) into v_blocks
  from jsonb_array_elements(coalesce(v_data->'businessBlocks', '[]'::jsonb)) x(value)
  where nullif(x.value->>'barberId', '') is null
     or x.value->>'barberId' = v_account.barber_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'barberId', r.barber_id, 'barberName', r.barber_name,
    'date', r.request_date, 'start', to_char(r.starts_at, 'HH24:MI'),
    'end', to_char(r.ends_at, 'HH24:MI'), 'reason', r.reason,
    'status', r.status, 'createdAt', r.created_at
  ) order by r.created_at desc), '[]'::jsonb) into v_requests
  from public.barber_block_requests r
  where r.user_id = (select auth.uid());

  return jsonb_build_object(
    'barbers', v_barbers,
    'appointments', v_appointments,
    'withdrawals', v_withdrawals,
    'businessBlocks', v_blocks,
    'blockRequests', v_requests,
    'businessHours', v_data->'businessHours',
    'shopName', v_data->'shopName',
    'shopLogo', v_data->'shopLogo',
    'open', v_data->'open',
    'accent', v_data->'accent',
    'dark', v_data->'dark',
    'expenses', '[]'::jsonb,
    'services', '[]'::jsonb
  );
end;
$$;

create or replace function public.submit_barber_block_request(
  p_date date, p_start time, p_end time, p_reason text
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_account public.shop_barber_accounts%rowtype;
  v_shop_data jsonb;
  v_name text;
  v_request public.barber_block_requests%rowtype;
  v_conflict boolean;
begin
  select * into v_account
  from public.shop_barber_accounts
  where user_id = (select auth.uid()) and active = true;
  if not found then raise exception 'Acesso de barbeiro não encontrado.'; end if;
  if p_end <= p_start then raise exception 'O fim precisa ser depois do início.'; end if;
  select data into v_shop_data from public.shops where id = v_account.shop_id;
  select exists (
    select 1 from jsonb_array_elements(coalesce(v_shop_data->'appointments', '[]'::jsonb)) a(value)
    where a.value->>'barberId' = v_account.barber_id
      and a.value->>'date' = p_date::text
      and (a.value->>'time')::time < p_end
      and ((a.value->>'time')::time
        + make_interval(mins => coalesce(nullif(a.value->>'duration', '')::int, 30))) > p_start
  ) or exists (
    select 1 from jsonb_array_elements(coalesce(v_shop_data->'businessBlocks', '[]'::jsonb)) b(value)
    where b.value->>'date' = p_date::text
      and (nullif(b.value->>'barberId', '') is null or b.value->>'barberId' = v_account.barber_id)
      and (b.value->>'start')::time < p_end
      and (b.value->>'end')::time > p_start
  ) into v_conflict;
  if v_conflict then raise exception 'O período conflita com um atendimento ou bloqueio existente.'; end if;
  select x.value->>'name' into v_name
  from jsonb_array_elements(coalesce(v_shop_data->'barbers', '[]'::jsonb)) x(value)
  where x.value->>'id' = v_account.barber_id;
  insert into public.barber_block_requests(
    shop_id, barber_id, user_id, barber_name, request_date, starts_at, ends_at, reason
  ) values (
    v_account.shop_id, v_account.barber_id, (select auth.uid()),
    coalesce(v_name, 'Barbeiro'), p_date, p_start, p_end,
    coalesce(nullif(trim(p_reason), ''), 'Indisponível')
  ) returning * into v_request;
  return jsonb_build_object(
    'id', v_request.id, 'barberId', v_request.barber_id,
    'barberName', v_request.barber_name, 'date', v_request.request_date,
    'start', to_char(v_request.starts_at, 'HH24:MI'),
    'end', to_char(v_request.ends_at, 'HH24:MI'),
    'reason', v_request.reason, 'status', v_request.status,
    'createdAt', v_request.created_at
  );
end;
$$;

create or replace function public.review_barber_block_request(p_request_id uuid, p_status text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_request public.barber_block_requests%rowtype;
  v_data jsonb;
  v_conflict boolean;
begin
  if p_status not in ('Aprovado', 'Recusado') then
    raise exception 'Estado de solicitação inválido.';
  end if;
  select r.* into v_request
  from public.barber_block_requests r
  where r.id = p_request_id and public.is_shop_owner(r.shop_id)
  for update;
  if not found then raise exception 'Solicitação não encontrada.'; end if;
  if v_request.status <> 'Pendente' then raise exception 'Esta solicitação já foi analisada.'; end if;

  if p_status = 'Aprovado' then
    select s.data into v_data from public.shops s where s.id = v_request.shop_id for update;
    select exists (
      select 1 from jsonb_array_elements(coalesce(v_data->'appointments', '[]'::jsonb)) a(value)
      where a.value->>'barberId' = v_request.barber_id
        and a.value->>'date' = v_request.request_date::text
        and (a.value->>'time')::time < v_request.ends_at
        and ((a.value->>'time')::time
          + make_interval(mins => coalesce(nullif(a.value->>'duration', '')::int, 30)))
          > v_request.starts_at
    ) or exists (
      select 1 from jsonb_array_elements(coalesce(v_data->'businessBlocks', '[]'::jsonb)) b(value)
      where b.value->>'date' = v_request.request_date::text
        and (nullif(b.value->>'barberId', '') is null or b.value->>'barberId' = v_request.barber_id)
        and (b.value->>'start')::time < v_request.ends_at
        and (b.value->>'end')::time > v_request.starts_at
    ) into v_conflict;
    if v_conflict then raise exception 'O período conflita com um atendimento ou bloqueio existente.'; end if;

    update public.shops
    set data = jsonb_set(
      coalesce(data, '{}'::jsonb),
      '{businessBlocks}',
      coalesce(data->'businessBlocks', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'id', v_request.id::text, 'barberId', v_request.barber_id,
        'barberName', v_request.barber_name,
        'date', v_request.request_date::text,
        'start', to_char(v_request.starts_at, 'HH24:MI'),
        'end', to_char(v_request.ends_at, 'HH24:MI'),
        'reason', v_request.reason
      ))
    ),
    updated_at = now()
    where id = v_request.shop_id;
  end if;

  update public.barber_block_requests
  set status = p_status, reviewed_at = now()
  where id = v_request.id
  returning * into v_request;
  return jsonb_build_object('id', v_request.id, 'status', v_request.status);
end;
$$;

revoke all on function public.get_barber_workspace() from public;
revoke all on function public.submit_barber_block_request(date, time, time, text) from public;
revoke all on function public.review_barber_block_request(uuid, text) from public;
grant execute on function public.get_barber_workspace() to authenticated;
grant execute on function public.submit_barber_block_request(date, time, time, text) to authenticated;
grant execute on function public.review_barber_block_request(uuid, text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.barber_block_requests;
exception when duplicate_object then null;
end $$;

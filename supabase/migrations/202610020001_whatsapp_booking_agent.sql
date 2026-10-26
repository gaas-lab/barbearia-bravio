-- Conversation memory and idempotency for the WhatsApp booking agent.
create table if not exists public.whatsapp_conversations (
  shop_id uuid not null references public.shops(id) on delete cascade,
  phone text not null,
  history jsonb not null default '[]'::jsonb,
  pending_booking jsonb,
  updated_at timestamptz not null default now(),
  primary key (shop_id, phone)
);

create table if not exists public.whatsapp_processed_messages (
  message_id text primary key,
  processed_at timestamptz not null default now()
);

alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_processed_messages enable row level security;
revoke all on public.whatsapp_conversations from anon, authenticated;
revoke all on public.whatsapp_processed_messages from anon, authenticated;
grant all on public.whatsapp_conversations to service_role;
grant all on public.whatsapp_processed_messages to service_role;

-- Build appointments in the database from the current catalog and atomically
-- append them to shops.data, preserving the app's existing source of truth.
create or replace function public.create_whatsapp_appointment(
  p_shop_id uuid,
  p_phone text,
  p_client text,
  p_date date,
  p_time time,
  p_barber_id text,
  p_service_ids jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_data jsonb;
  v_barber jsonb;
  v_services jsonb;
  v_service_ids text[];
  v_duration integer;
  v_total numeric;
  v_end time;
  v_hours jsonb;
  v_appointment jsonb;
  v_conflict boolean;
begin
  if p_client is null or length(trim(p_client)) < 2 or p_phone !~ '^[0-9]{8,15}$' then
    raise exception 'Dados do cliente inválidos.';
  end if;
  if p_date < (now() at time zone 'America/Sao_Paulo')::date
     or p_date > (now() at time zone 'America/Sao_Paulo')::date + 90 then
    raise exception 'Escolha uma data nos próximos 90 dias.';
  end if;
  if extract(second from p_time) <> 0 or extract(minute from p_time)::integer not in (0, 30) then
    raise exception 'Escolha um horário em intervalos de 30 minutos.';
  end if;
  if jsonb_typeof(p_service_ids) <> 'array' or jsonb_array_length(p_service_ids) = 0 then
    raise exception 'Selecione ao menos um serviço.';
  end if;

  select s.data into v_data from public.shops s where s.id = p_shop_id for update;
  if not found then raise exception 'Barbearia não encontrada.'; end if;
  if coalesce((v_data->>'open')::boolean, true) is false then raise exception 'A agenda está fechada.'; end if;

  select b.value into v_barber
  from jsonb_array_elements(coalesce(v_data->'barbers', '[]'::jsonb)) b(value)
  where b.value->>'id' = p_barber_id;
  if v_barber is null then raise exception 'Barbeiro não encontrado.'; end if;

  select coalesce(array_agg(distinct value), array[]::text[])
    into v_service_ids from jsonb_array_elements_text(p_service_ids);
  if cardinality(v_service_ids) <> jsonb_array_length(p_service_ids) then
    raise exception 'Serviços repetidos.';
  end if;
  select jsonb_agg(s.value), sum((s.value->>'duration')::integer), sum((s.value->>'price')::numeric)
    into v_services, v_duration, v_total
  from jsonb_array_elements(coalesce(v_data->'services', '[]'::jsonb)) s(value)
  where s.value->>'id' = any(v_service_ids);
  if jsonb_array_length(coalesce(v_services, '[]'::jsonb)) <> cardinality(v_service_ids) then
    raise exception 'Um serviço selecionado não está mais disponível.';
  end if;
  v_duration := greatest(coalesce(v_duration, 30), 30);
  v_end := p_time + make_interval(mins => v_duration);

  select h.value into v_hours
  from jsonb_array_elements(coalesce(v_data->'businessHours', '[]'::jsonb)) h(value)
  where (h.value->>'day')::integer = extract(dow from p_date)::integer;
  if v_hours is null or coalesce((v_hours->>'isOpen')::boolean, false) is false
     or p_time < (v_hours->>'open')::time or v_end > (v_hours->>'close')::time then
    raise exception 'Esse horário está fora do funcionamento da barbearia.';
  end if;

  select exists (
    select 1 from jsonb_array_elements(coalesce(v_data->'appointments', '[]'::jsonb)) a(value)
    where a.value->>'date' = p_date::text and a.value->>'barberId' = p_barber_id
      and (a.value->>'time')::time < v_end
      and ((a.value->>'time')::time + make_interval(mins => coalesce(nullif(a.value->>'duration','')::integer,30))) > p_time
  ) or exists (
    select 1 from jsonb_array_elements(coalesce(v_data->'businessBlocks', '[]'::jsonb)) b(value)
    where b.value->>'date' = p_date::text
      and (nullif(b.value->>'barberId','') is null or b.value->>'barberId' = p_barber_id)
      and (b.value->>'start')::time < v_end and (b.value->>'end')::time > p_time
  ) into v_conflict;
  if v_conflict then raise exception 'Esse horário acabou de ficar indisponível. Consulte outro horário.'; end if;

  v_appointment := jsonb_build_object(
    'id', gen_random_uuid()::text, 'client', trim(p_client), 'phone', p_phone,
    'barberId', p_barber_id, 'barberName', v_barber->>'name',
    'barberColor', v_barber->>'color', 'barberPhoto', v_barber->>'photo',
    'date', p_date::text, 'time', to_char(p_time, 'HH24:MI'),
    'services', (select jsonb_agg(s.value->>'name') from jsonb_array_elements(v_services) s(value)),
    'subtotal', v_total, 'discount', 0, 'total', v_total, 'duration', v_duration,
    'status', 'Agendado', 'source', 'whatsapp', 'createdAt', now()
  );
  update public.shops
    set data = jsonb_set(v_data, '{appointments}',
      coalesce(v_data->'appointments', '[]'::jsonb) || jsonb_build_array(v_appointment), true),
      updated_at = now()
    where id = p_shop_id;
  return v_appointment;
end;
$$;

revoke all on function public.create_whatsapp_appointment(uuid,text,text,date,time,text,jsonb) from public, anon, authenticated;
grant execute on function public.create_whatsapp_appointment(uuid,text,text,date,time,text,jsonb) to service_role;

-- The browser still saves the whole workspace JSON. Preserve bot bookings if
-- a stale browser snapshot is saved after the webhook wrote to that JSON.
create or replace function public.preserve_whatsapp_appointments()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_appointments jsonb;
begin
  select coalesce(jsonb_agg(old_item.value), '[]'::jsonb) into v_appointments
  from jsonb_array_elements(coalesce(old.data->'appointments', '[]'::jsonb)) old_item(value)
  where old_item.value->>'source' = 'whatsapp'
    and not exists (
      select 1 from jsonb_array_elements(coalesce(new.data->'appointments', '[]'::jsonb)) new_item(value)
      where new_item.value->>'id' = old_item.value->>'id'
    );
  if jsonb_array_length(coalesce(v_appointments, '[]'::jsonb)) > 0 then
    new.data := jsonb_set(new.data, '{appointments}',
      coalesce(new.data->'appointments', '[]'::jsonb) || v_appointments, true);
  end if;
  return new;
end;
$$;

drop trigger if exists preserve_whatsapp_appointments_on_shop_save on public.shops;
create trigger preserve_whatsapp_appointments_on_shop_save
  before update of data on public.shops
  for each row execute function public.preserve_whatsapp_appointments();

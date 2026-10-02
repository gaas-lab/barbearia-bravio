import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const encoder = new TextEncoder();
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

async function validSignature(rawBody: string, header: string | null, secret: string) {
  if (!header?.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody)));
  const expected = 'sha256=' + [...digest].map(value => value.toString(16).padStart(2, '0')).join('');
  if (expected.length !== header.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index++) difference |= expected.charCodeAt(index) ^ header.charCodeAt(index);
  return difference === 0;
}

function toMinutes(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

function dateWeekday(isoDate: string) {
  return new Date(`${isoDate}T12:00:00-03:00`).getDay();
}

function saoPauloToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function availableSlots(data: Record<string, any>, date: string, serviceIds: string[], barberId?: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Informe a data no formato AAAA-MM-DD.');
  const today = new Date(`${saoPauloToday()}T12:00:00-03:00`).getTime();
  const selectedDate = new Date(`${date}T12:00:00-03:00`).getTime();
  if (selectedDate < today || selectedDate > today + 90 * 24 * 60 * 60 * 1000) throw new Error('Consulte uma data entre hoje e os próximos 90 dias.');
  const services = (data.services ?? []).filter((item: any) => serviceIds.includes(item.id));
  if (!serviceIds.length || services.length !== new Set(serviceIds).size) throw new Error('Um ou mais serviços não foram encontrados.');
  const duration = Math.max(30, services.reduce((sum: number, item: any) => sum + Number(item.duration || 0), 0));
  const hours = (data.businessHours ?? []).find((item: any) => Number(item.day) === dateWeekday(date));
  if (data.open === false || !hours?.isOpen) return [];
  const from = toMinutes(hours.open);
  const until = toMinutes(hours.close);
  const eligibleBarbers = (data.barbers ?? []).filter((barber: any) => !barberId || barber.id === barberId);
  const slots = [];
  for (const barber of eligibleBarbers) {
    for (let start = from; start + duration <= until; start += 30) {
      const end = start + duration;
      const busy = (data.appointments ?? []).some((item: any) => item.date === date && item.barberId === barber.id && start < toMinutes(item.time) + Number(item.duration || 30) && toMinutes(item.time) < end);
      const blocked = (data.businessBlocks ?? []).some((item: any) => item.date === date && (!item.barberId || item.barberId === barber.id) && start < toMinutes(item.end) && toMinutes(item.start) < end);
      if (!busy && !blocked) slots.push({ barberId: barber.id, barberName: barber.name, time: `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}` });
    }
  }
  return slots.slice(0, 24);
}

const tools = [
  {
    type: 'function', name: 'list_catalog', description: 'Lista serviços ativos, preços, duração e barbeiros cadastrados. Use para responder dúvidas do cliente.',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false }, strict: true,
  },
  {
    type: 'function', name: 'find_available_slots', description: 'Consulta a agenda para uma data, serviços e opcionalmente um barbeiro. Sempre consulte antes de oferecer horários.',
    parameters: { type: 'object', properties: { date: { type: 'string', description: 'Data em AAAA-MM-DD' }, service_ids: { type: 'array', items: { type: 'string' } }, barber_id: { type: ['string', 'null'] } }, required: ['date', 'service_ids', 'barber_id'], additionalProperties: false }, strict: true,
  },
  {
    type: 'function', name: 'prepare_booking', description: 'Prepara um resumo para confirmação. Use quando já tiver nome, serviço, barbeiro, data e horário escolhidos. Isso NÃO cria a reserva; o cliente precisa confirmar em uma mensagem separada.',
    parameters: { type: 'object', properties: { client_name: { type: 'string' }, date: { type: 'string' }, time: { type: 'string' }, barber_id: { type: 'string' }, service_ids: { type: 'array', items: { type: 'string' } } }, required: ['client_name', 'date', 'time', 'barber_id', 'service_ids'], additionalProperties: false }, strict: true,
  },
];

async function callModel(apiKey: string, model: string, input: unknown[], shopName: string) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, store: false, instructions: `Você é o atendente virtual da barbearia ${shopName}. Converse em português brasileiro, com simpatia e objetividade. Ajude a marcar atendimentos. Use as ferramentas para consultar o catálogo e a agenda; nunca invente serviços, preços, barbeiros nem horários. Datas e horários são do fuso America/Sao_Paulo. Antes de reservar, colete o nome completo. Quando tiver todos os dados, chame prepare_booking para validar o horário e montar o resumo. Essa ferramenta não reserva: diga serviço(s), barbeiro, data, hora e preço retornados e peça confirmação explícita. A confirmação acontece depois, em outra mensagem do cliente. Não diga que está marcado até receber a confirmação final. Se não houver horário, ofereça opções reais retornadas pela consulta. Se o cliente pedir uma pessoa, diga que a transferência automática para um atendente ainda não está disponível e sugira que entre em contato diretamente com a barbearia.`, input, tools }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message || 'Falha ao consultar o atendente virtual.');
  return result;
}

function textFromResponse(response: any) {
  return (response.output ?? []).filter((item: any) => item.type === 'message')
    .flatMap((item: any) => item.content ?? []).filter((part: any) => part.type === 'output_text')
    .map((part: any) => part.text).join('\n').trim();
}

async function runAssistant(admin: any, shopId: string, phone: string, body: string) {
  const openAiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAiKey) throw new Error('O atendente virtual ainda não está configurado.');
  const model = Deno.env.get('OPENAI_MODEL') || 'gpt-5-mini';
  const { data: shop, error: shopError } = await admin.from('shops').select('name, data').eq('id', shopId).maybeSingle();
  if (shopError || !shop) throw new Error('Barbearia não encontrada.');
  const { data: conversation } = await admin.from('whatsapp_conversations').select('history, pending_booking').eq('shop_id', shopId).eq('phone', phone).maybeSingle();
  const history = Array.isArray(conversation?.history) ? conversation.history : [];
  let pendingBooking = conversation?.pending_booking ?? null;
  const normalizedBody = body.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
  const explicitYes = /^(sim|confirmo|pode marcar|pode confirmar|fechado|isso mesmo|ok|okay|beleza|com certeza)[.!\s]*$/i.test(normalizedBody);
  const explicitNo = /^(nao|cancela|melhor nao|nao quero|desisto)[.!\s]*$/i.test(normalizedBody);
  if (pendingBooking && explicitYes) {
    const { data, error } = await admin.rpc('create_whatsapp_appointment', {
      p_shop_id: shopId, p_phone: phone, p_client: pendingBooking.client_name, p_date: pendingBooking.date,
      p_time: pendingBooking.time, p_barber_id: pendingBooking.barber_id, p_service_ids: pendingBooking.service_ids,
    });
    const reply = error
      ? 'Esse horário acabou de ficar indisponível. Não registrei a reserva. Quer que eu consulte outros horários?'
      : `Prontinho, ${data.client}! Seu horário está marcado para ${data.date} às ${data.time} com ${data.barberName}. Serviço: ${data.services.join(', ')} · ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(data.total))}.`;
    const nextHistory = [...history, { role: 'user', content: body }, { role: 'assistant', content: reply }].slice(-20);
    await admin.from('whatsapp_conversations').upsert({ shop_id: shopId, phone, history: nextHistory, pending_booking: null, updated_at: new Date().toISOString() });
    return reply;
  }
  if (pendingBooking && explicitNo) pendingBooking = null;
  let response = await callModel(openAiKey, model, [...history.slice(-16), { role: 'user', content: body }], shop.name || 'Bravio Studio');

  for (let iteration = 0; iteration < 5; iteration++) {
    const calls = (response.output ?? []).filter((item: any) => item.type === 'function_call');
    if (!calls.length) break;
    const outputs = [];
    for (const call of calls) {
      const args = JSON.parse(call.arguments || '{}');
      let result: unknown;
      if (call.name === 'list_catalog') {
        result = { services: (shop.data.services ?? []).map((item: any) => ({ id: item.id, name: item.name, price: item.price, duration: item.duration })), barbers: (shop.data.barbers ?? []).map((item: any) => ({ id: item.id, name: item.name })), open: shop.data.open !== false };
      } else if (call.name === 'find_available_slots') {
        result = availableSlots(shop.data, args.date, args.service_ids, args.barber_id ?? undefined);
      } else if (call.name === 'prepare_booking') {
        const slot = availableSlots(shop.data, args.date, args.service_ids, args.barber_id)
          .find((item: any) => item.time === args.time && item.barberId === args.barber_id);
        if (!slot) {
          result = { ready: false, error: 'Esse horário não está livre. Consulte novamente a agenda antes de oferecer opções.' };
        } else {
          pendingBooking = { client_name: args.client_name, date: args.date, time: args.time, barber_id: args.barber_id, service_ids: args.service_ids };
          result = { ready: true, appointment_will_only_be_created_after_client_confirms: true, client_name: args.client_name, date: args.date, time: args.time, barber: slot.barberName, services: args.service_ids.map((id: string) => (shop.data.services ?? []).find((service: any) => service.id === id)).filter(Boolean).map((service: any) => ({ name: service.name, price: service.price, duration: service.duration })) };
        }
      } else result = { error: 'Ferramenta não disponível.' };
      outputs.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) });
    }
    response = await callModel(openAiKey, model, [...(response.output ?? []), ...outputs], shop.name || 'Bravio Studio');
  }

  const reply = textFromResponse(response) || 'Desculpe, não consegui concluir. Vou chamar alguém da equipe para continuar o atendimento.';
  const nextHistory = [...history, { role: 'user', content: body }, { role: 'assistant', content: reply }].slice(-20);
  const { error: saveError } = await admin.from('whatsapp_conversations').upsert({ shop_id: shopId, phone, history: nextHistory, pending_booking: pendingBooking, updated_at: new Date().toISOString() });
  if (saveError) console.error('conversation save:', saveError.message);
  return reply;
}

async function sendWhatsApp(phone: string, message: string) {
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const graphVersion = Deno.env.get('WHATSAPP_GRAPH_VERSION') || 'v23.0';
  if (!accessToken || !phoneNumberId) throw new Error('WhatsApp Cloud API ainda não está configurada.');
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: phone, type: 'text', text: { preview_url: false, body: message.slice(0, 4000) } }),
  });
  if (!response.ok) throw new Error(`WhatsApp API respondeu ${response.status}: ${await response.text()}`);
}

async function processWebhook(rawBody: string, admin: any, shopId: string) {
  const payload = JSON.parse(rawBody);
  const expectedPhoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (expectedPhoneNumberId && String(change.value?.metadata?.phone_number_id) !== expectedPhoneNumberId) continue;
      for (const message of change.value?.messages ?? []) {
        if (!message.id || !message.from || message.type !== 'text' || !message.text?.body) continue;
        const { error: dedupeError } = await admin.from('whatsapp_processed_messages').insert({ message_id: message.id });
        if (dedupeError?.code === '23505') continue;
        if (dedupeError) throw dedupeError;
        const reply = await runAssistant(admin, shopId, String(message.from).replace(/\D/g, ''), String(message.text.body).slice(0, 2000));
        await sendWhatsApp(String(message.from).replace(/\D/g, ''), reply);
      }
    }
  }
}

Deno.serve(async request => {
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token && token === Deno.env.get('WHATSAPP_VERIFY_TOKEN') && challenge) return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    return new Response('Verificação inválida.', { status: 403 });
  }
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const appSecret = Deno.env.get('WHATSAPP_APP_SECRET');
  const shopId = Deno.env.get('BRAVIO_SHOP_ID');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!appSecret || !shopId || !supabaseUrl || !serviceRoleKey) return json({ error: 'Configuração incompleta da integração.' }, 500);
  const rawBody = await request.text();
  if (!await validSignature(rawBody, request.headers.get('x-hub-signature-256'), appSecret)) return json({ error: 'Assinatura inválida.' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const work = processWebhook(rawBody, admin, shopId).catch(error => console.error('whatsapp-booking-agent:', error));
    // Supabase Edge Runtime keeps this work alive after acknowledging the webhook.
    // @ts-ignore Deno Deploy exposes EdgeRuntime at runtime.
    EdgeRuntime.waitUntil(work);
    return json({ received: true });
  } catch (error) {
    console.error('whatsapp-booking-agent:', error);
    return json({ error: 'Não foi possível processar a mensagem.' }, 500);
  }
});

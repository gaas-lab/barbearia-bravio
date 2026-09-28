import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function defaultKeyFromMap(name: string) {
  try {
    const keys = JSON.parse(Deno.env.get(name) ?? '{}');
    return keys.default ?? Object.values(keys)[0] ?? '';
  } catch {
    return '';
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') {
    return Response.json({ error: 'Método não permitido.' }, { status: 405, headers: corsHeaders });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? defaultKeyFromMap('SUPABASE_PUBLISHABLE_KEYS');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? defaultKeyFromMap('SUPABASE_SECRET_KEYS');
  const authorization = request.headers.get('Authorization');
  if (!url || !anonKey || !serviceRoleKey || !authorization) {
    return Response.json({ error: 'Configuração de autenticação incompleta.' }, { status: 500, headers: corsHeaders });
  }

  const caller = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const token = authorization.replace(/^Bearer\s+/i, '');
    const { data: { user }, error: userError } = await caller.auth.getUser(token);
    if (userError || !user) {
      return Response.json({ error: 'Sessão inválida.' }, { status: 401, headers: corsHeaders });
    }

    const body = await request.json();
    const action = String(body.action ?? 'save');
    const shopId = String(body.shop_id ?? '');
    const barberId = String(body.barber_id ?? '');
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    if (!shopId || !barberId || !email) {
      return Response.json({ error: 'Informe a barbearia, o barbeiro e o e-mail.' }, { status: 400, headers: corsHeaders });
    }
    if (action !== 'invite' && action !== 'save') {
      return Response.json({ error: 'Ação inválida.' }, { status: 400, headers: corsHeaders });
    }
    if (action !== 'invite' && password && password.length < 8) {
      return Response.json({ error: 'A senha precisa ter pelo menos 8 caracteres.' }, { status: 400, headers: corsHeaders });
    }

    const { data: shop, error: shopError } = await admin
      .from('shops').select('id, data').eq('id', shopId).eq('owner_id', user.id).maybeSingle();
    if (shopError || !shop) {
      return Response.json({ error: 'Apenas o gerente desta barbearia pode gerenciar acessos.' }, { status: 403, headers: corsHeaders });
    }
    if (!(shop.data?.barbers ?? []).some((barber: { id?: string }) => barber.id === barberId)) {
      return Response.json({ error: 'Cadastre o perfil do barbeiro antes de enviar o convite.' }, { status: 404, headers: corsHeaders });
    }

    const { data: existing, error: accountError } = await admin
      .from('shop_barber_accounts')
      .select('user_id')
      .eq('shop_id', shopId)
      .eq('barber_id', barberId)
      .maybeSingle();
    if (accountError) throw accountError;

    let userId = existing?.user_id;
    if (action === 'invite') {
      if (existing?.user_id) {
        return Response.json({ error: 'Este barbeiro já tem acesso. Edite o perfil para atualizar os dados de acesso.' }, { status: 409, headers: corsHeaders });
      }
      const redirectTo = Deno.env.get('APP_URL') ?? Deno.env.get('APP_ORIGIN');
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { role: 'barber', barber_id: barberId, shop_id: shopId, invite_pending: true },
        ...(redirectTo ? { redirectTo } : {}),
      });
      if (error || !data.user) throw error ?? new Error('Não foi possível enviar o convite.');
      userId = data.user.id;
    } else if (userId) {
      const changes: { email: string; password?: string; email_confirm?: boolean } = {
        email,
        email_confirm: true,
      };
      if (password) changes.password = password;
      const { error } = await admin.auth.admin.updateUserById(userId, changes);
      if (error) throw error;
    } else {
      if (!password) {
        return Response.json({ error: 'Defina uma senha inicial para o barbeiro.' }, { status: 400, headers: corsHeaders });
      }
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: 'barber', barber_id: barberId, shop_id: shopId },
      });
      if (error || !data.user) throw error ?? new Error('Não foi possível criar a conta.');
      userId = data.user.id;
    }

    const { error: linkError } = await admin.from('shop_barber_accounts').upsert({
      shop_id: shopId,
      barber_id: barberId,
      user_id: userId,
      email,
      active: true,
    }, { onConflict: 'shop_id,barber_id' });
    if (linkError) {
      if (!existing && userId) await admin.auth.admin.deleteUser(userId);
      throw linkError;
    }

    return Response.json({ ok: true, user_id: userId }, { headers: corsHeaders });
  } catch (error) {
    console.error('manage-barber-account:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Falha ao salvar o acesso.' },
      { status: 500, headers: corsHeaders },
    );
  }
});

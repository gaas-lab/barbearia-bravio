import { cloudEnabled, supabase } from './supabase.js';

export { cloudEnabled, supabase };

export function cloudSafeWorkspace(data) {
  const { blockRequests, ...workspace } = data;
  return {
    ...workspace,
    barbers: (workspace.barbers || []).map(({ access, ...barber }) => barber),
  };
}

export async function getManagerShop(userId) {
  const { data, error } = await supabase
    .from('shops')
    .select('id, owner_id, name, data')
    .eq('owner_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveManagerWorkspace(shopId, workspace) {
  const safe = cloudSafeWorkspace(workspace);
  const { error } = await supabase
    .from('shops')
    .update({
      name: safe.shopName || 'Bravio Studio',
      data: safe,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shopId);
  if (error) throw error;
}

export async function getBarberAccount(userId) {
  const { data, error } = await supabase
    .from('shop_barber_accounts')
    .select('shop_id, barber_id, email, active')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getBarberWorkspace() {
  const { data, error } = await supabase.rpc('get_barber_workspace');
  if (error) throw error;
  return data;
}

export async function fetchBlockRequests(shopId) {
  const { data, error } = await supabase
    .from('barber_block_requests')
    .select('id, barber_id, barber_name, request_date, starts_at, ends_at, reason, status, created_at')
    .eq('shop_id', shopId)
    .order('request_date')
    .order('starts_at');
  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    barberId: row.barber_id,
    barberName: row.barber_name,
    date: row.request_date,
    start: String(row.starts_at).slice(0, 5),
    end: String(row.ends_at).slice(0, 5),
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function submitCloudBlockRequest({ date, start, end, reason }) {
  const { data, error } = await supabase.rpc('submit_barber_block_request', {
    p_date: date,
    p_start: start,
    p_end: end,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function reviewCloudBlockRequest(id, status) {
  const { data, error } = await supabase.rpc('review_barber_block_request', {
    p_request_id: id,
    p_status: status,
  });
  if (error) throw error;
  return data;
}

export function watchBlockRequests(shopId, onChange) {
  return supabase
    .channel('manager-block-requests-' + shopId)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'barber_block_requests',
      filter: 'shop_id=eq.' + shopId,
    }, onChange)
    .subscribe();
}

export async function saveCloudBarberAccount({ shopId, barberId, email, password, invite = false }) {
  const { data, error } = await supabase.functions.invoke('manage-barber-account', {
    body: {
      action: invite ? 'invite' : 'save',
      shop_id: shopId,
      barber_id: barberId,
      email,
      password: password || undefined,
    },
  });
  if (error) throw error;
  return data;
}

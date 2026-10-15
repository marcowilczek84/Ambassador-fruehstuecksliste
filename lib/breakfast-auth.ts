import { createClient } from '@supabase/supabase-js';

// Public project key. This branch is deliberately bound to isolated STAGING.
const url = 'https://jeuvmhahanaulvrnasgq.supabase.co';
const key = "sb_publishable_KS7md2SjQvezRHw4aVdxQw_siwqo2E5";

export async function requireReception(request: Request): Promise<boolean> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return false;
  const client = createClient(url, key, {
    global: {headers: {Authorization: authorization}},
    auth: {persistSession: false, autoRefreshToken: false},
  });
  // PostgREST verifies the signature; the RPC checks the live Auth session,
  // current membership, device approval and administrator MFA.
  const {data, error} = await client.rpc('bf41_context', {p_label: 'Browser'});
  return !error && data?.status === 'ready' && ['reception', 'admin'].includes(data.role);
}

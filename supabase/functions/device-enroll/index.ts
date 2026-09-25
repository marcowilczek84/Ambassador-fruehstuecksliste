// One-time device enrollment. Deploy ONLY in the separate staging project first.
// Service credentials stay in the Edge Function environment, never in the browser.
import { createClient } from 'npm:@supabase/supabase-js@2.57.0';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const publicKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const admin = createClient(url, serviceKey, {auth:{persistSession:false}});
const auth = createClient(url, publicKey, {auth:{persistSession:false}});
const cors = {
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'apikey, authorization, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Cache-Control':'no-store',
  'Content-Type':'application/json',
};
const reply = (status:number, body:unknown) => new Response(JSON.stringify(body), {status,headers:cors});

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:cors});
  if (request.method !== 'POST') return reply(405,{error:'Methode nicht erlaubt'});
  const input = await request.json().catch(()=>null);
  const code = typeof input?.code === 'string' ? input.code.trim().toLowerCase() : '';
  if (!/^[a-f0-9]{32}$/.test(code)) return reply(400,{error:'Code ungültig oder abgelaufen'});

  // A single UPDATE atomically consumes the code. Invalid codes create no users.
  const {data:claim,error:claimError}=await admin.rpc('gm_claim_device_code',{p_code:code});
  if (claimError || !claim?.length) return reply(400,{error:'Code ungültig oder abgelaufen'});

  const email=`${crypto.randomUUID()}@devices.staging.invalid`;
  const password=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
  const {data:created,error:createError}=await admin.auth.admin.createUser({
    email,password,email_confirm:true,app_metadata:{hotel_device:true}
  });
  if (createError || !created.user) return reply(503,{error:'Gerät konnte nicht freigeschaltet werden'});

  const {error:bindError}=await admin.rpc('gm_bind_device',{
    p_code_id:claim[0].code_id,p_user:created.user.id
  });
  if (bindError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return reply(503,{error:'Gerät konnte nicht freigeschaltet werden'});
  }
  const {data:login,error:loginError}=await auth.auth.signInWithPassword({email,password});
  if (loginError || !login.session) {
    await admin.from('gm_devices').update({revoked_at:new Date().toISOString()}).eq('user_id',created.user.id);
    return reply(503,{error:'Gerät konnte nicht freigeschaltet werden'});
  }
  return reply(200,{
    access_token:login.session.access_token,
    refresh_token:login.session.refresh_token,
    expires_at:login.session.expires_at,
    expires_in:login.session.expires_in,
  });
});

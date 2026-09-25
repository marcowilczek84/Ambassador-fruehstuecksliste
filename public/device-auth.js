/* Staging device pairing; all data requests use a server-verified device session. */
(() => {
  'use strict';
  const base=window.__AMBASSADOR_STAGING_URL__;
  const key=window.__AMBASSADOR_STAGING_KEY__;
  if (base!=='https://jeuvmhahanaulvrnasgq.supabase.co' || !key) return;
  const storageKey='ambassador-staging-device-session-v1';
  const nativeFetch=window.fetch.bind(window);
  let session=null,ready=false,verifying=null;
  document.documentElement.dataset.deviceGate='pending';
  try { session=JSON.parse(localStorage.getItem(storageKey)||'null'); } catch {}

  function clear() {
    session=null;ready=false;
    localStorage.removeItem(storageKey);
    // A revoked device must not continue displaying a stale guest list.
    for (const name of Object.keys(localStorage)) if (
      name.startsWith('ambassador-breakfast-') || name.startsWith('ambassador-guest-') || name.startsWith('ambassador-gm-')
    ) localStorage.removeItem(name);
    document.documentElement.dataset.deviceGate='pending';
    document.getElementById('device-pair-overlay')?.remove();
    show();
  }
  function persist(data) {
    session={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:data.expires_at};
    localStorage.setItem(storageKey,JSON.stringify(session));
  }
  async function token() {
    if (!session?.refresh_token) return null;
    if ((session.expires_at||0)*1000>Date.now()+30000) return session.access_token;
    const response=await nativeFetch(`${base}/auth/v1/token?grant_type=refresh_token`,{
      method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
      body:JSON.stringify({refresh_token:session.refresh_token}),cache:'no-store'
    });
    if (!response.ok) {
      if (response.status===400 || response.status===401) clear();
      throw Error('Verbindung zur Gerätesession fehlgeschlagen');
    }
    const data=await response.json();
    persist({...data,expires_at:data.expires_at||Math.floor(Date.now()/1000)+data.expires_in});
    return session.access_token;
  }
  async function verify() {
    if (verifying) return verifying;
    verifying=(async()=>{
      try {
        const access=await token();
        if (!access) {clear();return false;}
        const response=await nativeFetch(`${base}/rest/v1/rpc/gm_device_status`,{
          method:'POST',headers:{apikey:key,Authorization:`Bearer ${access}`,'Content-Type':'application/json'},
          body:'{}',cache:'no-store'
        });
        if (response.status===401 || response.status===403) {clear();return false;}
        if (!response.ok) throw Error('Verbindung zur Geräteprüfung fehlgeschlagen');
        if (await response.json()!==true) {clear();return false;}
        ready=true;document.documentElement.dataset.deviceGate='ready';
        document.getElementById('device-pair-overlay')?.remove();
        return true;
      } catch {
        // Offline and temporary API errors must never destroy a paired device.
        ready=false;document.documentElement.dataset.deviceGate='pending';show();return false;
      }
    })().finally(()=>{verifying=null;});
    return verifying;
  }
  async function enroll(code) {
    const response=await nativeFetch(`${base}/functions/v1/device-enroll`,{
      method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
      body:JSON.stringify({code}),cache:'no-store'
    });
    const data=await response.json().catch(()=>({}));
    if (!response.ok) throw Error(data.error||'Code ungültig oder abgelaufen');
    persist(data);
    if (!await verify()) throw Error('Gerät konnte nicht freigeschaltet werden');
  }
  function show() {
    if (!document.body || ready || document.getElementById('device-pair-overlay')) return;
    const layer=document.createElement('div');layer.id='device-pair-overlay';
    if (session) {
      layer.innerHTML='<div class="device-pair-card"><img src="/ambassador-logo.svg" alt="Ambassador Hotel Zürich"><h1>Verbindung wird geprüft</h1><p>Die Freischaltung dieses Geräts wird überprüft.</p><button type="button">Erneut prüfen</button></div>';
      document.body.append(layer);
      layer.querySelector('button').onclick=()=>verify();
      return;
    }
    layer.innerHTML=`<form class="device-pair-card"><img src="/ambassador-logo.svg" alt="Ambassador Hotel Zürich">
      <h1>Gerät freischalten</h1><p>Einmaligen Freischaltcode für dieses Hotelgerät eingeben.</p>
      <label>Code<input name="code" required autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="32"></label>
      <button type="submit">Gerät freischalten</button><p role="alert" class="device-pair-error"></p></form>`;
    document.body.append(layer);
    layer.querySelector('form').onsubmit=async event=>{
      event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');
      button.disabled=true;
      try { await enroll(form.elements.code.value); }
      catch(error) {form.querySelector('.device-pair-error').textContent=error.message;}
      finally {button.disabled=false;}
    };
  }
  window.__AMBASSADOR_DEVICE_AUTH__={
    isReady:()=>ready,getSession:()=>session,token,verify,enroll
  };

  // All existing direct REST calls from the recovered breakfast app are now
  // authenticated. The public publishable key alone cannot read guest data.
  window.fetch=async(input,options={})=>{
    const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
    if (!url.startsWith(`${base}/rest/v1/`)) return nativeFetch(input,options);
    const access=ready?await token():null;
    if (!access) return new Response('{"message":"Gerät nicht freigeschaltet"}',{
      status:403,headers:{'content-type':'application/json'}
    });
    const headers=new Headers(input instanceof Request?input.headers:undefined);
    new Headers(options.headers).forEach((value,name)=>headers.set(name,value));
    headers.set('Authorization',`Bearer ${access}`);
    return nativeFetch(input,{...options,headers});
  };
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',show,{once:true});
  else show();
  verify().finally(()=>{if (!ready) show();});
  setInterval(()=>{if (session) verify();},30000);
  window.addEventListener('focus',()=>{if (session) verify();});
})();

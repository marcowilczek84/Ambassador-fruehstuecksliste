/* Guest memory preview: uses only the separate staging Supabase project. */
(() => {
  'use strict';
  const base = window.__AMBASSADOR_STAGING_URL__;
  const key = window.__AMBASSADOR_STAGING_KEY__;
  if (!base?.includes('jeuvmhahanaulvrnasgq.supabase.co') || !key?.startsWith('sb_publishable_')) return;
  const sessionKey = 'ambassador-gm-staging-session';
  let session = null;
  let membership = null;
  let syncSignature = '';
  let modalSignature = '';
  let lastRefreshAt = 0;
  let selectedName = '';
  let busy = false;
  try { session = JSON.parse(localStorage.getItem(sessionKey) || 'null'); } catch {}

  const uiRole = () => (sessionStorage.getItem('ambassador-work-area') || document.body.dataset.appRole || '').toUpperCase();
  const day = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Zurich'}).format(new Date());
  const normalizeName = text => String(text || '').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('de-CH');
  const roomData = number => {
    try {
      const record = JSON.parse(localStorage.getItem('ambassador-breakfast-rooms') || 'null');
      return record?.date === day() ? record.rooms?.find(room => +room.room === +number) : null;
    } catch { return null; }
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const time = value => value ? new Intl.DateTimeFormat('de-CH', {timeZone:'Europe/Zurich',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)) : '';
  const label = (de,en) => document.documentElement.lang?.startsWith('en') ? en : de;

  async function renew() {
    if (!session?.refresh_token) throw Error('Arbeitsrolle anmelden');
    const response = await fetch(`${base}/auth/v1/token?grant_type=refresh_token`, {
      method:'POST',headers:{apikey:key,'content-type':'application/json'},
      body:JSON.stringify({refresh_token:session.refresh_token})
    });
    if (!response.ok) { session=null;membership=null;localStorage.removeItem(sessionKey);throw Error('Arbeitsrolle erneut anmelden'); }
    session=await response.json();
    if (!session.expires_at) session.expires_at=Math.floor(Date.now()/1000)+(session.expires_in||3600);
    localStorage.setItem(sessionKey,JSON.stringify(session));
  }
  async function request(path, options={}, retry=true) {
    if (!session?.access_token) throw Error('Arbeitsrolle anmelden');
    if (Date.now() > (session.expires_at || 0)*1000 - 30000) await renew();
    const response=await fetch(`${base}${path}`, {
      ...options,headers:{apikey:key,Authorization:`Bearer ${session.access_token}`,
        'content-type':'application/json',...(options.headers||{})},cache:'no-store'
    });
    if (response.status===401 && retry) { await renew();return request(path,options,false); }
    if (!response.ok) { const error=await response.json().catch(()=>({}));throw Error(error.message || `Anfrage fehlgeschlagen (${response.status})`); }
    return response.status===204 ? null : response.json();
  }
  const query = (table,filter) => request(`/rest/v1/${table}?${filter}`);
  const rpc = (name,params) => request(`/rest/v1/rpc/${name}`,{method:'POST',body:JSON.stringify(params)});
  const saveNote = item => request('/rest/v1/guest_notes?select=*',{
    method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(item)
  });

  async function identify() {
    if (!session) return;
    const data=await query('gm_memberships','select=user_id,hotel_id,work_role&active=eq.true');
    membership=data.find(item=>item.work_role===uiRole()) || null;
    if (!membership) throw Error('Angemeldete Arbeitsrolle und gewählter Bereich stimmen nicht überein');
    return membership;
  }
  async function login(email,password) {
    const response=await fetch(`${base}/auth/v1/token?grant_type=password`,{
      method:'POST',headers:{apikey:key,'content-type':'application/json'},
      body:JSON.stringify({email,password})
    });
    const result=await response.json();
    if (!response.ok) throw Error(result.msg || result.error_description || 'Anmeldung fehlgeschlagen');
    session=result;
    if (!session.expires_at) session.expires_at=Math.floor(Date.now()/1000)+(session.expires_in||3600);
    localStorage.setItem(sessionKey,JSON.stringify(session));
    try { await identify(); } catch (error) { session=null;membership=null;localStorage.removeItem(sessionKey);throw error; }
    syncSignature=''; modalSignature='';
  }

  async function syncStays() {
    if (!membership || membership.work_role!=='RECEPTION' || busy) return;
    let state;
    try { state=JSON.parse(localStorage.getItem('ambassador-breakfast-rooms') || 'null'); } catch { return; }
    if (state?.date !== day() || !Array.isArray(state.rooms)) return;
    const rooms=state.rooms.filter(room=>room.guests?.length && room.arrival && room.departure);
    const matchingRooms=(name,arrival,departure)=>[...new Set(rooms.filter(room=>
      room.arrival===arrival && room.departure===departure && room.guests.some(guest=>normalizeName(guest)===normalizeName(name))
    ).map(room=>+room.room))].sort((a,b)=>a-b);
    const signature=JSON.stringify(rooms.map(room=>[room.room,room.guests,room.arrival,room.departure]));
    if (signature===syncSignature) return;
    busy=true;
    try {
      for (const room of rooms) for (const name of new Set(room.guests.filter(Boolean))) {
        try {
          await rpc('gm_upsert_stay_checked',{p_hotel:membership.hotel_id,p_name:name,
            p_arrival:room.arrival,p_departure:room.departure,p_room:+room.room,p_seen:day(),
            p_same_name_rooms:matchingRooms(name,room.arrival,room.departure)});
        } catch (error) { console.warn('Aufenthalt prüfen:',error.message); }
      }
      syncSignature=signature;
      modalSignature='';
    } finally { busy=false; }
  }

  async function resolveStay(room,name) {
    const encoded=encodeURIComponent(normalizeName(name));
    const stays=await query('guest_stays',`select=*&hotel_id=eq.${membership.hotel_id}&normalized_name=eq.${encoded}&arrival_date=eq.${room.arrival}&departure_date=eq.${room.departure}`);
    if (stays.length===1) return stays[0];
    if (stays.length>1) {
      const rooms=await query('guest_stay_rooms',`select=stay_id,room_number&hotel_id=eq.${membership.hotel_id}&room_number=eq.${room.room}`);
      const matching=stays.filter(stay=>rooms.some(entry=>entry.stay_id===stay.id));
      if (matching.length===1) return matching[0];
    }
    return null;
  }
  async function loadData(room,name) {
    const stay=await resolveStay(room,name);
    if (!stay) return {stay:null,notes:[],persistent:[],candidates:[],history:[],unresolved:[]};
    const notes=await query('guest_notes',`select=*&hotel_id=eq.${membership.hotel_id}&stay_id=eq.${stay.id}&deleted_at=is.null&order=created_at.desc`);
    const persistent=stay.guest_profile_id ? await query('guest_notes',`select=*&hotel_id=eq.${membership.hotel_id}&guest_profile_id=eq.${stay.guest_profile_id}&deleted_at=is.null&order=created_at.desc`) : [];
    let candidates=[],history=[],unresolved=[];
    if (membership.work_role==='RECEPTION') {
      const profiles=await query('guest_profiles',`select=*&hotel_id=eq.${membership.hotel_id}&normalized_name=eq.${encodeURIComponent(normalizeName(name))}&merged_into=is.null`);
      const decisions=await query('guest_match_decisions',`select=candidate_profile_id&stay_id=eq.${stay.id}&decision=eq.REJECTED`);
      candidates=profiles.filter(p=>p.id!==stay.guest_profile_id && !decisions.some(d=>d.candidate_profile_id===p.id));
      if (stay.guest_profile_id) history=await query('guest_stays',`select=id,arrival_date,departure_date&hotel_id=eq.${membership.hotel_id}&guest_profile_id=eq.${stay.guest_profile_id}&id=neq.${stay.id}&order=arrival_date.desc`);
      unresolved=await query('guest_legacy_unresolved',`select=id,original_body,observed_on&hotel_id=eq.${membership.hotel_id}&room_number=eq.${room.room}&assignment_status=eq.UNRESOLVED`);
    }
    return {stay,notes,persistent,candidates,history,unresolved};
  }

  function noteHtml(note) {
    const persistent=note.note_type==='PERSISTENT';
    const canDelete=!persistent || membership.work_role==='RECEPTION';
    return `<article class="gm-note" data-note-id="${note.id}">
      <small>${esc(label('Erstellt','Created'))} ${esc(time(note.created_at))}</small>
      <p>${esc(note.body)}</p><span class="gm-note-kind">${persistent?label('Dauerhafte Gastinformation','Permanent guest information'):label('Dieser Aufenthalt','This stay')}</span>
      ${new Date(note.updated_at)-new Date(note.created_at)>1000?`<small>${esc(label('Bearbeitet','Edited'))} ${esc(time(note.updated_at))}</small>`:''}
      <div class="gm-note-actions"><button data-action="edit" data-id="${note.id}">${label('Bearbeiten','Edit')}</button>${canDelete?`<button data-action="delete" data-id="${note.id}">${label('Löschen','Delete')}</button>`:''}</div>
    </article>`;
  }
  function panelHtml(data,room) {
    if (!membership) return `<section class="gm-panel"><h3>Gastgedächtnis</h3><p>Arbeitsrolle anmelden</p>
      <form class="gm-login"><label>E-Mail<input type="email" required autocomplete="username" value="${uiRole()==='SERVICE'?'service':'reception'}-guest-memory@staging.invalid"></label>
      <label>Passwort<input type="password" required autocomplete="current-password"></label><button type="submit">Anmelden</button></form></section>`;
    if (!data.stay) return `<section class="gm-panel"><h3>Aktueller Aufenthalt</h3><p>${label('Aufenthalt wird geprüft. Bei zwei gleichnamigen Gästen entscheidet die Rezeption.','Stay needs review.')}</p></section>`;
    const {stay,notes,persistent,candidates,history,unresolved}=data;
    const candidateUI=membership.work_role==='RECEPTION' && candidates.length ? `<section class="gm-section"><h3>Möglicher bekannter Gast</h3><p>Für diesen Namen existieren frühere Gastinformationen.</p><details><summary>Prüfen</summary>${candidates.map(candidate=>`<div class="gm-candidate"><strong>${esc(candidate.display_name)}</strong><small>Profil ${esc(candidate.id.slice(0,8))}</small><button data-action="same" data-id="${candidate.id}">Dieselbe Person</button><button data-action="other" data-id="${candidate.id}">Andere Person</button>${stay.guest_profile_id?`<button data-action="merge-preview" data-id="${candidate.id}">Profile vergleichen</button>`:''}</div>`).join('')}</details></section>`:'';
    const persistentUI=persistent.length?`<section class="gm-section"><h3>Dauerhafte Gastinformationen</h3>${persistent.map(noteHtml).join('')}</section>`:'';
    const historyUI=membership.work_role==='RECEPTION' && history.length?`<section class="gm-section"><details><summary>Frühere Aufenthalte · ${history.length}</summary>${history.map(h=>`<div class="gm-history"><button data-action="history" data-id="${h.id}">${esc(h.arrival_date)} – ${esc(h.departure_date)}</button><div data-history-id="${h.id}"></div></div>`).join('')}</details></section>`:'';
    const unresolvedUI=membership.work_role==='RECEPTION'&&unresolved.length?`<section class="gm-section"><h3>Alte Bemerkungen · Zuordnung nicht eindeutig</h3>${unresolved.map(item=>`<p>${esc(item.original_body)}<button data-action="assign" data-id="${item.id}">Diesem Aufenthalt zuordnen</button> · <button data-action="discard-legacy" data-id="${item.id}">Löschen</button></p>`).join('')}</section>`:'';
    return `<section class="gm-panel" data-stay-id="${stay.id}">${candidateUI}${persistentUI}
      <section class="gm-section"><h3>Aktueller Aufenthalt</h3>${notes.map(noteHtml).join('')||'<p class="gm-empty">Keine Bemerkung gespeichert</p>'}
      <button class="gm-add" data-action="add">+ Bemerkung hinzufügen</button></section>${historyUI}${unresolvedUI}</section>`;
  }

  function editor(panel,note=null) {
    const edit=Boolean(note);
    const dialog=document.createElement('div');dialog.className='gm-dialog-layer';
    dialog.innerHTML=`<div class="gm-dialog" role="dialog" aria-modal="true"><h3>${edit?'Bemerkung bearbeiten':'Bemerkung hinzufügen'}</h3>
      <form><fieldset ${edit?'disabled':''}><legend>Gültigkeit</legend><label><input type="radio" name="type" value="STAY" ${!note||note.note_type==='STAY'?'checked':''}> Dieser Aufenthalt</label>
      <label><input type="radio" name="type" value="PERSISTENT" ${note?.note_type==='PERSISTENT'?'checked':''}> Dauerhafte Gastinformation</label></fieldset>
      <textarea required maxlength="4000" rows="5" aria-label="Bemerkung">${esc(note?.body||'')}</textarea>
      <div class="gm-dialog-actions"><button type="button" data-cancel>Abbrechen</button><button type="submit">Speichern</button></div></form></div>`;
    panel.append(dialog);dialog.querySelector('[data-cancel]').onclick=()=>dialog.remove();
    dialog.querySelector('form').onsubmit=async event=>{
      event.preventDefault();const form=event.currentTarget,submit=form.querySelector('[type=submit]');submit.disabled=true;
      try {
        const body=form.querySelector('textarea').value.trim();if (!body) return;
        if (edit) await request(`/rest/v1/guest_notes?id=eq.${note.id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({body})});
        else {
          const type=form.querySelector('input[name=type]:checked').value;
          let profile=panel.dataset.profileId;
          if (type==='PERSISTENT' && !profile) profile=await rpc('gm_create_profile_for_stay',{p_stay:panel.dataset.stayId});
          await saveNote({hotel_id:membership.hotel_id,note_type:type,body,
            ...(type==='PERSISTENT'?{guest_profile_id:profile}:{stay_id:panel.dataset.stayId})});
        }
        dialog.remove();modalSignature='';await refreshPanel();
      } catch(error) { alert(error.message); } finally { submit.disabled=false; }
    };
  }

  async function handleAction(panel,data,action,id) {
    if (action==='add') return editor(panel);
    const note=[...data.notes,...data.persistent].find(item=>item.id===id);
    if (action==='edit' && note) return editor(panel,note);
    if (action==='delete' && note) {
      if (!confirm('Bemerkung löschen?\nDiese Bemerkung wird entfernt.')) return;
      await rpc('gm_soft_delete_note',{p_note:id});
    } else if (action==='same' || action==='other') {
      if (!confirm(action==='same'?'Diesen Aufenthalt mit dem ausgewählten Gastprofil verbinden?':'Dieses Profil für den Aufenthalt ablehnen?')) return;
      await rpc('gm_decide_match',{p_stay:data.stay.id,p_profile:id,p_same_person:action==='same'});
    } else if (action==='assign') {
      if (!confirm('Alte Bemerkung diesem Aufenthalt zuordnen?')) return;
      await rpc('gm_assign_legacy',{p_legacy:id,p_stay:data.stay.id});
    } else if (action==='discard-legacy') {
      if (!confirm('Alte Bemerkung löschen?')) return;
      await rpc('gm_discard_legacy',{p_legacy:id});
    } else if (action==='history') {
      const target=panel.querySelector(`[data-history-id="${id}"]`);
      if (!target) return;
      if (target.textContent) {target.replaceChildren();return;}
      const notes=await query('guest_notes',`select=*&stay_id=eq.${id}&deleted_at=is.null&order=created_at.desc`);
      target.innerHTML=notes.length?notes.map(noteHtml).join(''):'Keine Bemerkungen';return;
    } else if (action==='merge-preview') {
      const source=data.stay.guest_profile_id;
      const target=id;
      const sourceNotes=data.persistent.map(n=>n.body).join('\n')||'Keine Informationen';
      const targetNotes=await query('guest_notes',`select=body&guest_profile_id=eq.${target}&deleted_at=is.null`);
      const message=`GASTPROFILE ZUSAMMENFÜHREN?\n\nProfil A:\n${sourceNotes}\n\nProfil B:\n${targetNotes.map(n=>n.body).join('\n')||'Keine Informationen'}\n\nKeine Information wird überschrieben. Zusammenführen?`;
      if (!confirm(message)) return;
      await rpc('gm_merge_profiles',{p_source:source,p_target:target});
    } else return;
    modalSignature='';await refreshPanel();
  }

  async function refreshPanel() {
    const modal=document.querySelector('.guest-edit-modal');
    if (!modal || !membership) return;
    const number=+(modal.querySelector('.modal-kicker')?.textContent.match(/\d+/)?.[0]||0);
    const room=roomData(number);
    const names=[...new Set(room?.guests?.filter(Boolean)||[])];
    if (!room || !names.length) return;
    if (!names.includes(selectedName)) selectedName=names[0];
    const data=await loadData(room,selectedName);
    const container=modal.querySelector('.modal-body');if (!container) return;
    let panel=container.querySelector('.gm-panel');if (!panel) {panel=document.createElement('section');container.append(panel);}
    container.querySelector('.gm-guest-switch')?.remove();
    const namesUI=names.length>1?`<label class="gm-guest-switch">Gast <select>${names.map(n=>`<option ${n===selectedName?'selected':''}>${esc(n)}</option>`).join('')}</select></label>`:'';
    panel.outerHTML=namesUI+panelHtml(data,room);
    panel=container.querySelector('.gm-panel');if (!panel) return;
    panel.dataset.profileId=data.stay?.guest_profile_id||'';
    container.querySelector('.gm-guest-switch select')?.addEventListener('change',event=>{selectedName=event.target.value;modalSignature='';refreshPanel().catch(console.error);});
    panel.addEventListener('click',event=>{
      const button=event.target.closest('button[data-action]');if (!button)return;
      event.preventDefault();handleAction(panel,data,button.dataset.action,button.dataset.id).catch(error=>alert(error.message));
    });
  }

  async function tick() {
    const modal=document.querySelector('.guest-edit-modal');
    if (!modal) { modalSignature='';selectedName='';return; }
    const number=+(modal.querySelector('.modal-kicker')?.textContent.match(/\d+/)?.[0]||0);
    if (!number) return;
    if (membership && membership.work_role!==uiRole()) membership=null;
    const signature=`${number}:${uiRole()}:${Boolean(session)}:${syncSignature}`;
    if (signature===modalSignature && modal.querySelector('.gm-panel') &&
      (!membership || Date.now()-lastRefreshAt<5000 || modal.querySelector('.gm-dialog-layer'))) return;
    modalSignature=signature;
    try {
      if (!membership && session) await identify();
      if (membership) {document.body.classList.add('gm-enabled');await refreshPanel();lastRefreshAt=Date.now();}
      else {
        const container=modal.querySelector('.modal-body');
        if (!container || container.querySelector('.gm-panel')) return;
        const panel=document.createElement('div');panel.innerHTML=panelHtml({},{});
        container.append(...panel.children);
        container.querySelector('.gm-login')?.addEventListener('submit',async event=>{
          event.preventDefault();const form=event.currentTarget;
          try {await login(form.querySelector('input[type=email]').value,form.querySelector('input[type=password]').value);modalSignature='';await refreshPanel();}
          catch(error){alert(error.message);}
        });
      }
    } catch(error) {
      if (/Arbeitsrolle|Bereich/.test(error.message)) {
        session=null;membership=null;localStorage.removeItem(sessionKey);
      }
      modalSignature='';console.warn('Gastgedächtnis:',error.message);
    }
  }
  window.setInterval(()=>{tick().catch(console.error);syncStays().catch(console.error);},2500);
  window.addEventListener('focus',()=>{modalSignature='';tick().catch(console.error);syncStays().catch(console.error);});
  tick().catch(console.error);
})();

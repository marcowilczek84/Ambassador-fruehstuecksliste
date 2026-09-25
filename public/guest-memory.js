/* Guest memory uses the runtime configuration for this deployment. */
(() => {
  'use strict';
  const base = window.__AMBASSADOR_STAGING_URL__;
  const key = window.__AMBASSADOR_STAGING_KEY__;
  const deviceAuth = window.__AMBASSADOR_DEVICE_AUTH__;
  if (base !== 'https://jeuvmhahanaulvrnasgq.supabase.co' || !deviceAuth) return;
  let session = null;
  let membership = null;
  let syncSignature = '';
  let modalSignature = '';
  let lastRefreshAt = 0;
  let selectedName = '';
  let busy = false;
  session = deviceAuth.getSession();

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

  async function request(path, options={}, retry=true) {
    if (!deviceAuth.isReady()) throw Error('Gerät freischalten');
    const access=await deviceAuth.token();
    if (!access) throw Error('Gerät freischalten');
    const response=await fetch(`${base}${path}`, {
      ...options,headers:{apikey:key,Authorization:`Bearer ${access}`,
        'content-type':'application/json',...(options.headers||{})},cache:'no-store'
    });
    if (response.status===401 && retry && await deviceAuth.verify()) return request(path,options,false);
    if (!response.ok) { const error=await response.json().catch(()=>({}));throw Error(error.message || `Anfrage fehlgeschlagen (${response.status})`); }
    return response.status===204 ? null : response.json();
  }
  const query = (table,filter) => request(`/rest/v1/${table}?${filter}`);
  const rpc = (name,params) => request(`/rest/v1/rpc/${name}`,{method:'POST',body:JSON.stringify(params)});
  const saveNote = item => request('/rest/v1/guest_notes?select=*',{
    method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(item)
  });

  async function identify() {
    if (!deviceAuth.isReady()) return;
    const data=await query('gm_hotels','select=id');
    membership=data[0]?{hotel_id:data[0].id,work_role:'SERVICE'}:null;
    if (!membership) throw Error('Gerät nicht freigeschaltet');
    return membership;
  }

  async function syncStays() {
    if (!membership || busy) return;
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
    if (stays.length===1) return {stay:stays[0],ambiguous:false};
    if (stays.length>1) {
      const rooms=await query('guest_stay_rooms',`select=stay_id,room_number&hotel_id=eq.${membership.hotel_id}&room_number=eq.${room.room}`);
      const matching=stays.filter(stay=>rooms.some(entry=>entry.stay_id===stay.id));
      if (matching.length===1) return {stay:matching[0],ambiguous:false};
    }
    return {stay:null,ambiguous:stays.length>1};
  }
  async function loadData(room,name) {
    const {stay,ambiguous}=await resolveStay(room,name);
    if (!stay) return {stay:null,ambiguous,notes:[],persistent:[],candidates:[],history:[],unresolved:[]};
    const notes=await query('guest_notes',`select=*&hotel_id=eq.${membership.hotel_id}&stay_id=eq.${stay.id}&deleted_at=is.null&order=created_at.desc`);
    const persistent=stay.guest_profile_id ? await query('guest_notes',`select=*&hotel_id=eq.${membership.hotel_id}&guest_profile_id=eq.${stay.guest_profile_id}&deleted_at=is.null&order=created_at.desc`) : [];
    return {stay,notes,persistent};
  }

  function noteHtml(note) {
    const persistent=note.note_type==='PERSISTENT';
    const canDelete=true;
    return `<article class="gm-note" data-note-id="${note.id}">
      <small>${esc(label('Erstellt','Created'))} ${esc(time(note.created_at))}</small>
      <p>${esc(note.body)}</p><span class="gm-note-kind">${persistent?label('Dauerhafte Gastinformation','Permanent guest information'):label('Dieser Aufenthalt','This stay')}</span>
      ${new Date(note.updated_at)-new Date(note.created_at)>1000?`<small>${esc(label('Bearbeitet','Edited'))} ${esc(time(note.updated_at))}</small>`:''}
      <div class="gm-note-actions"><button data-action="edit" data-id="${note.id}">${label('Bearbeiten','Edit')}</button>${canDelete?`<button data-action="delete" data-id="${note.id}">${label('Löschen','Delete')}</button>`:''}</div>
    </article>`;
  }
  function panelHtml(data,room) {
    if (!membership) return '';
    if (!data.stay) {
      const expired=room.departure && room.departure<day();
      const message=expired
        ? label('Dieser Aufenthalt ist laut importierter Liste bereits beendet. Für den heutigen Service kann keine neue Aufenthaltsbemerkung angelegt werden.','This stay has already ended according to the imported list.')
        : data.ambiguous ? label('Mehrere gleichnamige Aufenthalte sind möglich. Die Rezeption muss die Zuordnung prüfen.','Several stays with the same name match. Reception must review the assignment.')
        : label('Für diesen Gast wurde noch kein Aufenthalt im Gastgedächtnis gefunden. Bitte die Rezeption prüfen lassen.','No stay has been found for this guest yet. Please contact reception.');
      return `<section class="gm-panel"><h3>Aktueller Aufenthalt</h3><p>${message}</p></section>`;
    }
    const {stay,notes,persistent}=data;
    const persistentUI=persistent.length?`<section class="gm-section"><h3>Dauerhafte Gastinformationen</h3>${persistent.map(noteHtml).join('')}</section>`:'';
    return `<section class="gm-panel" data-stay-id="${stay.id}">${persistentUI}
      <section class="gm-section"><h3>Aktueller Aufenthalt</h3>${notes.map(noteHtml).join('')||'<p class="gm-empty">Keine Bemerkung gespeichert</p>'}
      <button class="gm-add" data-action="add">+ Bemerkung hinzufügen</button></section></section>`;
  }

  function editor(panel,note=null) {
    const edit=Boolean(note);
    const dialog=document.createElement('div');dialog.className='gm-dialog-layer';
    dialog.innerHTML=`<div class="gm-dialog" role="dialog" aria-modal="true" aria-labelledby="gm-dialog-title">
      <header class="gm-dialog-header"><div><h3 id="gm-dialog-title">${edit?'Bemerkung bearbeiten':'Bemerkung hinzufügen'}</h3><p>Gastinformation erfassen</p></div><button type="button" class="gm-dialog-close" data-cancel aria-label="Schließen">×</button></header>
      <form><div class="gm-dialog-body"><fieldset ${edit?'disabled':''}><legend>Gültigkeit</legend><div class="gm-type-options">
      <label class="gm-type-option"><input type="radio" name="type" value="STAY" ${!note||note.note_type==='STAY'?'checked':''}><span><b aria-hidden="true">✓</b>Dieser Aufenthalt</span></label>
      <label class="gm-type-option"><input type="radio" name="type" value="PERSISTENT" ${note?.note_type==='PERSISTENT'?'checked':''}><span><b aria-hidden="true">✓</b>Dauerhafte Gastinfo</span></label>
      </div></fieldset><label class="gm-text-label" for="gm-note-text">Bemerkung</label>
      <textarea id="gm-note-text" required maxlength="4000" rows="5" placeholder="Bemerkung eingeben …">${esc(note?.body||'')}</textarea></div>
      <footer class="gm-dialog-actions"><button type="button" data-cancel>Abbrechen</button><button type="submit">Speichern</button></footer></form></div>`;
    panel.append(dialog);dialog.querySelectorAll('[data-cancel]').forEach(button=>button.onclick=()=>dialog.remove());
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
    let panel=container.querySelector('.gm-panel');if (!panel) {
      panel=document.createElement('section');
      const footer=container.querySelector('.modal-actions:not(.guest-view-actions)');
      if (footer) footer.before(panel); else container.append(panel);
    }
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
    if (!deviceAuth.isReady()) {membership=null;return;}
    session=deviceAuth.getSession();
    if (!membership) await identify();
    const modal=document.querySelector('.guest-edit-modal');
    if (!modal) { modalSignature='';selectedName='';return; }
    const number=+(modal.querySelector('.modal-kicker')?.textContent.match(/\d+/)?.[0]||0);
    if (!number) return;
    const signature=`${number}:${uiRole()}:${Boolean(session)}:${syncSignature}`;
    if (signature===modalSignature && modal.querySelector('.gm-panel') &&
      (!membership || Date.now()-lastRefreshAt<5000 || modal.querySelector('.gm-dialog-layer'))) return;
    modalSignature=signature;
    try {
      if (!membership && session) await identify();
      if (membership) {document.body.classList.add('gm-enabled');await refreshPanel();lastRefreshAt=Date.now();}
      else await identify();
    } catch(error) {
      if (/Gerät/.test(error.message)) membership=null;
      modalSignature='';console.warn('Gastgedächtnis:',error.message);
    }
  }
  window.setInterval(()=>{tick().catch(console.error);syncStays().catch(console.error);},2500);
  window.addEventListener('focus',()=>{modalSignature='';tick().catch(console.error);syncStays().catch(console.error);});
  tick().catch(console.error);
})();

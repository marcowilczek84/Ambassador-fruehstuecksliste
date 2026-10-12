/* Ambassador Frühstück V4 — readable service UI, backed by the existing live state. */
(function(root){
'use strict';
const PENDING='ambassador-service-v4-pending';
const normalize=r=>({...r,arrivedCount:Math.max(0,Math.min(Number(r.people)||0,Number(r.arrivedCount??(r.present||r.departed?r.people:0))||0))});
const isOpen=r=>r.people>0&&r.guests?.length&&r.included&&normalize(r).arrivedCount<r.people;
const matches=(r,q)=>`${r.room} ${(r.guests||[]).join(' ')} ${r.table||''}`.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(q.trim().toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''));
let Component;
function component(React){
 if(Component)return Component;
 const h=React.createElement;
 const labels={de:{service:'Service',reception:'Rezeption',search:'Zimmer oder Name',open:'Nur offene',all:'Alle Zimmer',included:'inkl.',excluded:'nicht inkl.',vacant:'Nicht belegt',registered:'erfasst',close:'Schließen',correct:'Korrigieren',minus:'Eine Person zurücknehmen',save:'Wird gespeichert …',saved:'Gespeichert',failed:'Verbindung unterbrochen. Erfassung wird beim Wiederholen sicher geprüft.',retry:'Erneut versuchen',pending:'Speicherung offen',conflict:'Zimmer wurde inzwischen geändert. Aktuellen Stand prüfen und erneut erfassen.',finished:'Frühstück abgeschlossen. Die Rezeption kann den Tag wieder öffnen.',missing:'Die heutige Liste ist nicht verfügbar.',empty:'Die Rezeption hat noch keine heutige Liste bereitgestellt.',noResults:'Keine passenden Zimmer',reset:'Filter zurücksetzen',undo:'Rückgängig',people:'Personen',room:'Zimmer',note:'Bemerkung',synced:'Synchronisiert',waiting:'Verbindung wird geprüft',offline:'Offline',extra:'Gäste ohne Zimmer'},en:{service:'Service',reception:'Reception',search:'Room or name',open:'Only open',all:'All rooms',included:'incl.',excluded:'not incl.',vacant:'Vacant',registered:'checked in',close:'Close',correct:'Correct',minus:'Remove one person',save:'Saving …',saved:'Saved',failed:'Connection interrupted. Retrying safely checks this check-in.',retry:'Try again',pending:'Save pending',conflict:'This room has changed. Check the current status and try again.',finished:'Breakfast is closed. Reception can reopen the day.',missing:"Today's list is unavailable.",empty:"Reception has not provided today's list yet.",noResults:'No matching rooms',reset:'Reset filters',undo:'Undo',people:'people',room:'Room',note:'Note',synced:'Synchronised',waiting:'Checking connection',offline:'Offline',extra:'Guests without a room'},vi:{service:'Phục vụ',reception:'Lễ tân',search:'Phòng hoặc tên',open:'Chỉ còn mở',all:'Tất cả phòng',included:'bao gồm',excluded:'không gồm',vacant:'Phòng trống',registered:'đã ghi nhận',close:'Đóng',correct:'Sửa',minus:'Bớt một khách',save:'Đang lưu …',saved:'Đã lưu',failed:'Mất kết nối. Thử lại để kiểm tra an toàn.',retry:'Thử lại',pending:'Chờ lưu',conflict:'Phòng đã thay đổi. Kiểm tra và thử lại.',finished:'Bữa sáng đã kết thúc. Liên hệ lễ tân.',missing:'Không có danh sách hôm nay.',empty:'Lễ tân chưa cung cấp danh sách hôm nay.',noResults:'Không tìm thấy phòng',reset:'Xóa bộ lọc',undo:'Hoàn tác',people:'khách',room:'Phòng',note:'Ghi chú',synced:'Đã đồng bộ',waiting:'Đang kiểm tra kết nối',offline:'Ngoại tuyến',extra:'Khách không có phòng'}};
 const icon=(name)=>h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:{search:'m21 21-5-5 M18 10a8 8 0 1 1-16 0a8 8 0 1 1 16 0',check:'m5 12 4 4L19 6',hub:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',close:'m6 6 12 12 M6 18 18 6',info:'M12 11v6 M12 7h.01 M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0'}[name]}));
 Component=function ServiceFirst(props){
  const lang=labels[props.language]||labels.de;
  const [query,setQuery]=React.useState(''),[onlyOpen,setOpen]=React.useState(false),[selected,setSelected]=React.useState(null),[busy,setBusy]=React.useState(false),[notice,setNotice]=React.useState(null),[pending,setPending]=React.useState(()=>{try{const p=JSON.parse(localStorage.getItem(PENDING)||'null');return p?.p_list_date===props.date?p:null}catch{return null}});
  const lock=React.useRef(false),latest=React.useRef(props),origin=React.useRef(null),noticeTimer=React.useRef(null);latest.current=props;
  React.useEffect(()=>{document.body.dataset.appRole='service';document.body.classList.add('service-first');return()=>{document.body.classList.remove('service-first');clearTimeout(noticeTimer.current)}},[]);
  function announce(value){clearTimeout(noticeTimer.current);setNotice(value);if(!value?.error)noticeTimer.current=setTimeout(()=>setNotice(null),6500)}
  async function send(action){
   if(lock.current)return;lock.current=true;setBusy(true);announce(null);
   try{
    // The operation is persisted before transmission. A lost response retries the same UUID.
    localStorage.setItem(PENDING,JSON.stringify(action));setPending(action);
    const response=await fetch(`${latest.current.endpoint}/rest/v1/rpc/breakfast_service_action_v4`,{method:'POST',headers:latest.current.headers(),body:JSON.stringify(action),signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw Error('save failed');const result=await response.json();
    if(!['saved','duplicate','conflict','finished','missing'].includes(result.status))throw Error('invalid response');
    if(result.payload)latest.current.applyPayload(result.payload);
    localStorage.removeItem(PENDING);setPending(null);
    if(result.status==='saved'||result.status==='duplicate'){
     const current=result.payload.rooms.find(r=>r.room===action.p_room);
     announce({text:`${lang.room} ${action.p_room} · ${current.arrivedCount}/${current.people} ${lang.registered}`,undo:action.p_delta===1?{room:action.p_room,expected:normalize(current)}:null});
    } else announce({text:lang[result.status],error:true});
   }catch{announce({text:lang.failed,error:true})}finally{setBusy(false);lock.current=false}
  }
  function change(room,delta,expected){
   if(lock.current||pending||props.finished)return;
   if(latest.current.legacyPending()){announce({text:props.language==='en'?'Previous changes are still syncing. Try again shortly.':'Vorherige Änderungen werden synchronisiert. Bitte kurz warten.',error:true});return}
   const r=normalize(room);if(delta===1&&r.arrivedCount>=r.people||delta===-1&&r.arrivedCount<=0)return;
   send({p_list_date:props.date,p_room:r.room,p_expected:expected||r,p_delta:delta,p_action_id:crypto.randomUUID()});
  }
  const all=props.rooms.map(normalize).sort((a,b)=>a.room-b.room),occupied=all.filter(r=>r.people&&r.guests?.length),included=occupied.filter(r=>r.included),total=included.reduce((a,r)=>a+r.people,0),count=included.reduce((a,r)=>a+r.arrivedCount,0);
  const filtered=all.filter(r=>matches(r,query)&&(!onlyOpen||isOpen(r)));
  const current=all.find(r=>r.room===selected);
  const blocked=busy||!!pending||props.finished;
  function openRoom(r,event){origin.current=event.currentTarget;setSelected(r.room)}
  function closeRoom(){setSelected(null);setTimeout(()=>origin.current?.isConnected&&origin.current.focus(),0)}
  React.useEffect(()=>{if(selected===null)return;const dialog=document.querySelector('.v4-dialog');dialog?.querySelector('button')?.focus();const key=e=>{if(e.key==='Escape'){e.preventDefault();closeRoom()}if(e.key==='Tab'){const controls=[...dialog.querySelectorAll('button:not(:disabled)')];const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}};dialog?.addEventListener('keydown',key);return()=>dialog?.removeEventListener('keydown',key)},[selected]);
  function card(r){
   const occupied=r.people>0&&r.guests?.length,complete=occupied&&r.arrivedCount>=r.people;
   return h('article',{key:r.room,className:`v4-room ${complete?'is-complete':''} ${!occupied?'is-vacant':''} ${r.included?'is-included':''}`,style:{'--room-row':r.room%10+1},'data-room':r.room,'aria-label':`${lang.room} ${r.room}`},
    h('div',{className:'v4-room-id'},h('strong',{className:'v4-number'},r.room),occupied&&h('button',{type:'button',className:'v4-count',onClick:e=>openRoom(r,e),'aria-label':`${lang.room} ${r.room}: ${r.arrivedCount} / ${r.people} ${lang.registered}. ${lang.correct}`},`${r.arrivedCount}/${r.people}`)),
    h('div',{className:'v4-room-body'},occupied?h('button',{className:'v4-names',onClick:e=>openRoom(r,e),'aria-label':`${r.guests.join(', ')}. ${lang.room} ${r.room}. ${lang.people}: ${r.people}`},r.guests.slice(0,2).map((name,i)=>h('span',{key:i},name)),r.guests.length>2&&h('small',{className:'v4-more'},`+${r.guests.length-2}`)):h('span',{className:'v4-vacant'},lang.vacant),occupied&&h('span',{className:'v4-entitlement'},r.included?lang.included:lang.excluded,(r.note||r.guestInfo?.length)?icon('info'):null)),
    occupied&&(!complete?h('button',{className:'v4-plus',type:'button',disabled:blocked,onClick:()=>change(r,1),'aria-label':`${lang.room} ${r.room}: +1`},busy&&pending?.p_room===r.room?'…':'+1'):h('span',{className:'v4-done','aria-label':lang.registered},icon('check')))
   );
  }
  const status=pending?lang.pending:/Offline/.test(props.status)?lang.offline:/gespeichert|Aktuell auf allen/.test(props.status)?lang.synced:lang.waiting;
  return h(React.Fragment,null,
   h('main',{className:'v4-shell',inert:selected!==null},
    h('header',{className:'v4-header'},h('img',{className:'v4-logo',src:'/ambassador-logo.svg',alt:'Ambassador Hotel Zürich'}),h('div',{className:'v4-brand'},h('h1',null,'Frühstück'),h('span',null,lang.service)),h('time',{dateTime:props.date},new Intl.DateTimeFormat(props.language==='en'?'en-GB':props.language==='vi'?'vi-VN':'de-CH',{weekday:'short',day:'numeric',month:'long'}).format(new Date(props.date+'T12:00:00'))),h('div',{className:'v4-header-actions'},h('select',{'aria-label':'Sprache / Language',value:props.language,onChange:e=>{localStorage.setItem('ambassador-ui-language',e.target.value.toUpperCase());localStorage.setItem('ambassador-language',e.target.value);window.dispatchEvent(new CustomEvent('ambassador-language-change',{detail:e.target.value}))}},['de','en','vi'].map(code=>h('option',{value:code,key:code},code.toUpperCase()))),h('button',{className:'v4-role',onClick:()=>{sessionStorage.setItem('ambassador-work-area','reception');location.reload()}},lang.reception),h('a',{href:'https://ambassador-apps.vercel.app/','aria-label':'App-Hub'},icon('hub')))),
    h('section',{className:'v4-tools','aria-label':lang.service},h('div',{className:'v4-progress'},h('div',null,h('strong',null,`${count} / ${total}`),h('span',null,props.language==='de'?'inklusive Gäste erfasst':props.language==='en'?'included guests checked in':'khách bao gồm đã đến')),h('progress',{value:count,max:Math.max(1,total),'aria-label':lang.registered})),h('label',{className:'v4-search'},icon('search'),h('input',{type:'search',value:query,placeholder:lang.search,'aria-label':lang.search,onChange:e=>setQuery(e.target.value)})),h('button',{className:'v4-filter','aria-pressed':onlyOpen,onClick:()=>setOpen(v=>!v)},h('span',{'aria-hidden':true},onlyOpen?'✓':''),lang.open)),
    props.finished&&h('p',{className:'v4-alert',role:'status'},lang.finished),
    h('section',{className:`v4-grid ${query||onlyOpen?'is-filtered':''}`,'aria-label':lang.all},filtered.length?[20,30,40,50,60].map(base=>h('div',{className:'v4-column',key:base,'aria-label':`${base}–${base+8}`},filtered.filter(r=>r.room>=base&&r.room<base+10).map(card))):h('div',{className:'v4-empty'},h('h2',null,occupied.length?lang.noResults:lang.empty),occupied.length>0&&h('button',{onClick:()=>{setQuery('');setOpen(false)}},lang.reset))),
    h('footer',{className:'v4-footer'},h('span',{'aria-live':'polite',className:pending||/Offline/.test(props.status)?'v4-sync-wait':''},status),h('span',null,`${occupied.length} ${lang.room.toLowerCase()} · ${occupied.reduce((s,r)=>s+r.people,0)} ${lang.people}`),h('button',{onClick:()=>window.dispatchEvent(new Event('ambassador-open-special'))},lang.extra))
   ),
   (busy||pending||notice)&&h('aside',{className:`v4-toast ${notice?.error?'is-error':''}`,role:'status','aria-live':'polite'},h('span',null,busy?lang.save:notice?.text||lang.pending),!busy&&pending&&h('button',{onClick:()=>send(pending)},lang.retry),!busy&&!pending&&notice?.undo&&h('button',{onClick:()=>{const r=all.find(r=>r.room===notice.undo.room);if(r)change(r,-1,notice.undo.expected)}},lang.undo),!busy&&!pending&&h('button',{'aria-label':lang.close,onClick:()=>setNotice(null)},'×')),
   current&&h('div',{className:'v4-dialog-layer',onClick:e=>e.target===e.currentTarget&&closeRoom()},h('section',{className:'v4-dialog',role:'dialog','aria-modal':true,'aria-labelledby':'v4-dialog-title'},h('header',null,h('h2',{id:'v4-dialog-title'},`${lang.room} ${current.room}`),h('button',{'aria-label':lang.close,onClick:closeRoom},icon('close'))),h('div',{className:'v4-dialog-body'},current.guests.map((name,i)=>h('p',{key:i,className:'v4-full-name'},name)),h('p',{className:'v4-dialog-meta'},`${current.people} ${lang.people} · ${current.included?(props.language==='de'?'Frühstück inklusive':lang.included):(props.language==='de'?'Frühstück nicht inklusive':lang.excluded)}`),h('div',{className:'v4-stepper'},h('button',{disabled:blocked||!current.arrivedCount,onClick:()=>change(current,-1),'aria-label':lang.minus},'−1'),h('strong',null,`${current.arrivedCount} / ${current.people}`,h('small',null,lang.registered)),h('button',{disabled:blocked||current.arrivedCount>=current.people,onClick:()=>change(current,1),'aria-label':`${lang.room} ${current.room}: +1`},'+1')),current.table&&h('p',null,current.table),current.note&&h('p',{className:'v4-note'},current.note),current.guestInfo?.length>0&&h('p',{className:'v4-note'},current.guestInfo.map(x=>typeof x==='string'?x:x.label||x.text||'').join(' · ')),h('button',{className:'v4-dialog-close',onClick:closeRoom},lang.close))))
  );
 };
 return Component;
}
const api={component,normalize,isOpen,matches};root.AmbassadorServiceV4=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

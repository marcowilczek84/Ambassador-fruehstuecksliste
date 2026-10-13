/* Ambassador Frühstück V4 — readable service UI, backed by the existing live state. */
(function(root){
'use strict';
const PENDING='ambassador-service-v4-pending';
const normalize=r=>({...r,arrivedCount:Math.max(0,Math.min(Number(r.people)||0,Number(r.arrivedCount??(r.present||r.departed?r.people:0))||0))});
const isOpen=r=>r.people>0&&r.guests?.length&&r.included&&normalize(r).arrivedCount<r.people;
const matches=(r,q)=>`${r.room} ${(r.guests||[]).join(' ')} ${r.table||''}`.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(q.trim().toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''));
// Signed corrections reduce the newest matching arrival for existing reception statistics.
function effectiveArrivals(events){
 const result=[];
 for(const event of [...events].sort((a,b)=>a.at-b.at)){
  if(Number(event.people)>0){result.push({...event});continue}
  let remaining=-Number(event.people||0);
  for(let i=result.length-1;i>=0&&remaining>0;i--){const candidate=result[i];if(candidate.room===event.room&&(event.undoActionId?candidate.actionId===event.undoActionId:candidate.included===event.included)){const remove=Math.min(remaining,candidate.people);candidate.people-=remove;remaining-=remove}}
 }
 return result.filter(e=>e.people>0);
}
// Count room attendance from persisted room state, including check-ins without an event log.
// Additional guests are event-based; targeted corrections are applied before summing.
function dayStatistics(rooms=[],events=[]){
 const occupied=rooms.filter(r=>Number(r.people)>0&&r.guests?.length).map(normalize);
 const arrived=effectiveArrivals(events),sum=(list,key)=>list.reduce((n,r)=>n+(Number(r[key])||0),0);
 const included=occupied.filter(r=>r.included),includedExpected=sum(included,'people'),includedArrived=sum(included,'arrivedCount');
 const hotelAdditional=sum(occupied.filter(r=>!r.included),'arrivedCount');
 const opera=sum(arrived.filter(e=>e.guestType==='opera'),'people'),external=sum(arrived.filter(e=>e.guestType==='external'),'people');
 const timed=arrived.filter(e=>Number.isFinite(Number(e.at))&&Number(e.at)>0).sort((a,b)=>a.at-b.at);
 return {includedExpected,includedArrived,includedMissing:Math.max(0,includedExpected-includedArrived),hotelAdditional,opera,external,additional:hotelAdditional+opera+external,total:includedArrived+hotelAdditional+opera+external,first:timed[0]?.at||null,last:timed.at(-1)?.at||null};
}
function dailySnapshot(rooms,events,date,profile={}){
 return {date,...dayStatistics(rooms,events),peak:profile.peak||'–',eighty:profile.eighty||'–'};
}
const statsHeaders={
 de:['Datum','Inklusive erwartet','Inklusive erfasst','Inklusive nicht erfasst','Hotelgäste zusätzlich','Opera Gäste','Externe Gäste','Zusätzliche Gäste gesamt','Frühstücke gesamt','Erste Erfassung','Letzte Erfassung','Stärkste 30 Minuten','80 % der Ankünfte'],
 en:['Date','Included expected','Included checked in','Included not checked in','Additional hotel guests','Opera guests','External guests','Additional guests total','Total breakfasts','First check-in','Last check-in','Busiest 30 minutes','80% of arrivals'],
 vi:['Ngày','Khách bao gồm dự kiến','Khách bao gồm đã đến','Khách bao gồm chưa đến','Khách khách sạn bổ sung','Khách Opera','Khách bên ngoài','Tổng khách bổ sung','Tổng bữa sáng','Ghi nhận đầu tiên','Ghi nhận cuối cùng','30 phút đông nhất','80% lượt đến']
};
function statisticsCsv(rows,language='de'){
 const cell=value=>'"'+String(value??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
 const clock=at=>Number.isFinite(Number(at))&&Number(at)>0?new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Zurich'}).format(new Date(Number(at))):'';
 const count=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Math.max(0,Number(value)):null;
 const data=(rows||[]).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date||'')).map(r=>{
  const expected=count(r.includedExpected),arrived=count(r.includedArrived),additional=count(r.additional);
  return [r.date,expected,arrived,expected!==null&&arrived!==null?Math.max(0,expected-arrived):null,count(r.hotelAdditional),count(r.opera),count(r.external),additional,arrived!==null&&additional!==null?arrived+additional:null,clock(r.first),clock(r.last),r.peak,r.eighty];
 });
 return '\uFEFF'+[statsHeaders[language]||statsHeaders.de,...data].map(row=>row.map(cell).join(';')).join('\r\n')+'\r\n';
}
function downloadStatistics(rows,language='de'){
 if(typeof document==='undefined'||sessionStorage.getItem('ambassador-work-area')!=='reception'||!rows?.length)return false;
 const blob=new Blob([statisticsCsv(rows,language)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
 const suffix=rows.length===1&&/^\d{4}-\d{2}-\d{2}$/.test(rows[0].date)?rows[0].date:'Abschluesse';
 link.href=url;link.download='Ambassador-Fruehstueck-'+suffix+'.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return true;
}
function roomTables(room){
 if(Number(room.arrivedCount||0)<=0)return [];
 const bookings=Array.isArray(room.serviceBookings)?room.serviceBookings:[];
 const names=bookings.filter(b=>Number(b.people)>0&&b.table).map(b=>String(b.table));
 const booked=bookings.reduce((total,b)=>total+Math.max(0,Number(b.people)||0),0);
 if(Number(room.arrivedCount)>booked){const legacy=String(room.serviceLegacyTable||room.table||'').trim();if(legacy)names.push(legacy)}
 return [...new Set(names.map(s=>s.trim().replace(/^(?:Tisch|Table|Bàn)\s*/i,'')).filter(Boolean))];
}
// Latest *recorded* placement per table. A check-in is not proof that a table is still occupied.
function latestTablePlacements(rooms){
 const candidates=new Map();
 for(const room of rooms){
  if(normalize(room).arrivedCount<=0)continue;
  for(const booking of Array.isArray(room.serviceBookings)?room.serviceBookings:[]){
   if(!(Number(booking.people)>0)||!booking.table)continue;
   const table=String(booking.table).trim().replace(/^(?:Tisch|Table|Bàn)\s*/i,'');
   const at=Number(booking.at);
   if(!table||table==='Roomservice'||!Number.isSafeInteger(at)||at<=0)continue; // Roomservice is not a restaurant table; older bookings without timestamps remain neutral.
   const previous=candidates.get(table),roomNumber=Number(room.room);
   if(!previous||at>previous.at)candidates.set(table,{room:roomNumber,at});
   else if(at===previous.at&&previous.room!==roomNumber)candidates.set(table,{room:null,at}); // Ambiguous ordering must not claim a winner.
  }
 }
 return new Map([...candidates].filter(([,value])=>value.room!==null).map(([table,value])=>[table,value.room]));
}
function stayInfo(room,today){
 const day=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return null;const n=Date.parse(s+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s?n/86400000:null};
 const a=day(room.arrival),d=day(room.departure),t=day(today);
 if(a===null||d===null||t===null||d<=a||t<a||t>d)return{nights:null,breakfast:null,total:null};
 // Hotel nights map to the following mornings: arrival excluded, departure included.
 return{nights:d-t,breakfast:t>a?t-a:null,total:t>a?d-a:null};
}
async function importList({rooms,date,endpoint,headers,apply,onComplete}){
 if(sessionStorage.getItem('ambassador-work-area')!=='reception')return;
 if(localStorage.getItem('ambassador-breakfast-pending-sync-v1')||localStorage.getItem(PENDING)){window.alert('Bitte zuerst ausstehende Änderungen synchronisieren.');return}
 const button=document.querySelector('.import-modal .modal-action.primary');if(button?.disabled)return;if(button)button.disabled=true;
 try{const r=await fetch(endpoint+'/rest/v1/rpc/breakfast_import_v41',{method:'POST',headers,body:JSON.stringify({p_list_date:date,p_rooms:rooms}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Import nicht gespeichert. Bitte die erkannten Zimmer und Personenzahlen prüfen.');const result=await r.json();if(result.payload)apply(result.payload);if(result.status==='conflict')throw Error('Zimmer '+result.room+' hat bereits Check-ins für andere Gastdaten. Import nicht übernommen; bestehende Erfassungen bleiben erhalten.');if(result.status!=='saved')throw Error('Import nicht gespeichert.');onComplete();}catch(e){window.alert(e.message||'Verbindung unterbrochen. Import bitte erneut versuchen.')}finally{if(button?.isConnected)button.disabled=false}
}
const editRequests=new Map();let editBusy=false;
async function editRoom({room,expected,date,endpoint,headers,apply,onComplete}){
 if(editBusy||sessionStorage.getItem('ambassador-work-area')!=='reception')return;
 if(localStorage.getItem('ambassador-breakfast-pending-sync-v1')||localStorage.getItem(PENDING)){window.alert('Bitte zuerst ausstehende Änderungen synchronisieren.');return}
 const changes=Object.fromEntries(['guests','people','included','arrival','departure','note'].map(k=>[k,room[k]??(k==='guests'?[]:k==='included'?false:k==='people'?0:'')]));
 changes.guests=changes.guests.map(x=>x.trim()).filter(Boolean);changes.people=Number(changes.people);
 const key=JSON.stringify([date,room.room,expected,changes]);
 const action=editRequests.get(key)||{p_list_date:date,p_room:room.room,p_expected:expected,p_changes:changes,p_action_id:crypto.randomUUID()};editRequests.set(key,action);
 editBusy=true;const modal=document.querySelector('.guest-edit-modal');if(modal)modal.inert=true;
 try{
  const response=await fetch(endpoint+'/rest/v1/rpc/breakfast_room_edit_v42',{method:'POST',headers,body:JSON.stringify(action),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Nicht gespeichert. Bitte Verbindung und Eingaben prüfen. Deine Änderungen bleiben im Formular.');
  const result=await response.json();if(result.payload)apply(result.payload);
  if(!['saved','duplicate'].includes(result.status))throw Error('Zimmer wurde inzwischen geändert. Bitte Formular schliessen, neu öffnen und den aktuellen Stand prüfen. Check-ins und Tische bleiben erhalten.');
  editRequests.delete(key);onComplete(result.payload.rooms.find(r=>r.room===room.room));
 }catch(e){window.alert(e.message||'Nicht gespeichert. Bitte erneut versuchen.')}finally{editBusy=false;if(modal?.isConnected)modal.inert=false}
}
let Component;
function component(React){
 if(Component)return Component;
 const h=React.createElement;
 const labels={de:{service:'Service',reception:'Verwaltung',search:'Zimmer oder Name',open:'Nur offene',all:'Alle Zimmer',included:'inkl.',excluded:'nicht inkl.',vacant:'Nicht belegt',registered:'erfasst',close:'Schließen',correct:'Korrigieren',minus:'Eine Person zurücknehmen',save:'Wird gespeichert …',saved:'Gespeichert',failed:'Verbindung unterbrochen. Erfassung wird beim Wiederholen sicher geprüft.',retry:'Erneut versuchen',pending:'Speicherung offen',conflict:'Zimmer wurde inzwischen geändert. Aktuellen Stand prüfen und erneut erfassen.',finished:'Frühstück abgeschlossen. Die Verwaltung kann den Tag wieder öffnen.',missing:'Die heutige Liste ist nicht verfügbar.',empty:'Die Verwaltung hat noch keine heutige Liste bereitgestellt.',noResults:'Keine passenden Zimmer',reset:'Filter zurücksetzen',undo:'Rückgängig',people:'Personen',room:'Zimmer',note:'Bemerkung',synced:'Synchronisiert',waiting:'Verbindung wird geprüft',offline:'Offline',extra:'Extern / Opera'},en:{service:'Service',reception:'Management',search:'Room or name',open:'Only open',all:'All rooms',included:'incl.',excluded:'not incl.',vacant:'Vacant',registered:'checked in',close:'Close',correct:'Correct',minus:'Remove one person',save:'Saving …',saved:'Saved',failed:'Connection interrupted. Retrying safely checks this check-in.',retry:'Try again',pending:'Save pending',conflict:'This room has changed. Check the current status and try again.',finished:'Breakfast is closed. Reception can reopen the day.',missing:"Today's list is unavailable.",empty:"Reception has not provided today's list yet.",noResults:'No matching rooms',reset:'Reset filters',undo:'Undo',people:'people',room:'Room',note:'Note',synced:'Synchronised',waiting:'Checking connection',offline:'Offline',extra:'External / Opera'},vi:{service:'Phục vụ',reception:'Quản lý',search:'Phòng hoặc tên',open:'Chỉ còn mở',all:'Tất cả phòng',included:'bao gồm',excluded:'không gồm',vacant:'Phòng trống',registered:'đã ghi nhận',close:'Đóng',correct:'Sửa',minus:'Bớt một khách',save:'Đang lưu …',saved:'Đã lưu',failed:'Mất kết nối. Thử lại để kiểm tra an toàn.',retry:'Thử lại',pending:'Chờ lưu',conflict:'Phòng đã thay đổi. Kiểm tra và thử lại.',finished:'Bữa sáng đã kết thúc. Liên hệ lễ tân.',missing:'Không có danh sách hôm nay.',empty:'Lễ tân chưa cung cấp danh sách hôm nay.',noResults:'Không tìm thấy phòng',reset:'Xóa bộ lọc',undo:'Hoàn tác',people:'khách',room:'Phòng',note:'Ghi chú',synced:'Đã đồng bộ',waiting:'Đang kiểm tra kết nối',offline:'Ngoại tuyến',extra:'Khách ngoài / Opera'}};
 const icon=(name)=>h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:{search:'m21 21-5-5 M18 10a8 8 0 1 1-16 0a8 8 0 1 1 16 0',check:'m5 12 4 4L19 6',hub:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',close:'m6 6 12 12 M6 18 18 6',stats:'M4 20V12 M10 20V4 M16 20V8 M22 20V16',person:'M5 21v-2a7 7 0 0 1 14 0v2 M12 3a4 4 0 1 1 0 8a4 4 0 1 1 0-8',info:'M12 11v6 M12 7h.01 M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0'}[name]}));
 Component=function ServiceFirst(props){
  const lang=labels[props.language]||labels.de;
  const text=(de,en,vi)=>props.language==='en'?en:props.language==='vi'?vi:de;
  const [amount,setAmount]=React.useState(1),[table,setTable]=React.useState(''),[receipt,setReceipt]=React.useState(null),[stats,setStats]=React.useState(false);
  const [query,setQuery]=React.useState(''),[onlyOpen,setOpen]=React.useState(false),[selected,setSelected]=React.useState(null),[busy,setBusy]=React.useState(false),[notice,setNotice]=React.useState(null),[pending,setPending]=React.useState(()=>{try{const p=JSON.parse(localStorage.getItem(PENDING)||'null');return p?.p_list_date===props.date?p:null}catch{return null}});
  const lock=React.useRef(false),latest=React.useRef(props),origin=React.useRef(null),noticeTimer=React.useRef(null);latest.current=props;
  React.useEffect(()=>{document.body.dataset.appRole='service';document.body.classList.add('service-first');return()=>{document.body.classList.remove('service-first');clearTimeout(noticeTimer.current)}},[]);
  function announce(value){clearTimeout(noticeTimer.current);setNotice(value);if(!value?.error)noticeTimer.current=setTimeout(()=>setNotice(null),6500)}
  async function send(action){
   if(lock.current)return;lock.current=true;setBusy(true);announce(null);
   try{
    // The operation is persisted before transmission. A lost response retries the same UUID.
    localStorage.setItem(PENDING,JSON.stringify(action));setPending(action);
    const response=await fetch(`${latest.current.endpoint}/rest/v1/rpc/${Object.hasOwn(action,'p_table')?'breakfast_service_action_v41':'breakfast_service_action_v4'}`,{method:'POST',headers:latest.current.headers(),body:JSON.stringify(action),signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw Error('save failed');const result=await response.json();
    if(!['saved','duplicate','conflict','finished','missing'].includes(result.status))throw Error('invalid response');
    if(result.payload)latest.current.applyPayload(result.payload);
    localStorage.removeItem(PENDING);setPending(null);
    if(result.status==='saved'||result.status==='duplicate'){
     const current=result.payload.rooms.find(r=>r.room===action.p_room);
     if(action.p_delta>0){setReceipt({people:action.p_delta,table:action.p_table||current.table||text('ohne Tischangabe','table unknown','chưa có bàn')});setTable('');setAmount(1)}else setReceipt(null);
     announce({text:`${lang.room} ${action.p_room} · ${current.arrivedCount}/${current.people} ${lang.registered}`,undo:action.p_delta>0?{room:action.p_room,expected:normalize(current),id:Object.hasOwn(action,'p_table')?action.p_action_id:null,people:action.p_delta,table:action.p_table}:null});
    } else announce({text:lang[result.status],error:true});
   }catch{announce({text:lang.failed,error:true})}finally{setBusy(false);lock.current=false}
  }
  function change(room,delta,expected,undo){
   if(lock.current||pending||props.finished)return;
   if(latest.current.legacyPending()){announce({text:props.language==='en'?'Previous changes are still syncing. Try again shortly.':'Vorherige Änderungen werden synchronisiert. Bitte kurz warten.',error:true});return}
   const r=normalize(room);if(r.arrivedCount+delta>r.people||r.arrivedCount+delta<0||delta>0&&!table)return;
   send({p_list_date:props.date,p_room:r.room,p_expected:expected||r,p_delta:delta,p_action_id:crypto.randomUUID(),p_table:delta>0?table:undo?.table||null,p_undo_action_id:undo?.id||null});
  }
  const all=props.rooms.map(normalize).sort((a,b)=>a.room-b.room),occupied=all.filter(r=>r.people&&r.guests?.length),included=occupied.filter(r=>r.included),total=included.reduce((a,r)=>a+r.people,0),count=included.reduce((a,r)=>a+r.arrivedCount,0);
  const filtered=all.filter(r=>matches(r,query)&&(!onlyOpen||isOpen(r)));
  const lastSeated=latestTablePlacements(all);
  const current=all.find(r=>r.room===selected);
  const blocked=busy||!!pending||props.finished;
  function openRoom(r,event){origin.current=event.currentTarget;setSelected(r.room);setAmount(Math.max(0,Number(r.people||0)-normalize(r).arrivedCount));setTable('');setReceipt(null)}
  function closeRoom(){setSelected(null);setTimeout(()=>origin.current?.isConnected&&origin.current.focus(),0)}
  React.useEffect(()=>{if(selected===null&&!stats)return;const dialog=document.querySelector('.v4-dialog');dialog?.querySelector('button')?.focus();const key=e=>{if(e.key==='Escape'){e.preventDefault();closeRoom();setStats(false)}if(e.key==='Tab'){const controls=[...dialog.querySelectorAll('button:not(:disabled)')];const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}};dialog?.addEventListener('keydown',key);return()=>dialog?.removeEventListener('keydown',key)},[selected,stats]);
  function card(r){
   const occupied=r.people>0&&r.guests?.length,complete=occupied&&r.arrivedCount>=r.people,partial=occupied&&r.arrivedCount>0&&!complete;
   const state=complete?lang.registered:partial?text('Teilweise','Partial','Một phần'):r.included?lang.included:lang.excluded;
   const tables=roomTables(r).sort((a,b)=>Number(lastSeated.get(b)===Number(r.room))-Number(lastSeated.get(a)===Number(r.room)));
   const tableLabel=text('Tisch','Table','Bàn'),serviceLabel=text('Roomservice','Room service','Phục vụ tại phòng');
   const seating=tables.map(t=>t==='Roomservice'?serviceLabel:`${tableLabel} ${t}`).join(' · ');
   const latestForRoom=tables.filter(t=>t!=='Roomservice'&&lastSeated.get(t)===Number(r.room));
   return h('article',{key:r.room,className:`v4-room ${complete?'is-complete':''} ${partial?'is-partial':''} ${!occupied?'is-vacant':''} ${r.included?'is-included':''}`,style:{'--room-row':r.room%10+1},'data-room':r.room,'aria-label':`${lang.room} ${r.room}`},
    h(occupied?'button':'div',{className:'v4-room-open',...(occupied?{type:'button',onClick:e=>openRoom(r,e),'aria-label':`${lang.room} ${r.room}: ${r.guests.join(', ')}. ${r.people} ${lang.people}. ${state}${seating?'. '+seating:''}${latestForRoom.length?'. '+text('Zuletzt erfasst an Tisch','Last recorded at table','Ghi nhận gần nhất tại bàn')+' '+latestForRoom.join(' und '):''}`}:{})},
     h('span',{className:'v4-room-id'},h('strong',{className:'v4-number'},r.room),occupied&&h('span',{className:'v4-people'},icon('person'),r.people)),
     h('span',{className:'v4-room-body'},occupied?h('span',{className:'v4-names'},r.guests.slice(0,2).map((name,i)=>h('span',{key:i},name)),r.guests.length>2&&h('small',{className:'v4-more'},`+${r.guests.length-2}`)):h('span',{className:'v4-vacant'},lang.vacant),(partial||seating)&&h('span',{className:'v4-room-meta'},partial&&h('span',{className:'v4-partial'},text('Teilweise','Partial','Một phần')),seating&&h('span',{className:'v4-room-table',title:seating},tables.map((table,i)=>h(React.Fragment,{key:table},
       i?h('span',{className:'v4-table-divider'},' · '):null,
       table==='Roomservice'?h('span',{className:'v4-table-service'},serviceLabel):h(React.Fragment,null,
        h('span',{className:'v4-table-label'},`${tableLabel} `),
        h('span',{className:`v4-table-number ${lastSeated.get(table)===Number(r.room)?'is-latest':''}`,title:lastSeated.get(table)===Number(r.room)?text('Zuletzt an diesem Tisch erfasst (Belegung nicht bestätigt)','Latest recorded at this table (occupancy not confirmed)','Ghi nhận gần nhất tại bàn (chưa xác nhận còn ngồi)'):text('Frühere oder zeitlich unbekannte Tischzuweisung','Earlier or undated table assignment','Bàn được gán trước đó hoặc không rõ thời gian')},table))))))),
     complete&&h('span',{className:'v4-done','aria-label':lang.registered},icon('check')))
   );
  }
  const status=pending?lang.pending:/Offline/.test(props.status)?lang.offline:/gespeichert|Aktuell auf allen/.test(props.status)?lang.synced:lang.waiting;
  return h(React.Fragment,null,
   h('main',{className:'v4-shell',inert:selected!==null||stats},
    h('header',{className:'v4-header'},h('img',{className:'v4-logo',src:'/ambassador-logo.svg',alt:'Ambassador Hotel Zürich'}),h('div',{className:'v4-brand'},h('h1',null,'Frühstück'),h('div',{className:'v48-header-meta'},h('span',null,lang.service),h('span',{'aria-hidden':true},'·'),h('time',{dateTime:props.date},new Intl.DateTimeFormat(props.language==='en'?'en-GB':props.language==='vi'?'vi-VN':'de-CH',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(props.date+'T12:00:00'))))),h('div',{className:'v4-header-actions'},h('select',{'aria-label':'Sprache / Language',value:props.language,onChange:e=>{localStorage.setItem('ambassador-ui-language',e.target.value.toUpperCase());localStorage.setItem('ambassador-language',e.target.value);window.dispatchEvent(new CustomEvent('ambassador-language-change',{detail:e.target.value}))}},['de','en','vi'].map(code=>h('option',{value:code,key:code},code.toUpperCase()))),h('button',{className:'v4-statistics','aria-label':text('Statistik','Statistics','Thống kê'),onClick:e=>{origin.current=e.currentTarget;setStats(true)}},icon('stats')),h('button',{className:'v4-role',onClick:()=>{sessionStorage.setItem('ambassador-work-area','reception');location.reload()}},lang.reception),h('a',{href:'https://ambassador-apps.vercel.app/','aria-label':'App-Hub'},icon('hub')))),
    h('section',{className:'v4-tools','aria-label':lang.service},h('div',{className:'v4-progress'},h('div',null,h('strong',null,`${count} / ${total}`),h('span',null,props.language==='de'?'inklusive Gäste erfasst':props.language==='en'?'included guests checked in':'khách bao gồm đã đến')),h('progress',{value:count,max:Math.max(1,total),'aria-label':lang.registered})),h('label',{className:'v4-search'},icon('search'),h('input',{type:'search',value:query,placeholder:lang.search,'aria-label':lang.search,onChange:e=>setQuery(e.target.value)})),h('button',{className:'v4-filter','aria-pressed':onlyOpen,onClick:()=>setOpen(v=>!v)},h('span',{'aria-hidden':true},onlyOpen?'✓':''),lang.open),h('button',{className:'v4-special',disabled:blocked,'aria-haspopup':'dialog',onClick:()=>window.dispatchEvent(new Event('ambassador-open-special'))},icon('person'),lang.extra)),
    props.finished&&h('p',{className:'v4-alert',role:'status'},lang.finished),
    h('section',{className:`v4-grid ${query||onlyOpen?'is-filtered':''}`,'aria-label':lang.all},occupied.length&&filtered.length?[20,30,40,50,60].map(base=>h('div',{className:'v4-column',key:base,'aria-label':`${base}–${base+8}`},filtered.filter(r=>r.room>=base&&r.room<base+10).map(card))):h('div',{className:'v4-empty'},h('h2',null,occupied.length?lang.noResults:lang.empty),occupied.length>0&&h('button',{onClick:()=>{setQuery('');setOpen(false)}},lang.reset))),
    h('footer',{className:'v4-footer'},h('span',{'aria-live':'polite',className:pending||/Offline/.test(props.status)?'v4-sync-wait':''},status),h('span',null,`${occupied.length} ${lang.room} · ${occupied.reduce((s,r)=>s+r.people,0)} ${lang.people}`))
   ),
   (busy||pending||notice)&&h('aside',{className:`v4-toast ${notice?.error?'is-error':''}`,role:'status','aria-live':'polite'},h('span',null,busy?lang.save:notice?.text||lang.pending),!busy&&pending&&h('button',{onClick:()=>send(pending)},lang.retry),!busy&&!pending&&notice?.undo&&h('button',{onClick:()=>{const r=all.find(r=>r.room===notice.undo.room);if(r)change(r,-notice.undo.people,notice.undo.expected,notice.undo)}},lang.undo),!busy&&!pending&&h('button',{'aria-label':lang.close,onClick:()=>setNotice(null)},'×')),
   current&&h('div',{className:'v4-dialog-layer',onClick:e=>e.target===e.currentTarget&&closeRoom()},h('section',{className:'v4-dialog v41-checkin',role:'dialog','aria-modal':true,'aria-labelledby':'v4-dialog-title'},
    h('header',null,h('div',null,h('h2',{id:'v4-dialog-title'},`${lang.room} ${current.room}`),h('p',{className:'v41-subtitle'},`${current.arrivedCount} / ${current.people} ${lang.registered}`)),h('button',{'aria-label':lang.close,onClick:closeRoom},icon('close'))),
    h('div',{className:'v4-dialog-body'},
     receipt&&h('div',{className:'v41-receipt',role:'status'},icon('check'),h('strong',null,text('Gespeichert','Saved','Đã lưu')),h('span',null,`${receipt.people} ${lang.people} · ${receipt.table}`)),
     !receipt&&current.arrivedCount<current.people&&h(React.Fragment,null,
      h('div',{className:'v41-count'},h('label',{id:'v41-amount'},text('Gäste jetzt','Guests now','Số khách đến')),h('div',{'aria-labelledby':'v41-amount'},h('button',{disabled:blocked||amount<=1,onClick:()=>setAmount(a=>a-1),'aria-label':text('Weniger Gäste','Fewer guests','Bớt khách')},'−'),h('strong',null,Math.min(amount,current.people-current.arrivedCount)),h('button',{disabled:blocked||amount>=current.people-current.arrivedCount,onClick:()=>setAmount(a=>a+1),'aria-label':text('Mehr Gäste','More guests','Thêm khách')},'+'))),
      h('div',{className:'v41-table-heading'},h('strong',null,text('Tisch wählen','Choose table','Chọn bàn')),h('div',null,h('button',{className:'v41-roomservice','aria-pressed':table==='Roomservice',disabled:blocked,onClick:()=>setTable('Roomservice')},text('Roomservice','Room service','Phục vụ tại phòng')))),
      h('div',{className:'v41-tables','aria-label':text('Tischwahl 1 bis 14','Tables 1 to 14','Bàn 1 đến 14')},Array.from({length:14},(_,i)=>i+1).map(n=>h('button',{key:n,'aria-label':`${text('Tisch','Table','Bàn')} ${n}`,'aria-pressed':table===`Tisch ${n}`,disabled:blocked,onClick:()=>setTable(`Tisch ${n}`)},n)))
     ),
     h('div',{className:'v41-guest-info'},h('div',{className:'v41-names'},current.guests.map((name,i)=>h('p',{key:i,className:'v4-full-name'},name))),h('strong',{className:'v41-entitlement'},current.included?text('Frühstück inklusive','Breakfast included','Bao gồm bữa sáng'):text('Frühstück nicht inklusive','Breakfast not included','Không bao gồm bữa sáng')),
      h('div',{className:'v41-stay'},(()=>{const stay=stayInfo(current,props.date);return[h('div',{key:'nights'},h('small',null,text('Aufenthalt','Stay','Lưu trú')),h('span',null,stay.nights===null?text('Keine Angabe','Not available','Không có thông tin'):stay.nights===0?text('Abreise heute','Departure today','Trả phòng hôm nay'):text(`Noch ${stay.nights} ${stay.nights===1?'Nacht':'Nächte'}`,`${stay.nights} nights remaining`,`Còn ${stay.nights} đêm`))),h('div',{key:'breakfast',title:text('Morgen nach Anreise bis einschliesslich Abreise.','Mornings after arrival through departure day.','Từ sáng sau ngày nhận phòng đến ngày trả phòng.')},h('small',null,text('Frühstück heute','Breakfast today','Bữa sáng hôm nay')),h('span',null,stay.breakfast===null?text('Keine Angabe','Not available','Không có thông tin'):text(`${stay.breakfast}. von ${stay.total} Frühstücken`,`${stay.breakfast} of ${stay.total} breakfasts`,`${stay.breakfast} / ${stay.total} bữa sáng`)))]})()),current.note&&h('p',{className:'v4-note'},current.note)),
     current.arrivedCount>0&&h('div',{className:'v41-bookings'},h('strong',null,text('Bereits erfasst','Checked in','Đã ghi nhận')),(current.serviceBookings||[]).map(b=>h('div',{key:b.id},h('span',null,`${b.people} ${lang.people} · ${b.table}`),h('button',{disabled:blocked,onClick:()=>{setReceipt(null);change(current,-b.people,undefined,b)}},lang.undo))),current.arrivedCount>(current.serviceBookings||[]).reduce((n,b)=>n+b.people,0)&&h('div',null,h('span',null,`${current.arrivedCount-(current.serviceBookings||[]).reduce((n,b)=>n+b.people,0)} ${lang.people} · ${current.serviceLegacyTable||current.table||text('ohne Tischangabe','table unknown','chưa có bàn')}`),h('button',{disabled:blocked,onClick:()=>{setReceipt(null);change(current,-1)},'aria-label':lang.minus},'−1')))
    ),
    h('footer',{className:'v41-dialog-footer'},receipt||current.arrivedCount>=current.people?h('button',{className:'v41-save',onClick:closeRoom},lang.close):h('button',{className:'v41-save',disabled:blocked||!table,onClick:()=>change(current,Math.min(amount,current.people-current.arrivedCount))},busy?lang.save:table?text(`${Math.min(amount,current.people-current.arrivedCount)} ${amount===1?'Gast':'Gäste'} · ${table} erfassen`,`Check in · ${table}`,`Ghi nhận · ${table}`):text('Tisch wählen','Choose table','Chọn bàn')))
   )),
   stats&&h('div',{className:'v4-dialog-layer',onClick:e=>e.target===e.currentTarget&&setStats(false)},h('section',{className:'v4-dialog v41-stats',role:'dialog','aria-modal':true,'aria-labelledby':'v41-stats-title'},h('header',null,h('h2',{id:'v41-stats-title'},text('Frühstück heute','Breakfast today','Bữa sáng hôm nay')),h('button',{'aria-label':lang.close,onClick:()=>{setStats(false);origin.current?.focus()}},icon('close'))),h('div',{className:'v4-dialog-body'},(()=>{const day=dayStatistics(props.rooms,props.arrivals||[]);return h('dl',null,[[text('Frühstücke gesamt','Total breakfasts','Tổng bữa sáng'),day.total],[text('Inklusive erfasst','Included checked in','Đã đến · bao gồm'),`${day.includedArrived} / ${day.includedExpected}`],[text('Inklusive noch offen','Included still open','Chưa đến · bao gồm'),day.includedMissing],[text('Hotelgäste zusätzlich','Additional hotel guests','Khách khách sạn bổ sung'),day.hotelAdditional],[text('Opera Gäste','Opera guests','Khách Opera'),day.opera],[text('Externe Gäste','External guests','Khách bên ngoài'),day.external]].map(([name,value])=>h('div',{key:name},h('dt',null,name),h('dd',null,value))))})())))
  );
 };
 return Component;
}
const api={component,normalize,isOpen,matches,effectiveArrivals,dayStatistics,dailySnapshot,statisticsCsv,downloadStatistics,stayInfo,importList,editRoom,roomTables,latestTablePlacements};root.AmbassadorServiceV4=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

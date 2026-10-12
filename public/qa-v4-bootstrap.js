/* Isolated QA only. Never included by Production entry. */
function bootstrap(){
 const store=data=>({get length(){return Object.keys(data).length},key:i=>Object.keys(data)[i]??null,getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k],clear:()=>Object.keys(data).forEach(k=>delete data[k])});
 Object.defineProperty(window,'localStorage',{value:store(parent.qaStores.local)});Object.defineProperty(window,'sessionStorage',{value:store(parent.qaStores.session)});
 const native=window.fetch.bind(window);window.fetch=async(input,options={})=>{
  const url=new URL(typeof input==='string'?input:input.url,location.href),method=(options.method||'GET').toUpperCase();
  if(url.origin===location.origin&&['GET','HEAD'].includes(method)&&!url.pathname.startsWith('/api/'))return native(input,options);
  if(parent.document.getElementById('offline').checked)throw Error('Isolated offline simulation');
  const clone=x=>JSON.parse(JSON.stringify(x));
  if(url.pathname==='/rest/v1/breakfast_lists'&&method==='GET')return new Response(JSON.stringify([{payload:clone(parent.qaCloud),updated_at:parent.qaCloud.updated}]),{status:200});
  if(url.pathname.includes('guest_preferences')&&method==='GET')return new Response('[]',{status:200});
  if(url.pathname==='/rest/v1/rpc/breakfast_import_v41'&&method==='POST'){
   const a=JSON.parse(options.body),cloud=parent.qaCloud;parent.qaCalls.push(clone(a));
   const conflict=cloud.rooms.find(r=>r.arrivedCount>0&&(()=>{const n=a.p_rooms.find(n=>n.room===r.room);return !n||JSON.stringify(n.guests)!==JSON.stringify(r.guests)||n.people<r.arrivedCount})());
   if(conflict)return new Response(JSON.stringify({status:'conflict',room:conflict.room,payload:clone(cloud)}),{status:200});
   cloud.rooms=a.p_rooms.map(r=>{const old=cloud.rooms.find(o=>o.room===r.room);return old?.arrivedCount>0?{...old,guests:r.guests,people:r.people,included:r.included,arrival:r.arrival,departure:r.departure}:r});cloud.updated=Math.max(Date.now(),cloud.updated+1);
   return new Response(JSON.stringify({status:'saved',payload:clone(cloud)}),{status:200});
  }
  if(url.pathname==='/rest/v1/rpc/breakfast_room_edit_v42'&&method==='POST'){
   const a=JSON.parse(options.body),cloud=parent.qaCloud;parent.qaCalls.push(clone(a));const current=cloud.rooms.find(r=>r.room===a.p_room);cloud.v42RoomEdits=cloud.v42RoomEdits||{};
   let status=cloud.v42RoomEdits[a.p_action_id]?'duplicate':'saved';
   if(status==='saved'&&(!current||['guests','people','included','arrival','departure','note'].some(k=>JSON.stringify(current[k]??null)!==JSON.stringify(a.p_expected[k]??null))||a.p_changes.people<current.arrivedCount))status='conflict';
   if(status==='saved'){Object.assign(current,a.p_changes);cloud.v42RoomEdits[a.p_action_id]=true;cloud.updated=Math.max(Date.now(),cloud.updated+1)}
   return new Response(JSON.stringify({status,payload:clone(cloud)}),{status:200});
  }
  if(url.pathname==='/rest/v1/rpc/merge_breakfast_changes'&&method==='POST'){
   const a=JSON.parse(options.body),cloud=parent.qaCloud;parent.qaCalls.push(clone(a));
   const changed=new Map((a.p_rooms||[]).map(r=>[r.room,r]));
   cloud.rooms=cloud.rooms.map(r=>changed.get(r.room)||r);
   for(const r of changed.values())if(!cloud.rooms.some(old=>old.room===r.room))cloud.rooms.push(r);
   cloud.v8Arrivals=[...new Map([...cloud.v8Arrivals,...a.p_arrivals||[]].map(e=>[JSON.stringify(e),e])).values()];
   cloud.v8Activity=[...new Map([...cloud.v8Activity,...a.p_activity||[]].map(e=>[e.id,e])).values()].slice(-30);
   if(Array.isArray(a.p_history))cloud.v8History=a.p_history;
   cloud.updated=Math.max(a.p_updated||0,cloud.updated);return new Response(JSON.stringify(clone(cloud)),{status:200});
  }
  if(['/rest/v1/rpc/breakfast_service_action_v4','/rest/v1/rpc/breakfast_service_action_v41'].includes(url.pathname)&&method==='POST'){
   const a=JSON.parse(options.body);parent.qaCalls.push(clone(a));const cloud=parent.qaCloud,current=cloud.rooms.find(r=>r.room===a.p_room);let status='saved';
   if(cloud.v4ServiceActions[a.p_action_id])status='duplicate';
   else if(!current||current.arrivedCount!==a.p_expected.arrivedCount||JSON.stringify(current.guests)!==JSON.stringify(a.p_expected.guests)||current.people!==a.p_expected.people||current.included!==a.p_expected.included||current.arrivedCount+a.p_delta<0||current.arrivedCount+a.p_delta>current.people)status='conflict';
   else {if(Object.hasOwn(a,'p_table')){current.serviceBookings=current.serviceBookings||[];if(a.p_delta>0){current.serviceBookings.push({id:a.p_action_id,people:a.p_delta,table:a.p_table,at:Date.now()})}else if(a.p_undo_action_id){current.serviceBookings=current.serviceBookings.filter(b=>b.id!==a.p_undo_action_id)}current.table=[...new Set(current.serviceBookings.map(b=>b.table))].join(' · ')}current.arrivedCount+=a.p_delta;current.present=current.arrivedCount>0;cloud.updated=Math.max(Date.now(),cloud.updated+1);cloud.v4ServiceActions[a.p_action_id]=true;cloud.v8Arrivals.push({room:a.p_room,at:cloud.updated,included:current.included,people:a.p_delta,actionId:a.p_action_id,table:a.p_table,undoActionId:a.p_undo_action_id})}
   return new Response(JSON.stringify({status,payload:clone(cloud)}),{status:200});
  }
  throw Error('Isolated QA: external data and writes blocked');
 };
 const open=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url,...args){const u=new URL(url,location.href);if(u.origin!==location.origin||method.toUpperCase()!=='GET'||u.pathname.startsWith('/api/'))throw Error('QA XHR blocked');return open.call(this,method,url,...args)};
 window.WebSocket=function(){throw Error('QA websocket blocked')};navigator.sendBeacon=()=>false;
}
bootstrap();

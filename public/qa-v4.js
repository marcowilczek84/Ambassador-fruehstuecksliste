/* Executes the actual application in a network-isolated iframe. No production writes. */
const qaDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zurich'}).format(new Date());
const rooms=window.v4Fixture.map(([room,guests,included,arrivedCount,table])=>({room,guests,people:guests.length,included:!!included,present:arrivedCount>0,arrivedCount,departedCount:0,table,arrival:qaDate,departure:'2026-12-30',note:room===24?'Fiktive Servicenotiz: glutenfreies Brot gewünscht.':'',guestInfo:[]}));
rooms.find(r=>r.room===27).guests=[];rooms.find(r=>r.room===27).people=0;
window.qaCloud={date:qaDate,rooms,v8Arrivals:[],v8Activity:[],v8History:[],updated:1,v4ServiceActions:{}};
window.qaStores={local:{},session:{'ambassador-work-area':'service','ambassador_splash_seen':'1'}};
window.qaStores.local['ambassador-breakfast-rooms']=JSON.stringify({date:qaDate,rooms});
window.qaCalls=[];let role='service',size=new URLSearchParams(location.search).get('size')||'1194x834';const frame=document.getElementById('app');
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
  if(url.pathname==='/rest/v1/rpc/breakfast_service_action_v4'&&method==='POST'){
   const a=JSON.parse(options.body);parent.qaCalls.push(clone(a));const cloud=parent.qaCloud,current=cloud.rooms.find(r=>r.room===a.p_room);let status='saved';
   if(cloud.v4ServiceActions[a.p_action_id])status='duplicate';
   else if(!current||current.arrivedCount!==a.p_expected.arrivedCount||JSON.stringify(current.guests)!==JSON.stringify(a.p_expected.guests)||current.people!==a.p_expected.people||current.included!==a.p_expected.included||current.arrivedCount+a.p_delta<0||current.arrivedCount+a.p_delta>current.people)status='conflict';
   else {current.arrivedCount+=a.p_delta;current.present=current.arrivedCount>0;cloud.updated=Math.max(Date.now(),cloud.updated+1);cloud.v4ServiceActions[a.p_action_id]=true;cloud.v8Arrivals.push({room:a.p_room,at:cloud.updated,included:current.included,people:a.p_delta,actionId:a.p_action_id})}
   return new Response(JSON.stringify({status,payload:clone(cloud)}),{status:200});
  }
  throw Error('Isolated QA: external data and writes blocked');
 };
 const open=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url,...args){const u=new URL(url,location.href);if(u.origin!==location.origin||method.toUpperCase()!=='GET'||u.pathname.startsWith('/api/'))throw Error('QA XHR blocked');return open.call(this,method,url,...args)};
 window.WebSocket=function(){throw Error('QA websocket blocked')};navigator.sendBeacon=()=>false;
}
async function show(){const [width,height]=size.split('x').map(Number);frame.width=width;frame.height=height;let html=await(await fetch('/index-live.html')).text();html=html.replace('<head>','<head><meta name="robots" content="noindex,nofollow"><script>('+bootstrap.toString()+')();<\/script>');frame.srcdoc=html;}
document.querySelectorAll('[data-size]').forEach(b=>b.onclick=()=>{size=b.dataset.size;show()});document.getElementById('reload').onclick=show;document.getElementById('reception').onclick=()=>{role=role==='service'?'reception':'service';window.qaStores.session['ambassador-work-area']=role;show()};document.getElementById('other').onclick=()=>{const r=window.qaCloud.rooms.find(r=>r.room===20);r.arrivedCount=Math.min(r.people,r.arrivedCount+1);r.present=r.arrivedCount>0;window.qaCloud.updated=Math.max(Date.now(),window.qaCloud.updated+1)};show();

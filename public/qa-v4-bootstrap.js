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
bootstrap();

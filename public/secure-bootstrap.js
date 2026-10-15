/* V4.1 isolated adapter. Production URLs in the recovered runtime are never sent. */
(function(){
'use strict';
if(parent===window||!parent.breakfastSecure){location.replace('/auth.html');throw Error('Authenticated shell required');}
const auth=parent.breakfastSecure,ctx=auth.context(),pre=auth.storagePrefix,native=window.fetch.bind(window),disk=window.localStorage,session=window.sessionStorage;
let payload=null,busy=false;
const lang=()=>String(disk.getItem('ambassador-language')||auth.language()).toLowerCase();
const tr=(de,en,vi)=>lang()==='en'?en:lang()==='vi'?vi:de;
const shared=new Set(['ambassador-language','ambassador-ui-language']);
const store={get length(){return Object.keys(disk).filter(k=>k.startsWith(pre)).length;},key:i=>Object.keys(disk).filter(k=>k.startsWith(pre))[i]?.slice(pre.length)??null,getItem:k=>disk.getItem(shared.has(k)?k:pre+k),setItem:(k,v)=>disk.setItem(shared.has(k)?k:pre+k,String(v)),removeItem:k=>disk.removeItem(shared.has(k)?k:pre+k),clear:()=>Object.keys(disk).filter(k=>k.startsWith(pre)).forEach(k=>disk.removeItem(k))};
Object.defineProperty(window,'localStorage',{value:store});
const area=()=>ctx.role==='service'?'service':session.getItem('bf41-area')||'reception';
Object.defineProperty(window,'sessionStorage',{value:{getItem:k=>k==='ambassador-work-area'?area():session.getItem(pre+k),setItem:(k,v)=>k==='ambassador-work-area'?session.setItem('bf41-area',ctx.role==='service'?'service':v):session.setItem(pre+k,String(v)),removeItem:k=>k==='ambassador-work-area'?auth.openAccount():session.removeItem(pre+k)}});
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zurich'}).format(new Date());
const pendingKey='bf41-workflow-pending';
function apply(data){if(!data)return;payload=data;window.BreakfastSecureUI.apply?.(data);}
async function read(){const r=await auth.rpc('read',{p_list_date:today()});if(r.payload)payload=r.payload;return r;}
async function run(name,args){if(busy)throw Error(tr('Eine Speicherung läuft bereits.','A save is already in progress.','Đang lưu một thay đổi.'));const intent=JSON.stringify({name,args});let pending;try{pending=JSON.parse(store.getItem(pendingKey)||'null');}catch{throw Error('Unresolved local pending action');}
 if(pending&&pending.intent!==intent)throw Error(tr('Bitte zuerst die unbestätigte Aktion prüfen.','Please reconcile the unconfirmed action first.','Hãy kiểm tra thao tác chưa được xác nhận trước.'));
 if(!pending){pending={name,args:{...args,p_action_id:crypto.randomUUID()},intent,user:ctx.user_id,date:today()};store.setItem(pendingKey,JSON.stringify(pending));}
 if(pending.user!==ctx.user_id||pending.date!==today())throw Error(tr('Unbestätigte Aktion gehört zu einer anderen Sitzung oder einem anderen Tag. Bitte Verwaltung kontaktieren.','Unconfirmed action belongs to another session or day. Contact administration.','Thao tác thuộc phiên hoặc ngày khác. Liên hệ quản lý.'));
 busy=true;
 try{const result=await auth.rpc(pending.name,pending.args);if(result.payload)apply(result.payload);store.removeItem(pendingKey);if(!['saved','duplicate'].includes(result.status))throw Error(tr('Der Stand wurde verändert. Bitte aktuelle Daten prüfen.','The data changed. Please review the current state.','Dữ liệu đã thay đổi. Vui lòng kiểm tra lại.'));return result;
 }catch(e){if(['22023','22003','22P02','P0001','40001'].includes(e.code)){store.removeItem(pendingKey);try{apply((await read()).payload);}catch{/* Reconnect before another write. */}}throw e;}finally{busy=false;}}
function report(error){error.bf41Handled=true;window.alert(error.code==='42501'?tr('Berechtigung oder Sitzung ist nicht mehr gültig. Bitte erneut anmelden.','Permission or session is no longer valid. Please sign in again.','Quyền hoặc phiên không còn hợp lệ. Hãy đăng nhập lại.'):error.message);throw error;}
async function safely(fn){try{return await fn();}catch(e){return report(e);}}
function count(r){return Number(r.arrivedCount??(r.present||r.departed?r.people:0))||0;}
window.BreakfastSecureUI={
 apply:null,
 async commit(before,after,applyPayload){this.apply=applyPayload;return safely(async()=>{const ops=[],depart=[];for(const proposed of after){const old=before.find(r=>r.room===proposed.room);if(!old)throw Error('Unknown room');const changes={};for(const k of ['guests','people','included','arrival','departure','note']){if(JSON.stringify(old[k]??null)!==JSON.stringify(proposed[k]??null))changes[k]=proposed[k]??null;}
  const delta=count(proposed)-count(old);if(Object.keys(changes).length){if(delta)throw Error('Guest and attendance changes must be separate');ops.push({kind:'edit',room:old.room,expected:old,changes});}
  else if(delta){let undo=null;if(delta<0){const matches=(old.serviceBookings||[]).filter(b=>Number(b.people)===-delta);if(matches.length===1)undo=matches[0].id;else if((old.serviceBookings||[]).length)throw Error(tr('Bitte die konkrete Buchung im Service zurücknehmen.','Please undo the specific booking in Service.','Hãy hoàn tác đặt chỗ cụ thể trong phần Phục vụ.'));}
   const table=proposed.table||old.table;if(delta>0&&!/^(Tisch ([1-9]|[1-4][0-9]|50)|Roomservice)$/.test(table||''))throw Error(tr('Bitte im Service einen Tisch oder Roomservice wählen.','Please choose a table or room service in Service.','Hãy chọn bàn hoặc phục vụ tại phòng trong phần Phục vụ.'));
   ops.push({kind:'service',room:old.room,expected:{...old,arrivedCount:count(old)},delta,table,undo_id:undo});
  }else if(Number(proposed.departedCount||0)!==Number(old.departedCount||0)){if(Number(proposed.departedCount)!==count(old))throw Error('Invalid departure');depart.push({...old,arrivedCount:count(old),departedCount:Number(old.departedCount)||0});}}
  if(depart.length)ops.push({kind:'depart',rooms:depart});if(!ops.length)return true;await run('batch',{p_list_date:today(),p_operations:ops});return true;});},
 async history(history,applyPayload){this.apply=applyPayload;return safely(async()=>{if(!payload)apply((await read()).payload);const closing=history.find(h=>h.date===today());await run('workflow',{p_list_date:today(),p_kind:closing?'close':'reopen',p_data:{expected_updated:payload.updated,peak:closing?.peak,eighty:closing?.eighty}});return true;});},
 async clear(applyPayload){this.apply=applyPayload;return safely(async()=>{if(!payload)await read();await run('workflow',{p_list_date:today(),p_kind:'clear',p_data:{expected_updated:payload.updated}});return true;});},
 async special(type,people,table){return safely(async()=>{await run('workflow',{p_list_date:today(),p_kind:'special',p_data:{guest_type:type,people,table}});window.dispatchEvent(new Event('focus'));return true;});},
 async undoSpecial(id){return safely(async()=>{await run('workflow',{p_list_date:today(),p_kind:'special',p_data:{undo_id:id}});window.dispatchEvent(new Event('focus'));return true;});},
 async retry(){return safely(async()=>{const p=JSON.parse(store.getItem(pendingKey)||'null');if(!p)return;const intent=JSON.parse(p.intent);await run(intent.name,intent.args);window.dispatchEvent(new Event('focus'));return true;});}
};
window.fetch=async(input,options={})=>{const url=new URL(typeof input==='string'?input:input.url,location.href),method=(options.method||'GET').toUpperCase();if(url.origin===location.origin&&['GET','HEAD'].includes(method)&&!url.pathname.startsWith('/api/'))return native(input,options);
 if(url.origin===location.origin&&url.pathname==='/api/photo-list'&&method==='POST')return auth.authenticatedFetch(url.href,options);
 let result;const body=options.body?JSON.parse(options.body):{};
 try{if(method==='GET'&&url.pathname==='/rest/v1/breakfast_lists'){const d=await read();result=d.payload?[{payload:d.payload,updated_at:d.payload.updated}]:[];}
 else if(method==='GET'&&url.pathname==='/rest/v1/guest_preferences')result=[];
 else if(method==='POST'&&url.pathname==='/rest/v1/rpc/breakfast_service_action_v41'){result=await auth.rpc('service',body);if(result.payload)payload=result.payload;}
 else if(method==='POST'&&url.pathname==='/rest/v1/rpc/breakfast_room_edit_v42'){result=await auth.rpc('edit',body);if(result.payload)payload=result.payload;}
 else if(method==='POST'&&url.pathname==='/rest/v1/rpc/breakfast_import_v41'){result=await auth.rpc('import',body);if(result.payload)payload=result.payload;}
 else throw Object.assign(Error('Legacy write endpoint disabled in secure mode'),{code:'42501'});
 return Response.json(result);
 }catch(e){if(e.code)return Response.json({message:e.message,code:e.code},{status:e.code==='42501'?403:400});throw e;}};
const open=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url,...args){const u=new URL(url,location.href);if(u.origin!==location.origin||method.toUpperCase()!=='GET'||u.pathname.startsWith('/api/'))throw Error('Secure XHR blocked');return open.call(this,method,url,...args);};window.WebSocket=function(){throw Error('Secure bridge uses authenticated polling');};navigator.sendBeacon=()=>false;
window.addEventListener('unhandledrejection',e=>{if(e.reason?.bf41Handled)e.preventDefault();});
window.addEventListener('DOMContentLoaded',()=>{
 const style=document.createElement('style');style.textContent='.bf41-account{min-width:44px;min-height:44px;border:1px solid #7E898F;border-radius:8px;background:#fff;color:#202326}.bf41-retry{position:fixed;bottom:12px;left:12px;z-index:100000;min-height:44px;background:#1C777B;color:white;border:0;border-radius:8px;padding:10px 16px}';document.head.append(style);
 const enhance=()=>{const role=document.querySelector('.v4-role');if(role){const label=tr('Konto','Account','Tài khoản');if(role.textContent!==label)role.textContent=label;role.onclick=e=>{e.stopPropagation();auth.openAccount();};}
 const header=document.querySelector('.header-actions');if(header&&!header.querySelector('.bf41-account')){const button=document.createElement('button');button.className='bf41-account';button.textContent='◎';button.setAttribute('aria-label',tr('Konto und Gerät','Account and device','Tài khoản và thiết bị'));button.onclick=auth.openAccount;header.prepend(button);}
 let retry=document.querySelector('.bf41-retry');if(store.getItem(pendingKey)&&!retry){retry=document.createElement('button');retry.className='bf41-retry';retry.textContent=tr('Unbestätigte Aktion prüfen','Review unconfirmed action','Kiểm tra thao tác chưa xác nhận');retry.onclick=()=>window.BreakfastSecureUI.retry();document.body.append(retry);}else if(!store.getItem(pendingKey))retry?.remove();};
 let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance();});}).observe(document.body,{childList:true,subtree:true});enhance();
});
})();

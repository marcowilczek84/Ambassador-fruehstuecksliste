/* Isolated QA only. Production entry never loads this adapter. */
function bootstrap(){
 if(parent===window){location.replace('/qa-v4.html');return}
 const store=data=>({get length(){return Object.keys(data).length},key:i=>Object.keys(data)[i]??null,getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k],clear:()=>Object.keys(data).forEach(k=>delete data[k])});
 Object.defineProperty(window,'localStorage',{value:store(parent.qaStores.local)});
 Object.defineProperty(window,'sessionStorage',{value:store(parent.qaStores.session)});
 const native=window.fetch.bind(window);
 window.fetch=async(input,options={})=>{
  const url=new URL(typeof input==='string'?input:input.url,location.href),method=(options.method||'GET').toUpperCase();
  if(url.origin===location.origin&&['GET','HEAD'].includes(method)&&!url.pathname.startsWith('/api/'))return native(input,options);
  if(parent.document.getElementById('offline').checked)throw Error('Isolated offline simulation');
  const result=await parent.qaRequest(url.pathname+url.search,method,options.body?JSON.parse(options.body):null);
  if(method==='POST'&&parent.document.getElementById('lost').checked){parent.document.getElementById('lost').checked=false;throw Error('Isolated lost response after SQL commit')}
  return new Response(JSON.stringify(result.body),{status:result.status,headers:{'Content-Type':'application/json'}});
 };
 const open=XMLHttpRequest.prototype.open;
 XMLHttpRequest.prototype.open=function(method,url,...args){const u=new URL(url,location.href);if(u.origin!==location.origin||method.toUpperCase()!=='GET'||u.pathname.startsWith('/api/'))throw Error('QA XHR blocked');return open.call(this,method,url,...args)};
 window.WebSocket=function(){throw Error('QA websocket blocked')};navigator.sendBeacon=()=>false;
}
bootstrap();

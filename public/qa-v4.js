/* Executes the actual application in a network-isolated iframe. No production writes. */
const qaDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zurich'}).format(new Date());
const qaDay=offset=>{const d=new Date(qaDate+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10)};
const rooms=window.v4Fixture.map(([room,guests,included,arrivedCount,table])=>({room,guests,people:guests.length,included:!!included,present:arrivedCount>0,arrivedCount,departedCount:0,table,arrival:qaDay(-1),departure:qaDay(2),note:room===24?'Fiktive Servicenotiz: glutenfreies Brot gewünscht.':'',guestInfo:[]}));
rooms.find(r=>r.room===27).guests=[];rooms.find(r=>r.room===27).people=0;
rooms.find(r=>r.room===21).arrival=qaDate;rooms.find(r=>r.room===22).arrival='';rooms.find(r=>r.room===22).departure='';
window.qaCloud={date:qaDate,rooms,v8Arrivals:[],v8Activity:[],v8History:[],updated:1,v4ServiceActions:{}};
if(new URLSearchParams(location.search).has('stats')){
 window.qaCloud.v8Arrivals=[{room:0,people:3,included:false,guestType:'opera',at:Date.parse(qaDate+'T06:00:00Z'),actionId:'qa-opera'},{room:0,people:2,included:false,guestType:'external',at:Date.parse(qaDate+'T06:30:00Z'),actionId:'qa-external'}];
 window.qaCloud.v8History=[{date:qaDay(-2),includedExpected:50,includedArrived:42,additional:6,first:Date.parse(qaDay(-2)+'T05:00:00Z'),last:Date.parse(qaDay(-2)+'T08:00:00Z'),peak:'08:00–08:30',eighty:'07:30–09:00'},{date:qaDay(-1),includedExpected:40,includedArrived:35,additional:7,hotelAdditional:2,opera:3,external:2,total:42,first:Date.parse(qaDay(-1)+'T05:00:00Z'),last:Date.parse(qaDay(-1)+'T08:00:00Z'),peak:'08:30–09:00',eighty:'07:00–09:00'}];
}
window.qaStores={local:{},session:{'ambassador-work-area':'service','ambassador_splash_seen':'1'}};
window.qaStores.local['ambassador-breakfast-rooms']=JSON.stringify({date:qaDate,rooms});

window.qaCalls=[];
let role='service',size=new URLSearchParams(location.search).get('size')||'auto';
const frame=document.getElementById('app'),status=document.getElementById('qa-status');
function show(){
 const [width,height]=size==='auto'?[innerWidth,Math.max(568,innerHeight-document.querySelector('header').offsetHeight-status.offsetHeight-24)]:size.split('x').map(Number);
 frame.width=width;frame.height=height;frame.src='/qa-v4-app.html?view='+Date.now();
}
async function start(){
 try{
  await window.qaInit(window.qaCloud);
  status.textContent='Isolierte PostgreSQL-Testdaten im Browser. Keine Verbindung zu produktiven Gastdaten. Speicherung bleibt bei Reload erhalten. Eine Preview-Registerkarte pro Browser verwenden.';
  document.querySelectorAll('[data-size]').forEach(b=>b.onclick=()=>{size=b.dataset.size;show()});
  document.getElementById('reload').onclick=show;
  document.getElementById('reception').onclick=()=>{role=role==='service'?'reception':'service';window.qaStores.session['ambassador-work-area']=role;show()};
  document.getElementById('other').onclick=async()=>{
   const cloud=await window.qaDatabase.read(),r=cloud.rooms.find(r=>r.room===20);
   const result=await window.qaRequest('/rest/v1/rpc/breakfast_service_action_v41','POST',{p_list_date:qaDate,p_room:20,p_expected:r,p_delta:1,p_action_id:crypto.randomUUID(),p_table:'Tisch 14'});
   status.textContent='Zweiter Client: '+(result.body.status||result.body.message)+'. Die Oberfläche lädt den Datenbankstand automatisch nach.';
  };
  show();
 }catch(e){status.textContent='Prüfumgebung konnte nicht starten: '+e.message}
}
start();

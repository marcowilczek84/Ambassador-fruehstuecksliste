/* Executes the actual application in a network-isolated iframe. No production writes. */
const qaDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zurich'}).format(new Date());
const qaDay=offset=>{const d=new Date(qaDate+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10)};
const rooms=window.v4Fixture.map(([room,guests,included,arrivedCount,table])=>({room,guests,people:guests.length,included:!!included,present:arrivedCount>0,arrivedCount,departedCount:0,table,arrival:qaDay(-1),departure:qaDay(2),note:room===24?'Fiktive Servicenotiz: glutenfreies Brot gewünscht.':'',guestInfo:[]}));
rooms.find(r=>r.room===27).guests=[];rooms.find(r=>r.room===27).people=0;
rooms.find(r=>r.room===21).arrival=qaDate;rooms.find(r=>r.room===22).arrival='';rooms.find(r=>r.room===22).departure='';
window.qaCloud={date:qaDate,rooms,v8Arrivals:[],v8Activity:[],v8History:[],updated:1,v4ServiceActions:{}};
window.qaStores={local:{},session:{'ambassador-work-area':'service','ambassador_splash_seen':'1'}};
window.qaStores.local['ambassador-breakfast-rooms']=JSON.stringify({date:qaDate,rooms});
window.qaCalls=[];let role='service',size=new URLSearchParams(location.search).get('size')||'1194x834';const frame=document.getElementById('app');

async function show(){const [width,height]=size.split('x').map(Number);frame.width=width;frame.height=height;frame.src='/qa-v4-app.html?view='+Date.now();}

document.querySelectorAll('[data-size]').forEach(b=>b.onclick=()=>{size=b.dataset.size;show()});document.getElementById('reload').onclick=show;document.getElementById('reception').onclick=()=>{role=role==='service'?'reception':'service';window.qaStores.session['ambassador-work-area']=role;show()};document.getElementById('other').onclick=()=>{const r=window.qaCloud.rooms.find(r=>r.room===20);r.arrivedCount=Math.min(r.people,r.arrivedCount+1);r.present=r.arrivedCount>0;window.qaCloud.updated=Math.max(Date.now(),window.qaCloud.updated+1)};show();

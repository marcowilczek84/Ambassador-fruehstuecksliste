const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const api=require('../public/service-first.js');
const room={room:20,people:2,guests:['Clara Winter','Jonas Winter'],included:true,arrivedCount:0};
test('service filter covers partial, full, vacant, excluded and accented search',()=>{assert.ok(api.isOpen(room));assert.ok(api.isOpen({...room,arrivedCount:1}));assert.ok(!api.isOpen({...room,arrivedCount:2}));assert.ok(!api.isOpen({...room,included:false}));assert.ok(!api.isOpen({...room,guests:[]}));assert.ok(api.matches({...room,guests:['Renée Dubois']},'renee'));assert.ok(api.matches(room,'20'));assert.ok(!api.matches(room,'Meier'));});
test('room cards display only persisted, distinct tables and keep different bookings',()=>{
 assert.deepEqual(api.roomTables({...room,arrivedCount:0,table:'Tisch 4'}),[],'an unarrived guest is not shown as seated');
 assert.deepEqual(api.roomTables({...room,arrivedCount:2,serviceBookings:[{people:1,table:'Tisch 3'},{people:1,table:'Tisch 8'}],table:'Tisch 8'}),['3','8']);
 assert.deepEqual(api.roomTables({...room,arrivedCount:2,serviceBookings:[{people:1,table:'Tisch 3'},{people:1,table:'Tisch 3'}]}),['3'],'duplicate tables are shown once');
 assert.deepEqual(api.roomTables({...room,arrivedCount:2,serviceBookings:[{people:1,table:'Tisch 3'}],serviceLegacyTable:'Tisch 8'}),['3','8'],'legacy placement is kept when earlier arrivals exist');
 assert.deepEqual(api.roomTables({...room,arrivedCount:1,serviceBookings:[{people:1,table:'Tisch 3'}],serviceLegacyTable:'Tisch 8'}),['3'],'unmatched legacy placement is not invented');
});
test('latest recorded table placement wins per table, follows corrections and never guesses timestamps',()=>{
 const mk=(number,bookings,count=bookings.reduce((n,b)=>n+b.people,0))=>({...room,room:number,arrivedCount:count,people:Math.max(2,count),serviceBookings:bookings});
 const old=mk(20,[{id:'a',people:1,table:'Tisch 1',at:1000},{id:'b',people:1,table:'Tisch 2',at:1500}]);
 const recent=mk(35,[{id:'c',people:1,table:'Tisch 1',at:2000}]);
 assert.deepEqual([...api.latestTablePlacements([old,recent])],[['1',35],['2',20]],'room 35 replaces room 20 only at table 1');
 assert.equal(api.latestTablePlacements([old]).get('1'),20,'after undo the previous recorded placement becomes latest');
 assert.equal(api.latestTablePlacements([old,{...recent,serviceBookings:[{id:'missing',people:1,table:'Tisch 1'}]}]).get('1'),20,'unknown booking time is not treated as newest');
 assert.equal(api.latestTablePlacements([old,mk(35,[{id:'same',people:1,table:'Tisch 1',at:1000}])]).has('1'),false,'same timestamp in different rooms is ambiguous');
 assert.equal(api.latestTablePlacements([mk(20,[{people:1,table:'Tisch 1',at:2500}],0)]).has('1'),false,'an undone or unarrived room is not marked');
 assert.equal(api.latestTablePlacements([mk(20,[{people:0,table:'Tisch 1',at:2500}],1)]).has('1'),false,'zero-person booking is ignored');
});
test('legacy attendance normalization remains compatible and bounded',()=>{assert.equal(api.normalize({...room,arrivedCount:undefined,present:true}).arrivedCount,2);assert.equal(api.normalize({...room,arrivedCount:9}).arrivedCount,2);assert.equal(api.normalize({...room,arrivedCount:-2}).arrivedCount,0)});
test('corrected arrivals retain exact people totals and valid positive events for statistics',()=>{const result=api.effectiveArrivals([{room:20,people:1,included:true,at:1},{room:20,people:1,included:true,at:2},{room:21,people:1,included:true,at:3},{room:20,people:-1,included:true,at:4}]);assert.deepEqual(result.map(e=>[e.room,e.people,e.at]),[[20,1,1],[21,1,3]]);});
test('rendered table check-ins, independent bookings, corrections, retries, statistics and filters',async()=>{
 const {JSDOM}=require('jsdom');const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test'});const w=dom.window;
 for(const key of ['window','document','localStorage','sessionStorage','Event','CustomEvent'])global[key]=w[key];global.IS_REACT_ACT_ENVIRONMENT=true;
 const React=require('react');const{createRoot}=require('react-dom/client');let payload={date:'2026-10-12',rooms:[room,{...room,room:21,people:1,guests:['Test One']},{...room,room:22,included:false}],v8Arrivals:[],v8Activity:[],v8History:[],updated:1};let calls=[],fail=false,conflict=false;const seen=new Set();
 global.fetch=async(url,options)=>{const a=JSON.parse(options.body);calls.push(a);if(fail){fail=false;throw Error('offline')}if(conflict){conflict=false;return{ok:true,json:async()=>({status:'conflict',payload})}}if(!seen.has(a.p_action_id)){seen.add(a.p_action_id);payload={...payload,rooms:payload.rooms.map(r=>r.room===a.p_room?{...r,arrivedCount:r.arrivedCount+a.p_delta,serviceBookings:a.p_delta>0?[...r.serviceBookings||[],{id:a.p_action_id,people:a.p_delta,table:a.p_table}]:(r.serviceBookings||[]).filter(b=>b.id!==a.p_undo_action_id)}:r)}}return{ok:true,json:async()=>({status:'saved',payload})}};
 const root=createRoot(document.getElementById('root'));const C=api.component(React);let props={rooms:payload.rooms,language:'de',date:payload.date,status:'Aktuell auf allen Geräten',endpoint:'https://example.test',headers:()=>({}),legacyPending:()=>false,applyPayload:p=>{props={...props,rooms:p.rooms};root.render(React.createElement(C,props))}};
 const render=()=>React.act(async()=>root.render(React.createElement(C,props)));const click=selector=>React.act(async()=>document.querySelector(selector).click());await render();
 await click('article[data-room="20"]');assert.equal(calls.length,0,'whole card does not save');
 const checkin=async(number,table,partial=false)=>{await click(`[data-room="${number}"] .v4-room-open`);const remaining=payload.rooms.find(r=>r.room===number);assert.equal(Number(document.querySelector('.v41-count strong').textContent),remaining.people-remaining.arrivedCount,'defaults to all remaining room guests');if(partial){await click('.v41-count button');assert.equal(Number(document.querySelector('.v41-count strong').textContent),1,'can reduce to one guest for a partial arrival')}assert.equal(document.querySelector('.v41-save').disabled,true,'table required');await click(`[aria-label="Tisch ${table}"]`);await click('.v41-save')};
 await checkin(20,3,true);assert.equal(payload.rooms[0].arrivedCount,1);assert.match(document.querySelector('[data-room="20"] .v4-partial').textContent,/Teilweise/);assert.doesNotMatch(document.querySelector('[data-room="20"]').textContent,/1\/2|inkl\./);assert.equal(payload.rooms[0].serviceBookings[0].table,'Tisch 3');assert.match(document.querySelector('.v41-receipt').textContent,/Gespeichert/);await click('.v41-save');
 await checkin(20,8);assert.equal(payload.rooms[0].arrivedCount,2);assert.deepEqual(payload.rooms[0].serviceBookings.map(b=>b.table),['Tisch 3','Tisch 8']);await click('.v41-save');
 await click('[data-room="20"] .v4-room-open');await click('.v41-bookings button');assert.equal(payload.rooms[0].arrivedCount,1);assert.equal(payload.rooms[0].serviceBookings[0].table,'Tisch 8','undo preserves second table');await click('.v4-dialog header button');
 fail=true;await checkin(21,6);assert.equal(payload.rooms[1].arrivedCount,0);assert.ok(localStorage.getItem('ambassador-service-v4-pending'));const id=calls.at(-1).p_action_id;await click('.v4-toast button');assert.equal(calls.at(-1).p_action_id,id);assert.equal(payload.rooms[1].arrivedCount,1);assert.equal(localStorage.getItem('ambassador-service-v4-pending'),null);await click('.v41-save');
 await click('.v4-filter');assert.ok(document.querySelector('[data-room="20"]'));assert.equal(document.querySelector('[data-room="21"]'),null);assert.equal(document.querySelector('[data-room="22"]'),null);
 conflict=true;await checkin(20,9);assert.match(document.querySelector('.v4-toast').textContent,/inzwischen geändert/);assert.equal(payload.rooms[0].arrivedCount,1);await click('.v4-dialog header button');
 await click('.v4-statistics');assert.match(document.querySelector('.v41-stats').textContent,/Frühstücke gesamt2/);await click('.v41-stats header button');
 await React.act(async()=>root.unmount());dom.window.close();
});

test('room badges move to the newest table assignment without suggesting live occupancy',async()=>{
 const {JSDOM}=require('jsdom');const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test'});
 const w=dom.window;for(const name of ['window','document','localStorage','sessionStorage','Event','CustomEvent'])global[name]=w[name];
 global.IS_REACT_ACT_ENVIRONMENT=true;
 const React=require('react'),{createRoot}=require('react-dom/client');
 const mk=(number,at)=>({...room,room:number,people:2,arrivedCount:1,serviceBookings:[{id:String(number),people:1,table:'Tisch 1',at}]});
 const root=createRoot(document.getElementById('root')),C=api.component(React);
 let rooms=[mk(20,1000),mk(21,2000)];
 const props=()=>({rooms,language:'de',date:'2026-10-12',status:'Aktuell auf allen Geräten',endpoint:'https://example.test',headers:()=>({}),legacyPending:()=>false,applyPayload:()=>{}});
 const render=()=>React.act(async()=>root.render(React.createElement(C,props())));
 await render();
 const active=()=>[...document.querySelectorAll('.v4-table-number.is-latest')].map(e=>e.closest('[data-room]').dataset.room);
 assert.deepEqual(active(),['21'],'newer check-in at table 1 is highlighted');
 assert.equal(document.querySelector('[data-room="20"] .v4-table-number').textContent,'1');
 rooms=[mk(20,3000),mk(21,2000)];await render();assert.deepEqual(active(),['20'],'highlight switches when room 20 has the newest assignment');
 rooms=[mk(20,1000),mk(21,2000)];await render();assert.deepEqual(active(),['21'],'after correction the earlier valid assignment is highlighted');
 await React.act(async()=>root.unmount());dom.window.close();
});
test('stay calculation uses calendar dates, arrival excluded and departure included',()=>{
 const info=(a,d,t)=>api.stayInfo({arrival:a,departure:d},t);
 assert.deepEqual(info('2026-10-11','2026-10-14','2026-10-13'),{nights:1,breakfast:2,total:3});
 assert.deepEqual(info('2026-10-11','2026-10-14','2026-10-14'),{nights:0,breakfast:3,total:3});
 assert.deepEqual(info('2026-10-11','2026-10-14','2026-10-11'),{nights:3,breakfast:null,total:null});
 assert.deepEqual(info('2026-10-24','2026-10-26','2026-10-25'),{nights:1,breakfast:1,total:2},'DST does not change calendar count');
 for(const [a,d,t] of [['','2026-10-14','2026-10-12'],['2026-02-30','2026-03-02','2026-03-01'],['2026-10-14','2026-10-11','2026-10-12'],['2026-10-11','2026-10-11','2026-10-11'],['2026-10-11','2026-10-14','2026-10-15']])assert.deepEqual(info(a,d,t),{nights:null,breakfast:null,total:null});
});
test('undo a specific table booking preserves the later guest arrival',()=>{
 const events=[{room:20,people:1,included:true,at:1,actionId:'first',table:'Tisch 3'},{room:20,people:1,included:true,at:2,actionId:'second',table:'Tisch 8'},{room:20,people:-1,included:true,at:3,undoActionId:'first'}];
 assert.deepEqual(api.effectiveArrivals(events).map(e=>e.table),['Tisch 8']);
});

test('reception saves only master fields, waits for confirmation and retries with the same action id',async()=>{
 const {JSDOM}=require('jsdom');const dom=new JSDOM('<section class="guest-edit-modal"></section>',{url:'https://example.test'});
 for(const k of ['window','document','sessionStorage','localStorage'])global[k]=dom.window[k];sessionStorage.setItem('ambassador-work-area','reception');
 const alerts=[],calls=[];window.alert=x=>alerts.push(x);let fail=true,completed=0,applied=0;
 const current={...room,arrivedCount:1,table:'Tisch 8',serviceBookings:[{id:'other',people:1,table:'Tisch 8'}]};
 global.fetch=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});if(fail){fail=false;throw Error('lost response')}return{ok:true,json:async()=>({status:'duplicate',payload:{rooms:[current]}})}};
 const args={room:{...room,note:'New note'},expected:room,date:'2026-10-12',endpoint:'https://example.test',headers:{},apply:()=>applied++,onComplete:saved=>{completed++;assert.equal(saved.arrivedCount,1);assert.equal(saved.table,'Tisch 8')}};
 await api.editRoom(args);assert.equal(completed,0);assert.equal(applied,0);assert.equal(alerts.length,1);assert.equal(document.querySelector('section').inert,false);
 await api.editRoom(args);assert.equal(completed,1);assert.equal(applied,1);assert.equal(calls[0].body.p_action_id,calls[1].body.p_action_id);assert.match(calls[1].url,/breakfast_room_edit_v42$/);
 assert.deepEqual(Object.keys(calls[1].body.p_changes).sort(),['arrival','departure','guests','included','note','people']);
 global.fetch=async()=>({ok:true,json:async()=>({status:'conflict',payload:{rooms:[current]}})});
 await api.editRoom({...args,room:{...room,note:'Another note'}});assert.equal(completed,1);assert.equal(applied,2);assert.match(alerts.at(-1),/neu öffnen/);
 dom.window.close();
});

test('iPad check-in keeps the 25 tables in three rows with safe touch targets',()=>{
 const css=fs.readFileSync(require('node:path').join(__dirname,'../public/service-first.css'),'utf8');
 const compact=css.split('/* V4.3 · iPad check-in:')[1];
 assert.ok(compact,'dedicated iPad layout is present');
 assert.match(compact,/@media \(min-width:700px\) and \(min-height:650px\)/);
 assert.match(compact,/\.v41-tables\{\s*grid-template-columns:repeat\(10,minmax\(0,1fr\)\)!important/);
 assert.match(compact,/\.v41-tables button\{[^}]*min-width:44px!important;[^}]*min-height:44px!important/s);
 assert.match(compact,/\.v41-dialog-footer\{[^}]*flex:0 0 auto!important/s);
 assert.match(compact,/overflow-y:auto!important;\s*\/\* safe fallback/);
 for(const [width,height] of [[1024,768],[1194,834]]){
  const dialogWidth=Math.min(680,width-32);
  const buttonWidth=(dialogWidth-40-9*6)/10;
  assert.ok(buttonWidth>=44,`iPad ${width}x${height}: button width is ${buttonWidth}`);
  assert.ok(height-24>=700,`iPad ${width}x${height}: dialog can use a complete-height viewport`);
 }
});

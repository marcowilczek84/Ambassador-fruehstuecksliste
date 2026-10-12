const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),XLSX=require('xlsx');
const {cases,workbook}=require('../.github/scripts/zff-import-test.cjs');

test('actual V4 Mews handler preserves 25 synthetic product, people, name and date cases',async()=>{
 const source=fs.readFileSync('public/recovered/_next/static/chunks/0nkyeaxka~cd7-service-v4.js','utf8');
 const start=source.indexOf('sg=async s=>{'),end=source.indexOf(',sx=async',start);
 assert.ok(start>0&&end>start);
 const rooms=[20,30,40,50,60].flatMap(n=>Array.from({length:9},(_,i)=>n+i)).filter(n=>n!==55);
 let parsed,modal,error;
 const fn=vm.runInNewContext('('+source.slice(start+3,end)+')',{XLSX,e:{A:async()=>XLSX},I:rooms,Z:r=>r,$:x=>x,localStorage:{getItem:()=>null},ez:()=>{},ec:()=>{},eI:v=>parsed=v,eC:v=>modal=v,e2:s=>s,window:{alert:v=>error=v}});
 const bytes=workbook();await fn({arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
 assert.equal(error,undefined);assert.equal(modal,'import');
 for(const c of cases){const r=parsed.find(r=>r.room===c.room);assert.ok(r,c.id);for(const key of ['included','people','arrival','departure'])assert.equal(r[key],c[key],c.id+' '+key);assert.ok(r.guests.includes(c.guest),c.id+' guest');}
 assert.equal(parsed.filter(r=>r.guests.length).length,cases.length);
});

test('external guests queue no unrelated room writes and preserve preexisting room changes',()=>{
 const source=fs.readFileSync('public/workflow-polish.js','utf8');
 const start=source.indexOf('  function persistBreakfastState('),end=source.indexOf('\n  function ',start+1);
 const data={};const date='2026-10-12';
 const rooms=[{room:20,arrivedCount:0},{room:21,arrivedCount:0}];
 const ctx={Date,Map,JSON,specialGuestDate:()=>date,readBreakfastHistory:()=>[],readDailyState:()=>rooms,localStorage:{getItem:k=>data[k]||null,setItem:(k,v)=>data[k]=v},window:{dispatchEvent:()=>{}},Event:function(){}};
 vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
 const key='ambassador-breakfast-pending-sync-v1';ctx.persistBreakfastState(rooms,[{guestType:'external',people:1}],[]);
 assert.deepEqual(JSON.parse(data[key]).rooms,[]);
 data[key]=JSON.stringify({date,rooms:[{room:21,arrivedCount:1}]});
 ctx.persistBreakfastState([{room:20,arrivedCount:1},rooms[1]],[],[]);
 assert.deepEqual(JSON.parse(data[key]).rooms,[{room:21,arrivedCount:1},{room:20,arrivedCount:1}]);
});

test('external and Opera bookings survive merge/reload and targeted undo remains undone',()=>{
 const source=fs.readFileSync('public/workflow-polish.js','utf8');
 const api=require('../public/service-first.js');
 const rooms=[{room:20,people:2,arrivedCount:1,table:'Tisch 8',serviceBookings:[{id:'room-checkin',people:1,table:'Tisch 8'}]}];
 let state={rooms,events:[],items:[]},clock=1000;
 const ctx={Date:{now:()=>++clock},specialGuestDate:()=> '2026-10-12',window:{AmbassadorServiceV4:api},
  readDailyState:(_key,property)=>state[property],
  persistBreakfastState:(r,e,a)=>{state={rooms:r,events:e,items:a}}};
 vm.createContext(ctx);
 for(const name of ['saveSpecialGuestCheckin','activeSpecialGuestArrivals','undoSpecialGuestCheckin']){
  const start=source.indexOf('  function '+name+'('),end=source.indexOf('\n  function ',start+1);
  vm.runInContext(source.slice(start,end),ctx);
 }
 ctx.saveSpecialGuestCheckin('external',2,'Tisch 5');
 ctx.saveSpecialGuestCheckin('opera',3,'Tisch 7');
 const before=JSON.parse(JSON.stringify(state.events)),external=state.events[0].actionId;
 assert.equal(api.effectiveArrivals(state.events).reduce((n,e)=>n+e.people,0),5);
 assert.equal(ctx.undoSpecialGuestCheckin(external),true);
 // Same additive union as merge_breakfast_changes; a stale device resends both original arrivals.
 state.events=[...new Map([...before,...state.events,...before].map(e=>[JSON.stringify(e),e])).values()];
 const visible=ctx.activeSpecialGuestArrivals(state.events);
 assert.deepEqual(JSON.parse(JSON.stringify(visible)).map(e=>[e.guestType,e.people,e.table]),[['opera',3,'Tisch 7']]);
 assert.equal(ctx.undoSpecialGuestCheckin(external),false,'already undone booking cannot be corrected twice');
 assert.equal(state.rooms,rooms,'room attendance and tables remain untouched');
 assert.equal(state.events.find(e=>e.undoActionId===external).people,-2);
});

test('external guest confirmation cannot submit the same gesture twice',()=>{
 const {JSDOM}=require('jsdom');const dom=new JSDOM('<body></body>');
 const source=fs.readFileSync('public/workflow-polish.js','utf8');
 const start=source.indexOf('  function openSpecialGuestDialog() {'),end=source.indexOf('\n  function ',start+1);
 let calls=0;const ctx={document:dom.window.document,window:{setTimeout:()=>{},dispatchEvent:()=>{}},Event:dom.window.Event,
  activeLanguage:'DE',tr:s=>s,icon:()=>'',specialGuestEntriesMarkup:()=>'',saveSpecialGuestCheckin:()=>calls++,schedule:()=>{}};
 vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);ctx.openSpecialGuestDialog();
 dom.window.document.querySelector('[data-special-type="opera"]').click();
 const save=dom.window.document.querySelector('[data-special-save]');save.click();save.click();
 assert.equal(calls,1);assert.equal(save.disabled,true);assert.match(save.textContent,/Erfasst/);
 dom.window.close();
});

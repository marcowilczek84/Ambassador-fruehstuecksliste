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

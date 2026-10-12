const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const api=require('../public/service-first.js');
const rooms=[
 {room:20,people:3,guests:['Fictional family'],included:true,arrivedCount:2},
 {room:21,people:1,guests:['Legacy check-in'],included:true,present:true},
 {room:22,people:2,guests:['Additional hotel guest'],included:false,arrivedCount:1},
 {room:23,people:0,guests:[],included:true,arrivedCount:0}
];
const events=[
 {room:20,people:2,included:true,at:1000,actionId:'room'},
 {room:0,people:3,included:false,guestType:'opera',at:2000,actionId:'opera'},
 {room:0,people:2,included:false,guestType:'external',at:3000,actionId:'external-old'},
 {room:0,people:1,included:false,guestType:'external',at:4000,actionId:'external-new'},
 {room:0,people:-2,included:false,guestType:'external',at:5000,undoActionId:'external-old'}
];
test('daily totals include legacy room attendance, partial check-ins and corrected guest categories exactly once',()=>{
 const day=api.dayStatistics(rooms,events);
 assert.deepEqual(day,{includedExpected:4,includedArrived:3,includedMissing:1,hotelAdditional:1,opera:3,external:1,additional:5,total:8,first:1000,last:4000});
 assert.equal(api.dayStatistics([{...rooms[0],arrivedCount:1},...rooms.slice(1)],events).total,7,'room correction is reflected from persisted state');
 assert.deepEqual(api.dayStatistics([],[]),{includedExpected:0,includedArrived:0,includedMissing:0,hotelAdditional:0,opera:0,external:0,additional:0,total:0,first:null,last:null});
});
test('new closing snapshots preserve categories; old summaries export unknown splits as empty cells',()=>{
 const row=api.dailySnapshot(rooms,events,'2026-10-12',{peak:'07:30–08:00',eighty:'07:32–09:10'});
 assert.equal(row.opera,3);assert.equal(row.external,1);assert.equal(row.hotelAdditional,1);
 const csv=api.statisticsCsv([row,{date:'2026-10-11',includedExpected:20,includedArrived:12,additional:4,first:null,last:null,peak:'08:00–08:30',eighty:'07:00–09:00'}]);
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.endsWith('\r\n'));assert.match(csv,/"Opera Gäste";"Externe Gäste"/);
 const lines=csv.split('\r\n');assert.match(lines[1],/^"2026-10-12";"4";"3";"1";"1";"3";"1";"5";"8"/);
 assert.match(lines[2],/^"2026-10-11";"20";"12";"8";"";"";"";"4";"16"/);
 assert.doesNotMatch(csv,/Fictional|Legacy check-in|Additional hotel guest/,'export is aggregate-only');
 assert.match(api.statisticsCsv([{...row,peak:'=1+1',eighty:'"quoted"'}]),/"'=1\+1";"""quoted"""/);
 assert.match(api.statisticsCsv([row],'en'),/"External guests"/);assert.match(api.statisticsCsv([row],'vi'),/"Khách bên ngoài"/);
});
test('service shows only current counts, updates reactively and has no history/export action',async()=>{
 const {JSDOM}=require('jsdom'),dom=new JSDOM('<div id="root"></div>',{url:'https://example.test'});
 for(const key of ['window','document','sessionStorage','localStorage','Event','CustomEvent'])global[key]=dom.window[key];
 global.IS_REACT_ACT_ENVIRONMENT=true;sessionStorage.setItem('ambassador-work-area','service');
 const React=require('react'),{createRoot}=require('react-dom/client'),root=createRoot(document.getElementById('root'));
 const C=api.component(React);let props={rooms,arrivals:events,language:'de',date:'2026-10-12',status:'Aktuell',endpoint:'https://example.test',headers:()=>({}),legacyPending:()=>false};
 await React.act(async()=>root.render(React.createElement(C,props)));
 await React.act(async()=>document.querySelector('.v4-statistics').click());
 const values=()=>Object.fromEntries([...document.querySelectorAll('.v41-stats dl>div')].map(el=>[el.querySelector('dt').textContent,el.querySelector('dd').textContent]));
 assert.deepEqual(values(),{'Frühstücke gesamt':'8','Inklusive erfasst':'3 / 4','Inklusive noch offen':'1','Hotelgäste zusätzlich':'1','Opera Gäste':'3','Externe Gäste':'1'});
 assert.doesNotMatch(document.querySelector('.v41-stats').textContent,/CSV|Wochen|Erste Erfassung/);
 assert.equal(api.downloadStatistics([api.dailySnapshot(rooms,events,'2026-10-12')]),false,'service role cannot invoke management export');
 props={...props,arrivals:[...events,{room:0,guestType:'opera',included:false,people:-3,undoActionId:'opera',at:6000}]};
 await React.act(async()=>root.render(React.createElement(C,props)));assert.equal(values()['Opera Gäste'],'0');assert.equal(values()['Frühstücke gesamt'],'5');
 await React.act(async()=>root.unmount());dom.window.close();
});
test('management CSV control exports current synchronized totals and existing completed days',()=>{
 const {JSDOM}=require('jsdom'),dom=new JSDOM('<section class="stats-modal"><div class="stat-list"></div><div class="timeline-list"><strong>07:00</strong><strong>07:30–08:00 · 3 Gäste</strong><strong>07:00–09:00</strong></div></section>',{url:'https://example.test'});
 const w=dom.window;w.sessionStorage.setItem('ambassador-work-area','reception');let exports=[];
 const history=[{date:'2026-10-11',includedExpected:2,includedArrived:1,additional:0}];
 const sandbox={document:w.document,sessionStorage:w.sessionStorage,window:{AmbassadorServiceV4:{...api,downloadStatistics:(rows,language)=>exports.push({rows,language})}},roleKey:'ambassador-work-area',activeLanguage:'DE',tr:x=>x,readDailyState:(key)=>key.includes('arrivals')?events:rooms,readBreakfastHistory:()=>history,specialGuestDate:()=> '2026-10-12'};
 const source=fs.readFileSync('public/workflow-polish.js','utf8');const start=source.indexOf('  function enhanceStatistics(){'),end=source.indexOf('\n  function ',start+5);
 vm.runInNewContext(source.slice(start,end)+'\nenhanceStatistics();',sandbox);
 const button=w.document.querySelector('.v45-export-actions button');assert.equal(button.textContent,'Tag als CSV exportieren');button.click();assert.equal(exports[0].rows[0].total,8);assert.equal(exports[0].rows[0].peak,'07:30–08:00');
 w.document.querySelector('.stat-list').remove();vm.runInNewContext('enhanceStatistics()',sandbox);assert.equal(button.textContent,'Abschlüsse als CSV exportieren');button.click();assert.equal(exports[1].rows[0].date,'2026-10-11');
 assert.equal(w.document.querySelectorAll('.v45-export-actions').length,1,'reactive updates never duplicate export buttons');
 history.length=0;vm.runInNewContext('enhanceStatistics()',sandbox);assert.equal(button.disabled,true);
 dom.window.close();
});

// Targeted display tests only. Check-in/import writes are confined to disposable
// synthetic browser storage; every Supabase request is blocked before navigation.
const fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require('playwright');
const seed=require('./ui-fixture.cjs');
const url=process.env.PREVIEW_URL;
if(!url)throw Error('PREVIEW_URL required');
const output=path.join(process.env.AUDIT_OUTPUT||'responsive-audit-output','realdevice-restfix');
fs.mkdirSync(output,{recursive:true});
const matrix={},evidence={},screenshots=[],errors=[],isolationErrors=[],blockedRequests=[];
const check=(key,condition,data)=>{matrix[key]=condition?'PASS':'FAIL';if(data!==undefined)evidence[key]=data;console.log(key+' '+matrix[key]);};

async function run(browser,engine,device,width,height){
 const prefix=engine+'.'+device,dir=path.join(output,prefix);fs.mkdirSync(dir,{recursive:true});
 let context,page,mutated=false;
 async function fresh(fixture=true,reducedMotion='no-preference'){
  await context?.close();context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,hasTouch:device!=='desktop',locale:'de-CH',timezoneId:'Europe/Zurich',reducedMotion});
  if(fixture)await context.addInitScript(seed);
  await context.addInitScript(()=>{window.__uiRestfixTrace=[];new MutationObserver(()=>{const e=document.querySelector('.service-entry-transition');if(e&&!window.__uiRestfixTrace.length)window.__uiRestfixTrace.push({time:performance.now(),text:e.textContent,pointerEvents:getComputedStyle(e).pointerEvents});if(!e&&window.__uiRestfixTrace.length&&!window.__uiRestfixTransitionEnd)window.__uiRestfixTransitionEnd=performance.now();}).observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});});
  await context.route('**/*',route=>{if(new URL(route.request().url()).hostname==='vercel.live')return route.abort();if(/supabase/i.test(route.request().url())){blockedRequests.push({engine,device,method:route.request().method()});return route.abort();}return route.continue();});
  page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>{const item={engine,device,message:e.message,stack:e.stack};if(/supabase\.co/.test(e.message)&&/access control checks/.test(e.message))isolationErrors.push(item);else errors.push(item);});mutated=false;
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('.role-selection').waitFor();
 }
 async function role(name,wait=true){await page.locator('.role-selection [data-role="'+name+'"]').click();await page.locator('body[data-app-role="'+name+'"] .app-shell').waitFor();if(wait)await page.locator('.service-entry-transition').waitFor({state:'detached'});}
 async function shot(name){
  const file=path.join(dir,name+'.png');await page.screenshot({path:file,animations:name==='08-service-transition'?'allow':'disabled'});
  const metrics=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,scrollWidth:document.documentElement.scrollWidth}));
  screenshots.push({file,engine,device,state:name,requestedViewport:[page.viewportSize().width,page.viewportSize().height],referenceViewport:[width,height],metrics,interactivelyReached:true,dataMutation:mutated,realDataMutation:false,dataSource:'disposable synthetic browser fixture; Supabase blocked'});
  check(prefix+'.overflow.'+name,metrics.scrollWidth<=metrics.width);
 }
 async function test(name,fn){try{await fn();}catch(e){check(prefix+'.'+name,false,{error:String(e),body:await page.locator('body').innerText().catch(()=>''),roomState:await page.evaluate(()=>localStorage.getItem('ambassador-breakfast-rooms')).catch(()=>null)});await shot('FAIL-'+name).catch(()=>{});}}
 try{
 await test('01-direct-reception',async()=>{
  await fresh();await role('reception');await page.getByRole('button',{name:'Zimmer 21 öffnen'}).waitFor();
  const entry=await page.locator('.entry-screen').count();const counts=await page.locator('.reception-summary small b').allTextContents();
  check(prefix+'.01-direct-reception',entry===0&&counts.join(',')==='43,45',{entry,counts});await shot('01-reception-list');
  const row=page.getByRole('button',{name:'Zimmer 31 öffnen'});await row.scrollIntoViewIfNeeded();
  const boxes=await row.evaluate(el=>{const rect=s=>el.querySelector(s).getBoundingClientRect().toJSON();return{room:rect('.room-number'),name:rect('.guest-names'),people:rect('.people'),nameStyle:{overflow:getComputedStyle(el.querySelector('.guest-names')).overflow,ellipsis:getComputedStyle(el.querySelector('.guest-names')).textOverflow}};});
  if(device==='iphone')check(prefix+'.03-mobile-name-columns',boxes.name.x-boxes.room.right>=11&&boxes.people.x-boxes.name.right>=11&&boxes.nameStyle.ellipsis==='ellipsis',boxes);
  await shot('03-reception-long-name');
  await page.getByRole('button',{name:'Menü öffnen'}).click();
  const menu=await page.locator('.structured-menu-item').evaluateAll(es=>es.map(e=>{const t=e.querySelector('span:not(.structured-menu-icon)'),r=e.getBoundingClientRect(),b=t.getBoundingClientRect();return{rowWidth:r.width,textWidth:b.width,titleHeight:t.querySelector('strong').getBoundingClientRect().height,titleLine:parseFloat(getComputedStyle(t.querySelector('strong')).lineHeight)};}));
  check(prefix+'.04-reception-menu',menu.length===2&&menu.every(m=>m.textWidth>=m.rowWidth-30&&m.titleHeight<=m.titleLine*2+1),menu);await shot('04-reception-menu');await page.getByRole('button',{name:'Menü schließen'}).click();
  await page.getByRole('button',{name:'Zimmer 21 öffnen'}).click();
  await page.locator('.reception-view-body dd').first().waitFor();
  const dates=await page.locator('.reception-view-body dd').allTextContents();
  const raw=await page.locator('.guest-edit-modal input[type="date"]').evaluateAll(es=>es.map(e=>e.value));
  check(prefix+'.05-german-view-dates',dates[0]==='26.09.2026'&&dates[1]==='30.09.2026'&&raw.join(',')==='2026-09-26,2026-09-30',{dates,storedInputValues:raw});await shot('05-reception-dates');
 });
 await test('02-empty-state',async()=>{
  await fresh(false);await role('reception');await page.locator('.workspace-empty-state h2').waitFor();
  const state=await page.locator('.workspace-empty-state').evaluate(el=>{const content=el.parentElement.getBoundingClientRect();return{text:el.innerText,bounds:[...el.children].map(x=>x.getBoundingClientRect().toJSON()),content:content.toJSON()};});
  check(prefix+'.02-empty-state',state.text.includes('Für heute ist noch keine Frühstücksliste geladen.')&&state.text.includes('Lade die aktuelle Mews-Liste, um zu beginnen.')&&state.bounds.every(b=>b.top>=state.content.top&&b.bottom<=state.content.bottom)&&await page.getByRole('button',{name:'Neue Mews-Liste laden'}).isVisible(),state);await shot('02-reception-empty');
  // Exercise existing import entirely in isolated data. Same workspace must remain.
  await page.evaluate(()=>{window.__receptionWorkspace=document.querySelector('.app-shell');});
  const XLSX=require('xlsx'),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Space number','Customer','Companions','Products'],[24,'Audit Importgast','1 People 26.09.2026 - 30.09.2026','Continental']]),'Customers');
  await page.locator('input[type="file"]').first().setInputFiles({name:'synthetic-restfix.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:XLSX.write(wb,{type:'buffer',bookType:'xlsx'})});
  await page.locator('.import-modal').waitFor();await page.locator('.import-modal').getByRole('button',{name:'Liste übernehmen'}).click();mutated=true;
  await page.locator('.success-overlay:not(.service-entry-transition)').waitFor();
  check(prefix+'.08-import-animation-preserved',await page.locator('.success-overlay h2').isVisible());await shot('08-import-transition');
  await page.locator('.success-overlay').waitFor({state:'detached',timeout:10000});
  const after=await page.evaluate(()=>({sameWorkspace:window.__receptionWorkspace===document.querySelector('.app-shell'),entry:!!document.querySelector('.entry-screen'),summary:document.querySelector('.reception-summary small').innerText,empty:!!document.querySelector('.workspace-empty-state')}));
  check(prefix+'.01-list-after-import',after.sameWorkspace&&!after.entry&&!after.empty&&!after.summary.startsWith('0 '),after);await shot('01-reception-after-import');
 });
 if(device!=='desktop'){
 await test('08-service-transition',async()=>{
  await fresh();await role('service',false);
  await page.waitForFunction(()=>window.__uiRestfixTrace?.length>0);
  if(await page.locator('.service-entry-transition').count())await shot('08-service-transition');
  await page.locator('.service-entry-transition').waitFor({state:'detached'});
  const data=await page.evaluate(()=>({trace:window.__uiRestfixTrace,elapsed:(window.__uiRestfixTransitionEnd||performance.now())-window.__uiRestfixTrace[0].time}));
  check(prefix+'.08-service-transition',data.trace.length===1&&data.trace[0].pointerEvents==='none'&&data.elapsed<1200,data);await shot('08-service-ready');
  if(device==='iphone'){await fresh(true,'reduce');await role('service');const reduced=await page.evaluate(()=>({seen:window.__uiRestfixTrace.length,duration:(window.__uiRestfixTransitionEnd||performance.now())-window.__uiRestfixTrace[0]?.time}));check(prefix+'.08-reduced-motion',reduced.seen===1&&reduced.duration<500,reduced);}
 });
 await test('06-service-editor',async()=>{
  await fresh();await role('service');await page.getByRole('button',{name:'Gäste bearbeiten',exact:true}).click();await page.getByRole('button',{name:'Zimmer 21 öffnen'}).click();await page.locator('.guest-edit-modal').waitFor();
  const geometry=()=>page.locator('.guest-edit-modal').evaluate(e=>{const body=e.querySelector('.modal-body'),head=e.querySelector('.modal-head'),foot=e.querySelector('.modal-actions');const b=x=>x.getBoundingClientRect().toJSON();return{header:b(head),body:b(body),footer:b(foot),label:b(e.querySelector('.guest-edit-grid label > span')),last:b(e.querySelector('.remark-edit-open')),scrollTop:body.scrollTop,scrollMax:body.scrollHeight-body.clientHeight,buttons:[...foot.querySelectorAll('button')].map(x=>b(x).width),outerScroll:e.parentElement.scrollTop,scrollAreas:[e.parentElement,e,body,...body.querySelectorAll('*')].filter(x=>x.scrollHeight>x.clientHeight+1&&/(auto|scroll)/.test(getComputedStyle(x).overflowY)).map(x=>x.className)};});
  let top=await geometry();check(prefix+'.06-first-label',top.label.top>=top.header.bottom+12&&top.body.top>=top.header.bottom&&top.outerScroll===0,top);await shot('06-service-edit-top');
  await page.locator('.guest-edit-modal .modal-body').evaluate(e=>e.scrollTop=e.scrollHeight);let bottom=await geometry();
  check(prefix+'.06-footer',bottom.last.bottom<=bottom.footer.top&&bottom.body.bottom<=bottom.footer.top+1&&Math.abs(bottom.buttons[0]-bottom.buttons[1])<1&&bottom.footer.bottom<=height+1,bottom);await shot('06-service-edit-bottom');
  if(device==='iphone'){
   await page.setViewportSize({width,height:600});await page.locator('.guest-edit-modal .modal-body').evaluate(e=>e.scrollTop=e.scrollHeight);bottom=await geometry();check(prefix+'.06-short-viewport-footer',bottom.last.bottom<=bottom.footer.top&&bottom.footer.bottom<=601&&bottom.scrollAreas.length===1,bottom);await shot('06-service-edit-short-viewport');
   await page.setViewportSize({width,height});
  }
  await page.locator('.guest-edit-modal .modal-body').evaluate(e=>e.scrollTop=0);await page.locator('.guest-edit-grid textarea').first().focus();top=await geometry();check(prefix+'.06-return-to-top',top.label.top>=top.header.bottom+12,top);await shot('06-service-edit-top-restored');
 });
 await test('07-success-remark',async()=>{
  await fresh();await role('service');await page.getByRole('button',{name:'Zimmer 21 öffnen'}).click();await page.locator('.checkin-choice-modal').getByRole('button',{name:'17',exact:true}).click();await page.locator('.checkin-choice-modal .table-picker button.selected').filter({hasText:/^17$/}).waitFor();await page.locator('.checkin-choice-modal .modal-actions .primary').filter({hasText:'17'}).click();mutated=true;
  await page.locator('.checkin-card .important-note').waitFor();
  await page.waitForFunction(()=>document.querySelector('.checkin-card .important-note strong')?.textContent==='Bemerkung');
  const note=await page.locator('.checkin-card .important-note').evaluate(e=>({text:e.querySelector('p').textContent,heading:e.querySelector('strong').textContent,background:getComputedStyle(e).backgroundColor,iconVisible:[...e.querySelectorAll('svg')].some(x=>x.getBoundingClientRect().height>0)}));
  check(prefix+'.07-success-remark',note.heading==='Bemerkung'&&note.text==='Synthetische Bemerkung für die UI-Abnahme.'&&!note.iconVisible&&note.background==='rgba(0, 0, 0, 0)',note);await shot('07-success-with-remark');
 });
 }
 }finally{await context?.close();}
}
(async()=>{
 for(const engine of (process.env.RESTFIX_ENGINES||'chromium,webkit').split(',')){
  let browser;try{
   const local=engine==='chromium'&&process.env.LOCAL_CHROMIUM;
   browser=await({chromium,webkit}[engine]).launch(local?{executablePath:process.env.LOCAL_CHROMIUM,args:require(process.env.LOCAL_CHROMIUM_PACKAGE).default.args.filter(a=>a!=='--single-process')}:{headless:true});
   for(const [device,w,h] of (engine==='webkit'?[['iphone',390,844]]:[['iphone',390,844],['ipad',1024,1366],['desktop',1440,900]]))if(!process.env.RUN_DEVICES||process.env.RUN_DEVICES.split(',').includes(device))await run(browser,engine,device,w,h);
  }catch(e){check(engine+'.runner',false,{error:String(e)});}finally{await browser?.close();}
 }
 check('runtimeErrors',errors.length===0,errors);
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({url,commit:process.env.SOURCE_SHA,matrix,evidence,screenshots,errors,isolationErrors,blockedRequests,conditions:{realDeviceRetest:false,supabaseWrites:false,productionWrites:false,syntheticLocalSubmissions:true,vercelFeedbackToolbarBlocked:true}},null,2));
 if(Object.values(matrix).includes('FAIL'))process.exitCode=1;
 console.log(JSON.stringify({screenshots:screenshots.length,pass:Object.values(matrix).filter(x=>x==='PASS').length,fail:Object.values(matrix).filter(x=>x==='FAIL').length}));
})();

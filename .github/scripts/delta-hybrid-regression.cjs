// Actual Preview screenshots. All guests are synthetic; every Supabase request is aborted.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {chromium,webkit}=require('playwright'),{PNG}=require('pngjs');
const seed=require('./ui-fixture.cjs');
const current=process.env.PREVIEW_URL,baseline=process.env.BASELINE_PREVIEW_URL;
if(!current||!baseline)throw Error('Both exact-commit Preview URLs are required');
const output=path.join(process.env.AUDIT_OUTPUT||'delta-audit-output','delta-hybrid');fs.mkdirSync(output,{recursive:true});
const matrix={},evidence={},screenshots=[],errors=[],isolationErrors=[];
function check(key,ok,data){matrix[key]=ok?'PASS':'FAIL';if(data!==undefined)evidence[key]=data;console.log(key+' '+matrix[key]+(ok?'':' '+JSON.stringify(data)));}
const near=(a,b)=>Math.abs(a-b)<.5;
function sameBox(a,b){return ['x','y','width','height'].every(k=>near(a[k],b[k]));}
function pixelDiff(before,after,masks,file){
 const a=PNG.sync.read(fs.readFileSync(before)),b=PNG.sync.read(fs.readFileSync(after));if(a.width!==b.width||a.height!==b.height)throw Error('Different screenshot dimensions');
 const diff=new PNG({width:a.width,height:a.height});let changed=0,outside=0,inside=0;
 for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){const i=(y*a.width+x)*4,d=[0,1,2,3].some(k=>a.data[i+k]!==b.data[i+k]);const masked=masks.some(r=>x>=Math.floor(r.left)&&x<Math.ceil(r.right)&&y>=Math.floor(r.top)&&y<Math.ceil(r.bottom));
  if(d){changed++;masked?inside++:outside++;diff.data[i]=masked?28:220;diff.data[i+1]=masked?119:35;diff.data[i+2]=masked?123:35;}else{const g=Math.round((b.data[i]+b.data[i+1]+b.data[i+2])/3);diff.data[i]=diff.data[i+1]=diff.data[i+2]=235+Math.round(g/255*20);}diff.data[i+3]=255;
 }fs.writeFileSync(file,PNG.sync.write(diff));return{width:a.width,height:a.height,changedPixels:changed,insideIconPixels:inside,outsideChangedPixels:outside,masks,threshold:0,file};
}
async function run(browser,engine,device,width,height){
 const prefix=engine+'.'+device,dir=path.join(output,prefix);fs.mkdirSync(dir,{recursive:true});const records={};
 for(const [version,url]of [['before',baseline],['after',current]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,hasTouch:device!=='desktop',isMobile:device!=='desktop',locale:'de-CH',timezoneId:'Europe/Zurich',reducedMotion:'reduce'});
  await context.addInitScript(seed);await context.route('**/*',async r=>{
   const u=new URL(r.request().url());if(/supabase/i.test(u.href)||u.hostname==='vercel.live')return r.abort();
   if(process.env.LOCAL_CHROMIUM&&version==='before'&&['/workflow-polish.js','/final-design.css'].includes(u.pathname))return r.fulfill({body:execFileSync('git',['show','5c62497c3647854a1356d0a20eac5a0205ee2b74:public'+u.pathname],{encoding:'utf8'}),contentType:u.pathname.endsWith('.css')?'text/css':'text/javascript'});
   return r.continue();
  });
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>{const item={prefix,version,message:e.message};if(/supabase\.co/.test(e.message)&&/access control checks/.test(e.message))isolationErrors.push(item);else errors.push(item);});
  const key=n=>prefix+'.'+version+'.'+n;
  async function settle(){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});}
  async function shot(name,metrics,clip){await settle();const file=path.join(dir,version+'-'+name+'.png');await page.screenshot({path:file,animations:'disabled',caret:'hide',...(clip?{clip}: {})});screenshots.push({file,engine,device,version,state:name,viewport:[width,height],captureViewport:await page.evaluate(()=>[innerWidth,innerHeight]),crop:clip||null,metrics,synthetic:true,realDataMutation:false,sourceUrl:url});if(!clip){const m=await page.evaluate(()=>({innerWidth,innerHeight,scrollWidth:document.documentElement.scrollWidth}));check(key('overflow.'+name),m.scrollWidth<=m.innerWidth,m);}return file;}
  async function formMetrics(){return page.locator('.dialog-add-room').evaluate(e=>{
   const r=x=>x.getBoundingClientRect().toJSON(),css=x=>getComputedStyle(x),grid=e.querySelector('.form-grid'),submit=e.querySelector('.modal-action'),head=e.querySelector('.modal-head'),close=e.querySelector('.close-button');
   const hit=x=>{const b=r(x);return x.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));};
   const fields=[...grid.querySelectorAll(':scope > label:not(.check-field)')].map(l=>{const s=l.querySelector('span'),c=l.querySelector('input,select,textarea'),range=document.createRange();range.selectNodeContents(s);return{label:s.textContent,labelBox:r(s),textBox:range.getBoundingClientRect().toJSON(),box:r(l),control:r(c),controlTag:c.tagName,value:c.value,labelGap:r(c).top-r(s).bottom,visualLabelGap:r(c).top-range.getBoundingClientRect().bottom,font:css(s).font,inputFont:css(c).font};});
   const checkbox=grid.querySelector('.check-field');return{modal:r(e),head:r(head),grid:r(grid),scrollHeight:grid.scrollHeight,clientHeight:grid.clientHeight,scrollTop:grid.scrollTop,overflowY:css(grid).overflowY,fields,groupGaps:fields.slice(1).map((f,i)=>f.box.top-fields[i].box.bottom),checkbox:{box:r(checkbox),checked:checkbox.querySelector('input').checked,gap:r(checkbox).top-fields.at(-1).box.bottom,hit:hit(checkbox)},submit:{box:r(submit),disabled:submit.disabled,hit:hit(submit)},close:{box:r(close),hit:hit(close)},scrollOwners:[e,e.querySelector('.modal-body'),grid].filter(x=>/(auto|scroll)/.test(css(x).overflowY)&&x.scrollHeight>x.clientHeight+1).map(x=>x.className)};
  });}
  try{
   await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('.role-selection').waitFor();await settle();
   const chooser=await page.evaluate(()=>{
    const box=x=>x.getBoundingClientRect().toJSON();const selectors=['.role-logo','.role-app-logo','.role-eyebrow','.role-date','.role-selection h1','.role-options','.role-options [data-role=service]','.role-options [data-role=reception]','.entry-meili-footer'];
    return{boxes:selectors.map(s=>({selector:s,box:box(document.querySelector(s))})),icons:[...document.querySelectorAll('.role-icon svg')].map(e=>({box:box(e),viewBox:e.getAttribute('viewBox'),symbol:e.dataset.roleSymbol,stroke:getComputedStyle(e).stroke,strokeWidth:getComputedStyle(e).strokeWidth,linecap:getComputedStyle(e).strokeLinecap,linejoin:getComputedStyle(e).strokeLinejoin,head:e.querySelector('circle')?{cy:e.querySelector('circle').getAttribute('cy'),r:e.querySelector('circle').getAttribute('r')}:null,children:e.children.length,html:e.outerHTML})),texts:[...document.querySelectorAll('.role-options strong,.role-options small')].map(e=>({text:e.textContent,box:box(e),font:getComputedStyle(e).font})),chevrons:document.querySelectorAll('.role-options button>b').length};
   });
   const chooserFile=await shot('01-bereichswahl',chooser);
   const logo=await page.evaluate(async()=>await(await fetch(document.querySelector('.role-app-logo').src)).text());
   records[version]={chooser,chooserFile,logo};
   if(version==='after'){
    check(key('hybrid-C'),chooser.icons.map(i=>i.symbol).join(',')==='person-tablet,person-counter'&&chooser.icons.map(i=>i.children).join(',')==='3,4',chooser.icons);
    check(key('icons-exactly-26px'),chooser.icons.every(i=>i.box.width===26&&i.box.height===26&&i.viewBox==='0 0 32 32'));
    check(key('shared-family'),chooser.icons.every(i=>i.stroke==='rgb(28, 119, 123)'&&i.strokeWidth==='2px'&&i.linecap==='round'&&i.linejoin==='round'&&i.head.cy==='6.5'&&i.head.r==='3.4'));
    check(key('no-chevrons-no-bell'),chooser.chevrons===0&&chooser.icons.every(i=>!/(bell|klingel|<image|<text|filter|Gradient)/i.test(i.html)));
    for(let i=0;i<2;i++){const b=chooser.icons[i].box;const file=await shot(i?'03-reception-icon-26px':'02-service-icon-26px',chooser.icons[i],{x:Math.floor(b.x),y:Math.floor(b.y),width:26,height:26});const png=PNG.sync.read(fs.readFileSync(file));check(key('crop-'+i+'-actual-size'),png.width===26&&png.height===26);}
    const old=records.before.chooser;
    check(key('chooser-all-layout-unchanged'),JSON.stringify(old.boxes)===JSON.stringify(chooser.boxes)&&JSON.stringify(old.texts)===JSON.stringify(chooser.texts)&&old.icons.every((i,n)=>sameBox(i.box,chooser.icons[n].box)));
    check(key('filled-app-cup-byte-identical'),logo===records.before.logo);
    const diff=pixelDiff(records.before.chooserFile,chooserFile,chooser.icons.map(i=>i.box),path.join(dir,'chooser-pixel-difference.png'));check(key('chooser-outside-icons-zero-pixels'),diff.outsideChangedPixels===0&&diff.insideIconPixels>0,diff);
   }
   await page.locator('.role-selection [data-role=reception]').click();await page.locator('.app-shell').waitFor();await page.locator('.work-area-entry-transition').waitFor({state:'detached'});await shot('reception-main');
   await page.locator('.reception-add').click();await page.locator('.dialog-add-room').waitFor();await settle();
   const initial=await formMetrics();records[version].form=initial;const formFile=await shot('04-add-room-top',initial);records[version].formFile=formFile;
   check(key('initial-state-and-validation'),initial.fields.length===3&&initial.fields[0].value===''&&initial.fields[1].value==='1'&&initial.fields[2].value===''&&initial.checkbox.checked&&initial.submit.disabled);
   check(key('close-reachable'),initial.close.hit);
   if(version==='after'){
    const old=records.before.form;check(key('dialog-and-footer-unchanged'),sameBox(old.modal,initial.modal)&&sameBox(old.head,initial.head)&&sameBox(old.submit.box,initial.submit.box)&&sameBox(old.close.box,initial.close.box),{before:old,after:initial});
    check(key('controls-and-type-unchanged'),initial.fields.every((f,i)=>near(f.control.width,old.fields[i].control.width)&&near(f.control.height,old.fields[i].control.height)&&f.font===old.fields[i].font&&f.inputFont===old.fields[i].inputFont));
    if(device==='iphone'){
     check(key('mobile-label-gap-8px'),initial.fields.every(f=>near(f.labelGap,8)&&f.labelBox.height<25),initial);
     check(key('mobile-field-gap-20px'),initial.groupGaps.every(g=>near(g,20))&&near(initial.checkbox.gap,20),initial);
     check(key('free-space-after-form'),initial.grid.bottom-initial.checkbox.box.bottom>150,initial);
    }else{
     check(key('wide-form-geometry-unchanged'),JSON.stringify(old.fields)===JSON.stringify(initial.fields)&&sameBox(old.checkbox.box,initial.checkbox.box)&&sameBox(old.grid,initial.grid),{before:old,after:initial});
    }
    const diff=pixelDiff(records.before.formFile,formFile,device==='iphone'?[initial.grid]:[],path.join(dir,'add-room-pixel-difference.png'));check(key(device==='iphone'?'form-frame-outside-body-unchanged':'wide-form-pixels-unchanged'),diff.outsideChangedPixels===0,diff);
   }
   await page.locator('.dialog-add-room select').selectOption('64');await page.locator('.dialog-add-room input[type=number]').fill('2');await page.locator('.dialog-add-room textarea').fill('Delta Anna Beispiel\nDelta Ben Beispiel');await page.locator('.dialog-add-room h2').click();
   check(key('valid-form-submit-enabled'),await page.locator('.dialog-add-room .modal-action').isEnabled());await shot('05-add-room-complete-form',await formMetrics());
   if(version==='after'&&device==='iphone'){
    await page.setViewportSize({width:390,height:500});await settle();
    for(const selector of ['select','input[type=number]','textarea','.check-field']){
     const field=page.locator('.dialog-add-room '+selector);await field.scrollIntoViewIfNeeded();if(selector!=='.check-field')await field.focus();
     const m=await field.evaluate(e=>{const b=e.getBoundingClientRect(),grid=e.closest('.form-grid').getBoundingClientRect(),button=e.closest('.dialog-add-room').querySelector('.modal-action').getBoundingClientRect();return{top:b.top,bottom:b.bottom,gridTop:grid.top,gridBottom:grid.bottom,footerTop:button.top,hit:e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)),active:document.activeElement===e,visualViewportHeight:visualViewport.height};});
     check(key('reduced-height-reachable.'+selector),m.top>=m.gridTop&&m.bottom<=m.gridBottom+.5&&m.bottom<=m.footerTop&&m.hit,m);
    }
    await page.locator('.dialog-add-room textarea').focus();await page.locator('.dialog-add-room textarea').scrollIntoViewIfNeeded();await shot('06-focused-name-reduced-height-NOT-native-keyboard',{...(await formMetrics()),nativeKeyboard:false,note:'390x500 available-height surrogate; no native iOS keyboard available in headless WebKit'});
    await page.locator('.dialog-add-room .form-grid').evaluate(e=>e.scrollTop=e.scrollHeight);const end=await formMetrics();check(key('reduced-height-one-scroll-footer'),end.scrollOwners.length===1&&end.scrollOwners[0]==='form-grid'&&end.scrollTop>0&&end.checkbox.box.bottom<=end.submit.box.top&&end.submit.hit&&end.close.hit,end);await shot('07-add-room-scroll-end-footer',end);
    await page.setViewportSize({width,height});await settle();
   }
   await page.locator('.dialog-add-room .modal-action').click();await page.locator('.dialog-add-room').waitFor({state:'detached'});
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ambassador-breakfast-rooms')).rooms.find(r=>r.room===64));
   check(key('native-create-room-unchanged'),saved.people===2&&saved.included===true&&saved.guests.join('|')==='Delta Anna Beispiel|Delta Ben Beispiel',saved);
   await page.locator('.reception-add').click();await page.locator('.dialog-add-room .close-button').click();check(key('close-returns-to-reception'),await page.locator('.dialog-add-room').count()===0&&await page.locator('.reception-add').isVisible());
  }catch(e){check(key('scenario'),false,{error:String(e)});await shot('FAIL').catch(()=>{});}finally{await context.close();}
 }
}
(async()=>{
 for(const engine of(process.env.DELTA_ENGINES||'webkit,chromium').split(',')){
  let b;try{const local=engine==='chromium'&&process.env.LOCAL_CHROMIUM;let options={headless:true};if(local){const chrome=(await import(process.env.LOCAL_CHROMIUM_PACKAGE)).default;options={executablePath:local,args:chrome.args.filter(a=>a!=='--single-process')};}b=await({webkit,chromium}[engine]).launch(options);
   for(const [device,w,h]of [['iphone',390,844],...(engine==='webkit'?[['ipad',1024,1366],['desktop',1440,900]]:[])])await run(b,engine,device,w,h);
  }catch(e){check(engine+'.runner',false,{error:String(e)});}finally{await b?.close();}
 }
 check('runtime-errors',errors.length===0,errors);
 const result={commit:process.env.SOURCE_SHA,baselineCommit:'5c62497c3647854a1356d0a20eac5a0205ee2b74',url:current,baselineUrl:baseline,matrix,evidence,screenshots,errors,isolationErrors,physicalKeyboard:{status:'NOT_RUN',reason:'Headless Linux WebKit cannot show the native iOS keyboard. Reduced-height focus/scroll evidence is explicitly labeled and does not replace physical Safari acceptance.'},supabaseRequests:'all aborted',realDataMutation:false};
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({pass:Object.values(matrix).filter(v=>v==='PASS').length,fail:Object.values(matrix).filter(v=>v==='FAIL').length,screenshots:screenshots.length}));if(Object.values(matrix).includes('FAIL'))process.exitCode=1;
})();

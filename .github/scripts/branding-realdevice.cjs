// Evidence from exact built Preview URLs. No UI asset substitution or production writes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {webkit}=require('playwright'),{PNG}=require('pngjs'),seed=require('./ui-fixture.cjs');
const current=process.env.PREVIEW_URL,baseline=process.env.BASELINE_PREVIEW_URL;
const frozenRegression=process.env.FROZEN_UI_REGRESSION==='1';
if(!current||!baseline)throw Error('Exact Preview URLs required');
const dir='branding-audit-output';fs.mkdirSync(dir,{recursive:true});
const matrix={},evidence={},screenshots=[],errors=[],requests=[];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function check(k,ok,data){matrix[k]=ok?'PASS':'FAIL';if(data!==undefined)evidence[k]=data;console.log(k+' '+matrix[k]+(ok?'':' '+JSON.stringify(data)));}
function diff(aFile,bFile,mask,file){const a=PNG.sync.read(fs.readFileSync(aFile)),b=PNG.sync.read(fs.readFileSync(bFile)),out=new PNG({width:b.width,height:b.height});let inside=0,outside=0;if(a.width!==b.width||a.height!==b.height)throw Error('Image dimensions differ');for(let y=0;y<b.height;y++)for(let x=0;x<b.width;x++){const i=(y*b.width+x)*4,d=[0,1,2,3].some(k=>a.data[i+k]!==b.data[i+k]),m=mask.some(r=>x>=Math.floor(r.x)&&x<Math.ceil(r.x+r.width)&&y>=Math.floor(r.y)&&y<Math.ceil(r.y+r.height));if(d){m?inside++:outside++;out.data[i]=m?28:220;out.data[i+1]=m?119:35;out.data[i+2]=m?123:35;}else out.data[i]=out.data[i+1]=out.data[i+2]=245;out.data[i+3]=255;}fs.writeFileSync(file,PNG.sync.write(out));return{insideChangedPixels:inside,outsideChangedPixels:outside,threshold:0,mask,file};}
async function settled(p){await p.evaluate(async()=>{await Promise.race([document.fonts.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Font readiness timeout')),10000))]);await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});}
async function form(p){return p.locator('.dialog-add-room').evaluate(e=>{const box=e=>e.getBoundingClientRect().toJSON(),style=e=>getComputedStyle(e),grid=e.querySelector('.form-grid'),ta=e.querySelector('textarea'),primary=e.querySelector('.modal-action'),close=e.querySelector('.close-button'),check=e.querySelector('.check-field');const hit=e=>{const b=box(e);return e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));};return{modal:box(e),head:box(e.querySelector('.modal-head')),grid:box(grid),footer:box(primary),close:box(close),fields:[...grid.querySelectorAll(':scope>label:not(.check-field)')].map(l=>({label:box(l.querySelector('span')),control:box(l.querySelector('select,input,textarea')),group:box(l)})),checkbox:box(check),focus:{active:document.activeElement===ta,visible:ta.matches(':focus-visible'),border:style(ta).border,outline:style(ta).outline,outlineWidth:style(ta).outlineWidth,outlineStyle:style(ta).outlineStyle,outlineColor:style(ta).outlineColor,offset:style(ta).outlineOffset,shadow:style(ta).boxShadow,ancestorBorder:style(ta.parentElement).border},scroll:{clientHeight:grid.clientHeight,scrollHeight:grid.scrollHeight,top:grid.scrollTop,owners:[e,e.querySelector('.modal-body'),grid].filter(x=>/(auto|scroll)/.test(style(x).overflowY)&&x.scrollHeight>x.clientHeight+1).map(x=>x.className)},hits:{textarea:hit(ta),close:hit(close),footer:hit(primary),checkbox:hit(check)}};});}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
async function run(browser,device,width,height){
 const records={};
 for(const [version,url]of [['before',baseline],['after',current]]){
  const key=n=>'webkit.'+device+'.'+version+'.'+n,folder=path.join(dir,device,version);fs.mkdirSync(folder,{recursive:true});
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:device!=='desktop',hasTouch:device!=='desktop',locale:'de-CH',timezoneId:'Europe/Zurich',reducedMotion:'reduce'});
  await ctx.addInitScript(seed);
  const previewOrigin=new URL(url).origin;
  await ctx.route('**/*',r=>new URL(r.request().url()).origin===previewOrigin?r.continue():r.abort());
  const p=await ctx.newPage();p.setDefaultTimeout(20000);p.on('pageerror',e=>{if(!/supabase.*access control checks/i.test(e.message))errors.push({device,version,message:e.message});});
  p.on('response',r=>{if(/workflow-polish|final-design|breakfast-app-logo|favicon|apple-touch/.test(r.url()))requests.push({device,version,url:r.url(),status:r.status()});});
  async function shot(name){await settled(p);const file=path.join(folder,name+'.png');await p.screenshot({path:file,animations:'disabled',caret:'hide'});const m=await p.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth}));check(key('overflow.'+name),m.scrollWidth<=m.width,m);screenshots.push({file,url,device,version,viewport:m,state:name,synthetic:true});return file;}
  try{
   const rec=records[version]={};
   if(device==='iphone'){
    // Capture the real native startup during its fully opaque plateau; do not alter its timing.
    const startupContext=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'de-CH',timezoneId:'Europe/Zurich',reducedMotion:'no-preference'});
    await startupContext.route('**/*',r=>new URL(r.request().url()).origin===previewOrigin?r.continue():r.abort());
    const startup=await startupContext.newPage();startup.setDefaultTimeout(20000);
    try{
     console.log(key('startup.load'));await startup.goto(url,{waitUntil:'domcontentloaded'});
     await startup.waitForFunction(()=>{const e=document.querySelector('.breakfast-splash'),c=e?.querySelector('.breakfast-splash-content');return e&&c&&getComputedStyle(e).opacity==='1'&&getComputedStyle(c).opacity==='1'&&[...e.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0);});console.log(key('startup.opaque'));
     rec.splash=await startup.locator('.breakfast-splash-mark').evaluate(e=>({box:e.getBoundingClientRect().toJSON(),background:getComputedStyle(e).backgroundImage,backgroundColor:getComputedStyle(e).backgroundColor,svgVisibility:getComputedStyle(e.querySelector('svg')).visibility,html:e.outerHTML,others:[...document.querySelectorAll('.breakfast-splash-content > img,.breakfast-splash-content > strong,.breakfast-splash-content > small,.breakfast-splash > .entry-meili-footer')].map(e=>({html:e.outerHTML,box:e.getBoundingClientRect().toJSON()}))}));
     rec.splashFile=path.join(folder,'01-start-splash.png');await startup.screenshot({path:rec.splashFile,animations:'allow',timeout:20000});console.log(key('startup.captured'));screenshots.push({file:rec.splashFile,url,device,version,state:'native-startup-opaque-plateau',scriptsDisabledForStartupCapture:false});
     const painted=PNG.sync.read(fs.readFileSync(rec.splashFile));const pixel=(dx,dy)=>{const x=Math.floor(rec.splash.box.x+dx),y=Math.floor(rec.splash.box.y+dy),i=(y*painted.width+x)*4;return [...painted.data.slice(i,i+3)];};
     rec.splash.pixels={body:pixel(28,36),saucer:pixel(32,53),steam1:pixel(25,16),steam2:pixel(34,16),petrol:pixel(8,32)};
     check(key('startup-not-blank'),[...painted.data].some((v,i)=>i%4!==3&&v<200));
     if(version==='after')check(key('filled-cup-painted-pixels'),Object.entries(rec.splash.pixels).every(([k,v])=>same(v,k==='petrol'?[28,119,123]:[255,255,255])),rec.splash.pixels);
     check(key('splash-overflow'),await startup.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }finally{await startupContext.close();}
   }
   console.log(key('normal-navigation'));await p.goto(url,{waitUntil:'domcontentloaded'});
   await p.locator('.role-selection').waitFor();await settled(p);
   rec.chooser=await p.locator('.role-selection').evaluate(e=>({html:e.outerHTML,box:e.getBoundingClientRect().toJSON(),icons:[...e.querySelectorAll('.role-icon svg')].map(s=>({html:s.outerHTML,box:s.getBoundingClientRect().toJSON(),viewBox:s.getAttribute('viewBox'),stroke:getComputedStyle(s).stroke,weight:getComputedStyle(s).strokeWidth,shapes:[...s.children].map(c=>({tag:c.tagName,attrs:[...c.attributes].map(a=>[a.name,a.value])})),before:getComputedStyle(s.parentElement,'::before').content,after:getComputedStyle(s.parentElement,'::after').content})),geometry:[...e.querySelectorAll('img,h1,p,button,strong,small')].map(n=>({text:n.textContent,box:n.getBoundingClientRect().toJSON()}))}));
   rec.chooserFile=await shot('02-bereichswahl');
   rec.assets=await p.evaluate(()=>({scripts:[...document.scripts].filter(s=>s.src).map(s=>s.src),links:[...document.querySelectorAll('link[rel*=icon],link[rel=manifest]')].map(e=>({rel:e.rel,href:e.href})),styles:[...document.querySelectorAll('link[rel=stylesheet]')].map(e=>e.href),logo:document.querySelector('.role-app-logo').src}));
   if(version==='after'){
    const icons=rec.chooser.icons;
    const expectedShapes=[[
     {tag:'circle',attrs:[['cx','11.8'],['cy','6.5'],['r','3.4']]},
     {tag:'path',attrs:[['d','M17.1 14C15.7 13 13.8 12.8 11.5 12.8H9C5.4 12.8 3.1 15.5 3.1 19v2.9c0 1.6 1 2.6 2.6 2.6l11 .6']]},
     {tag:'path',attrs:[['d','M20.3 15.2h8.1c.7 0 1 .5.7 1.2l-3.8 11.1c-.2.7-.6 1.1-1.4 1.1h-8c-.7 0-1-.5-.7-1.2L19 16.3c.3-.8.6-1.1 1.3-1.1Z']]}],[
     {tag:'circle',attrs:[['cx','16'],['cy','6.5'],['r','3.4']]},
     {tag:'path',attrs:[['d','M8.8 18c.3-3.3 2.7-5.2 7.2-5.2s6.9 1.9 7.2 5.2']]},
     {tag:'rect',attrs:[['x','4'],['y','20.5'],['width','24'],['height','8.1'],['rx','1']]},
     {tag:'path',attrs:[['d','M2.8 20.5h26.4']]}]];
    for(let i=0;i<2;i++){
     check(key(i?'person-counter-actual-vectors':'person-tablet-actual-vectors'),same(icons[i].shapes,expectedShapes[i]),icons[i]);
     check(key('icon-'+i+'-26px-petrol'),icons[i].box.width===26&&icons[i].box.height===26&&icons[i].stroke==='rgb(28, 119, 123)'&&icons[i].weight==='2px');
     check(key('icon-'+i+'-no-pseudo-replacement'),icons[i].before==='none'&&icons[i].after==='none');
     const file=path.join(folder,i?'04-reception-icon-26px.png':'03-service-icon-26px.png');await p.locator('.role-icon svg').nth(i).screenshot({path:file});screenshots.push({file,url,device,version,crop:true});
    }
    check(key('chooser-frozen-geometry'),same(rec.chooser.geometry,records.before.chooser.geometry));
    check(key('chooser-outside-icons-zero-pixels'),(rec.chooserDiff=diff(records.before.chooserFile,rec.chooserFile,icons.map(i=>i.box),path.join(folder,'chooser-difference.png'))).outsideChangedPixels===0,rec.chooserDiff);
    check(key('no-chevrons'),await p.locator('.role-options button>b').count()===0);
    const loaded={};
    for(const name of ['workflow-polish.js','final-design.css','breakfast-app-logo.svg','favicon.svg','apple-touch-icon.png']){
     const sources=[...rec.assets.scripts,...rec.assets.styles,rec.assets.logo,...rec.assets.links.map(l=>l.href)];
     
     const u=sources.find(x=>new URL(x).pathname==='/'+name);if(new URL(u).origin!==previewOrigin)throw Error('Asset outside Preview origin');const response=await ctx.request.get(u);const body=await response.body();const expected=sha(fs.readFileSync('public/'+name));
     loaded[name]={url:u,status:response.status(),sha256:sha(body),expected};check(key('loaded-asset.'+name),response.ok()&&sha(body)===expected,loaded[name]);
     if(['workflow-polish.js','final-design.css'].includes(name))check(key('content-version.'+name),new URL(u).searchParams.get('v')===expected.slice(0,16));
     fs.writeFileSync(path.join(folder,'loaded-'+name),body);
    }
    rec.loaded=loaded;
    check(key('all-system-links-versioned'),rec.assets.links.filter(x=>x.rel!=='manifest').every(x=>new URL(x.href).searchParams.get('v')===sha(fs.readFileSync('public/'+new URL(x.href).pathname.split('/').pop())).slice(0,16)),rec.assets.links);
    check(key('no-active-manifest-added'),rec.assets.links.filter(x=>x.rel==='manifest').length===records.before.assets.links.filter(x=>x.rel==='manifest').length,rec.assets.links);
    if(device==='iphone'){
     check(key('splash-existing-filled-asset'),rec.splash.background.includes('data:image/svg+xml;base64,'+fs.readFileSync('public/breakfast-app-logo.svg').toString('base64'))&&rec.splash.svgVisibility==='hidden'&&rec.splash.backgroundColor==='rgb(28, 119, 123)',rec.splash);
     check(key('splash-frozen-geometry'),same(rec.splash.box,records.before.splash.box)&&same(rec.splash.others,records.before.splash.others));
     rec.splashStrictDiff=diff(records.before.splashFile,rec.splashFile,[rec.splash.box],path.join(folder,'splash-strict-css-box-difference.png'));
     // WebKit's fractional-y border paints an antialiased raster edge one pixel above the CSS box.
     // Retain the strict result and include only this measured painted top edge, with zero color tolerance.
     const box=rec.splash.box,rasterBox={x:box.x,y:Math.floor(box.y)-1,width:box.width,height:Math.ceil(box.y+box.height)-(Math.floor(box.y)-1)};
     rec.splashDiff=diff(records.before.splashFile,rec.splashFile,[rasterBox],path.join(folder,'splash-difference.png'));
     check(key('splash-outside-logo-zero-pixels'),rec.splashDiff.outsideChangedPixels===0&&(frozenRegression?rec.splashDiff.insideChangedPixels===0:rec.splashDiff.insideChangedPixels>0),{...rec.splashDiff,cssBox:box,strictCssBoxOutside:rec.splashStrictDiff.outsideChangedPixels,rasterEdge:'One top pixel row; no general color tolerance or other mask expansion'});
    }
   }
   await p.locator('.role-options [data-role=reception]').click();await p.locator('.reception-actions').waitFor();await p.locator('.work-area-entry-transition').waitFor({state:'detached'});rec.reception=await shot('05-reception');
   await p.locator('.reception-add').click();await p.locator('.dialog-add-room').waitFor();
   // Normalize the pointer left by the opening click before comparing native select rendering.
   if(frozenRegression){await p.mouse.move(0,0);await p.waitForTimeout(200);}
   await settled(p);rec.form=await form(p);rec.formFile=await shot('06-add-room');
   await p.locator('.dialog-add-room textarea').click();await settled(p);rec.focus=await form(p);rec.focusFile=await shot('07-name-focused');
   if(version==='after'){
    check(key('form-geometry-unchanged'),['modal','head','grid','footer','close','fields','checkbox'].every(k=>same(rec.form[k],records.before.form[k])),{before:records.before.form,after:rec.form});
    check(key('unfocused-form-zero-pixels'),diff(records.before.formFile,rec.formFile,[],path.join(folder,'form-difference.png')).outsideChangedPixels===0);
    check(key('one-visible-petrol-focus'),rec.focus.focus.active&&rec.focus.focus.shadow==='none'&&rec.focus.focus.outlineWidth==='2px'&&rec.focus.focus.outlineStyle==='solid'&&rec.focus.focus.outlineColor==='rgb(28, 119, 123)'&&rec.focus.focus.offset==='-1px',rec.focus);
    await p.locator('.dialog-add-room input[type=number]').focus();await p.keyboard.press('Tab');await settled(p);const keyboard=await form(p);check(key('keyboard-focus-preserved'),keyboard.focus.active&&keyboard.focus.visible&&keyboard.focus.outlineWidth==='2px'&&keyboard.focus.outlineStyle==='solid'&&keyboard.focus.outlineColor==='rgb(28, 119, 123)'&&keyboard.focus.offset==='-1px'&&keyboard.focus.shadow==='none',keyboard.focus);
    if(device==='iphone'){
     check(key('field-group-8-20-retained'),rec.form.fields.every(f=>Math.abs(f.control.top-f.label.bottom-8)<.1)&&rec.form.fields.slice(1).every((f,i)=>Math.abs(f.group.top-rec.form.fields[i].group.bottom-20)<.1));
     await p.setViewportSize({width:390,height:500});await p.locator('.dialog-add-room textarea').scrollIntoViewIfNeeded();const small=await form(p);check(key('reduced-height-field-close-footer-reachable'),small.hits.textarea&&small.hits.close&&small.hits.footer,small);await shot('08-reduced-height-focus-NOT-native-keyboard');
     await p.locator('.dialog-add-room .form-grid').evaluate(e=>e.scrollTop=e.scrollHeight);const end=await form(p);check(key('reduced-height-one-scroll-checkbox-footer'),end.scroll.owners.length===1&&end.scroll.owners[0]==='form-grid'&&end.hits.checkbox&&end.hits.footer&&end.checkbox.bottom<=end.footer.top,end);await shot('09-scroll-end-footer');await p.setViewportSize({width,height});
    }
    await p.locator('.dialog-add-room select').selectOption('64');await p.locator('.dialog-add-room input[type=number]').fill('2');await p.locator('.dialog-add-room textarea').fill('Branding Anna Beispiel\nBranding Ben Beispiel');check(key('valid-form'),await p.locator('.dialog-add-room .modal-action').isEnabled());
    await p.locator('.dialog-add-room .modal-action').click();await p.locator('.dialog-add-room').waitFor({state:'detached'});check(key('local-submit'),await p.evaluate(()=>{const r=JSON.parse(localStorage.getItem('ambassador-breakfast-rooms')).rooms.find(r=>r.room===64);return r.people===2&&r.guests.length===2&&r.included;}));
    await p.locator('.reception-add').click();await p.locator('.dialog-add-room .close-button').click();check(key('close-returns-to-reception'),await p.locator('.dialog-add-room').count()===0&&await p.locator('.reception-actions').isVisible());
   }else await p.locator('.dialog-add-room .close-button').click();
   // Native role chooser service navigation, without changing persistence implementation.
   await p.evaluate(()=>sessionStorage.removeItem('ambassador-work-area'));await p.reload();await p.locator('.role-selection [data-role=service]').click();await p.locator('body[data-app-role=service] .app-shell').waitFor();await p.locator('.work-area-entry-transition').waitFor({state:'detached'});rec.service=await shot('10-service');check(key('service-opens'),await p.locator('.room-row').count()>0);
   if(version==='after')check(key('reception-frozen-pixels'),diff(records.before.reception,rec.reception,[],path.join(folder,'reception-difference.png')).outsideChangedPixels===0);
  }catch(e){check(key('scenario'),false,{error:String(e)});await p.screenshot({path:path.join(folder,'FAIL.png')}).catch(()=>{});}finally{await ctx.close();}
 }
 evidence[device+'.records']=records;
}
(async()=>{let b;try{b=await webkit.launch();for(const v of [['iphone',390,844],['ipad',1024,1366],['desktop',1440,900]])await run(b,...v);}finally{await b?.close();}check('runtime-errors',errors.length===0,errors);const result={commit:process.env.SOURCE_SHA,baselineCommit:process.env.BASELINE_COMMIT||'5d4b35b75d1aaa734c476310f80365cdb0eab1f1',url:current,baselineUrl:baseline,matrix,evidence,screenshots,requests,errors,notes:{startup:'Native startup with JavaScript and original animation enabled, captured during computed-opacity=1 plateau. Screenshot uses animations=allow. Painted cup pixel samples reject empty or missing brand captures. No UI, assets or timings replaced.',nativeKeyboard:'NOT_RUN: Linux WebKit cannot show native iOS keyboard; 390x500 is explicitly a reduced-height surrogate.',physicalOldIcons:'Not reproduced in a fresh baseline browser. Device-cache explanation remains unproven. Content-versioned loaded assets and exact DOM paths recorded.',data:'Browser-local synthetic fixture; strict Preview-origin allowlist; every external request blocked before network access.'}};fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({pass:Object.values(matrix).filter(x=>x==='PASS').length,fail:Object.values(matrix).filter(x=>x==='FAIL').length}));if(Object.values(matrix).includes('FAIL'))process.exitCode=1;})();

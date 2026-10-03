// Scoped design acceptance. Synthetic browser-local data; every server write blocked.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const pw=require('playwright'),seed=require('./ui-fixture.cjs'),{PNG}=require('pngjs');
const base=process.env.PREVIEW_URL||'http://app.test/index-live.html',origin=new URL(base).origin;
const out=process.env.DESIGN_OUTPUT||'ipad-service-design-evidence',engine=process.env.TEST_ENGINE||'webkit';
const baseline='364dd2113497ad74248cf9230b0a2721e05cdb54';
fs.mkdirSync(out,{recursive:true});
const checks=[];let blocked=0;const errors=[];
function check(name,pass,detail){checks.push({name,pass,detail});console.log((pass?'PASS ':'FAIL ')+name);}
const before=Object.fromEntries(['final-design.css','workflow-polish.js'].map(f=>[f,cp.execFileSync('git',['show',baseline+':public/'+f])]));
const boxScript=()=>{
 const box=e=>e?.getBoundingClientRect().toJSON(),shown=e=>e&&e.getClientRects().length&&getComputedStyle(e).display!=='none';
 const row=e=>({room:e.querySelector('.room-number').textContent,box:box(e),key:box(e.querySelector('.room-key')),names:box(e.querySelector('.guest-names')),nameTitle:e.querySelector('.guest-names').title,label:box(e.querySelector('.meta-line,.frozen-breakfast-note:not([hidden])')),status:shown(e.querySelector('.room-state:not(.redundant-open-status)'))?box(e.querySelector('.room-state:not(.redundant-open-status)')):null,table:box(e.querySelector('.table-badge')),bar:{left:getComputedStyle(e,'::before').left,width:getComputedStyle(e,'::before').width,top:getComputedStyle(e,'::before').top,bottom:getComputedStyle(e,'::before').bottom,color:getComputedStyle(e,'::before').backgroundColor},font:parseFloat(getComputedStyle(e.querySelector('.guest-names strong')||e.querySelector('.guest-names')).fontSize)});
 return{viewport:{width:innerWidth,height:innerHeight},document:{height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth},facts:box(document.querySelector('.hero-facts')),search:box(document.querySelector('.search-box')),action:box(document.querySelector('.ipad-special-guest-shortcut')),footer:box(document.querySelector('.bottom-bar')),rows:[...document.querySelectorAll('.ipad-room-column .room-row')].map(row),columns:[...document.querySelectorAll('.ipad-room-column')].map(e=>({label:e.getAttribute('aria-label'),slots:[...e.children].map(x=>x.classList.contains('room-placeholder')?'':x.querySelector('.room-number')?.textContent)})),placeholder:[...document.querySelectorAll('.room-placeholder')].map(e=>({text:e.textContent,inert:e.inert,box:box(e)})),touch:[...document.querySelectorAll('.topbar button,.open-filter-button,.ipad-special-guest-shortcut,.ipad-room-column .room-row,.bottom-button')].filter(shown).map(e=>({text:e.getAttribute('aria-label')||e.textContent,box:box(e)}))};
};
function fixtureSpecialCases(){const d=JSON.parse(localStorage.getItem('ambassador-breakfast-rooms'));Object.assign(d.rooms.find(r=>r.room===21),{arrivedCount:1,table:'Tisch 17'});Object.assign(d.rooms.find(r=>r.room===22),{present:true,arrivedCount:1,table:'Roomservice'});Object.assign(d.rooms.find(r=>r.room===31),{people:3,guests:['Alexandra Sehr Langer Familienname','Ben Weiterer Sehr Langer Familienname','Clara Dritter Gast']});localStorage.setItem('ambassador-breakfast-rooms',JSON.stringify(d));}
async function pageFor(browser,role,width,height,touch,version){
 const ctx=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,locale:'de-CH',timezoneId:'Europe/Zurich',serviceWorkers:'block',reducedMotion:'reduce'});
 const denied=[];
 await ctx.route('**/*',async r=>{const q=r.request(),u=new URL(q.url());if(u.origin!==origin||!['GET','HEAD'].includes(q.method())||u.pathname.startsWith('/api/')&&!u.pathname.includes('logo')){blocked++;denied.push(u.host+u.pathname);return r.abort();}
 const f=u.pathname.split('/').pop();if(version==='before'&&before[f])return r.fulfill({body:before[f],contentType:f.endsWith('.css')?'text/css':'application/javascript'});
 if(process.env.TEST_PUBLIC_DIR){const file=path.join(process.env.TEST_PUBLIC_DIR,u.pathname.startsWith('/_next/')?'recovered'+u.pathname:u.pathname);return fs.existsSync(file)?r.fulfill({path:file}):r.abort();}return r.continue();});
 await ctx.addInitScript(seed);await ctx.addInitScript(fixtureSpecialCases);
 const p=await ctx.newPage();p.setDefaultTimeout(12000);p.on('pageerror',e=>{if(!(/due to access control checks/.test(e.message)&&denied.some(x=>e.message.includes(x))))errors.push(e.message)});
 await p.goto(base,{waitUntil:'domcontentloaded'});await p.locator('.role-selection').waitFor();
 if(role){await p.locator('[data-role='+role+']').click();await p.locator('.app-shell').waitFor();await p.waitForFunction(role=>document.body.id==='ambassador-ui'&&document.body.dataset.appRole===role,role);await p.locator('.work-area-entry-transition').waitFor({state:'detached'});}
 await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(200);
 // Compare static presentation after entry completion, never animation frames.
 await p.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'});
 await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));return{ctx,p};
}
function pixelDifference(a,b){const x=PNG.sync.read(a),y=PNG.sync.read(b);if(x.width!==y.width||x.height!==y.height)return{pass:false};let changed=0,maxChannelDifference=0;for(let i=0;i<x.data.length;i+=4){let different=false;for(let j=0;j<4;j++){const d=Math.abs(x.data[i+j]-y.data[i+j]);if(d)different=true;maxChannelDifference=Math.max(maxChannelDifference,d);}if(different)changed++;}return{changedPixels:changed,totalPixels:x.width*x.height,maxChannelDifference,exact:changed===0,pass:changed<=x.width*x.height*.0001&&maxChannelDifference<=24};}
const visualStructure=()=>{
 const root=document.querySelector('.app-shell')||document.querySelector('.role-selection');
 return [...root.querySelectorAll('*')].map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return{tag:e.tagName,classes:e.className.baseVal??e.className,rect:[r.x,r.y,r.width,r.height],style:('display position z-index box-sizing width height min-width max-width min-height max-height margin-top margin-right margin-bottom margin-left padding-top padding-right padding-bottom padding-left border-top-width border-right-width border-bottom-width border-left-width border-top-color border-right-color border-bottom-color border-left-color border-top-style border-right-style border-bottom-style border-left-style border-top-left-radius border-top-right-radius border-bottom-left-radius border-bottom-right-radius background-color background-image box-shadow outline-width outline-color outline-style color font-family font-size font-weight font-style line-height letter-spacing word-spacing text-align text-transform text-decoration-line text-decoration-color white-space text-overflow overflow-x overflow-y visibility opacity transform transform-origin filter grid-template-columns grid-template-rows grid-column grid-row grid-auto-flow column-gap row-gap flex-direction flex-wrap flex-grow flex-shrink flex-basis align-items align-self justify-content justify-self fill stroke stroke-width appearance touch-action cursor user-select').split(' ').map(k=>[k,s.getPropertyValue(k)]),before:getComputedStyle(e,'::before').cssText,after:getComputedStyle(e,'::after').cssText};});
};
(async()=>{
 const browser=await pw[engine].launch(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{});
 try{
 for(const [w,h] of [[1194,810],[1024,748]]){
  const {ctx,p}=await pageFor(browser,'service',w,h,true,'after');const id=engine+'-'+w+'x'+h;
  const m=await p.evaluate(boxScript);fs.writeFileSync(path.join(out,id+'.json'),JSON.stringify(m,null,2));await p.screenshot({path:path.join(out,id+'.png'),animations:'disabled'});
  check(id+'.one-screen',m.document.height<=h+1&&m.document.width<=w&&m.rows.every(r=>r.box.bottom<=m.footer.top+1));
  check(id+'.compact-status-search-action',m.facts.width<=w*.36&&m.facts.right<m.search.left&&m.search.width<=540&&Math.abs(m.search.top-m.action.top)<1);
  check(id+'.five-fixed-groups',m.columns.length===5&&m.columns.every((c,i)=>c.label===`${20+i*10}–${28+i*10}`&&c.slots.length===9&&c.slots.every((n,j)=>n===(20+i*10+j===55?'':String(20+i*10+j)))));
  check(id+'.55-empty-inert',m.placeholder.length===1&&m.placeholder[0].inert&&!m.placeholder[0].text&&Math.abs(m.placeholder[0].box.height-m.rows[0].box.height)<1);
  check(id+'.touch-targets-44',m.touch.every(t=>t.box.width>=44&&t.box.height>=44),m.touch.filter(t=>t.box.width<44||t.box.height<44));
  check(id+'.stable-row-height',Math.max(...m.rows.map(r=>r.box.height))-Math.min(...m.rows.map(r=>r.box.height))<1);
  check(id+'.fixed-information-zones',m.rows.every(r=>Math.abs(r.key.left-r.box.left-10)<1&&Math.abs(r.key.top-r.box.top-4)<1&&Math.abs(r.names.top-r.box.top-22)<1&&(!r.label||Math.abs(r.label.bottom-r.box.bottom+5)<2)&&(!r.status||r.status.top===r.key.top)&&(!r.table||Math.abs(r.table.bottom-r.box.bottom+5)<2)));
  check(id+'.labels-tables-no-overlap',m.rows.every(r=>!r.label||!r.table||r.label.right+4<=r.table.left),m.rows.filter(r=>r.label&&r.table&&r.label.right+4>r.table.left));
  check(id+'.key-status-no-overlap',m.rows.every(r=>!r.status||r.key.right+3<=r.status.left));
  check(id+'.aligned-status-bars',m.rows.every(r=>r.bar.left==='0px'&&r.bar.width==='3px'&&r.bar.top==='4px'&&r.bar.bottom==='4px'));
  const find=n=>m.rows.find(r=>r.room===String(n));
  check(id+'.inclusive-yellow',find(23).bar.color==='rgb(243, 207, 36)');check(id+'.neutral-grey',find(40).bar.color==='rgb(205, 215, 212)');check(id+'.partial-and-complete-petrol',[20,21,22].every(n=>find(n).bar.color==='rgb(28, 119, 123)'));
  check(id+'.long-multiple-names',find(31).nameTitle.includes('Clara Dritter Gast')&&find(21).nameTitle.includes(' · '));check(id+'.names-readable',m.rows.every(r=>r.font>=12));
  await p.getByRole('button',{name:'Zimmer 31 öffnen',exact:true}).click();check(id+'.full-names-existing-dialog',(await p.locator('.checkin-choice-modal').textContent()).includes('Alexandra Sehr Langer Familienname'));await p.locator('.checkin-choice-modal .close-button').click();await p.locator('.checkin-choice-modal').waitFor({state:'detached'});
  await p.locator('.search-box input').click();await p.locator('.search-box input').pressSequentially('NoMatchXYZ',{delay:40});await p.locator('.search-empty-state').waitFor({state:'visible'});check(id+'.search-existing-empty-state',await p.locator('.search-empty-state').isVisible());await p.locator('.search-box input').fill('');
  await p.getByRole('button',{name:'Menü öffnen',exact:true}).click();await p.locator('[data-language="EN"]').click();await p.keyboard.press('Escape');await p.waitForTimeout(150);
  check(id+'.existing-English-label',await p.locator('.ipad-room-column .meta-line').first().getAttribute('data-landscape-breakfast')==='included');
  await ctx.close();
 }
 for(const [role,w,h,touch] of [[null,390,844,true],[null,1194,810,true],['service',390,844,true],['reception',390,844,true],['reception',1194,810,true],['reception',1024,748,true],['reception',1440,900,false],['service',1194,810,false],['service',810,1194,true]]){
  const id=engine+'-unchanged-'+(role||'chooser')+'-'+w+'x'+h+'-'+(touch?'touch':'mouse'),shots=[],structures=[];
  for(const version of ['before','after']){const {ctx,p}=await pageFor(browser,role,w,h,touch,version);shots.push(await p.screenshot({path:path.join(out,id+'-'+version+'.png'),animations:'disabled'}));structures.push(await p.evaluate(visualStructure));await ctx.close();}
  const pixels=pixelDifference(...shots),structureIdentical=JSON.stringify(structures[0])===JSON.stringify(structures[1]);
  // Chromium can vary a few rounded-border antialias pixels between contexts.
  // Require exact element geometry AND computed visual styles, plus at most 0.01%
  // low-amplitude raster noise; never mask regions or accept layout differences.
  const mismatch=structures[0].findIndex((e,i)=>JSON.stringify(e)!==JSON.stringify(structures[1][i]));const sample=mismatch<0?null:{before:structures[0][mismatch],after:structures[1][mismatch]};check(id+'.render-unchanged',structureIdentical&&pixels.pass,{structureIdentical,...pixels,sample});
 }
 check('runtime.no-unexpected-errors',errors.length===0,errors);
 }finally{await browser.close();fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({engine,url:base,baseline,commit:process.env.SOURCE_SHA,physicalIpad:false,physicalWindows:false,blocked,checks,pass:checks.filter(c=>c.pass).length,fail:checks.filter(c=>!c.pass).length},null,2));}
 if(checks.some(c=>!c.pass))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});

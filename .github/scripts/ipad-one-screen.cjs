// Read-only deployed-UI smoke check. Synthetic local rooms; every API/write blocked.
const fs=require('node:fs'),crypto=require('node:crypto'),{webkit}=require('playwright');
const seed=require('./ui-fixture.cjs');
const base=process.env.PREVIEW_URL,origin=new URL(base).origin,out=process.env.IPAD_OUTPUT||'ipad-smoke-output';
fs.mkdirSync(out,{recursive:true});
const checks=[];function check(name,pass,detail){checks.push({name,pass,detail});console.log((pass?'PASS ':'FAIL ')+name+(pass?'':' '+JSON.stringify(detail)));}
(async()=>{
 const css=await (await fetch(origin+'/final-design.css?smoke='+Date.now())).text();
 check('Exact built CSS',crypto.createHash('sha256').update(css).digest('hex')===crypto.createHash('sha256').update(fs.readFileSync('public/final-design.css')).digest('hex'));
 const js=await(await fetch(origin+'/_next/static/chunks/0nkyeaxka~cd7-meili-v9.js')).text();
 check('ZFF/business bundle unchanged',crypto.createHash('sha256').update(js).digest('hex')==='54f7b3a22e7fc0b98fc23c863dbcd3ab01ec499d90d5f80ca61bcbcd5f3c2cac');
 const browser=await webkit.launch();
 for(const viewport of [{width:1194,height:810},{width:1024,height:748},{width:1366,height:1000}]){
 const ctx=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1,locale:'de-CH',timezoneId:'Europe/Zurich',serviceWorkers:'block'});
 await ctx.route('**/*',r=>{const q=r.request(),u=new URL(q.url());return u.origin!==origin||!['GET','HEAD'].includes(q.method())||u.pathname.startsWith('/api/')?r.abort():r.continue()});
 await ctx.addInitScript(seed);const p=await ctx.newPage();await p.goto(base,{waitUntil:'networkidle'});
 await p.locator('.role-selection [data-role="service"]').click();await p.locator('.app-shell').waitFor();await p.locator('.work-area-entry-transition').waitFor({state:'detached'});await p.waitForTimeout(500);
 const result=await p.evaluate(()=>{
 const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
 const box=s=>rect(document.querySelector(s));const v=e=>{const r=rect(e),s=getComputedStyle(e);return r.height>0&&r.width>0&&r.y>=0&&r.bottom<=innerHeight+1&&r.x>=0&&r.right<=innerWidth+1&&s.display!=='none'&&s.visibility!=='hidden'};
 const cols=[...document.querySelectorAll('.ipad-room-column')],rows=[...document.querySelectorAll('.ipad-room-column .room-row')];
 const facts=[...document.querySelectorAll('.hero-facts .hero-fact')];
 const factText=facts.flatMap(e=>[...e.querySelectorAll('strong,small')]).map(e=>({text:e.textContent,r:rect(e),visible:v(e),parent:rect(e.closest('.hero-fact'))}));
 const content=document.querySelector('.content');
 const texts=rows.flatMap(e=>[...e.querySelectorAll('.room-number,.people,.guest-names strong,.meta-line,.frozen-breakfast-note,.table-badge,.room-state')].filter(t=>getComputedStyle(t).display!=='none').map(t=>({room:e.getAttribute('aria-label'),text:t.textContent,r:rect(t),row:rect(e),font:parseFloat(getComputedStyle(t).fontSize),visible:v(t)})));
 return {viewport:{width:innerWidth,height:innerHeight},header:box('.topbar'),headline:box('.open-guests-headline'),progress:box('.progress-track'),facts:box('.hero-facts'),factText,search:box('.search-wrap'),grid:box('.ipad-room-grid'),footer:box('.bottom-bar'),columns:cols.map(e=>({r:rect(e),rooms:[...e.querySelectorAll('.room-row')].map(x=>x.querySelector('.room-number')?.textContent),placeholder:[...e.children].findIndex(x=>x.classList.contains('room-placeholder'))})),rows:rows.map(rect),texts,content:{client:content.clientHeight,scroll:content.scrollHeight},document:{client:document.documentElement.clientHeight,scroll:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth},footerButtons:[...document.querySelectorAll('.bottom-button')].map(e=>({text:e.textContent,r:rect(e),visible:v(e)}))};
 });
 const name=viewport.width+'x'+viewport.height;
 fs.writeFileSync(out+'/'+name+'.json',JSON.stringify(result,null,2));await p.screenshot({path:out+'/'+name+'.png',fullPage:false});
 check(name+' header/headline/progress/KPI/search/footer all visible',[result.header,result.headline,result.progress,result.facts,result.search,result.footer].every(r=>r.height>0&&r.y>=0&&r.bottom<=viewport.height+1),result);
 check(name+' complete KPI text',result.factText.length===6&&result.factText.every(t=>t.visible&&t.r.y>=t.parent.y-1&&t.r.bottom<=t.parent.bottom+1),result.factText);
 check(name+' five fixed columns / all rooms / 55 placeholder',result.columns.length===5&&result.rows.length===44&&result.columns.every((c,i)=>JSON.stringify(c.rooms)===JSON.stringify(Array.from({length:9},(_,j)=>String(20+i*10+j)).filter(n=>n!=='55')))&&result.columns[3].placeholder===5,result.columns);
 check(name+' all rows above footer and >=44px',result.rows.every(r=>r.height>=44&&r.y>=result.search.bottom-1&&r.bottom<=result.footer.y+1),result.rows);
 check(name+' room text readable and inside row',result.texts.every(t=>t.visible&&t.font>=11&&t.r.y>=t.row.y-1&&t.r.bottom<=t.row.bottom+1&&t.r.x>=t.row.x-1&&t.r.right<=t.row.right+1),result.texts.filter(t=>!t.visible||t.font<11||t.r.bottom>t.row.bottom+1||t.r.y<t.row.y-1));
 check(name+' no vertical/horizontal scrolling',result.content.scroll<=result.content.client+1&&result.document.scroll<=viewport.height+1&&result.document.width<=viewport.width,result.content);
 check(name+' both footer actions visible',result.footerButtons.length===2&&result.footerButtons.every(b=>b.visible&&b.r.height>=44),result.footerButtons);
 await ctx.close();
 }
 await browser.close();fs.writeFileSync(out+'/checks.json',JSON.stringify({source:process.env.SOURCE_SHA,url:base,checks},null,2));
 console.log(checks.filter(c=>c.pass).length+' PASS / '+checks.filter(c=>!c.pass).length+' FAIL');if(checks.some(c=>!c.pass))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});

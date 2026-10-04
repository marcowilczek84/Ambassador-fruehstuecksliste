// In-app cup regression: compare actual pixels with the prior release, excluding cup bounds only. Synthetic isolated browser data; no backend writes.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process'),assert=require('assert/strict');
const {chromium}=require('playwright'),sharp=require('sharp'),seed=require('./ui-fixture.cjs');
const repo=path.resolve(__dirname,'../..'),out=process.env.EVIDENCE_DIR||path.join(repo,'branding-release-evidence');fs.mkdirSync(out,{recursive:true});
const url=process.env.PREVIEW_URL||'http://127.0.0.1:8877/index-live.html',origin=new URL(url).origin,remote=!!process.env.PREVIEW_URL,base='30998adcb2370ded0956c86016aba67ccbd9911a';
const checks=[],shots=[],errors=[],missing=[],assets={},cache=new Map();let browser;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const record=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({url,base,checks,shots,errors,missing,assets,browser:browser?.version(),platform:'Linux',physicalDevice:false},null,2));
function ok(id,value,detail){checks.push({id,status:value?'PASS':'FAIL',detail});record();console.log((value?'PASS ':'FAIL ')+id);assert(value,id);}
const local=p=>'public'+(p.startsWith('/_next/')?'/recovered':'')+p;
function bytes(p,before){if(p==='/meili-selection.png'){const route='app/meili-selection.png/route.ts',s=(before?cp.execFileSync('git',['show',base+':'+route],{cwd:repo,stdio:['ignore','pipe','pipe']}):fs.readFileSync(path.join(repo,route))).toString();return Buffer.from(s.match(/const logoBase64 = "([^"]+)"/)[1],'base64');}return before?cp.execFileSync('git',['show',base+':'+local(p)],{cwd:repo,stdio:['ignore','pipe','pipe']}):fs.readFileSync(path.join(repo,local(p)));}
const mask='svg.lucide-coffee,.special-guest-icon svg:has(path[d^="M5 8h12"])';
async function context(before,viewport,touch,role){
 const c=await browser.newContext({viewport,hasTouch:touch,isMobile:touch,deviceScaleFactor:1,locale:'de-CH',timezoneId:'Europe/Zurich',serviceWorkers:'block',reducedMotion:'reduce',ignoreHTTPSErrors:true});
 await c.route('**/*',async route=>{const q=route.request(),u=new URL(q.url());if(u.origin!==origin||q.method()!=='GET'||u.pathname.startsWith('/api/'))return route.abort();
  const key=(before?'base:':'release:')+q.url();let data=cache.get(key);
  if(!data){try{if(!before&&remote){const r=await route.fetch();data={status:r.status(),headers:r.headers(),body:await r.body()};}else data={status:200,body:bytes(u.pathname,before),headers:{'content-type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'})[path.extname(u.pathname)]||'application/octet-stream'}};cache.set(key,data);}catch(e){missing.push({before,path:u.pathname});return route.fulfill({status:404,body:''});}}
  if(data.status>=400)missing.push({before,path:u.pathname,status:data.status});
  if(!before&&/breakfast-app-logo|favicon|apple-touch|branding\/|workflow-polish.js|final-design.css/.test(u.pathname))assets[u.pathname]={status:data.status,actual:sha(data.body),expected:sha(bytes(u.pathname,false))};
  return route.fulfill({...data,headers:{...data.headers,'content-security-policy':"connect-src 'none'"}});
 });await c.routeWebSocket('**/*',s=>s.close());
 await c.addInitScript(({src,role})=>{(0,eval)('('+src+')')();sessionStorage.setItem('ambassador_splash_seen','1');if(role)sessionStorage.setItem('ambassador-work-area',role);localStorage.setItem('ambassador-ui-language','DE');localStorage.setItem('ambassador-language','de');},{src:seed.toString(),role});
 const p=await c.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push({before,role,message:e.message}));await p.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
 await p.locator(role?'body[data-app-role='+role+'] .app-shell':'.role-selection').waitFor();await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});await p.waitForTimeout(250);await p.mouse.move(0,0);return {c,p};
}
async function raw(p,options={}){return sharp(await p.screenshot({animations:'disabled',caret:'hide',...options})).removeAlpha().raw().toBuffer();}
async function screenshot(p,name){const file=name+'.png';await p.screenshot({path:path.join(out,file),animations:'disabled',caret:'hide'});shots.push({file,viewport:p.viewportSize(),synthetic:true});record();}
async function compare(name,w,h,touch,role,menu=false){const viewport={width:w,height:h};let before,after;
 try{before=await context(true,viewport,touch,role);after=await context(false,viewport,touch,role);
  if(menu){for(const x of [before,after]){await x.p.getByRole('button',{name:'Menü öffnen',exact:true}).click();await x.p.locator('.structured-app-menu').waitFor();await x.p.waitForTimeout(200);if(menu==='special'){await x.p.locator('[data-menu-action=special-guests]').click();await x.p.locator('.special-guest-modal').waitFor();await x.p.waitForTimeout(200);}}}
  const boxes=async p=>p.locator(mask).evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()).filter(b=>b.width&&b.height));
  const oldBoxes=await boxes(before.p),newBoxes=await boxes(after.p);ok(name+'.no-layout-shift',JSON.stringify(oldBoxes)===JSON.stringify(newBoxes));
  const blur=menu?await after.p.locator(menu==='special'?'.modal-layer:has(.special-guest-modal)':'.reliable-app-menu-layer').evaluate(e=>Number(getComputedStyle(e).backdropFilter.match(/blur\(([\d.]+)px\)/)?.[1]||0)):0;
  const radius=Math.ceil(blur*3); // Existing Gaussian backdrop blur spreads changed cup pixels by three sigma.
  const old=await raw(before.p),next=await raw(after.p);let outside=0;
  // Enclose the actual raster footprint of fractional CSS boxes. Zero tolerance outside these asset bounds.
  for(let i=0;i<old.length;i+=3){const x=(i/3)%w,y=Math.floor(i/3/w);if(old[i]===next[i]&&old[i+1]===next[i+1]&&old[i+2]===next[i+2])continue;if(!newBoxes.some(b=>x>=Math.floor(b.x)-radius&&x<Math.ceil(b.right)+radius&&y>=Math.floor(b.y)-radius&&y<Math.ceil(b.bottom)+radius))outside++;}
  ok(name+'.unchanged-outside-cup-footprints',old.length===next.length&&outside===0,{outsideChangedPixels:outside,backdropBlur:blur,blurRadius:radius,brandBoxes:newBoxes});
  ok(name+'.no-overflow',await after.p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  ok(name+'.images-loaded',await after.p.evaluate(()=>[...document.images].filter(i=>i.getClientRects().length).every(i=>i.complete&&i.naturalWidth>0)));
  await screenshot(after.p,name);
  const symbols=await after.p.locator(mask).evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().width).map(e=>({steam:e.querySelectorAll('[data-breakfast-steam="single"]').length,old:[...e.querySelectorAll('path')].some(p=>/M10 2v2|M14 2v2|M6 2v2|m4-2v2m4-2v2/.test(p.getAttribute('d'))),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
  ok(name+'.single-steam-no-legacy',symbols.length>0&&symbols.every(x=>x.steam===1&&!x.old),symbols);
  const styles=async p=>p.locator(mask).evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().width).map(e=>{const c=getComputedStyle(e);return{stroke:c.stroke,fill:c.fill,strokeWidth:c.strokeWidth,width:c.width,height:c.height};}));
  ok(name+'.colors-size-stroke-unchanged',JSON.stringify(await styles(before.p))===JSON.stringify(await styles(after.p)));
 }finally{for(const x of [before,after])if(x){await x.c.setOffline(true);await x.c.close();}}
}
(async()=>{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',args:['--no-sandbox','--disable-dev-shm-usage'],...(remote?{proxy:{server:process.env.HTTPS_PROXY}}:{})});try{
 for(const [name,w,h,t,r,menu]of [['iphone-service',390,844,true,'service',false],['ipad-service',1194,810,true,'service',false],['iphone-menu',390,844,true,'service',true],['ipad-menu',1194,810,true,'service',true],['iphone-special-guests',390,844,true,'service','special'],['ipad-special-guests',1194,810,true,'service','special']])await compare(name,w,h,t,r,menu);
 ok('runtime.no-new-errors',errors.length===0,errors);ok('assets.none-missing',missing.length===0,missing);for(const[k,v]of Object.entries(assets))ok('source.'+k,v.status===200&&v.actual===v.expected,v);
 }catch(e){console.error(e);process.exitCode=1;}finally{record();await browser.close();console.log(JSON.stringify({pass:checks.filter(x=>x.status==='PASS').length,fail:checks.filter(x=>x.status==='FAIL').length,screenshots:shots.length}));}})();

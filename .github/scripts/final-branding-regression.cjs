// Release branding verification. Real Preview assets; browser-local fixture; no backend writes.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process'),assert=require('assert/strict');
const {chromium}=require('playwright'),sharp=require('sharp'),seed=require('./ui-fixture.cjs');
const repo=path.resolve(__dirname,'../..'),out=process.env.EVIDENCE_DIR||path.join(repo,'branding-release-evidence');fs.mkdirSync(out,{recursive:true});
const url=process.env.PREVIEW_URL||'http://127.0.0.1:8877/index-live.html',origin=new URL(url).origin,remote=!!process.env.PREVIEW_URL,base='b0a6ec0dfa6861c6c95c0b5e1a1febdfc1d1ef34';
const checks=[],shots=[],errors=[],missing=[],assets={},cache=new Map();let browser;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const record=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({url,base,checks,shots,errors,missing,assets,browser:browser?.version(),platform:'Linux',physicalDevice:false},null,2));
function ok(id,value,detail){checks.push({id,status:value?'PASS':'FAIL',detail});record();console.log((value?'PASS ':'FAIL ')+id);assert(value,id);}
const local=p=>'public'+(p.startsWith('/_next/')?'/recovered':'')+p;
function bytes(p,before){if(p==='/meili-selection.png'){const route='app/meili-selection.png/route.ts',s=(before?cp.execFileSync('git',['show',base+':'+route],{cwd:repo,stdio:['ignore','pipe','pipe']}):fs.readFileSync(path.join(repo,route))).toString();return Buffer.from(s.match(/const logoBase64 = "([^"]+)"/)[1],'base64');}return before?cp.execFileSync('git',['show',base+':'+local(p)],{cwd:repo,stdio:['ignore','pipe','pipe']}):fs.readFileSync(path.join(repo,local(p)));}
const mask='.role-app-logo,.role-hybrid-icon,.reception-summary-icon,.breakfast-splash-mark';
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
async function compare(name,w,h,touch,role){const viewport={width:w,height:h};let before,after;
 try{before=await context(true,viewport,touch,role);after=await context(false,viewport,touch,role);
  const boxes=async p=>p.locator(mask).evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()).filter(b=>b.width&&b.height));
  const oldBoxes=await boxes(before.p),newBoxes=await boxes(after.p);ok(name+'.no-layout-shift',JSON.stringify(oldBoxes)===JSON.stringify(newBoxes));
  const old=await raw(before.p),next=await raw(after.p);let outside=0;
  // Enclose the actual raster footprint of fractional CSS boxes. Zero tolerance outside these asset bounds.
  for(let i=0;i<old.length;i+=3){const x=(i/3)%w,y=Math.floor(i/3/w);if(old[i]===next[i]&&old[i+1]===next[i+1]&&old[i+2]===next[i+2])continue;if(!newBoxes.some(b=>x>=Math.floor(b.x)&&x<Math.ceil(b.right)&&y>=Math.floor(b.y)&&y<Math.ceil(b.bottom)))outside++;}
  ok(name+'.unchanged-outside-brand',old.length===next.length&&outside===0,{outsideChangedPixels:outside,brandBoxes:newBoxes});
  ok(name+'.no-overflow',await after.p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  ok(name+'.images-loaded',await after.p.evaluate(()=>[...document.images].filter(i=>i.getClientRects().length).every(i=>i.complete&&i.naturalWidth>0)));
  await screenshot(after.p,name);
  if(!role){
   const expected=['service','reception'].map(r=>fs.readFileSync(path.join(repo,'public/branding/'+r+'.svg'),'utf8'));
   const proof=await after.p.locator('.role-options svg').evaluateAll((es,expected)=>es.map((e,i)=>{const xml=new DOMParser().parseFromString(expected[i],'image/svg+xml'),g=e.querySelector('g');const attrs=e=>[...e.attributes].filter(x=>x.name!=='xmlns').map(x=>[x.name,x.value]).sort();const shapes=e=>[...e.querySelectorAll('circle,path,rect')].map(n=>({tag:n.tagName.toLowerCase(),attrs:attrs(n)}));const b=g.getBBox();return{same:JSON.stringify(shapes(e))===JSON.stringify(shapes(xml)),stroke:getComputedStyle(g).stroke,weight:getComputedStyle(g).strokeWidth,box:{x:b.x,y:b.y,width:b.width,height:b.height},width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height};}),expected);
   ok(name+'.exact-master-geometry',proof.every(x=>x.same),proof);ok(name+'.shared-petrol-stroke',proof.every(x=>x.stroke==='rgb(28, 119, 123)'&&x.weight==='2px'));ok(name+'.no-clipping-or-distortion',proof.every(x=>x.box.x>=1&&x.box.y>=1&&x.box.x+x.box.width<=31&&x.box.y+x.box.height<=31&&x.width===x.height));
   for(const r of ['service','reception']){await after.p.locator('.role-options [data-role='+r+']').click();await after.p.locator('body[data-app-role='+r+'] .app-shell').waitFor();ok(name+'.'+r+'-opens',await after.p.locator('.room-row').count()>0);await after.p.evaluate(()=>sessionStorage.removeItem('ambassador-work-area'));await after.p.reload();await after.p.locator('.role-selection').waitFor();}
  }
 }finally{for(const x of [before,after])if(x){await x.c.setOffline(true);await x.c.close();}}
}
async function assetSheet(){let x;try{x=await context(false,{width:900,height:580},false,'service');const names=['breakfast-app-logo.svg','branding/service.svg','branding/reception.svg','favicon.svg','apple-touch-icon.png'];
 for(const name of names){const r=remote?await x.c.request.get(origin+'/'+name):null;const body=r?await r.body():bytes('/'+name,false);const status=r?r.status():200;ok('asset.'+name,status===200&&sha(body)===sha(bytes('/'+name,false)),{status,sha256:sha(body)});assets['/'+name]={status,actual:sha(body),expected:sha(bytes('/'+name,false))};}
 await x.p.setContent('<html><body style="margin:0;background:white;font:14px sans-serif;color:#141918"><h1 style="font-size:20px;margin:28px">Freigegebene SVG-Assets · technische Größenkontrolle</h1><main style="display:flex;gap:50px;padding:24px 55px">'+['breakfast-app-logo.svg','branding/service.svg','branding/reception.svg'].map((n,i)=>'<section style="width:220px;text-align:center"><img src="'+origin+'/'+n+'" width="200" height="200"><p>'+['App-Logo','Service','Rezeption'][i]+'</p><p><img src="'+origin+'/'+n+'" width="20" height="20"> &nbsp; 20 px</p><p><img src="'+origin+'/'+n+'" width="22" height="22"> &nbsp; 22 px</p></section>').join('')+'</main></body></html>');await x.p.evaluate(async()=>Promise.all([...document.images].map(i=>i.decode())));await screenshot(x.p,'branding-200-20-22px');
 ok('asset-sheet.loaded',await x.p.evaluate(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0)));
 for(const n of names.filter(n=>n.endsWith('.svg'))){const s=fs.readFileSync(path.join(repo,'public',n),'utf8');ok('asset.'+n+'.flat-approved-palette',!/gradient|filter|shadow|<image/i.test(s)&&[...s.matchAll(/#[a-f\d]{6}\b/gi)].every(m=>['#1c777b','#ffffff'].includes(m[0].toLowerCase())));}
 ok('app.one-steam',fs.readFileSync(path.join(repo,'public/breakfast-app-logo.svg'),'utf8').match(/id="steam"/g).length===1);
 const png=await sharp(path.join(repo,'public/apple-touch-icon.png')).metadata();ok('app.home-screen-180',png.width===180&&png.height===180);
 const css=fs.readFileSync(path.join(repo,'public/final-design.css'),'utf8');ok('app.splash-matches-master',css.includes('data:image/svg+xml;base64,'+fs.readFileSync(path.join(repo,'public/breakfast-app-logo.svg')).toString('base64')));
 }finally{if(x){await x.c.setOffline(true);await x.c.close();}}}
(async()=>{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',args:['--no-sandbox','--disable-dev-shm-usage'],...(remote?{proxy:{server:process.env.HTTPS_PROXY}}:{})});try{
 for(const [name,w,h,t,r]of [['iphone-bereichswahl',390,844,true,null],['ipad-bereichswahl',1194,810,true,null],['iphone-service',390,844,true,'service'],['iphone-rezeption',390,844,true,'reception'],['ipad-service',1194,810,true,'service'],['ipad-rezeption',1194,810,true,'reception'],...[[1280,720],[1366,768],[1440,900],[1536,864],[1920,1080]].map(([w,h])=>['desktop-'+w,w,h,false,'reception'])])await compare(name,w,h,t,r);
 await assetSheet();ok('runtime.no-new-errors',errors.length===0,errors);ok('assets.none-missing',missing.length===0,missing);for(const[k,v]of Object.entries(assets))ok('source.'+k,v.status===200&&v.actual===v.expected,v);
 }catch(e){console.error(e);process.exitCode=1;}finally{record();await browser.close();console.log(JSON.stringify({pass:checks.filter(x=>x.status==='PASS').length,fail:checks.filter(x=>x.status==='FAIL').length,screenshots:shots.length}));}})();

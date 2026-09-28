// Chooser-only audit; isolated synthetic data, no check-ins or imports.
const fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require('playwright');
const seed=require('./ui-fixture.cjs');
const url=process.env.PREVIEW_URL;
if(!url)throw Error('PREVIEW_URL required');
const output=path.join(process.env.AUDIT_OUTPUT||'responsive-audit-output','branding');
fs.mkdirSync(output,{recursive:true});
const matrix={},evidence={},screenshots=[],errors=[],isolationErrors=[];
const check=(key,ok,data)=>{matrix[key]=ok?'PASS':'FAIL';if(data!==undefined)evidence[key]=data;console.log(key+' '+matrix[key]);};
async function run(browser,engine,device,width,height){
 const prefix=engine+'.'+device;
 for(const role of ['service','reception'])for(const side of ['left','right']){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,hasTouch:device!=='desktop',locale:'de-CH',timezoneId:'Europe/Zurich'});
  await context.addInitScript(seed);
  await context.route('**/*',route=>/supabase/i.test(route.request().url())||new URL(route.request().url()).hostname==='vercel.live'?route.abort():route.continue());
  const page=await context.newPage();page.setDefaultTimeout(10000);
  page.on('pageerror',e=>{const item={engine,device,message:e.message};if(/supabase\.co/.test(e.message)&&/access control checks/.test(e.message))isolationErrors.push(item);else errors.push(item);});
  try{
   await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('.role-selection').waitFor();
   await page.waitForFunction(()=>[...document.querySelectorAll('.role-selection img')].every(e=>e.complete&&e.naturalWidth>0));
   if(role==='service'&&side==='left'){
    const m=await page.evaluate(()=>{
     const box=s=>document.querySelector(s).getBoundingClientRect().toJSON();
     const selectors=['.role-logo','.role-app-logo','.role-eyebrow','.role-date','.role-selection h1','.role-options'];
     const buttons=[...document.querySelectorAll('.role-options button')].map(el=>{
      const b=el.getBoundingClientRect();
      const points=[[b.left+12,b.top+b.height/2],[b.right-12,b.top+b.height/2],[b.left+b.width/2,b.top+12],[b.left+b.width/2,b.bottom-12],[b.left+b.width/2,b.top+b.height/2]];
      return{role:el.dataset.role,box:b.toJSON(),hitTests:points.map(([x,y])=>el.contains(document.elementFromPoint(x,y))),icons:el.querySelectorAll('.role-icon svg').length,children:el.children.length};
     });
     const logo=document.querySelector('.role-app-logo'),style=getComputedStyle(logo);
     return{viewport:[innerWidth,innerHeight],scrollWidth:document.documentElement.scrollWidth,hierarchy:selectors.map(box),buttons,logo:{width:logo.width,height:logo.height,naturalWidth:logo.naturalWidth,src:logo.getAttribute('src'),shadow:style.boxShadow},ambassador:document.querySelector('.role-logo').getAttribute('src'),meili:box('.entry-meili-footer'),chevrons:document.querySelectorAll('.role-options button>b').length};
    });
    check(prefix+'.viewport',m.viewport[0]===width&&m.viewport[1]===height,m);
    check(prefix+'.no-overflow',m.scrollWidth===width);
    check(prefix+'.logo-size',m.logo.width===(device==='iphone'?52:60)&&m.logo.height===m.logo.width&&m.logo.naturalWidth===64&&m.logo.shadow==='none');
    check(prefix+'.hierarchy-visible',m.hierarchy.every((b,i)=>b.top>=0&&b.bottom<=height&&(!i||b.top>=m.hierarchy[i-1].bottom))&&m.hierarchy.at(-1).bottom<m.meili.top);
    check(prefix+'.equal-controls',m.buttons.length===2&&m.buttons.every(b=>b.box.height>=44&&Math.abs(b.box.width-m.buttons[0].box.width)<1&&Math.abs(b.box.height-m.buttons[0].box.height)<1));
    check(prefix+'.full-hit-area',m.buttons.every(b=>b.hitTests.every(Boolean)));
    check(prefix+'.chevrons-removed-icons-preserved',m.chevrons===0&&m.buttons.every(b=>b.icons===1&&b.children===2));
    check(prefix+'.hotel-brand-preserved',m.ambassador==='/ambassador-logo.svg?v=confirmed-20260816-0517');
    const svg=await page.evaluate(async()=>{const raw=await(await fetch(document.querySelector('.role-app-logo').src)).text();const d=new DOMParser().parseFromString(raw,'image/svg+xml');return{steam:d.querySelectorAll('#steam path').length,colors:[...new Set([...d.querySelectorAll('[fill],[stroke]')].flatMap(e=>[e.getAttribute('fill'),e.getAttribute('stroke')]).filter(c=>c&&c!=='none'))],effects:d.querySelectorAll('filter,linearGradient,radialGradient,image,text').length};});
    check(prefix+'.flat-svg-two-steams',svg.steam===2&&svg.effects===0&&svg.colors.length===2&&svg.colors.includes('#1c777b')&&svg.colors.includes('#ffffff'),svg);
    const file=path.join(output,prefix+'-bereichswahl.png');await page.screenshot({path:file,animations:'disabled'});screenshots.push({file,engine,device,viewport:m.viewport,metrics:m,dataSource:'synthetic fixture',realDataMutation:false});
   }
   const button=page.locator('.role-options [data-role="'+role+'"]');const b=await button.boundingBox();
   await button.click({position:{x:side==='left'?12:b.width-12,y:b.height/2}});
   await page.locator('body[data-app-role="'+role+'"] .app-shell').waitFor();
   await page.locator('.service-entry-transition').waitFor({state:'detached'});
   check(prefix+'.'+role+'-'+side+'-edge-navigation',await page.locator('.entry-screen,.role-selection,.role-app-logo').count()===0&&await page.locator('.room-row').count()>0);
  }catch(e){check(prefix+'.'+role+'-'+side,false,{error:String(e)});await page.screenshot({path:path.join(output,prefix+'-'+role+'-'+side+'-FAIL.png')}).catch(()=>{});}
  finally{await context.close();}
 }
}
(async()=>{
 for(const engine of ['chromium','webkit']){
  const browser=await({chromium,webkit}[engine]).launch({headless:true});
  try{for(const [device,width,height]of [['iphone',390,844],['ipad',1024,1366],...(engine==='chromium'?[['desktop',1440,900]]:[])])await run(browser,engine,device,width,height);}finally{await browser.close();}
 }
 check('runtime-errors',errors.length===0,errors);
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({commit:process.env.SOURCE_SHA,url,matrix,evidence,screenshots,errors,isolationErrors,scope:'role-selection-only',supabaseRequests:'blocked',realDataMutation:false},null,2));
 console.log(JSON.stringify({pass:Object.values(matrix).filter(v=>v==='PASS').length,fail:Object.values(matrix).filter(v=>v==='FAIL').length,screenshots:screenshots.length}));
 if(Object.values(matrix).includes('FAIL'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});

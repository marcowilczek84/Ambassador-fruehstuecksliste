const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const sizes=[[1194,834,true],[1024,768,true],[1024,748,true],[393,852,true],[375,812,true],[1440,900,false],[1280,800,false]];
const evidence='qa-evidence/v42';
function geometry(el){return [...el.querySelectorAll('.v4-room')].map(r=>{const b=r.getBoundingClientRect();return{room:r.dataset.room,x:b.x,y:b.y,width:b.width,height:b.height,text:r.innerText}});}
for(const [width,height,hasTouch] of sizes)test.describe(`${width}x${height}`,()=>{
 test.use({hasTouch,locale:'de-CH'});
 test('room geometry, workspace, dialogs and editorial selection preserve the existing flow',async({page},info)=>{
  const external=[],errors=[],origin=new URL(info.project.use.baseURL).origin;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==origin){external.push(u.origin);return route.abort();}return route.continue();});
  await page.setViewportSize({width:Math.max(width,700),height:height+220});
  const oldStyles=route=>route.fulfill({contentType:'text/css',body:''});
  await page.route(/\/(design-tokens-v42|design-system-v42)\.css$/,oldStyles);
  await page.goto(`/qa-v4.html?stats&size=${width}x${height}`);
  const f=page.frameLocator('#app');await expect(f.locator('.v4-room')).toHaveCount(44,{timeout:30000});
  await f.locator('.v4-shell').evaluate(()=>document.fonts.ready);
  const before=await f.locator('.v4-shell').evaluate(geometry);
  await page.unroute(/\/(design-tokens-v42|design-system-v42)\.css$/,oldStyles);
  await page.reload();await expect(f.locator('.v4-room')).toHaveCount(44,{timeout:30000});
  await f.locator('.v4-shell').evaluate(()=>document.fonts.ready);
  expect(await f.locator('.v4-shell').evaluate(geometry)).toEqual(before);
  expect(await f.locator('body').evaluate(()=>window.matchMedia('(pointer:coarse)').matches)).toBe(hasTouch);
  if(width>=1000){expect(await f.locator('.v4-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(5);for(const r of before)expect(r.y+r.height).toBeLessThanOrEqual(height);}
  const initial=await page.evaluate(()=>window.qaDatabase.read());
  await page.locator('#reception').click();await expect(f.locator('.reception-toolbar')).toBeVisible();
  const workspace=await f.locator('.app-shell').evaluate(el=>{const search=el.querySelector('.search-wrap').getBoundingClientRect(),content=el.querySelector('.content').getBoundingClientRect(),summary=el.querySelector('.reception-summary').getBoundingClientRect();return{searchBottom:search.bottom,searchTop:search.top,listTop:content.top,summaryBottom:summary.bottom,overflow:document.documentElement.scrollWidth-innerWidth,title:getComputedStyle(el.querySelector('.page-title h1')).fontWeight};});
  expect(workspace.overflow).toBeLessThanOrEqual(1);expect(workspace.listTop).toBeGreaterThanOrEqual(workspace.searchBottom-1);expect(workspace.searchTop).toBeGreaterThanOrEqual(workspace.summaryBottom-1);expect(workspace.title).toBe('300');
  await expect(f.locator('.room-row:visible')).toHaveCount(44);
  await f.locator('.search-box input').fill('Clara');await expect(f.locator('.room-row:visible')).toHaveCount(1);await f.locator('.room-row:visible').click();
  const edit=f.locator('.guest-edit-modal');await expect(edit).toBeVisible();const editButton=edit.getByRole('button',{name:'Gast bearbeiten',exact:true});if(await editButton.isVisible())await editButton.click();
  await expect(edit.locator('textarea').first()).toHaveValue('Clara Winter\nJonas Winter');
  const dialog=await edit.evaluate(el=>{const b=el.getBoundingClientRect(),save=el.querySelector('.modal-actions').getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom,footer:save.bottom,overflow:el.scrollWidth-el.clientWidth,inputs:[...el.querySelectorAll('input:not([type=checkbox]),textarea')].filter(e=>e.offsetWidth).map(e=>({font:parseFloat(getComputedStyle(e).fontSize),right:e.getBoundingClientRect().right}))};});
  expect(dialog.x).toBeGreaterThanOrEqual(0);expect(dialog.y).toBeGreaterThanOrEqual(0);expect(dialog.right).toBeLessThanOrEqual(width+1);expect(dialog.bottom).toBeLessThanOrEqual(height+1);expect(dialog.footer).toBeLessThanOrEqual(height+1);expect(dialog.overflow).toBeLessThanOrEqual(1);for(const input of dialog.inputs){expect(input.font).toBeGreaterThanOrEqual(16);expect(input.right).toBeLessThanOrEqual(width);}
  fs.mkdirSync(evidence,{recursive:true});await page.locator('#app').screenshot({path:`${evidence}/${width}x${height}-editor.png`,animations:'disabled'});
  await edit.locator('.close-button').click();expect(await page.evaluate(()=>window.qaDatabase.read())).toEqual(initial);
  // Same existing two choices; no new route, role or information architecture.
  await page.evaluate(()=>{delete window.qaStores.session['ambassador-work-area'];document.getElementById('reload').click();});
  const choices=f.locator('.role-selection .role-options button');await expect(choices).toHaveCount(2);
  await f.locator('.role-selection').evaluate(()=>document.fonts.ready);
  const chooser=await f.locator('.role-selection').evaluate(el=>({overflow:document.documentElement.scrollWidth-innerWidth,font:getComputedStyle(el.querySelector('h1')).fontFamily,weight:getComputedStyle(el.querySelector('h1')).fontWeight,buttons:[...el.querySelectorAll('.role-options button')].map(b=>{const r=b.getBoundingClientRect();return{width:r.width,height:r.height,right:r.right}})}));
  expect(chooser.overflow).toBeLessThanOrEqual(1);expect(chooser.font).toContain('Ambassador Editorial');expect(chooser.weight).toBe('300');for(const b of chooser.buttons){expect(b.width).toBeGreaterThanOrEqual(44);expect(b.height).toBeGreaterThanOrEqual(44);expect(b.right).toBeLessThanOrEqual(width);}
  await choices.first().focus();expect(await choices.first().evaluate(e=>getComputedStyle(e).outlineStyle)).toBe('solid');
  await choices.first().click();await expect(f.locator('.v4-room')).toHaveCount(44,{timeout:30000});
  expect(external).toEqual([]);expect(errors).toEqual([]);
  fs.writeFileSync(`${evidence}/${width}x${height}.json`,JSON.stringify({viewport:[width,height],hasTouch,roomGeometryUnchanged:true,rooms:44,workspace,dialog,chooser,externalRequests:external,errors},null,2));
 });
});
test('Auth presentation keeps secure forms, languages and native validation usable',async({page})=>{
 await page.setViewportSize({width:393,height:852});await page.goto('/auth.html');
 await expect(page.locator('#login')).toBeVisible();await expect(page.locator('#breakfast')).toBeHidden();await expect(page.locator('#mfa')).toBeHidden();
 for(const code of ['en','vi','de']){await page.locator(`[data-lang=${code}]`).click();await expect(page.locator(`[data-lang=${code}]`)).toHaveAttribute('aria-pressed','true');expect(await page.locator('#login input[type=email]').getAttribute('autocomplete')).toBe('username');expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);}
 await page.locator('#login button[type=submit]').click();expect(await page.locator('#email').evaluate(e=>e.validity.valueMissing)).toBe(true);await expect(page.locator('#breakfast')).toBeHidden();
});

const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const sizes=[[1194,834],[1024,768],[393,852],[1440,1000]];
for(const [width,height] of sizes)test(`actual SQL check-in, Roomservice, undo and reload at ${width}x${height}`,async({page},testInfo)=>{
 const external=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==new URL(testInfo.project.use.baseURL).origin){external.push(u.origin);return route.abort()}return route.continue()});
 await page.setViewportSize({width:Math.max(width,700),height:height+240});
 const response=await page.goto('/qa-v4.html?size='+width+'x'+height);
 expect(response.headers()['x-ambassador-data-mode']).toBe('isolated-postgres-qa');
 const f=page.frameLocator('#app');
 await expect(f.locator('.v4-room')).toHaveCount(44);
 const before=await page.evaluate(()=>window.qaDatabase.read());
 await f.locator('[data-room="20"] .v4-room-open').click();
 await expect(f.locator('.v41-tables button')).toHaveCount(14);
 await expect(f.locator('.v41-save')).toBeDisabled();
 await expect(f.locator('.v41-count strong')).toHaveText('2');
 const geometry=await f.locator('.v41-checkin').evaluate(dialog=>{
  const r=dialog.getBoundingClientRect(),body=dialog.querySelector('.v4-dialog-body'),footer=dialog.querySelector('footer').getBoundingClientRect();
  const buttons=[...dialog.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return{label:b.textContent,width:r.width,height:r.height}});
  return{viewport:[innerWidth,innerHeight],dialog:{x:r.x,y:r.y,right:r.right,bottom:r.bottom},footerBottom:footer.bottom,bodyScroll:body.scrollHeight-body.clientHeight,overflow:document.documentElement.scrollWidth-innerWidth,buttons};
 });
 expect(geometry.viewport).toEqual([width,height]);expect(geometry.overflow).toBeLessThanOrEqual(1);
 expect(geometry.dialog.x).toBeGreaterThanOrEqual(0);expect(geometry.dialog.y).toBeGreaterThanOrEqual(0);
 expect(geometry.dialog.right).toBeLessThanOrEqual(width+1);expect(geometry.footerBottom).toBeLessThanOrEqual(height+1);
 for(const b of geometry.buttons){expect(b.width,b.label).toBeGreaterThanOrEqual(43);expect(b.height,b.label).toBeGreaterThanOrEqual(43)}
 if(width>=700)expect(geometry.bodyScroll).toBeLessThanOrEqual(1);
 fs.mkdirSync('qa-evidence/screenshots',{recursive:true});
 await page.locator('#app').screenshot({path:`qa-evidence/screenshots/${width}x${height}-checkin.png`});
 await f.getByRole('button',{name:'Weniger Gäste',exact:true}).click();
 await f.getByRole('button',{name:'Tisch 3',exact:true}).click();
 await f.locator('.v41-save').click();await expect(f.locator('.v41-receipt')).toContainText('Gespeichert');
 expect((await page.evaluate(()=>window.qaDatabase.read())).rooms[0].arrivedCount).toBe(1);
 await f.locator('.v41-save').click();
 await f.locator('.v4-roomservice-action').click();
 await expect(f.locator('main')).toHaveAttribute('inert','');
 await f.locator('.v41-roomservice-rooms button').filter({hasText:'Zimmer 20'}).click();
 await expect(f.locator('.v41-roomservice')).toHaveAttribute('aria-pressed','true');
 await page.locator('#lost').check();
 await f.locator('.v41-save').dblclick();
 await expect(f.locator('.v4-toast')).toContainText('Verbindung unterbrochen');
 const firstId=await page.evaluate(()=>window.qaCalls.at(-1).p_action_id);
 await f.getByRole('button',{name:'Erneut versuchen',exact:true}).click();
 await expect(f.locator('.v41-receipt')).toContainText('Roomservice');
 expect(await page.evaluate(()=>window.qaCalls.at(-1).p_action_id)).toBe(firstId);
 let data=await page.evaluate(()=>window.qaDatabase.read());
 expect(data.rooms[0].arrivedCount).toBe(2);expect(data.rooms[0].serviceBookings.map(b=>b.table)).toEqual(['Tisch 3','Roomservice']);
 expect(data.rooms.slice(1)).toEqual(before.rooms.slice(1));expect(data.v8Arrivals).toHaveLength(2);
 await page.locator('#app').screenshot({path:`qa-evidence/screenshots/${width}x${height}-roomservice-saved.png`});
 // Undo exactly the Roomservice booking; the independent Tisch 3 booking remains.
 await f.locator('.v41-bookings > div').filter({hasText:'Roomservice'}).getByRole('button').click();
 await expect(f.locator('.v41-subtitle')).toContainText('1 / 2');
 data=await page.evaluate(()=>window.qaDatabase.read());expect(data.rooms[0].table).toBe('Tisch 3');
 await f.locator('.v41-roomservice').click();await f.locator('.v41-save').click();
 await expect(f.locator('.v41-receipt')).toContainText('Gespeichert');
 const saved=await page.evaluate(()=>window.qaDatabase.read());
 await page.reload();await expect(f.locator('.v4-room')).toHaveCount(44);
 expect(await page.evaluate(()=>window.qaDatabase.read())).toEqual(saved);
 await expect(f.locator('[data-room="20"]')).toContainText('Roomservice');
 await expect(f.locator('[data-room="20"]')).toHaveClass(/is-complete/);
 for(const [code,label] of [['en','Room service'],['vi','Phục vụ tại phòng'],['de','Roomservice']]){
  await f.getByLabel('Sprache / Language').selectOption(code);await expect(f.locator('.v4-roomservice-action')).toHaveText(label);
  await f.locator('[data-room="20"] .v4-room-open').click();await expect(f.locator('.v41-bookings')).toContainText(label);
  if(code!=='de')await expect(f.locator('.v41-bookings')).not.toContainText('Tisch 3');
  await f.locator('.v4-dialog header button').click();
 }
 if(width===1194){
  await page.locator('#other').click();await expect(f.locator('[data-room="20"]')).toHaveClass(/is-complete/);
  await expect(page.locator('#qa-status')).toContainText('conflict');
  // Independent client uses the same real PostgreSQL RPC, then normal polling updates UI.
  await page.evaluate(async()=>{const data=await window.qaDatabase.read(),r=data.rooms.find(r=>r.room===21);await window.qaRequest('/rest/v1/rpc/breakfast_service_action_v41','POST',{p_list_date:data.date,p_room:21,p_expected:r,p_delta:1,p_action_id:crypto.randomUUID(),p_table:'Roomservice'})});
  await expect(f.locator('[data-room="21"]')).toHaveClass(/is-complete/,{timeout:20000});
  await expect(f.locator('[data-room="21"]')).toContainText('Roomservice');
  await f.locator('.v4-statistics').click();await expect(f.locator('.v41-stats')).toContainText('Frühstücke gesamt');await f.locator('.v41-stats header button').click();
 }
 expect(external).toEqual([]);expect(errors).toEqual([]);
 fs.writeFileSync(`qa-evidence/browser-${width}x${height}.json`,JSON.stringify({size:[width,height],browser:await page.context().browser().version(),geometry,externalRequests:external,errors,storedRoom:saved.rooms[0],events:saved.v8Arrivals,unrelatedRoomsUnchanged:true},null,2));
});

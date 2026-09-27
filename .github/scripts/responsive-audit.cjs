const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const XLSX = require('xlsx');

const url = process.env.PREVIEW_URL;
if (!url) throw Error('PREVIEW_URL must identify the audited commit');
const seedUiFixture = require('./ui-fixture.cjs');
const root = process.env.AUDIT_OUTPUT || 'responsive-audit-output';
fs.mkdirSync(root, { recursive: true });
const manifest = [];
const unavailable = [];
const audits = {};
const matrix = {};
const runtimeErrors = [];
const blockedRequests = [];

async function runDevice(browser, device, width, height) {
  const dir = path.join(root, device==='desktop'?'desktop-reception':`${device}-${width}x${height}`);
  fs.mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, locale:'de-CH', timezoneId:'Europe/Zurich', hasTouch:device!=='desktop' });
  await context.addInitScript(seedUiFixture);
  const contexts = [context];
  let page = await context.newPage();
  page.setDefaultTimeout(12000);
  // Keep the visual audit read-only even if a UI event unexpectedly tries to sync.
  async function protect(p) { p.on('pageerror', error => runtimeErrors.push({device,message:error.message})); await p.route('**/*', route => {
    const request = route.request();
    if (/supabase/i.test(request.url())) {
      blockedRequests.push({device, method:request.method(), path:new URL(request.url()).pathname});
      return route.abort();
    }
    return route.continue();
  }); }
  await protect(page);
  async function freshPage(withFixture=true) {
    await page.context().close();
    const fresh = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, locale:'de-CH', timezoneId:'Europe/Zurich', hasTouch:device!=='desktop' });
    if(withFixture) await fresh.addInitScript(seedUiFixture);
    contexts.push(fresh);
    page = await fresh.newPage();
    page.setDefaultTimeout(12000);
    await protect(page);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByRole('region', { name: 'Arbeitsbereich auswählen' }).waitFor({ timeout: 30000 });
  }
  let count = 0;

  const metrics = async () => page.evaluate(() => ({
    innerWidth: window.innerWidth, innerHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    scrollWidth: document.documentElement.scrollWidth,
    documentReadyState: document.readyState,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
  }));
  async function shot(label, description) {
    const filename = `${String(++count).padStart(2, '0')}-${label}.png`;
    const file = path.join(dir, filename);
    await page.screenshot({ path: file, fullPage: false, animations: 'disabled', timeout:30000 });
    manifest.push({ file, viewport: [width, height], area: device, appArea: await page.locator('body').getAttribute('data-app-role') || 'bereichswahl', state: label,
      description, interactivelyReached: true, dataMutation: false, realDataMutation:false, dataSource:'isolated synthetic localStorage fixture; all Supabase requests blocked', metrics: await metrics() });
  }
  async function step(name, fn) {
    try { await fn(); console.log(device+' '+name+' reached'); }
    catch (error) { unavailable.push({ device, name, reason: String(error).slice(0, 900) }); matrix[device+'.flow.'+name]='FAIL'; console.log(device+' '+name+' FAILED '+String(error).slice(0,160)); }
    finally { fs.writeFileSync(path.join(root,'progress.json'),JSON.stringify({audits,matrix,unavailable,screenshots:manifest.length},null,2)); }
  }
  async function scroll(selector, portion) {
    return page.locator(selector).first().evaluate((el, p) => {
      el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * p);
      return { scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
    }, portion);
  }
  async function inspectFooter(selector, key) {
    const geometry = await page.evaluate(sel => {
      const root=document.querySelector(sel), body=root?.querySelector('.modal-body'), footer=root?.querySelector('.modal-actions');
      if (!root || !body || !footer) return null;
      const b=body.getBoundingClientRect(), f=footer.getBoundingClientRect();
      return { bodyBottom:b.bottom, footerTop:f.top, footerBottom:f.bottom,
        buttonWidths:[...footer.querySelectorAll('button')].map(el=>el.getBoundingClientRect().width),
        viewportHeight:window.innerHeight, bodyScrollHeight:body.scrollHeight, bodyClientHeight:body.clientHeight };
    },selector);
    audits[device][key]=geometry;
    matrix[device+'.'+key+'.insideViewport']=geometry&&geometry.footerBottom<=height+1?'PASS':'FAIL';
    matrix[device+'.'+key+'.separate'] = geometry ? (geometry.bodyBottom<=geometry.footerTop+1 ? 'PASS':'FAIL') : 'NOT_REACHED';
    matrix[device+'.'+key+'.equalButtons'] = geometry?.buttonWidths.length===2 ?
      (Math.abs(geometry.buttonWidths[0]-geometry.buttonWidths[1])<2 ? 'PASS':'FAIL') : 'NOT_REACHED';
  }
  async function closeDialog() {
    const nested=page.locator('.group-room-popup-head button, .remark-popup-head button').last();
    if(await nested.count()){await nested.click();return;}
    const dialog = page.getByRole('dialog').last();
    if (await dialog.count()) {
      const close = dialog.locator('button.close-button, button.group-room-popup-close').first();
      if (await close.count()) await close.click(); else await dialog.getByRole('button',{name:/Abbrechen|Schließen/}).first().click();
    }
  }
  async function goRole(role) {
    if (!await page.getByRole('region', { name: 'Arbeitsbereich auswählen' }).count()) {
      await closeDialog();
      await page.getByRole('button', { name: 'Zur Startseite' }).click();
    }
    await page.getByRole('button', { name: role === 'service' ? /Service Frühstück/ : /Rezeption Gästeliste/ }).click();
    await page.locator(`body[data-app-role="${role}"]`).waitFor({ state: 'attached', timeout: 25000 });
    await page.locator('.room-row').first().waitFor({ state: 'attached', timeout: 25000 });
  }

  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByRole('region', { name: 'Arbeitsbereich auswählen' }).waitFor({ timeout: 30000 });
  audits[device] = { requested: [width, height], measured: await metrics(), url: page.url(), httpStatus: response?.status(), screenshots: 0 };
  await shot('bereichswahl', 'Initiale Bereichswahl nach echtem Laden');

  if(device!=='desktop') await step('service', async () => {
    await goRole('service');
    await shot('service-main-top', 'Service mit KPI, Fortschritt und Zimmerliste');
    const roomAudit = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.ipad-room-column .room-row')];
      const groups = [...document.querySelectorAll('.ipad-room-column')].map(col => ({
        label: col.getAttribute('aria-label'), numbers: [...col.querySelectorAll('.room-number')].map(el => el.textContent.trim()),
        children: col.children.length
      }));
      const visible = [...document.querySelectorAll('body[data-app-role="service"] .room-row')]
        .filter(row => row.getBoundingClientRect().height > 0 && getComputedStyle(row).visibility !== 'hidden');
      const edges = visible.map(row => {
        const r=row.getBoundingClientRect(), pseudo=getComputedStyle(row,'::before');
        return {x:r.x,top:r.top+parseFloat(pseudo.top),bottom:r.bottom-parseFloat(pseudo.bottom)};
      });
      const gaps = edges.flatMap(r => edges.filter(next=>Math.abs(r.x-next.x)<2 && next.top>r.top).sort((a,b)=>a.top-b.top).slice(0,1).map(next=>next.top-r.bottom));
      const connectedEdges = gaps.some(g=>g<=0);
      const placeholder=document.querySelector('.room-placeholder');
      const placeholderValid=Boolean(placeholder && !placeholder.textContent.trim() && placeholder.hasAttribute('inert') && placeholder.tabIndex<0 && Math.abs(placeholder.getBoundingClientRect().height-visible[0]?.getBoundingClientRect().height)<1);
      return { groups, connectedEdges, statusLineGaps:gaps, placeholderValid, rows: visible.map((row, i) => {
        const style = getComputedStyle(row), edge = getComputedStyle(row, '::before');
        const r = row.getBoundingClientRect();
        return { index: i, room: row.querySelector('.room-number')?.textContent.trim() ?? '',
          classes: row.className, height: r.height, width:r.width, radius: style.borderRadius, padding:style.padding,
          positions:Object.fromEntries(['.room-key','.guest-names','.room-tail'].map(sel=>{const b=row.querySelector(sel)?.getBoundingClientRect();return[sel,b?{x:b.x-r.x,y:b.y-r.y}:null]})),
          borderTop: style.borderTopWidth, borderBottom: style.borderBottomWidth,
          edgeColor: edge.backgroundColor, edgeRadius: edge.borderRadius,
          edgeTop: edge.top, edgeBottom: edge.bottom };
      }) };
    });
    audits[device].roomGeometry = roomAudit;
    const first = roomAudit.rows[0];
    matrix[device + '.serviceStraightEdge'] = first?.edgeRadius === '0px' ? 'PASS' : 'FAIL';
    matrix[device + '.serviceStraightSeparators'] = first?.borderBottom !== '0px' ? 'PASS' : 'FAIL';
    matrix[device + '.noRoundedCards'] = first?.radius === '0px' ? 'PASS' : 'FAIL';
    matrix[device + '.sameGeometry'] = roomAudit.rows.every(r => Math.abs(r.height - first.height) <= 1 && r.radius === first.radius) ? 'PASS' : 'FAIL';
    matrix[device + '.separateStatusLines'] = roomAudit.connectedEdges ? 'FAIL' : 'PASS';
    if (device === 'ipad') {
      matrix[device + '.room55Placeholder'] = roomAudit.placeholderValid && roomAudit.groups.find(g => g.label?.startsWith('50'))?.children === 9 ? 'PASS' : 'FAIL';
      matrix[device + '.fiveColumns'] = roomAudit.groups.length === 5 ? 'PASS' : 'FAIL';
    }
    matrix[device+'.sameGeometry'] = roomAudit.rows.length>0 && roomAudit.rows.every(r=>Math.abs(r.height-first.height)<=1 && Math.abs(r.width-first.width)<=1 && r.padding===first.padding && ['.room-key','.guest-names'].every(sel=>Math.abs(r.positions[sel].x-first.positions[sel].x)<=1 && Math.abs(r.positions[sel].y-first.positions[sel].y)<=1))?'PASS':'FAIL';
    if(device==='ipad') matrix[device+'.roomOrder']=roomAudit.groups.every((g,i)=>g.numbers.every((n,j)=>Number(n)===(20+i*10+j+(i===3&&j>=5?1:0))))?'PASS':'FAIL';
    await step('service scroll', async () => {
      const box = await page.evaluate(() => [...document.querySelectorAll('.ipad-room-overview,.content')]
        .find(e => e.scrollHeight > e.clientHeight + 20)?.classList[0]);
      if (!box) {await shot('service-list-complete','Gesamte Zimmerliste passt in den verfügbaren Bereich');return;}
      await scroll('.' + box, .5); await shot('service-list-middle', 'Mittlere Scrollposition der Zimmerliste');
      await scroll('.' + box, 1); await shot('service-list-bottom', 'Untere Scrollposition und Footer');
      await scroll('.' + box, 0);
    });
    await step('service variants', async () => {
      for (const [label, pattern] of [['open', '.room-row:not(.present):not(.partial)'], ['captured', '.room-row.present'], ['included', '.room-row.included'], ['not-included', '.room-row:not(.included)'], ['with-table', '.room-row.present'], ['additional', '.room-row:not(.included)']]) {
        const match = page.locator('body[data-app-role="service"] ' + pattern + ':visible').first();
        if (await match.count()) {
          await match.scrollIntoViewIfNeeded();
          await shot('service-room-' + label, 'Zimmerstatus ' + label + ' im Listenverband');
        } else unavailable.push({ device, name: label, reason: 'Status currently absent' });
      }
    });
    await step('service search', async () => {
      const input = page.getByRole('textbox', { name: /Zimmer, Name oder Tisch suchen/ });
      await input.fill('21'); await shot('service-search-21', 'Suchergebnis Zimmer 21');
      await input.fill('ZZZ-NO-MATCH'); await shot('service-search-no-results','Suche ohne Treffer'); await input.fill(''); await shot('service-search-empty', 'Leere Service-Suche');
    });
    await step('service menu', async () => {
      await page.getByRole('button', { name: 'Menü öffnen' }).click();
      await shot('service-menu', 'Service-Menü mit Sprachen');
      for(const language of ['EN','VI','DE']) {
        const control=page.locator('[data-language="'+language+'"]');
        if(!await control.count()) continue;
        await control.click();
        await page.waitForTimeout(150);
        matrix[device+'.menuRemainsOpen.'+language]=await page.locator('.reliable-app-menu').isVisible()?'PASS':'FAIL';
        await shot('service-menu-'+language.toLowerCase(),'Sprachwechsel bei geöffnetem Menü');
      }
      await page.getByRole('button', { name: 'Menü schließen' }).click();
    });
    await step('checkin', async () => {
      await freshPage(); await goRole('service');
      const multi = page.getByRole('button', { name: 'Zimmer 21 öffnen' });
      await multi.click();
      const dialog = page.getByRole('dialog', { name: 'Check-in' });
      await dialog.waitFor(); await shot('checkin-multiple-open', 'Check-in mit mehreren Gästen ohne Tisch');
      await inspectFooter('.checkin-choice-modal','checkinFooter');
      const tables=await dialog.locator('.table-picker button').evaluateAll(buttons=>buttons.map(b=>({number:Number(b.textContent),width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height})));
      audits[device].checkinTables=tables;
      matrix[device+'.tables1to50']=tables.length===50&&tables.every((b,i)=>b.number===i+1)?'PASS':'FAIL';
      matrix[device+'.tableTouchTargets']=tables.every(b=>b.width>=43&&b.height>=44)?'PASS':'FAIL';
      const positions=await dialog.evaluate(el=>({count:el.querySelector('.checkin-count-block').getBoundingClientRect().toJSON(),table:el.querySelector('.table-picker').getBoundingClientRect().toJSON()}));
      matrix[device+'.checkinArrangement']=device==='iphone'?positions.table.y>positions.count.bottom?'PASS':'FAIL':positions.table.x>positions.count.right?'PASS':'FAIL';
      await dialog.getByRole('button', { name: '1 Gast' }).click(); await shot('checkin-one-selected', 'Ein Gast gewählt');
      await dialog.getByRole('button', { name: /2 Gäste/ }).click(); await shot('checkin-multiple-selected', 'Mehrere Gäste gewählt');
      await dialog.getByRole('button', { name: /Roomservice Frühstück/ }).click(); await shot('checkin-roomservice-on', 'Roomservice aktiv');
      await dialog.getByRole('button', { name: /Roomservice Frühstück/ }).click();
      await dialog.getByRole('button', { name: '17', exact: true }).click(); await shot('checkin-table-17', 'Tisch 17 ausgewählt');
      await step('checkin scroll', async () => {
        await scroll('.checkin-choice-modal .modal-body', 1); await shot('checkin-bottom-footer', 'Check-in bis zum Footer gescrollt');
      });
      await step('checkin additional rooms', async () => {
        await dialog.getByRole('button', { name: /Weitere Zimmer hinzufügen/ }).click();
        await shot('checkin-additional-rooms', 'Weitere Zimmer geöffnet, ohne zu erfassen');
        await closeDialog();
      });
      await freshPage();
    });
    await step('checkin single guest', async () => {
      await freshPage(); await goRole('service');
      await page.getByRole('button', { name: 'Zimmer 27 öffnen' }).click();
      await shot('checkin-single-guest', 'Check-in eines Zimmers mit einem Gast, ohne Speichern');
    });
    await step('special guests', async () => {
      await freshPage(); await goRole('service');
      await page.getByRole('button', { name: 'Menü öffnen' }).click();
      await page.getByRole('menuitem', { name: /Gäste ohne Zimmer erfassen/ }).click();
      const dialog = page.getByRole('dialog', { name: 'Gäste ohne Zimmer erfassen' });
      await dialog.waitFor(); await shot('special-none', 'Gastart noch nicht gewählt');
      await inspectFooter('.special-guest-modal','specialFooter');
      const opera = dialog.getByRole('button', { name: /Opera Hotel Opera Gäste/ });
      const external = dialog.getByRole('button', { name: /Externe Gäste Frühstück/ });
      await opera.click(); await shot('special-opera', 'Opera gewählt');
      await external.click(); await shot('special-external', 'Externe Gäste gewählt');
      audits[device].specialTypes = await Promise.all([opera, external].map(async x => x.evaluate(el => {
        const r = el.getBoundingClientRect(), s = getComputedStyle(el);
        return { selected: el.classList.contains('selected'), width: r.width, height: r.height, radius: s.borderRadius, padding: s.padding };
      })));
      const [a,b] = audits[device].specialTypes;
      matrix[device + '.operaExternalGeometry'] = Math.abs(a.width-b.width)<1 && Math.abs(a.height-b.height)<1 && a.radius===b.radius ? 'PASS':'FAIL';
      await dialog.getByRole('button', { name: '+', exact: true }).click(); await shot('special-two-guests', 'Gästeanzahl zwei');
      await dialog.getByRole('button', { name: '17', exact: true }).click(); await shot('special-table-17', 'Tisch 17 ausgewählt');
      await step('special scroll', async () => { await scroll('.special-guest-modal .modal-body',1); await shot('special-bottom-footer','Unteres Ende des Sondergastdialogs'); });
      await closeDialog();
    });
    await step('service confirmations and statistics',async()=>{
      await freshPage();await goRole('service');
      await page.getByRole('button',{name:'Menü öffnen'}).click();
      await page.getByRole('menuitem',{name:/Frühstück beenden/}).click();
      await page.locator('.dialog-finish-breakfast').waitFor();
      await shot('service-finish-confirmation','Bestehende Abschlussbestätigung; nicht bestätigt');
      await closeDialog();
      await page.getByRole('button',{name:'Menü öffnen'}).click();
      await page.getByRole('menuitem',{name:/Statistik/}).click();
      await shot('service-statistics-menu','Vorhandene Statistikauswahl');
      await page.getByRole('button',{name:/Tagesstatistik/}).click();
      await shot('service-statistics-day','Tagesstatistik der synthetischen Ausgangsdaten');
      await closeDialog();
      await page.getByRole('button',{name:'Zimmer 20 öffnen'}).click();
      await shot('service-captured-detail','Bereits erfasstes Zimmer; kein neuer Check-in');
      const undo=page.getByRole('button',{name:/rückgängig|Rückgängig/}).first();
      if(await undo.count()) {
        page.once('dialog',async confirmation=>{audits[device].undoConfirmation={type:confirmation.type(),message:confirmation.message(),dismissed:true};await confirmation.dismiss();});
        await undo.click();
        unavailable.push({device,name:'undo-native-dialog-screenshot',reason:'Native browser confirmation was opened and dismissed; not represented by a page screenshot.'});
      }
    });
  });

  await step('reception', async () => {
    await freshPage(); await goRole('reception'); await shot('reception-main', 'Heutige Liste und Kennzahlen');
    const listMetrics=await page.evaluate(()=>({
      headings:[...document.querySelectorAll('.reception-table-head span')].filter(e=>e.getBoundingClientRect().height).map(e=>({text:e.textContent,width:e.clientWidth,scrollWidth:e.scrollWidth})),
      rows:[...document.querySelectorAll('.room-row')].filter(e=>e.getBoundingClientRect().height).map(e=>({height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth})),
      dataIcons:[...document.querySelectorAll('.room-row svg')].filter(e=>e.getBoundingClientRect().height).length
    }));
    audits[device].receptionTable=listMetrics;
    matrix[device+'.receptionIconMinimal']=listMetrics.dataIcons===0?'PASS':'FAIL';
    if(device==='desktop') {
      matrix[device+'.fullTable']=listMetrics.headings.length===7?'PASS':'FAIL';
      matrix[device+'.compactRows']=listMetrics.rows.every(r=>r.height>=40&&r.height<=48)?'PASS':'FAIL';
      matrix[device+'.tableHeadingsFit']=listMetrics.headings.every(h=>h.scrollWidth<=h.width+1)?'PASS':'FAIL';
    } else matrix[device+'.receptionTouchRows']=listMetrics.rows.every(r=>r.height>=44)?'PASS':'FAIL';
    await step('reception search', async () => {
      const input = page.getByRole('textbox',{name:/Zimmer, Name oder Tisch suchen/});
      await input.fill('21'); await shot('reception-search-21','Rezeption Suchzustand');
      await input.fill('');
    });
    await step('guest edit and detail', async () => {
      await freshPage(); await goRole('reception');
      const listBefore = await page.locator('.ipad-room-grid').boundingBox();
      const target=page.getByRole('button',{name:'Zimmer 21 öffnen'});
      await target.click({timeout:5000});
      let dialog = page.locator('.guest-edit-modal');
      await dialog.waitFor();
      await shot('reception-guest-detail','Ruhige Datenansicht nach normalem Klick auf Zimmer 21');
      const listAfter = await page.locator('.ipad-room-grid').boundingBox();
      audits[device].receptionListBounds = {before:listBefore,after:listAfter,normalClick:true};
      matrix[device+'.receptionPointerInteraction']='PASS';
      matrix[device+'.receptionListStable']=device==='iphone'?'NOT_APPLICABLE':listBefore&&listAfter&&['x','y','width'].every(k=>Math.abs(listBefore[k]-listAfter[k])<1)?'PASS':'FAIL';
      if(device!=='iphone') {
        await page.getByRole('button',{name:'Zimmer 22 öffnen'}).click();
        await page.getByRole('button',{name:'Zimmer 21 öffnen'}).click();
      }
      await dialog.getByRole('button',{name:'Gast bearbeiten',exact:true}).click();
      matrix[device+'.viewEditSeparated']=await dialog.locator('.reception-view-body').isHidden()?'PASS':'FAIL';
      await shot('reception-guest-edit-top','Bestehendes Gastformular im Edit-Modus');
      const editList=await page.locator('.ipad-room-grid').boundingBox();
      if(device!=='iphone') matrix[device+'.receptionListStableEdit']=['x','y','width'].every(k=>Math.abs(listBefore[k]-editList[k])<1)?'PASS':'FAIL';
      if(device==='desktop') {
        await page.keyboard.press('Tab');
        matrix[device+'.keyboardFocus']=await page.evaluate(()=>{const s=getComputedStyle(document.activeElement);return s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0;})?'PASS':'FAIL';
        await shot('reception-keyboard-focus','Tastaturfokus im Gastformular');
      }
      const body = dialog.locator('.modal-body');
      if (await body.count()) {
        await scroll('.guest-edit-modal .modal-body',.5); await shot('reception-edit-middle','Mittlere Formularposition');
        await scroll('.guest-edit-modal .modal-body',1); await shot('reception-edit-bottom-footer','Letzter Inhalt und Footer');
        audits[device].editModalGeometry = await page.evaluate(() => {
          const d=document.querySelector('.guest-edit-modal'); if(!d)return null;
          const body=d.querySelector('.modal-body'),foot=d.querySelector('.modal-actions');
          const b=body?.getBoundingClientRect(),f=foot?.getBoundingClientRect();
          const buttons=[...foot.querySelectorAll('button')].map(x=>x.getBoundingClientRect().width);
          return { bodyBottom:b?.bottom,footerTop:f?.top,buttonWidths:buttons,bodyScrollTop:body?.scrollTop,
            bodyScrollMax:body?.scrollHeight-body?.clientHeight };
        });
        const g=audits[device].editModalGeometry;
        matrix[device + '.editFooterSeparation'] = g && g.bodyBottom <= g.footerTop + 1 ? 'PASS':'FAIL';
        matrix[device + '.editFooter50_50'] = g?.buttonWidths.length===2 && Math.abs(g.buttonWidths[0]-g.buttonWidths[1])<2 ? 'PASS':'FAIL';
      }
      await dialog.locator('.remark-edit-open').click();
      await shot('reception-remark-edit','Bestehende Bemerkung im Editor; nicht gespeichert');
      await closeDialog();await closeDialog();
    });
    await step('add room', async () => {
      await freshPage(); await goRole('reception');
      await page.getByRole('button',{name:/Zimmer hinzufügen/}).click(); await shot('reception-add-room','Zimmer hinzufügen, ohne Speichern'); await closeDialog();
    });
    await step('import entry', async () => {
      await freshPage(); await goRole('reception');
      await page.getByRole('button',{name:'Neue Mews-Liste laden'}).click();
      await shot('reception-import-entry','Import-Einstieg ohne Datenübernahme');
      const fileInput=page.locator('input[type="file"]').first();
      if (!await fileInput.count()) throw Error('No file input available');
      const wb=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
        ['Space number','Customer','Companions','Products'],
        [24,'Audit Testgast','1 People 26.09.2026 - 28.09.2026','Continental'],
        [25,'Audit Test Zwei','2 People 26.09.2026 - 28.09.2026',null],
        [25,null,'Audit Begleitgast',null]
      ]),'Customers');
      const synthetic=path.join(root,'synthetic-mews.xlsx');
      XLSX.writeFile(wb,synthetic);
      await fileInput.setInputFiles(synthetic);
      await page.waitForTimeout(1700);
      await shot('reception-import-control-or-error','Synthetische Datei ausgewählt; NICHT übernommen');
      audits[device].importPreviewOnly = true;
      if(await page.locator('.import-modal').count()) {
        await inspectFooter('.import-modal','importFooter');
        await scroll('.import-modal .modal-body',1);await shot('reception-import-control-bottom','Importkontrolle bis zum Ende; nicht übernommen');
      }
    });
    await step('reception menu', async () => {
      await freshPage(); await goRole('reception');
      if (!await page.getByRole('button',{name:'Menü öffnen'}).count()) return;
      await page.getByRole('button',{name:'Menü öffnen'}).click(); await shot('reception-menu','Rezeptionsmenü');
      await page.getByRole('menuitem',{name:/Frühstücksliste löschen/}).click();
      await page.getByRole('dialog').last().waitFor();
      await shot('reception-delete-confirmation','Bestehende Löschbestätigung; nicht bestätigt');await closeDialog();
    });
  });
  await step('reception empty state',async()=>{
    await freshPage(false);
    await page.getByRole('button',{name:/Rezeption Gästeliste/}).click();
    await page.locator('.workspace-empty-state').waitFor();
    await shot('reception-no-daily-list','Rezeption ohne Tagesliste; leerer isolierter Browser');
    manifest[manifest.length-1].dataSource='isolated empty browser; all Supabase requests blocked';
  });
  audits[device].screenshots=count;
  audits[device].end=await metrics();
  const screens=manifest.filter(s=>s.area===device);
  matrix[device+'.horizontalOverflow']=screens.some(s=>s.metrics.horizontalOverflow)?'FAIL':'PASS';
  matrix[device+'.requestedViewport']=screens.every(s=>s.metrics.innerWidth===width&&s.metrics.innerHeight===height)?'PASS':'FAIL';
  matrix[device+'.runtimeErrors']=runtimeErrors.some(e=>e.device===device)?'FAIL':'PASS';
  for (const c of contexts) await c.close();
}

(async()=>{
  let browser;
  try {
    browser=await chromium.launch(process.env.LOCAL_CHROMIUM?{headless:true,executablePath:process.env.LOCAL_CHROMIUM,args:require(process.env.LOCAL_CHROMIUM_PACKAGE).default.args.filter(a=>a!=="--single-process")}:{headless:true});
    for(const [device,width,height] of [['iphone',390,844],['ipad',1024,1366],['desktop',1440,900]]) {
      if(!process.env.RUN_DEVICES||process.env.RUN_DEVICES.split(',').includes(device)) await runDevice(browser,device,width,height);
    }
  } catch(error) { unavailable.push({device:'global',name:'browser/audit',reason:String(error)});process.exitCode=1; }
  finally {
    await browser?.close();
    unavailable.push({device:'both',name:'Erfolgreich erfasst',reason:'Frozen success view needs a new check-in. No check-in was submitted, including in the isolated fixture; view intentionally not recreated.'});

    for(const screen of manifest) screen.invariants=Object.fromEntries(Object.entries(matrix).filter(([key])=>key.startsWith(screen.area+'.')));
    if(Object.values(matrix).includes('FAIL')||unavailable.some(e=>e.device==='global')) process.exitCode=1;
    fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2));
    fs.writeFileSync(path.join(root,'invariants.json'),JSON.stringify(matrix,null,2));
    fs.writeFileSync(path.join(root,'responsive-audit.json'),JSON.stringify({previewUrl:url,commit:process.env.SOURCE_SHA,viewports:audits,unavailable,runtimeErrors,blockedRequests,conditions:{productionWrites:false,supabaseChanges:false,uiChanges:true,syntheticFixture:true}},null,2));
    fs.writeFileSync(path.join(root,'README.txt'),`Frozen UI release audit. Only synthetic audit guests; Supabase requests are blocked. All screenshots use actual UI interactions. No submit/save actions. External visual acceptance remains required.\nScreenshot count: ${manifest.length}. No submit/save actions were performed.\nUnreachable states: ${unavailable.length}. See responsive-audit.json.\n`);
    console.log(JSON.stringify({counts:Object.fromEntries(Object.entries(audits).map(([k,v])=>[k,v.screenshots])),unavailable,matrix},null,2));
  }
})();

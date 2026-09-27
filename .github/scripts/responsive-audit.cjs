const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const XLSX = require('xlsx');

const url = 'https://ambassador-fruehstuecksliste-oi72wjjmw-restaurant-silk.vercel.app/index-live.html';
const root = 'responsive-audit-output';
fs.mkdirSync(root, { recursive: true });
const manifest = [];
const unavailable = [];
const audits = {};
const matrix = {};

async function runDevice(browser, device, width, height) {
  const dir = path.join(root, `${device}-${width}x${height}`);
  fs.mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  // Keep the visual audit read-only even if a UI event unexpectedly tries to sync.
  await page.route('**/*', route => {
    const request = route.request();
    if (/supabase/i.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      unavailable.push({ device, name: 'blocked-write', reason: `${request.method()} ${new URL(request.url()).pathname}` });
      return route.abort();
    }
    return route.continue();
  });
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
    await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
    manifest.push({ file, viewport: [width, height], area: device, state: label,
      description, interactivelyReached: true, dataMutation: false, metrics: await metrics() });
  }
  async function step(name, fn) {
    try { await fn(); }
    catch (error) {
      unavailable.push({ device, name, reason: String(error).slice(0, 400) });
      await closeDialog().catch(() => {});
      const menuClose = page.getByRole('button', { name: 'Menü schließen' });
      if (await menuClose.count()) await menuClose.click().catch(() => {});
    }
  }
  async function scroll(selector, portion) {
    return page.locator(selector).first().evaluate((el, p) => {
      el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * p);
      return { scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
    }, portion);
  }
  async function closeDialog() {
    const dialog = page.getByRole('dialog').last();
    if (await dialog.count()) {
      const close = dialog.getByRole('button', { name: /Schließen|Abbrechen/ }).first();
      if (await close.count()) await close.click();
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

  await step('service', async () => {
    await goRole('service');
    await shot('service-main-top', 'Service mit KPI, Fortschritt und Zimmerliste');
    const roomAudit = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.ipad-room-column .room-row')];
      const groups = [...document.querySelectorAll('.ipad-room-column')].map(col => ({
        label: col.getAttribute('aria-label'), numbers: [...col.querySelectorAll('.room-number')].map(el => el.textContent.trim()),
        children: col.children.length
      }));
      return { groups, rows: rows.map((row, i) => {
        const style = getComputedStyle(row), edge = getComputedStyle(row, '::before');
        const r = row.getBoundingClientRect();
        return { index: i, room: row.querySelector('.room-number')?.textContent.trim() ?? '',
          classes: row.className, height: r.height, radius: style.borderRadius,
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
    matrix[device + '.room55Placeholder'] = roomAudit.groups.find(g => g.label?.startsWith('50'))?.children === 9 ? 'PASS' : 'FAIL';
    matrix[device + '.fiveColumns'] = roomAudit.groups.length === 5 ? 'PASS' : 'FAIL';
    await step('service scroll', async () => {
      const box = await page.evaluate(() => [...document.querySelectorAll('.ipad-room-overview,.content')]
        .find(e => e.scrollHeight > e.clientHeight + 20)?.classList[0]);
      if (!box) throw Error('No scrollable room region');
      await scroll('.' + box, .5); await shot('service-list-middle', 'Mittlere Scrollposition der Zimmerliste');
      await scroll('.' + box, 1); await shot('service-list-bottom', 'Untere Scrollposition und Footer');
      await scroll('.' + box, 0);
    });
    await step('service variants', async () => {
      for (const [label, pattern] of [['open', '.room-row:not(.present):not(.partial)'], ['captured', '.room-row.present'], ['included', '.room-row.included'], ['not-included', '.room-row:not(.included)'], ['with-table', '.room-row.present']]) {
        const match = page.locator('.ipad-room-grid ' + pattern).first();
        if (await match.count()) {
          await match.scrollIntoViewIfNeeded();
          await shot('service-room-' + label, 'Zimmerstatus ' + label + ' im Listenverband');
        } else unavailable.push({ device, name: label, reason: 'Status currently absent' });
      }
    });
    await step('service search', async () => {
      const input = page.getByRole('textbox', { name: /Zimmer, Name oder Tisch suchen/ });
      await input.fill('21'); await shot('service-search-21', 'Suchergebnis Zimmer 21');
      await input.fill(''); await shot('service-search-empty', 'Leere Service-Suche');
    });
    await step('service menu', async () => {
      await page.getByRole('button', { name: 'Menü öffnen' }).click();
      await shot('service-menu', 'Service-Menü mit Sprachen');
      await page.getByRole('button', { name: 'Menü schließen' }).click();
    });
    await step('checkin', async () => {
      const multi = page.getByRole('button', { name: 'Zimmer 21 öffnen' });
      await multi.click();
      const dialog = page.getByRole('dialog', { name: 'Check-in' });
      await dialog.waitFor(); await shot('checkin-multiple-open', 'Check-in mit mehreren Gästen ohne Tisch');
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
      await closeDialog();
      const one = page.getByRole('button', { name: 'Zimmer 27 öffnen' });
      await one.click(); await shot('checkin-single-guest', 'Check-in eines Zimmers mit einem Gast'); await closeDialog();
    });
    await step('special guests', async () => {
      await page.getByRole('button', { name: 'Menü öffnen' }).click();
      await page.getByRole('menuitem', { name: /Gäste ohne Zimmer erfassen/ }).click();
      const dialog = page.getByRole('dialog', { name: 'Gäste ohne Zimmer erfassen' });
      await dialog.waitFor(); await shot('special-none', 'Gastart noch nicht gewählt');
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
  });

  await step('reception', async () => {
    await goRole('reception'); await shot('reception-main', 'Heutige Liste und Kennzahlen');
    await step('reception search', async () => {
      const input = page.getByRole('textbox',{name:/Zimmer, Name oder Tisch suchen/});
      await input.fill('21'); await shot('reception-search-21','Rezeption Suchzustand');
      await input.fill('');
    });
    await step('guest edit and detail', async () => {
      const listBefore = await page.locator('.ipad-room-grid').boundingBox();
      await page.getByRole('button',{name:'Zimmer 21 öffnen'}).click();
      const dialog = page.getByRole('dialog',{name:'Gast bearbeiten'});
      await dialog.waitFor();
      await shot('reception-guest-detail-or-edit-top','Gastansicht nach Auswahl, oben');
      const listAfter = await page.locator('.ipad-room-grid').boundingBox();
      audits[device].receptionListBounds = { before:listBefore, after:listAfter };
      matrix[device + '.receptionListStable'] = listBefore && listAfter && Math.abs(listBefore.width-listAfter.width)<1 && Math.abs(listBefore.x-listAfter.x)<1 ? 'PASS' : 'FAIL';
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
      await closeDialog();
    });
    await step('add room', async () => {
      await page.getByRole('button',{name:/Zimmer hinzufügen/}).click(); await shot('reception-add-room','Zimmer hinzufügen, ohne Speichern'); await closeDialog();
    });
    await step('import entry', async () => {
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
    });
    await step('reception menu', async () => {
      if (!await page.getByRole('button',{name:'Menü öffnen'}).count()) return;
      await page.getByRole('button',{name:'Menü öffnen'}).click(); await shot('reception-menu','Rezeptionsmenü');
    });
  });
  audits[device].screenshots=count;
  audits[device].end=await metrics();
  matrix[device + '.horizontalOverflow'] = audits[device].end.horizontalOverflow ? 'FAIL':'PASS';
  await context.close();
}

(async()=>{
  let browser;
  try {
    browser=await chromium.launch({headless:true});
    await runDevice(browser,'iphone',390,844);
    await runDevice(browser,'ipad',1024,1366);
  } catch(error) { unavailable.push({device:'global',name:'browser/audit',reason:String(error)});process.exitCode=1; }
  finally {
    await browser?.close();
    fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2));
    fs.writeFileSync(path.join(root,'invariants.json'),JSON.stringify(matrix,null,2));
    fs.writeFileSync(path.join(root,'responsive-audit.json'),JSON.stringify({previewUrl:url,viewports:audits,unavailable,conditions:{productionWrites:false,supabaseChanges:false,uiChanges:false}},null,2));
    fs.writeFileSync(path.join(root,'README.txt'),`Responsive audit of the unchanged Ambassador preview. Private internal review only; screenshots can contain real guest names.\nScreenshot count: ${manifest.length}. No submit/save actions were performed.\nUnreachable states: ${unavailable.length}. See responsive-audit.json.\n`);
    console.log(JSON.stringify({counts:Object.fromEntries(Object.entries(audits).map(([k,v])=>[k,v.screenshots])),unavailable,matrix},null,2));
  }
})();

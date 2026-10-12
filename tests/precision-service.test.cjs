const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync('public/workflow-polish.js','utf8');
function functionSource(name){
 const start=source.indexOf(`  function ${name}(`);
 assert.ok(start>=0,`Missing ${name}`);
 const end=source.indexOf('\n  function ',start+1);
 return source.slice(start,end<0?source.length:end);
}
function setup(){
 const dom=new JSDOM(`<body data-app-role="service"><main class="app-shell"><div class="hero"><h2></h2></div><div class="search-box"><input></div><div class="content"><section class="section">
 <button class="room-row included" data-case="open"><span class="room-number">20</span></button>
 <button class="room-row included present partial" data-case="partial"><span class="room-number">23</span></button>
 <button class="room-row included present" data-case="complete"><span class="room-number">25</span></button>
 <button class="room-row" data-case="excluded"><span class="room-number">22</span></button>
 <button class="room-row included departed" data-case="departed"><span class="room-number">26</span></button>
 <button class="room-row included" data-case="vacant"><span class="room-number">27</span><span class="vacant">Frei</span></button>
 </section></div></main></body>`,{runScripts:'outside-only'});
 const w=dom.window;
 w.Element.prototype.getClientRects=function(){return this.style.display==='none'?[]:[{width:160,height:60}];};
 const ctx=dom.getInternalVMContext();
 vm.runInContext(`let openOnly=false; const activeLanguage='DE';const tr=s=>s;const normalize=s=>s.trim();const schedule=()=>{};${functionSource('markOpenRooms')}\n${functionSource('updateFilter')}\n${functionSource('updateWorkspaceFeedback')}`,ctx);
 const shell=w.document.querySelector('.app-shell');
 w.updateFilter(shell);
 return {dom,w,shell,row:name=>shell.querySelector(`[data-case="${name}"]`)};
}
test('open filter includes incomplete included rooms, excludes completed, nonincluded, departed and vacant',()=>{
 const {dom,row}=setup();
 for(const name of ['open','partial'])assert.equal(row(name).dataset.openMatch,'true',name);
 for(const name of ['complete','excluded','departed','vacant'])assert.equal(row(name).dataset.openMatch,'false',name);
 dom.window.close();
});
test('toggle has one stable label and retains the search query and native room nodes',()=>{
 const {dom,w,shell,row}=setup();const open=row('open');
 const input=shell.querySelector('input'); input.value='Zimmermann';
 const button=shell.querySelector('.open-filter-button');
 button.click();
 assert.equal(button.textContent,'Nur offene');assert.equal(button.getAttribute('aria-pressed'),'true');
 assert.ok(shell.classList.contains('open-only'));assert.ok(shell.classList.contains('search-active'));
 w.updateFilter(shell);assert.equal(button.getAttribute('aria-pressed'),'true');assert.equal(row('open'),open);
 button.click();assert.equal(button.getAttribute('aria-pressed'),'false');assert.equal(button.textContent,'Nur offene');assert.equal(input.value,'Zimmermann');
 dom.window.close();
});
test('completion removes the room from open results; partial check-in retains it',()=>{
 const {dom,w,shell,row}=setup();
 row('open').classList.add('present','partial');w.markOpenRooms(shell);assert.equal(row('open').dataset.openMatch,'true');
 row('open').classList.remove('partial');w.markOpenRooms(shell);assert.equal(row('open').dataset.openMatch,'false');
 row('open').classList.remove('present');w.markOpenRooms(shell);assert.equal(row('open').dataset.openMatch,'true');
 dom.window.close();
});
test('search result feedback excludes invisible fixed-position rooms and shows the empty state',()=>{
 const {dom,w,shell,row}=setup();shell.querySelector('input').value='Berger';
 for(const el of shell.querySelectorAll('.room-row'))el.style.visibility='hidden';
 w.updateWorkspaceFeedback(shell);assert.equal(shell.querySelector('.final-search-summary').textContent,'0 Treffer');assert.equal(shell.querySelector('.search-empty-state').hidden,false);
 row('partial').style.visibility='visible';w.updateWorkspaceFeedback(shell);assert.equal(shell.querySelector('.final-search-summary').textContent,'1 Treffer');assert.equal(shell.querySelector('.search-empty-state').hidden,true);
 dom.window.close();
});
test('production data, native calculations/import/check-in, API, and service animation are unchanged',()=>{
 const guard=JSON.parse(fs.readFileSync('tests/protected-baseline.json','utf8'));
 for(const [file,expected] of Object.entries(guard.files))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),expected,file);
 for(const [name,expected] of Object.entries(guard.functions))assert.equal(crypto.createHash('sha256').update(functionSource(name)).digest('hex'),expected,name);
});

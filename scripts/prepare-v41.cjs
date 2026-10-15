// A separate authenticated build of the recovered runtime. V4 artifacts stay reproducible.
const fs=require('node:fs'),espree=require('espree'),esbuild=require('esbuild');
const inputPath='public/recovered/_next/static/chunks/0nkyeaxka~cd7-service-v4.js';
let input=fs.readFileSync(inputPath,'utf8');
const replacements=[
 ['eM(n),localStorage.setItem("ambassador-breakfast-history",JSON.stringify(n)),e5(ea,Y,n,eU.current,[])','e5(ea,Y,n,eU.current,[])'],
 ['eM(s),localStorage.setItem("ambassador-breakfast-history",JSON.stringify(s)),e5(ea,Y,s,eU.current,[])','e5(ea,Y,s,eU.current,[])'],
 ['return eU.current=o,es(o),et(i),o','return o'],
 ['};if(!r&&sessionStorage.getItem("ambassador-work-area")','};window.BreakfastSecureUI.apply=v4Apply;if(!r&&sessionStorage.getItem("ambassador-work-area")']
];
for(const [a,b] of replacements){if(input.split(a).length!==2)throw Error('V4.1 runtime boundary changed: '+a);input=input.replace(a,b);}
const ast=espree.parse(input,{ecmaVersion:2023,sourceType:'script',range:true}),edits=[],changed=new Set(),callers=new Set();
const bodies={
 e7:'async(e,s=eK.current,n=eV.current,t=eU.current)=>window.BreakfastSecureUI.commit(eW.current,e,v4Apply)',
 e5:'async(e,s=eK.current,n=eV.current,t=eU.current,a=e)=>window.BreakfastSecureUI.history(n,v4Apply)',
 sx:'async()=>{await window.BreakfastSecureUI.clear(v4Apply);eC(null)}'
};
function walk(node,parents=[]){if(!node||typeof node!=='object')return;if(node.type==='VariableDeclarator'&&bodies[node.id?.name]){changed.add(node.id.name);edits.push({start:node.init.start,end:node.init.end,text:bodies[node.id.name]});return;}
 if(node.type==='CallExpression'&&['e7','e5'].includes(node.callee?.name)){edits.push({start:node.start,end:node.start,text:'await '});const fn=[...parents].reverse().find(p=>['FunctionExpression','ArrowFunctionExpression','FunctionDeclaration'].includes(p.type));if(!fn)throw Error('Missing handler');if(!fn.async)callers.add(fn);}
 for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(v=>walk(v,[...parents,node]));else if(value&&typeof value==='object'&&value.type)walk(value,[...parents,node]);}}
walk(ast);if(changed.size!==3)throw Error('Missing protected writer');for(const fn of callers)edits.push({start:fn.start,end:fn.start,text:'async '});
for(const e of edits.sort((a,b)=>b.start-a.start))input=input.slice(0,e.start)+e.text+input.slice(e.end);
espree.parse(input,{ecmaVersion:2023,sourceType:'script'});
fs.writeFileSync(inputPath.replace('service-v4','secure-v41'),input);
let workflow=fs.readFileSync('public/workflow-polish.js','utf8');
// Historical labels/action IDs can predate strict RPC validation. Escape them at HTML sinks.
workflow='const secureHtml=value=>String(value??\'\').replace(/[&<>"\']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",\'"\':"&quot;","\'":"&#39;"}[c]));\n'+workflow;
workflow=workflow.replaceAll('${displayTable(room.table)}','${secureHtml(displayTable(room.table))}').replaceAll('${displayTable(entry.table)}','${secureHtml(displayTable(entry.table))}').replaceAll('${entry.actionId}','${secureHtml(entry.actionId)}');
workflow=workflow.replace('function saveSpecialGuestCheckin(type, people, table) {','async function saveSpecialGuestCheckin(type, people, table) {\n    if(window.BreakfastSecureUI)return window.BreakfastSecureUI.special(type,people,table);');
workflow=workflow.replace('function undoSpecialGuestCheckin(actionId) {','async function undoSpecialGuestCheckin(actionId) {\n    if(window.BreakfastSecureUI)return window.BreakfastSecureUI.undoSpecial(actionId);');
workflow=workflow.replace('if (undoSpecialGuestCheckin(undoButton.dataset.specialUndo))','if (await undoSpecialGuestCheckin(undoButton.dataset.specialUndo))');
workflow=workflow.replace('saveSpecialGuestCheckin(type, count, table ? `Tisch ${table}` : "Kein Tisch");','try { await saveSpecialGuestCheckin(type, count, table ? `Tisch ${table}` : "Kein Tisch"); } catch { saving=false; update(); return; }');
const listener=workflow.indexOf('layer.addEventListener("click", (event) => {',workflow.indexOf('function openSpecialGuestDialog()'));
if(listener<0)throw Error('Special guest listener changed');workflow=workflow.slice(0,listener)+workflow.slice(listener).replace('layer.addEventListener("click", (event) => {','layer.addEventListener("click", async (event) => {');
espree.parse(workflow,{ecmaVersion:2023,sourceType:'script'});fs.writeFileSync('public/workflow-secure.js',workflow);
const html=fs.readFileSync('public/index-live.html','utf8').replace('<head>','<head><meta name="robots" content="noindex,nofollow"><script src="/secure-bootstrap.js"></script>').replaceAll('0nkyeaxka~cd7-service-v4.js','0nkyeaxka~cd7-secure-v41.js').replace('/workflow-polish.js','/workflow-secure.js');fs.writeFileSync('public/secure-app.html',html);
esbuild.buildSync({entryPoints:['client/auth-app.js'],bundle:true,minify:true,outfile:'public/auth-bundle.js',target:['safari15','chrome100']});
console.log('V4.1 authenticated shell, typed write bridge and preserved runtime built');

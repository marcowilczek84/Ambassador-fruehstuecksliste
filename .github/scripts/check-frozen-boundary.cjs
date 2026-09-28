const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const ts=require('typescript');
const crypto=require('node:crypto');
const baseline='3825aba02d66d8dca8c193054fb29877ad7c88f6';
const sourcePath='public/workflow-polish.js';
const before=execFileSync('git',['show',baseline+':'+sourcePath],{encoding:'utf8'});
const after=fs.readFileSync(sourcePath,'utf8');
const allowedFunctions=new Set(['apply','selectRole','showSharedListReadyAnimation','serviceEntryTransition']);
function functions(source) {
 const found=new Map(),tree=ts.createSourceFile(sourcePath,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 function visit(node){if(ts.isFunctionDeclaration(node)&&node.name)found.set(node.name.text,node.getText(tree));ts.forEachChild(node,visit);}visit(tree);return found;
}
function translationTable(source){const tree=ts.createSourceFile(sourcePath,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);let value;function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(tree)==='translations')value=node.getText(tree);ts.forEachChild(node,visit);}visit(tree);return value;}
if(!translationTable(before)||translationTable(before)!==translationTable(after))throw Error('Frozen translation table changed');
const oldFunctions=functions(before),newFunctions=functions(after),protectedFunctions=[];
for(const [name,body] of oldFunctions) if(!allowedFunctions.has(name)) {
 if(newFunctions.get(name)!==body)throw Error('Frozen function changed: '+name);
 protectedFunctions.push({name,sha256:crypto.createHash('sha256').update(body).digest('hex')});
}
const changed=execFileSync('git',['diff','--name-only',baseline],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const allowedFiles=path=>['public/breakfast-app-logo.svg','public/final-design.css',sourcePath,'.github/workflows/responsive-minimal.yml'].includes(path)||path.startsWith('.github/scripts/')||path.startsWith('docs/frozen-ui-release/');
if(changed.some(file=>!allowedFiles(file)))throw Error('File outside frozen UI boundary changed: '+changed.filter(file=>!allowedFiles(file)).join(', '));
// Authorized changes are presentation only. All other functions remain byte-identical.
let restored=after;
for(const name of ['selectRole','showSharedListReadyAnimation','serviceEntryTransition']) restored=restored.replace(newFunctions.get(name),oldFunctions.get(name));
restored=restored.replace('  '+newFunctions.get('structureImportReview')+'\n\n','').replace('    structureImportReview(document);\n','').replace('  const workAreaTransition = Object.freeze({ duration: 4700, reducedDuration: 80 });\n\n','');
if(restored!==before)throw Error('Unexpected JavaScript change outside authorized presentation functions');
const cssBefore=execFileSync('git',['show',baseline+':public/final-design.css'],{encoding:'utf8'});
if(!fs.readFileSync('public/final-design.css','utf8').startsWith(cssBefore+'\n/* Physical iPhone III:'))throw Error('Existing CSS changed');
for(const file of ['public/breakfast-app-logo.svg','.github/scripts/ui-fixture.cjs','.github/scripts/service-modal-regression.cjs']) {
 if(fs.readFileSync(file,'utf8')!==execFileSync('git',['show',baseline+':'+file],{encoding:'utf8'}))throw Error('Frozen file changed: '+file);
}
// Old assertions remain intact except the explicitly superseded 650-ms timing.
const permittedTestEdits={
 'realdevice-regression.cjs':s=>s.replace("async function shot(name){", "async function shot(name){\n  if(!name.endsWith('transition'))await page.locator('.work-area-entry-transition').waitFor({state:'detached'});").replace('data.elapsed<1200','data.elapsed>=4600&&data.elapsed<5200'),
 'responsive-audit.cjs':s=>s.replace('async function shot(label, description) {',"async function shot(label, description) {\n    await page.locator('.work-area-entry-transition').waitFor({state:'detached'});").replace("body=root?.querySelector('.import-list') || root?.querySelector('.modal-body')","body=root?.querySelector('.modal-body')").replace("await scroll('.import-modal .import-list',1)","await scroll('.import-modal .modal-body',1)"),
 'physical-iphone-regression.cjs':s=>s.replaceAll("page.locator('.service-entry-transition').waitFor({state:'detached'})","page.locator('.work-area-entry-transition').waitFor({state:'detached'})"),
 'branding-regression.cjs':s=>s.replaceAll("page.locator('.service-entry-transition').waitFor({state:'detached'})","page.locator('.work-area-entry-transition').waitFor({state:'detached'})")
};
for(const [name,transform]of Object.entries(permittedTestEdits)){const p='.github/scripts/'+name;if(fs.readFileSync(p,'utf8')!==transform(execFileSync('git',['show',baseline+':'+p],{encoding:'utf8'})))throw Error('Unexpected old audit edit: '+name);}
const report={baseline,result:'PASS',changedFiles:changed,protectedExistingFunctions:protectedFunctions,scope:'physical-iphone-III',businessHandlersByteIdentical:true,existingCssByteIdentical:true,existingAssertionsPreservedExceptSupersededTransitionTiming:true,brandingTileAndHotelAssetsUnchanged:true,receptionWideTableUnchanged:true,serviceModalGeometryUnchanged:true,recoveredApplicationChanged:false,translationsChanged:false,supabaseConfigurationChanged:false};
fs.mkdirSync('responsive-audit-output',{recursive:true});fs.writeFileSync('responsive-audit-output/frozen-boundary.json',JSON.stringify(report,null,2));
console.log('PASS: '+protectedFunctions.length+' existing functions byte-identical; recovered application and configuration unchanged.');
if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'branding_only=false\n');

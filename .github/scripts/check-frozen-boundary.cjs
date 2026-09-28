const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const ts=require('typescript');
const crypto=require('node:crypto');
const baseline='34f86730fbc5374317a2189abec75a1caec87be1';
const sourcePath='public/workflow-polish.js';
const before=execFileSync('git',['show',baseline+':'+sourcePath],{encoding:'utf8'});
const after=fs.readFileSync(sourcePath,'utf8');
const allowedFunctions=new Set(['apply']);
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
const allowedFiles=path=>['public/final-design.css',sourcePath,'.github/workflows/responsive-minimal.yml'].includes(path)||path.startsWith('.github/scripts/')||path.startsWith('docs/frozen-ui-release/');
if(changed.some(file=>!allowedFiles(file)))throw Error('File outside frozen UI boundary changed: '+changed.filter(file=>!allowedFiles(file)).join(', '));
// Only additive presentation helpers and their apply calls are authorized.
const helperNames=['structureServiceSuccess','lockServiceDialogBackground'];
let originalJs=after;
for(const name of helperNames) {
 const body=newFunctions.get(name);
 if(!body)throw Error('Missing presentation helper: '+name);
 originalJs=originalJs.replace('  '+body+'\n\n','').replace('    '+name+'(document);\n','');
}
if(originalJs!==before)throw Error('Unexpected JavaScript change outside presentation helpers');
const cssBefore=execFileSync('git',['show',baseline+':public/final-design.css'],{encoding:'utf8'});
const cssAfter=fs.readFileSync('public/final-design.css','utf8');
if(!cssAfter.startsWith(cssBefore+'\n/* Service work dialogs:'))throw Error('Existing CSS changed');
const addedCss=cssAfter.slice(cssBefore.length);
for(const line of addedCss.split('\n'))if(line.includes('#ambassador-ui')&&!line.includes('#ambassador-ui[data-app-role="service"]'))throw Error('Unscoped service CSS');
if(/reception|role-selection|role-options|guest-edit-modal|remark-popup|room-row|reliable-app-menu/.test(addedCss))throw Error('Frozen view targeted by new CSS');
for(const file of ['.github/scripts/realdevice-regression.cjs','.github/scripts/responsive-audit.cjs','.github/scripts/ui-fixture.cjs']) {
 if(fs.readFileSync(file,'utf8')!==execFileSync('git',['show',baseline+':'+file],{encoding:'utf8'}))throw Error('Existing regression changed: '+file);
}
const report={baseline,result:'PASS',changedFiles:changed,protectedExistingFunctions:protectedFunctions,scope:'service-modal-outer-geometry',allExistingHandlersByteIdentical:true,existingCssByteIdentical:true,existingRegressionScriptsByteIdentical:true,brandingUnchanged:true,receptionUnchanged:true,guestEditorUnchanged:true,recoveredApplicationChanged:false,translationsChanged:false,supabaseConfigurationChanged:false};
fs.mkdirSync('responsive-audit-output',{recursive:true});fs.writeFileSync('responsive-audit-output/frozen-boundary.json',JSON.stringify(report,null,2));
console.log('PASS: '+protectedFunctions.length+' existing functions byte-identical; recovered application and configuration unchanged.');
if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'branding_only=false\n');

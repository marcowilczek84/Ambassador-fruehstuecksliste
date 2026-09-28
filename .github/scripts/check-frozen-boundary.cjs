const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const ts=require('typescript');
const crypto=require('node:crypto');
const baseline='3e08880c4e72183c1c89695076ec789aef5b619a';
const sourcePath='public/workflow-polish.js';
const before=execFileSync('git',['show',baseline+':'+sourcePath],{encoding:'utf8'});
const after=fs.readFileSync(sourcePath,'utf8');
const allowedFunctions=new Set(['renderRoleSelection']);
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
const allowedFiles=path=>['public/final-design.css','public/breakfast-app-logo.svg',sourcePath,'.github/workflows/responsive-minimal.yml'].includes(path)||path.startsWith('.github/scripts/')||path.startsWith('docs/frozen-ui-release/');
if(changed.some(file=>!allowedFiles(file)))throw Error('File outside frozen UI boundary changed: '+changed.filter(file=>!allowedFiles(file)).join(', '));
// Prove that the only JavaScript edits are the explicitly authorized chooser markup.
const logoLine='      <img class="role-logo" src="/ambassador-logo.svg?v=confirmed-20260816-0517" alt="Ambassador Hotel Zürich">';
const productLine='      <img class="role-app-logo" src="/breakfast-app-logo.svg" width="60" height="60" alt="" aria-hidden="true">';
const expectedJs=before.replace(logoLine,logoLine+'\n'+productLine).replaceAll('</small></span><b>›</b>','</small></span>');
if(after!==expectedJs)throw Error('JavaScript edit outside the two branding changes');
const cssBefore=execFileSync('git',['show',baseline+':public/final-design.css'],{encoding:'utf8'});
const brandingCss='\n/* Product identity on the role chooser only. */\n#ambassador-ui .role-selection > .role-app-logo { display:block; order:0; align-self:center; flex:none; width:60px; height:60px; margin:0 0 16px; border:0; background:none; box-shadow:none; }\n@media(max-width:699px) {\n  #ambassador-ui .role-selection > .role-app-logo { width:52px; height:52px; }\n}\n';
const expectedCss=cssBefore.replace('grid-template-columns:36px minmax(0,1fr) 16px!important;','grid-template-columns:36px minmax(0,1fr)!important;')+brandingCss;
if(fs.readFileSync('public/final-design.css','utf8')!==expectedCss)throw Error('CSS edit outside the role chooser');
for(const file of ['.github/scripts/realdevice-regression.cjs','.github/scripts/responsive-audit.cjs','.github/scripts/ui-fixture.cjs']) {
 if(fs.readFileSync(file,'utf8')!==execFileSync('git',['show',baseline+':'+file],{encoding:'utf8'}))throw Error('Existing regression changed: '+file);
}
const report={baseline,result:'PASS',changedFiles:changed,protectedExistingFunctions:protectedFunctions,scope:'role-selection-only',allOtherJavaScriptByteIdentical:true,allOtherCssByteIdentical:true,existingRegressionScriptsByteIdentical:true,previousRestfix:{pass:97,fail:0,runId:36376608158,status:'unaffected; not rerun'},previousInvariants:{pass:86,fail:0,runId:36376608158,status:'unaffected; not rerun'},recoveredApplicationChanged:false,translationsChanged:false,supabaseConfigurationChanged:false};
fs.mkdirSync('responsive-audit-output',{recursive:true});fs.writeFileSync('responsive-audit-output/frozen-boundary.json',JSON.stringify(report,null,2));
console.log('PASS: '+protectedFunctions.length+' existing functions byte-identical; recovered application and configuration unchanged.');
if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'branding_only=true\n');

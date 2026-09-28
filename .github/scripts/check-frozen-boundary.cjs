const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const ts=require('typescript');
const crypto=require('node:crypto');
const baseline='2486e21c11b4212b3904655244a20f9959f51907';
const sourcePath='public/workflow-polish.js';
const before=execFileSync('git',['show',baseline+':'+sourcePath],{encoding:'utf8'});
const after=fs.readFileSync(sourcePath,'utf8');
const allowedFunctions=new Set(['buildReceptionToolbar','receptionReadView','updateEmptyWorkspace','apply']);
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
const report={baseline,result:'PASS',changedFiles:changed,protectedExistingFunctions:protectedFunctions,recoveredApplicationChanged:false,translationsChanged:false,supabaseConfigurationChanged:false};
fs.mkdirSync('responsive-audit-output',{recursive:true});fs.writeFileSync('responsive-audit-output/frozen-boundary.json',JSON.stringify(report,null,2));
console.log('PASS: '+protectedFunctions.length+' existing functions byte-identical; recovered application and configuration unchanged.');

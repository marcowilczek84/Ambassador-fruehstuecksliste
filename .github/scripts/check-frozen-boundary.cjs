const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const ts=require('typescript'),crypto=require('node:crypto');
const baseline='5c62497c3647854a1356d0a20eac5a0205ee2b74';
const sourcePath='public/workflow-polish.js';
const previous=p=>execFileSync('git',['show',baseline+':'+p],{encoding:'utf8'});
const before=previous(sourcePath),after=fs.readFileSync(sourcePath,'utf8');
function functions(source){const found=new Map(),tree=ts.createSourceFile(sourcePath,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);function visit(n){if(ts.isFunctionDeclaration(n)&&n.name)found.set(n.name.text,n.getText(tree));ts.forEachChild(n,visit);}visit(tree);return found;}
const oldFunctions=functions(before),newFunctions=functions(after),protectedFunctions=[];
for(const [name,body]of oldFunctions){
 const restored=name==='renderRoleSelection'?newFunctions.get(name).replaceAll('roleSelectionIcon("service")','icon("service")').replaceAll('roleSelectionIcon("reception")','icon("reception")'):newFunctions.get(name);
 if(restored!==body)throw Error('Frozen function changed: '+name);
 protectedFunctions.push({name,sha256:crypto.createHash('sha256').update(body).digest('hex'),exception:name==='renderRoleSelection'?'two presentation-only SVG calls':null});
}
const introduced=[...newFunctions.keys()].filter(n=>!oldFunctions.has(n));
if(introduced.join(',')!=='roleSelectionIcon')throw Error('Unexpected added function');
const comment='  // Approved Hybrid C: 32-unit vector geometry, displayed in the existing 26px role slots.\n  // Source: Ambassador_Icon_Entscheidungstest, page 8; functional app icons stay unchanged.\n';
const restored=after.replace(comment+'  '+newFunctions.get('roleSelectionIcon')+'\n\n','').replaceAll('roleSelectionIcon("service")','icon("service")').replaceAll('roleSelectionIcon("reception")','icon("reception")');
if(restored!==before)throw Error('Unexpected JavaScript delta outside chooser icons');
const cssBefore=previous('public/final-design.css'),cssAfter=fs.readFileSync('public/final-design.css','utf8');
const expectedCss='\n/* Approved post-III delta: Hybrid C glyphs only; existing slots stay 26px. */\n#ambassador-ui .role-options .role-hybrid-icon { stroke-width:2!important; stroke-linecap:round!important; stroke-linejoin:round!important; }\n@media(max-width:699px) {\n  #ambassador-ui[data-app-role="reception"] .dialog-add-room .form-grid { align-content:start!important; row-gap:20px!important; }\n  #ambassador-ui[data-app-role="reception"] .dialog-add-room .form-grid > label:not(.check-field) { align-content:start!important; gap:8px!important; }\n}\n';
if(cssAfter!==cssBefore+expectedCss)throw Error('Unexpected CSS delta');
const changed=execFileSync('git',['diff','--name-only',baseline],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const allowed=new Set([sourcePath,'public/final-design.css','.github/scripts/check-frozen-boundary.cjs','.github/scripts/delta-hybrid-regression.cjs','.github/workflows/delta-hybrid.yml','docs/frozen-ui-release/delta-hybrid-baseline.md']);
if(changed.some(p=>!allowed.has(p)))throw Error('File outside delta scope changed: '+changed.filter(p=>!allowed.has(p)).join(', '));
for(const file of ['public/breakfast-app-logo.svg','.github/workflows/responsive-minimal.yml',...fs.readdirSync('.github/scripts').filter(n=>!['check-frozen-boundary.cjs','delta-hybrid-regression.cjs'].includes(n)).map(n=>'.github/scripts/'+n)])if(fs.readFileSync(file,'utf8')!==previous(file))throw Error('Frozen asset / existing test changed: '+file);
const report={baseline,result:'PASS',changedFiles:changed,protectedExistingFunctions:protectedFunctions,scope:'hybrid-C-and-mobile-add-room-only',allExistingHandlersByteIdentical:true,existingCssByteIdentical:true,existingRegressionScriptsByteIdentical:true,filledAppLogoUnchanged:true,animationLifecycleAndDurationUnchanged:true,recoveredApplicationChanged:false,translationsChanged:false,supabaseConfigurationChanged:false};
fs.mkdirSync('responsive-audit-output',{recursive:true});fs.writeFileSync('responsive-audit-output/frozen-boundary.json',JSON.stringify(report,null,2));console.log('PASS: frozen 5c62497 baseline preserved; only two chooser SVG calls and mobile field grouping changed.');
if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'branding_only=false\n');

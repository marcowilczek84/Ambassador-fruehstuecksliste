const fs=require('node:fs'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const baseline='5d4b35b75d1aaa734c476310f80365cdb0eab1f1';
const old=p=>execFileSync('git',['show',baseline+':'+p]);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const allowed=new Set(['public/index-live.html','public/final-design.css','public/favicon.svg','public/apple-touch-icon.png','.github/scripts/check-frozen-boundary.cjs','.github/scripts/branding-realdevice.cjs','.github/workflows/branding-realdevice.yml','docs/frozen-ui-release/branding-realdevice-baseline.md']);
const changed=execFileSync('git',['diff','--name-only',baseline],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
if(changed.some(p=>!allowed.has(p)))throw Error('Out-of-scope change: '+changed.filter(p=>!allowed.has(p)));
const protectedFiles=execFileSync('git',['ls-tree','-r','--name-only',baseline],{encoding:'utf8'}).trim().split('\n').filter(p=>!allowed.has(p));
for(const p of protectedFiles)if(!fs.readFileSync(p).equals(old(p)))throw Error('Frozen file changed: '+p);
const css=fs.readFileSync('public/final-design.css','utf8'),beforeCss=old('public/final-design.css').toString();
if(!css.startsWith(beforeCss))throw Error('Existing CSS changed');
const cssDelta=css.slice(beforeCss.length);
const expected=`
/* Physical-iPhone branding restfix: reuse the approved cup; retain splash box/timing. */
.breakfast-splash-mark {
  background:#1c777b url("data:image/svg+xml;base64,${fs.readFileSync('public/breakfast-app-logo.svg').toString('base64')}") center / 100% 100% no-repeat border-box!important;
  border-color:transparent!important;
}
.breakfast-splash-mark > svg { visibility:hidden!important; }
/* One accessible contour, merged with the field edge; no second glow/ring. */
#ambassador-ui .dialog-add-room textarea:focus,
#ambassador-ui .dialog-add-room textarea:focus-visible {
  border-color:var(--ui-petrol)!important;
  box-shadow:none!important;
  outline:2px solid var(--ui-petrol)!important;
  outline-offset:-1px!important;
}
`;
if(cssDelta!==expected)throw Error('Unexpected CSS delta');
let expectedHtml=old('public/index-live.html').toString();
for(const [file,version]of [['workflow-polish.js','8.39.2'],['final-design.css','20260927'],['favicon.svg','8.39.2'],['apple-touch-icon.png','8.39.2']]){
 const v=hash(fs.readFileSync('public/'+file)).slice(0,16);
 expectedHtml=expectedHtml.replaceAll('/'+file+'?v='+version,'/'+file+'?v='+v);
 if(file==='favicon.svg')expectedHtml=expectedHtml.replaceAll('/favicon.svg\\"','/favicon.svg?v='+v+'\\"');
}
if(expectedHtml!==fs.readFileSync('public/index-live.html','utf8'))throw Error('HTML changed beyond active asset versions');
const logo=fs.readFileSync('public/breakfast-app-logo.svg','utf8'),white=logo.slice(logo.indexOf('  <g'),logo.lastIndexOf('</svg>'));
const system='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">\n  <rect width="64" height="64" fill="#1c777b"/>\n  <g transform="translate(32 32) scale(0.83) translate(-32 -32)">\n'+white+'  </g>\n</svg>\n';
if(system!==fs.readFileSync('public/favicon.svg','utf8'))throw Error('System cup contour changed');
const report={baseline,result:'PASS',changedFiles:changed,protectedFiles:protectedFiles.map(p=>({path:p,sha256:hash(old(p))})),workflowJavaScriptByteIdentical:true,filledAppLogoByteIdentical:true,recoveredApplicationByteIdentical:true,allExistingTestsByteIdentical:true,existingCssByteIdentical:true,animation4700msUnchanged:true,scope:'branding-assets-delivery-and-add-room-textarea-focus-only'};
fs.mkdirSync('responsive-audit-output',{recursive:true});fs.writeFileSync('responsive-audit-output/frozen-boundary.json',JSON.stringify(report,null,2));console.log('PASS: 5d4b35b frozen source verified; '+protectedFiles.length+' files byte-identical.');
if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'branding_only=false\n');

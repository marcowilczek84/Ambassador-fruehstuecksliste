// User-authorized Production promotion, only after this commit's complete green gate.
const fs=require('node:fs'),cp=require('node:child_process');
const read=p=>JSON.parse(fs.readFileSync('tested-proof/'+p,'utf8'));
const deployment=read('responsive-audit-output/deployment.json');
const parser=read('zff-audit-output/parser-results.json');
const browser=read('zff-audit-output/browser-results.json');
const branding=read('branding-audit-output/results.json');
const sha=process.env.GITHUB_SHA;
const green=(r,min)=>Object.keys(r.matrix).length>=min&&Object.values(r.matrix).every(v=>v==='PASS');
if(!sha||deployment.commit!==sha||parser.sourceCommit!==sha||browser.commit!==sha||branding.commit!==sha)throw Error('Production blocked: proof commit mismatch');
if(!green(parser,33)||!green(browser,212)||!green(branding,128))throw Error('Production blocked: required proof is not all PASS');
if(browser.url!==deployment.previewUrl||branding.url!==deployment.previewUrl)throw Error('Production blocked: tested Preview mismatch');
const url=new URL(deployment.previewUrl);
if(url.protocol!=='https:'||!/^ambassador-fruehstuecksliste-[a-z0-9]+-restaurant-silk\.vercel\.app$/.test(url.hostname))throw Error('Production blocked: unexpected project URL');
if(!process.env.VERCEL_TOKEN)throw Error('Production blocked: no existing CI Vercel credential');
console.log('Promoting tested commit '+sha+' from '+url.origin);
const r=cp.spawnSync('npx',['--yes','vercel@60.1.3','promote',url.origin,'--yes','--scope','restaurant-silk','--token',process.env.VERCEL_TOKEN],{stdio:'inherit',env:{...process.env,VERCEL_TELEMETRY_DISABLED:'1'}});
if(r.error)throw r.error;
if(r.status!==0)throw Error('Production promotion failed with exit '+r.status);

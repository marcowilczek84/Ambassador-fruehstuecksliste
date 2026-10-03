// Scope proof, separate from browser/E2E results.
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto');
const base='0ef9a8a506dd08c980d6678d77de9bd26cfd42bd',bundle='public/recovered/_next/static/chunks/0nkyeaxka~cd7-meili-v9.js';
const old=p=>cp.execFileSync('git',['show',base+':'+p],{encoding:'utf8',maxBuffer:32*1024*1024});
let expected=old(bundle);
const replace=(a,b)=>{if(expected.split(a).length!==2)throw Error('Ambiguous authorized delta: '+a);expected=expected.replace(a,b)};
replace('var s=e.i(43476),n=e.i(71645);','var s=e.i(43476),n=e.i(71645);const canEditGuestMaster=()=>sessionStorage.getItem("ambassador-work-area")==="reception";');
replace('ed?eg(Math.max(1,q(ed))):eg(1)},[ed])','ed?eg(Math.max(1,q(ed))):eg(1)},[ed?.room])');
for(const [field,value] of [['guests','e.target.value.split("\\n").filter(Boolean)'],['people','Math.max(1,Number(e.target.value)||1)'],['included','e.target.checked'],['arrival','e.target.value'],['departure','e.target.value']])replace('onChange:e=>eh({...ed,'+field+':'+value+'})',(field==='included'?'disabled':'readOnly')+':!canEditGuestMaster(),onChange:e=>canEditGuestMaster()&&eh({...ed,'+field+':'+value+'})');
replace('onClick:()=>(e=>{if(e7(ea.map(s=>s.room===e.room?Z({...s,...e}):s)),e.guests[0])','onClick:()=>(e=>{if(!canEditGuestMaster()){const original=eW.current.find(s=>s.room===e.room);if(!original)return;e={...original,note:e.note,guestInfo:e.guestInfo}}if(e7(ea.map(s=>s.room===e.room?Z({...s,...e}):s)),e.guests[0])');
const checks=[];const check=(name,ok,data)=>checks.push({name,status:ok?'PASS':'FAIL',data});
check('active-business-bundle-only-two-authorized-P1-deltas',expected===fs.readFileSync(bundle,'utf8'));
const paths=cp.execFileSync('git',['ls-tree','-r','--name-only',base,'public','app','next.config.ts','package.json','package-lock.json'],{encoding:'utf8',maxBuffer:32*1024*1024}).trim().split('\n');
const allowed=[bundle,'public/index-live.html','public/workflow-polish.js','public/final-design.css'];
const changes=paths.filter(p=>!allowed.includes(p)&&old(p)!==fs.readFileSync(p,'utf8'));
check('all-other-app-assets-config-and-dependencies-unchanged',changes.length===0,{checked:paths.length-allowed.length,changes});
for(const name of ['showSharedListReadyAnimation','serviceEntryTransition','openSpecialGuestDialog','settleServiceEditorContext','settleServiceEditScroll','quietSuccessRemark','structureServiceSuccess','structureImportReview','persistBreakfastState']){
 const extract=s=>{const start=s.indexOf('  function '+name+'(');if(start<0)throw Error('Missing '+name);const end=s.indexOf('\n  function ',start+5);return s.slice(start,end<0?s.length:end)};
 check(name+'-unchanged',extract(old('public/workflow-polish.js'))===extract(fs.readFileSync('public/workflow-polish.js','utf8')));
}
const result={base,type:'source-boundary-not-E2E',checks,pass:checks.filter(x=>x.status==='PASS').length,fail:checks.filter(x=>x.status==='FAIL').length};
fs.mkdirSync(process.env.AUDIT_OUTPUT||'consolidated-evidence',{recursive:true});fs.writeFileSync((process.env.AUDIT_OUTPUT||'consolidated-evidence')+'/boundaries.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(result.fail)process.exitCode=1;

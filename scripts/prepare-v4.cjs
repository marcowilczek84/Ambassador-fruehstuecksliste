// Reproducible, bounded bridge into the recovered production runtime.
// Legacy APIs, import/export and auth are preserved. Statistics discount corrections.
const fs=require('node:fs');
const path='public/recovered/_next/static/chunks/0nkyeaxka~cd7-meili-v9.js';
let input=fs.readFileSync(path,'utf8');
const statsStart=input.indexOf(',sy=Y.filter('),statsEnd=input.indexOf(',s$=',statsStart);
if(statsStart<0||statsEnd<0)throw Error('Statistics boundary changed');
input=input.slice(0,statsStart)+',v4Events=window.AmbassadorServiceV4.effectiveArrivals(Y)'+input.slice(statsStart,statsEnd).replace(/\bY\b/g,'v4Events')+input.slice(statsEnd);
const anchor=';return r?(0,s.jsxs)("main",{className:"breakfast-splash"';
if(input.split(anchor).length!==2)throw Error('Production runtime anchor changed');
const bridge=`;const v4Apply=payload=>{if(payload.date!==E())return;const rooms=W(payload.rooms||[]);eW.current=rooms;er(rooms);eQ.current=Number(payload.updated)||eQ.current;eK.current=payload.v8Arrivals||[];Q(eK.current);eU.current=payload.v8Activity||[];es(eU.current);eV.current=payload.v8History||[];eM(eV.current);try{localStorage.setItem("ambassador-breakfast-rooms",JSON.stringify({date:E(),rooms}));localStorage.setItem("ambassador-breakfast-arrivals",JSON.stringify({date:E(),events:eK.current}));localStorage.setItem(H,JSON.stringify({date:E(),items:eU.current}));localStorage.setItem("ambassador-breakfast-history",JSON.stringify(eV.current));ez("Auf allen Geräten gespeichert")}catch{ez("Auf allen Geräten gespeichert · Gerätespeicher nicht verfügbar")}};if(!r&&sessionStorage.getItem("ambassador-work-area")==="service")return (0,s.jsx)(window.AmbassadorServiceV4.component(n),{rooms:ea,arrivals:Y,language:t,status:eF,date:E(),finished:s$,endpoint:P,headers:R,legacyPending:()=>Boolean(localStorage.getItem(O)),applyPayload:v4Apply});return r?(0,s.jsxs)("main",{className:"breakfast-splash"`;

const importAccept='onClick:()=>{let e=eA.filter(e=>e.guests.length).length,s=eA.reduce((e,s)=>e+s.people,0),n=eA.filter(e=>e.included).reduce((e,s)=>e+s.people,0);e7(eA,[]),localStorage.removeItem("ambassador-breakfast-arrivals"),Q([]),eC(null),ez("Mews-Liste übernommen"),X({included:n,guests:s,occupied:e}),window.setTimeout(()=>X(null),4700)}';
if(input.split(importAccept).length!==2)throw Error('Import accept boundary changed');
input=input.replace(importAccept,'onClick:()=>window.AmbassadorServiceV4.importList({rooms:eA,date:E(),endpoint:P,headers:R(),apply:v4Apply,onComplete:()=>{eC(null);ez("Mews-Liste übernommen · Erfassungen erhalten")}})');

fs.writeFileSync('public/recovered/_next/static/chunks/0nkyeaxka~cd7-service-v4.js',input.replace(anchor,bridge));

const entry=fs.readFileSync('public/index-live.html','utf8');
fs.writeFileSync('public/qa-v4-app.html',entry.replace('<head>','<head><meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="connect-src \'self\';"><script src="/qa-v4-bootstrap.js"></script>'));

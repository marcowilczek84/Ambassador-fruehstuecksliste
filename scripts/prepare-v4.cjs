// Reproducible, bounded bridge into the recovered production runtime.
// All legacy APIs, import/export, auth and reception logic remain byte-for-byte.
const fs=require('node:fs');
const path='public/recovered/_next/static/chunks/0nkyeaxka~cd7-meili-v9.js';
const input=fs.readFileSync(path,'utf8');
const anchor=';return r?(0,s.jsxs)("main",{className:"breakfast-splash"';
if(input.split(anchor).length!==2)throw Error('Production runtime anchor changed');
const bridge=`;if(!r&&sessionStorage.getItem("ambassador-work-area")==="service")return (0,s.jsx)(window.AmbassadorServiceV4.component(n),{rooms:ea,language:t,status:eF,date:E(),finished:s$,endpoint:P,headers:R,legacyPending:()=>Boolean(localStorage.getItem(O)),applyPayload:payload=>{if(payload.date!==E())return;const rooms=W(payload.rooms||[]);eW.current=rooms;er(rooms);eQ.current=Number(payload.updated)||eQ.current;eK.current=payload.v8Arrivals||[];Q(eK.current);eU.current=payload.v8Activity||[];es(eU.current);eV.current=payload.v8History||[];eM(eV.current);try{localStorage.setItem("ambassador-breakfast-rooms",JSON.stringify({date:E(),rooms}));localStorage.setItem("ambassador-breakfast-arrivals",JSON.stringify({date:E(),events:eK.current}));localStorage.setItem(H,JSON.stringify({date:E(),items:eU.current}));localStorage.setItem("ambassador-breakfast-history",JSON.stringify(eV.current));ez("Auf allen Geräten gespeichert")}catch{ez("Auf allen Geräten gespeichert · Gerätespeicher nicht verfügbar")}}});return r?(0,s.jsxs)("main",{className:"breakfast-splash"`;
fs.writeFileSync('public/recovered/_next/static/chunks/0nkyeaxka~cd7-service-v4.js',input.replace(anchor,bridge));

const entry=fs.readFileSync('public/index-live.html','utf8');
fs.writeFileSync('public/qa-v4-app.html',entry.replace('<head>','<head><meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="connect-src \'self\';"><script src="/qa-v4-bootstrap.js"></script>'));

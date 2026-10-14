import {PGlite} from '@electric-sql/pglite';
import {isolatedDatabase} from './isolated-database.mjs';
import schema from '../tests/fixtures/schema-before-roomservice.sql';
import migration from '../sql/migrations/20261013_breakfast_roomservice_table_choice.sql';

window.qaInit=async fixture=>{
 const [wasm,fsBundle]=await Promise.all([
  fetch('/qa-db-assets/pglite.wasm').then(r=>r.arrayBuffer()).then(b=>WebAssembly.compile(b)),
  fetch('/qa-db-assets/pglite.data').then(r=>r.blob())
 ]);
 // Versioned, QA-only IndexedDB. Production storage is never opened or imported.
 const db=new PGlite('idb://ambassador-breakfast-v4-final-qa-1',{wasmModule:wasm,fsBundle});
 const api=await isolatedDatabase(db,fixture,schema,migration);
 window.qaDatabase=api;
 window.qaCloud=await api.read();
 window.qaRequest=async(path,method,args)=>{
  if(method==='POST')window.qaCalls.push(structuredClone(args));
  const result=await api.request(path,method,args);
  window.qaCloud=await api.read();
  return result;
 };
 return api;
};

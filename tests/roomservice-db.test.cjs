const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const sql=p=>fs.readFileSync(p,'utf8');
const migration=sql('sql/migrations/20261013_breakfast_roomservice_table_choice.sql');
const rollback=sql('sql/rollback/20261013_breakfast_roomservice_table_choice.sql');
const schema=sql('tests/fixtures/schema-before-roomservice.sql');
const hashes=require('./fixtures/function-checksums.json');
const identity="'public.breakfast_service_action_v41(date,integer,jsonb,integer,uuid,text,uuid)'::regprocedure";

test('isolated PostgreSQL: actual Roomservice migration, persistence, preservation and rollback',{timeout:60000},async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ambassador-v4-sql-'));let db=new PGlite(dir);
 const results=[],record=async(name,fn)=>t.test(name,async()=>{await fn();results.push(name)});
 try{
  await db.exec(schema);
  const date=(await db.query("SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Zurich')::date::text AS date")).rows[0].date;
  const numbers=[20,30,40,50,60].flatMap(n=>Array.from({length:9},(_,i)=>n+i)).filter(n=>n!==55);
  const rooms=numbers.map(room=>({room,people:3,guests:['Synthetic QA '+room],included:room!==22,arrivedCount:0,departedCount:0,present:false,departed:false,table:'',serviceBookings:[],note:'Preserve synthetic note',arrival:date,departure:date}));
  const initial={date,rooms,v8Arrivals:[],v8Activity:[],v8History:[],updated:1,v4ServiceActions:{}};
  const historic={date:'2026-08-20',rooms:[...rooms,{room:99,people:1,guests:['Historical QA'],present:true,table:'Tisch 50',customLegacy:'untouched'}],v8History:[{date:'2026-08-20',legacyUnknown:7}],unknownField:{keep:true}};
  await db.query('INSERT INTO breakfast_lists VALUES($1,$2,1),($3,$4,7)',[date,initial,historic.date,historic]);
  const read=async()=> (await db.query('SELECT payload FROM breakfast_lists WHERE list_date=$1',[date])).rows[0].payload;
  const checksums=async()=> (await db.query('SELECT list_date::text,md5(payload::text) AS checksum,updated_at FROM breakfast_lists ORDER BY list_date')).rows;
  const fn=async()=> (await db.query(`SELECT oid,md5(pg_get_functiondef(oid)) AS hash,proacl,prosecdef,proconfig FROM pg_proc WHERE oid=${identity}`)).rows[0];
  const invoke=async(a)=> (await db.query('SELECT breakfast_service_action_v41($1,$2,$3,$4,$5,$6,$7) AS result',[a.p_list_date??date,a.p_room??20,a.p_expected,a.p_delta??1,a.p_action_id??randomUUID(),a.p_table??null,a.p_undo_action_id??null])).rows[0].result;
  const before=await checksums(),beforeFn=await fn();let receipt;
  await record('baseline reproduces Roomservice rejection without a write',async()=>{
   await assert.rejects(invoke({p_expected:rooms[0],p_table:'Roomservice'}),/Choose a valid table/);
   assert.deepEqual(await checksums(),before);assert.equal(beforeFn.hash,hashes.baseline);
  });
  await record('migration changes only function validation; all row hashes and ACLs are retained',async()=>{
   await db.exec(migration);assert.deepEqual(await checksums(),before);
   const after=await fn();assert.equal(after.hash,hashes.candidate);assert.deepEqual({...after,hash:beforeFn.hash},beforeFn);
   await db.exec(migration);assert.equal((await fn()).hash,hashes.candidate);
  });
  await record('Roomservice stores a distinct canonical booking, event and action ID',async()=>{
   receipt=await invoke({p_expected:rooms[0],p_delta:2,p_table:'Roomservice'});
   assert.equal(receipt.status,'saved');const r=receipt.payload.rooms[0];
   assert.equal(r.arrivedCount,2);assert.equal(r.table,'Roomservice');assert.equal(r.serviceBookings[0].table,'Roomservice');
   assert.equal(receipt.payload.v8Arrivals[0].table,'Roomservice');
   assert.deepEqual(receipt.payload.rooms.slice(1),rooms.slice(1));
  });
  await record('lost-response replay uses the same UUID and creates no duplicate',async()=>{
   const r=receipt.payload.rooms[0],beforeReplay=await checksums();
   const result=await invoke({p_expected:rooms[0],p_delta:2,p_table:'Roomservice',p_action_id:r.serviceBookings[0].id});
   assert.equal(result.status,'duplicate');assert.deepEqual(await checksums(),beforeReplay);
  });
  await record('mixed table/Roomservice and targeted undo preserve the other booking',async()=>{
   const r=(await read()).rooms[0],id=r.serviceBookings[0].id;
   let result=await invoke({p_expected:r,p_table:'Tisch 14'});assert.equal(result.status,'saved');
   assert.deepEqual(result.payload.rooms[0].serviceBookings.map(b=>b.table),['Roomservice','Tisch 14']);
   result=await invoke({p_expected:result.payload.rooms[0],p_delta:-2,p_undo_action_id:id});
   assert.equal(result.status,'saved');assert.equal(result.payload.rooms[0].arrivedCount,1);assert.equal(result.payload.rooms[0].table,'Tisch 14');
   assert.equal((await invoke({p_expected:result.payload.rooms[0],p_delta:-2,p_undo_action_id:id})).status,'conflict');
  });
  await record('stale simultaneous requests cannot double-check-in or change another room',async()=>{
   const r=(await read()).rooms[1];
   const responses=await Promise.all([invoke({p_room:21,p_expected:r,p_table:'Roomservice'}),invoke({p_room:21,p_expected:r,p_table:'Tisch 1'})]);
   assert.deepEqual(responses.map(x=>x.status).sort(),['conflict','saved']);
   assert.equal((await read()).rooms[1].arrivedCount,1);
   assert.deepEqual((await read()).rooms.slice(2),rooms.slice(2));
  });
  await record('strict labels reject fake tables while legacy Tisch 15 and 50 still work',async()=>{
   const r=(await read()).rooms[2],beforeInvalid=await checksums();
   for(const label of [null,'Tisch 0','Tisch 51','Tisch 99','Room service','roomservice','Roomservice ',''])await assert.rejects(invoke({p_room:22,p_expected:r,p_table:label}),/Choose a valid table or Roomservice/);
   assert.deepEqual(await checksums(),beforeInvalid);
   let result=await invoke({p_room:22,p_expected:r,p_table:'Tisch 15'});
   result=await invoke({p_room:22,p_expected:result.payload.rooms[2],p_table:'Tisch 50'});assert.equal(result.status,'saved');
   assert.equal(result.payload.rooms[2].included,false);
  });
  await record('reception and safe import preserve Roomservice and attendance',async()=>{
   let current=await read();const r=current.rooms[1];
   let result=(await db.query('SELECT breakfast_room_edit_v42($1,21,$2,$3,$4) AS result',[date,{...r,arrivedCount:0,serviceBookings:[]},{note:'New synthetic reception note'},randomUUID()])).rows[0].result;
   assert.equal(result.status,'saved');assert.deepEqual(result.payload.rooms[1].serviceBookings,r.serviceBookings);
   const imported=result.payload.rooms.map(r=>({...r,arrivedCount:0,table:'',serviceBookings:[]}));
   result=(await db.query('SELECT breakfast_import_v41($1,$2) AS result',[date,imported])).rows[0].result;
   assert.equal(result.status,'saved');assert.equal(result.payload.rooms[1].table,'Roomservice');assert.equal(result.payload.rooms.length,44);
   const beforeConflict=await checksums();imported[1].guests=['Different synthetic guest'];
   result=(await db.query('SELECT breakfast_import_v41($1,$2) AS result',[date,imported])).rows[0].result;
   assert.equal(result.status,'conflict');assert.deepEqual(await checksums(),beforeConflict);
  });
  await record('closed days and historical dates cannot be checked in',async()=>{
   const data=await read(),r=data.rooms[3];
   await assert.rejects(invoke({p_list_date:'2026-08-20',p_room:23,p_expected:r,p_table:'Roomservice'}),/Invalid service action/);
   await db.query("UPDATE breakfast_lists SET payload=jsonb_set(payload,'{v8History}',$2) WHERE list_date=$1",[date,[{date}]]);
   assert.equal((await invoke({p_room:23,p_expected:r,p_table:'Roomservice'})).status,'finished');
   await db.query("UPDATE breakfast_lists SET payload=jsonb_set(payload,'{v8History}','[]') WHERE list_date=$1",[date]);
  });
  await record('PostgreSQL close/reopen retains the confirmed Roomservice booking',async()=>{
   const expected=await read();await db.close();db=new PGlite(dir);
   assert.deepEqual(await read(),expected);assert.equal((await read()).rooms[1].serviceBookings[0].table,'Roomservice');
  });
  let preserved;
  await record('rollback restores exact function without changing stored records; existing Roomservice can be undone',async()=>{
   preserved=await checksums();await db.exec(rollback);assert.equal((await fn()).hash,hashes.baseline);assert.deepEqual(await checksums(),preserved);
   let r=(await read()).rooms[1];await assert.rejects(invoke({p_room:21,p_expected:r,p_table:'Roomservice'}),/Choose a valid table/);
   const result=await invoke({p_room:21,p_expected:r,p_delta:-1,p_undo_action_id:r.serviceBookings[0].id});assert.equal(result.status,'saved');
   assert.equal(result.payload.rooms[1].arrivedCount,0);await db.exec(migration);
  });
  await record('historical JSON including 45 rooms and unknown fields is byte-equivalent',async()=>{
   assert.deepEqual((await checksums())[0],before[0]);
   assert.deepEqual((await db.query('SELECT payload FROM breakfast_lists WHERE list_date=$1',[historic.date])).rows[0].payload,historic);
  });
  await record('migration guard refuses an unreviewed function version',async()=>{
   const candidate=(await db.query(`SELECT pg_get_functiondef(${identity}) AS definition`)).rows[0].definition;
   await db.exec(candidate.replace('Choose a valid table or Roomservice','QA unreviewed validation'));
   await assert.rejects(db.exec(migration),/Unexpected service RPC version/);await db.exec('ROLLBACK');
  });
  fs.mkdirSync('qa-evidence',{recursive:true});fs.writeFileSync('qa-evidence/database.json',JSON.stringify({engine:'PostgreSQL 17.5 / PGlite 0.3.14',checkedAt:new Date().toISOString(),isolated:true,productionWrites:0,passed:results,roomserviceProof:receipt,historyBefore:before[0],historyAfter:preserved[0],limitation:'PGlite serializes requests; native multi-process lock contention is not emulated.'},null,2));
 }finally{await db.close();fs.rmSync(dir,{recursive:true,force:true})}
});

test('existing SQL regression suites run in temporary tables only',{timeout:60000},async()=>{
 const db=new PGlite();try{
  await db.exec('CREATE TEMP TABLE v4_test_lists(list_date date PRIMARY KEY,payload jsonb,updated_at bigint);CREATE TEMP TABLE v41_test_lists(LIKE v4_test_lists INCLUDING ALL);');
  for(const [file,table] of [['db/service_action_v4.sql','v4_test_lists'],['db/service_action_v41.sql','v41_test_lists'],['db/safe_import_v41.sql','v41_test_lists'],['db/room_edit_v42.sql','v41_test_lists']]){
   const content=sql(file).replace(/^REVOKE .*;\s*$/gm,'').replace(/^GRANT .*;\s*$/gm,'').replaceAll('public.breakfast_lists','pg_temp.'+table).replaceAll('FUNCTION public.','FUNCTION pg_temp.');
   await db.exec(content);
  }
  for(const file of ['tests/service-v4-db.sql','tests/service-v41-db.sql','tests/room-edit-v42-db.sql'])await db.exec(sql(file));
 }finally{await db.close()}
});

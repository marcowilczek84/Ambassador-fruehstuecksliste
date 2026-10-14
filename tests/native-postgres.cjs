// Dedicated ephemeral CI PostgreSQL only. This cannot connect to Supabase.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),{randomUUID}=require('node:crypto'),{Client}=require('pg');
test('native PostgreSQL 17: separate clients contend on the day row without lost updates',{timeout:30000},async()=>{
 assert.equal(process.env.QA_NATIVE_POSTGRES,'1');
 assert.equal(process.env.PGHOST,'127.0.0.1');assert.equal(process.env.PGDATABASE,'ambassador_v4_qa');
 const clients=Array.from({length:3},()=>new Client({host:'127.0.0.1',port:5432,database:'ambassador_v4_qa',user:'qa',password:'isolated-ci-only'}));
 await Promise.all(clients.map(c=>c.connect()));
 const [admin,a,b]=clients;
 try{
  await admin.query(fs.readFileSync('tests/fixtures/schema-before-roomservice.sql','utf8'));
  const version=(await admin.query('SHOW server_version')).rows[0].server_version;assert.match(version,/^17\./);
  const date=(await admin.query("SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Zurich')::date::text AS date")).rows[0].date;
  const rooms=[20,21].map(room=>({room,people:2,guests:['Synthetic QA '+room],included:true,arrivedCount:0,serviceBookings:[]}));
  await admin.query('INSERT INTO breakfast_lists VALUES($1,$2,1)',[date,{date,rooms,v8Arrivals:[],v8History:[],updated:1}]);
  const before=(await admin.query('SELECT md5(payload::text) AS hash FROM breakfast_lists')).rows[0].hash;
  await admin.query(fs.readFileSync('sql/migrations/20261013_breakfast_roomservice_table_choice.sql','utf8'));
  assert.equal((await admin.query('SELECT md5(payload::text) AS hash FROM breakfast_lists')).rows[0].hash,before);
  const pids=await Promise.all(clients.map(async c=>(await c.query('SELECT pg_backend_pid() AS pid')).rows[0].pid));assert.equal(new Set(pids).size,3);
  const invoke=async(client,room,id)=> (await client.query('SELECT breakfast_service_action_v41($1,$2,$3,1,$4,$5) AS result',[date,room.room,room,id,'Roomservice'])).rows[0].result;
  await admin.query('BEGIN');await admin.query('SELECT payload FROM breakfast_lists WHERE list_date=$1 FOR UPDATE',[date]);
  const firstId=randomUUID();let completed=0;
  const pending=[invoke(a,rooms[0],firstId).then(r=>{completed++;return r}),invoke(b,rooms[0],randomUUID()).then(r=>{completed++;return r})];
  await new Promise(r=>setTimeout(r,150));assert.equal(completed,0,'both actual database sessions wait for the row lock');
  await admin.query('COMMIT');const results=await Promise.all(pending);assert.deepEqual(results.map(r=>r.status).sort(),['conflict','saved']);
  const saved=results.find(r=>r.status==='saved'),r=saved.payload.rooms[0],savedId=r.serviceBookings[0].id;
  const replay=await Promise.all([invoke(a,rooms[0],savedId),invoke(b,rooms[0],savedId)]);assert.deepEqual(replay.map(x=>x.status),['duplicate','duplicate']);
  const mixed=await Promise.all([invoke(a,r,randomUUID()),invoke(b,rooms[1],randomUUID())]);assert.ok(mixed.every(x=>x.status==='saved'));
  const payload=(await admin.query('SELECT payload FROM breakfast_lists')).rows[0].payload;
  assert.deepEqual(payload.rooms.map(r=>r.arrivedCount),[2,1]);assert.equal(payload.v8Arrivals.length,3);
  const finalHash=(await admin.query('SELECT md5(payload::text) AS hash FROM breakfast_lists')).rows[0].hash;
  await admin.query(fs.readFileSync('sql/rollback/20261013_breakfast_roomservice_table_choice.sql','utf8'));
  assert.equal((await admin.query('SELECT md5(payload::text) AS hash FROM breakfast_lists')).rows[0].hash,finalHash);
  fs.mkdirSync('qa-evidence',{recursive:true});fs.writeFileSync('qa-evidence/native-postgres.json',JSON.stringify({version,pids,actualRowLockWaitVerified:true,sameRoomResults:results.map(r=>r.status),duplicateReplay:replay.map(r=>r.status),differentRoomsResults:mixed.map(r=>r.status),payload,rollbackPreservesAllRows:true},null,2));
 }finally{await Promise.all(clients.map(c=>c.end()))}
});

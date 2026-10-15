const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),crypto=require('node:crypto');
const baseline=require('./v42-protected-baseline.json');

test('V4.2 preserves the verified V4.1 operations, Auth, API, SQL and build guards byte for byte',()=>{
 for(const [file,expected] of Object.entries(baseline.files)){
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),expected,file);
 }
});

const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('path').join(__dirname,'../app/js/controllers/DeploykeyController.js'),'utf8');
function scenario(response) {
  let controller, sentName, errors=0, refreshed=0, digests=0;
  const emitted=[];
  const scope={$on(){},$emit:(...args)=>emitted.push(args),$applyAsync:()=>digests++};
  const context={angular:{module:()=>({controller:(name,arr)=>controller=arr.at(-1)})},console:{log(){}},toastr:{success(){},error:()=>errors++,warning(){}},Thinx:{
    createDeploykey:name=>{sentName=name;return {done(fn){fn(response);return this;},fail(){return this;},always(fn){fn();return this;}};},
    deploykeyList:()=>{refreshed++;return {done(fn){fn({success:true,response:[]});return this;},fail(){return this;}};}
  }};
  vm.runInNewContext(source,context); controller({},scope,{});
  scope.resetModal(); scope.deploykeyName=' Firmware ';
  scope.createDeploykey();
  return {scope,sentName,errors,refreshed,digests,emitted};
}
for (const raw of [false,true]) {
  const body={success:true,response:{name:'Firmware',date:'2026-10-09',pubkey:'ssh-rsa fixture Firmware'}};
  const r=scenario(raw?JSON.stringify(body):body);
  assert.equal(r.sentName,'Firmware');assert.equal(r.scope.deploykeyValue,body.response.pubkey);
  assert.equal(r.errors,0);assert.equal(r.refreshed,1);assert.equal(r.scope.creatingDeploykey,false);
  assert.ok(r.digests>=1);assert.equal(r.emitted[0][0],'updateDeploykeys');
}
const failed=scenario({success:false,response:'key_failed'});
assert.equal(failed.errors,1);assert.equal(failed.refreshed,0);assert.equal(failed.scope.creatingDeploykey,false);
console.log('Legacy deploy-key generation: parsed and string envelopes, names, refresh, digest, and failure checks passed.');

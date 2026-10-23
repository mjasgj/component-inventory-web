import test from 'node:test';
import assert from 'node:assert/strict';
import {GitHubInventory} from '../api.js';
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
test('requests go only to GitHub; credentials never go in URL or body',async()=>{
  const original=global.fetch;let seen;
  global.fetch=async(url,options)=>{seen={url,options};return response({login:'tester'});};
  try {const api=new GitHubInventory('owner/inventory','test-credential');await api.user();assert.equal(seen.url,'https://api.github.com/user');assert.equal(seen.options.headers.Authorization,'Bearer test-credential');assert.equal(seen.options.credentials,'omit');assert.equal(seen.options.body,undefined);api.disconnect();await api.user();assert.equal(seen.options.headers.Authorization,'Bearer ');}finally{global.fetch=original;}
});
test('snapshot preserves Chinese text and internal identities',async()=>{
  const original=global.fetch;const data={parts:[{sku:'P-1',model:'芯片',quantity:3}],movements:[],generated_at:'2026-10-23T00:00:00Z'};
  global.fetch=async()=>response({encoding:'base64',content:Buffer.from(JSON.stringify(data)).toString('base64')});
  try {const result=await new GitHubInventory('owner/inventory','test').snapshot();assert.equal(result.parts[0].model,'芯片');assert.equal(result.parts[0].quantity,3);}finally{global.fetch=original;}
});
test('comments from humans cannot masquerade as cloud accounting confirmation',async()=>{
  const original=global.fetch;global.fetch=async()=>response([{user:{type:'User'},body:'<!-- component-inventory-receipt-v1 -->\n已入账'}]);
  try{assert.equal(await new GitHubInventory('owner/inventory','test').receipt(1),null);}finally{global.fetch=original;}
});
test('invalid repository cannot redirect credentials to another host',()=>{assert.throws(()=>new GitHubInventory('https://evil.invalid/repo','test'));assert.throws(()=>new GitHubInventory('owner/repo/../../x','test'));});

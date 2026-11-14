import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../dist/skin-loader.js',import.meta.url),'utf8');
const {createSkinLoader}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
test('loading hides artwork until decoded assets and first paint both finish',async()=>{
 const art=deferred(),paint=deferred(),states=[];
 const show=createSkinLoader({loadImage:()=>art.promise,waitUntil:async check=>{assert.equal(check(),false);await paint.promise;assert.equal(check(),true)},afterPaint:async()=>{},onState:s=>states.push(s)});
 let painted=false;const task=show('thorax',['frame'],()=>painted);assert.deepEqual(states,['loading']);
 art.resolve();await new Promise(r=>setImmediate(r));assert.deepEqual(states,['loading']);
 painted=true;paint.resolve();await task;assert.deepEqual(states,['loading','ready']);
});
test('a slow previous skin cannot reveal or overwrite a newer selection',async()=>{
 const first=deferred(),states=[];
 const show=createSkinLoader({loadImage:file=>file==='slow'?first.promise:Promise.resolve(),waitUntil:async check=>assert.ok(check()),afterPaint:async()=>{},onState:(s,id)=>states.push([s,id])});
 const slow=show('maw',['slow'],()=>true);await show('thorax',['cached'],()=>true);first.resolve();await slow;
 assert.deepEqual(states,[['loading','maw'],['loading','thorax'],['ready','thorax']]);
});
test('failed artwork shows a recoverable error instead of an endless spinner',async()=>{
 const states=[];const show=createSkinLoader({loadImage:async()=>{throw Error('missing')},waitUntil:async()=>{},afterPaint:async()=>{},onState:s=>states.push(s)});
 await show('maw',['missing'],()=>false);assert.deepEqual(states,['loading','error']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../dist/volume-motion.js',import.meta.url),'utf8');
const {createVolumeMotion}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('sacs lead the contracting appendage and both settle after reversal',()=>{
 const m=createVolumeMotion();m.reset(0);for(let i=0;i<6;i++)m.advance(1,1/60);
 assert.ok(m.sacs>.9);assert.ok(m.curl<m.sacs-.2);
 for(let i=0;i<300;i++)m.advance(1,1/60);assert.ok(m.curl>.999);
 for(let i=0;i<300;i++)m.advance(0,1/60);assert.ok(m.curl<.001);assert.ok(!m.active);
 m.advance(.4,1,true);assert.equal(m.sacs,.4);assert.equal(m.curl,.4);assert.equal(m.velocity,0);
});

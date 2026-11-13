import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../dist/worm-motion.js',import.meta.url),'utf8');
const {createWormMotion,wormMetrics,wormTextureU}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('material markings travel with the head instead of stretching with exposure',()=>{
 const length=400,join=250,x=120,delta=70;
 assert.equal(wormTextureU(join,x,length),wormTextureU(join+delta,x+delta,length));
 assert.ok(wormTextureU(join+delta,x,length)<wormTextureU(join,x,length));
});
test('resize preserves the exact seek endpoints and keeps the head inside the cage',()=>{
 for(const width of [180,250,400,750]){
  const r={x:20,w:width},m=wormMetrics(r);
  assert.ok(m.start>=r.x);assert.ok(m.end<r.x+width);
  assert.ok(m.travel>0);assert.equal(m.start+m.travel,m.end);
  assert.ok(m.headWidth>=42&&m.headWidth<=66);
 }
});
test('pulling thins the neck, pushing gathers it, and release settles',()=>{
 const m=createWormMotion();m.reset(.2);
 for(let i=1;i<=45;i++)m.advance(.2+i*.004,1/60,{dragging:true,ambient:false});
 assert.ok(m.tension>0);assert.ok(m.sample(.02).radius<1);
 for(let i=1;i<=45;i++)m.advance(.38-i*.004,1/60,{dragging:true,ambient:false});
 assert.ok(m.tension<0);assert.ok(m.sample(.02).radius>1);
 const p=m.progress;
 for(let i=0;i<600;i++)m.advance(p,1/60,{ambient:false});
 assert.ok(Math.abs(m.tension)<.001);assert.ok(Math.abs(m.sample(.02).radius-1)<.01);
 assert.equal(m.sample(0).offset,0);
});
test('reversals, long frame gaps and endpoints never produce invalid geometry',()=>{
 const m=createWormMotion();
 for(let i=0;i<1200;i++){
  const p=(Math.sin(i*.031)+1)/2;m.advance(p,i%19===0?2:1/60,{dragging:i%7!==0});
  for(const q of [0,.1,.5,.9,1]){
   const s=m.sample(q);assert.ok(Number.isFinite(s.offset));assert.ok(s.radius>=.6&&s.radius<=1.4);
  }
  assert.equal(m.progress,p);
 }
 m.advance(1,1/60,{reduced:true});assert.equal(m.progress,1);assert.equal(m.tension,0);assert.equal(m.sample(.2).radius,1);
 m.advance(0,0,{reduced:true});assert.equal(m.progress,0);
});
test('resizing exposes the same material at the socket for the same media time',()=>{
 for(const p of [0,.25,.8,1])for(const width of [180,320,600]){
  const r={x:0,w:width},m=wormMetrics(r),head=m.start+p*m.travel,join=head-m.headWidth*.35;
  assert.ok(Math.abs(wormTextureU(join,m.socket,m.travel)-(1-p))<1e-9);
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../dist/sprite-matte.js',import.meta.url),'utf8');
const {isolateSpriteAlpha}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('detached neighbor stripe is removed while connected feelers and fringe survive',()=>{
 const w=32,h=20,pixels=new Uint8ClampedArray(w*h*4);
 const set=(x,y,a=255)=>{pixels[(y*w+x)*4+3]=a;};
 for(let y=7;y<15;y++)for(let x=0;x<12;x++)set(x,y);
 for(let x=11;x<23;x++)set(x,8); // thin connected feeler
 set(22,7,8); // antialiased fringe
 for(let y=4;y<17;y++)set(31,y); // neighboring pose's detached neck
 set(27,2,3); // generated background residue
 isolateSpriteAlpha(pixels,w,h);
 assert.equal(pixels[(8*w+22)*4+3],255);
 assert.equal(pixels[(7*w+22)*4+3],8);
 assert.equal(pixels[(9*w+31)*4+3],0);
 assert.equal(pixels[(2*w+27)*4+3],0);
});
test('empty frames remain transparent',()=>{
 const p=new Uint8ClampedArray(64);isolateSpriteAlpha(p,4,4);assert.ok(p.every(x=>x===0));
});

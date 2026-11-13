import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../dist/frame-edge.js',import.meta.url),'utf8');
const {softenFrameAlpha}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('feathered coverage preserves opaque tissue and removes near-transparent saturated residue',()=>{
 const w=17,h=17,p=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let i=(y*w+x)*4;p.set(x>=5&&x<=11&&y>=5&&y<=11?[120,80,50,255]:[255,0,0,1],i);}
 softenFrameAlpha(p,w,h);
 assert.deepEqual([...p.slice((8*w+8)*4,(8*w+8)*4+4)],[120,80,50,255]);
 const fringe=(8*w+4)*4;assert.ok(p[fringe+3]>0&&p[fringe+3]<255);
 assert.equal(p[fringe],120);assert.equal(p[fringe+1],80);
 assert.deepEqual([...p.slice(0,4)],[0,0,0,0]);
});

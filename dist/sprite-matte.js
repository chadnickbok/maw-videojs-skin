// Retain one connected creature plus its antialiased fringe. Generated atlases
// can contain detached slivers of a neighboring cell; those are not anatomy.
export function isolateSpriteAlpha(rgba,width,height,threshold=16) {
  const size=width*height,seen=new Uint8Array(size),queue=new Int32Array(size);
  let largest=[];
  for(let seed=0;seed<size;seed++){
    if(seen[seed]||rgba[seed*4+3]<=threshold)continue;
    let read=0,write=1;queue[0]=seed;seen[seed]=1;
    while(read<write){
      const p=queue[read++],x=p%width,y=Math.floor(p/width);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const nx=x+dx,ny=y+dy;if(nx<0||nx>=width||ny<0||ny>=height)continue;
        const n=ny*width+nx;if(!seen[n]&&rgba[n*4+3]>threshold){seen[n]=1;queue[write++]=n;}
      }
    }
    if(write>largest.length)largest=Array.from(queue.subarray(0,write));
  }
  const keep=new Uint8Array(size);
  for(const p of largest){const x=p%width,y=Math.floor(p/width);
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
      const nx=x+dx,ny=y+dy;if(nx>=0&&nx<width&&ny>=0&&ny<height)keep[ny*width+nx]=1;
    }
  }
  for(let p=0;p<size;p++)if(!keep[p])rgba[p*4+3]=0;
  return rgba;
}

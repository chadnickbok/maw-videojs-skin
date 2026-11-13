// Feather coverage, not the painted detail. Transparent RGB is untrusted:
// generated WebP mattes can hide saturated colors in almost-zero alpha pixels.
export function softenFrameAlpha(rgba,width,height) {
  const size=width*height,alpha=new Float32Array(size),horizontal=new Float32Array(size),blurred=new Float32Array(size);
  const kernel=[1,4,6,4,1];
  for(let p=0;p<size;p++)alpha[p]=Math.max(0,(rgba[p*4+3]-8)*255/247);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    let sum=0;for(let k=-2;k<=2;k++)sum+=alpha[y*width+Math.max(0,Math.min(width-1,x+k))]*kernel[k+2];
    horizontal[y*width+x]=sum/16;
  }
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    let sum=0;for(let k=-2;k<=2;k++)sum+=horizontal[Math.max(0,Math.min(height-1,y+k))*width+x]*kernel[k+2];
    blurred[y*width+x]=sum/16;
  }
  const original=new Uint8ClampedArray(rgba);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const p=y*width+x,i=p*4,a=blurred[p];
    rgba[i+3]=a<1?0:Math.round(a);
    if(a<1){rgba[i]=rgba[i+1]=rgba[i+2]=0;continue;}
    if(a>254&&alpha[p]>254)continue;
    // Bleed reliable tissue color into the feather, weighted in premultiplied
    // space. This avoids dark seams and magnified red/yellow matte contamination.
    let weight=0,r=0,g=0,b=0;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
      const nx=x+dx,ny=y+dy;if(nx<0||nx>=width||ny<0||ny>=height)continue;
      const q=ny*width+nx,w=alpha[q]*kernel[dx+2]*kernel[dy+2];
      weight+=w;r+=original[q*4]*w;g+=original[q*4+1]*w;b+=original[q*4+2]*w;
    }
    if(weight){rgba[i]=r/weight;rgba[i+1]=g/weight;rgba[i+2]=b/weight;}
  }
  return rgba;
}

import {clamp,wormMetrics,wormTextureU,createWormMotion} from './worm-motion.js';

// All soft anatomy uses the same contact coordinates. The foreground cage never
// deforms; its real alpha windows reveal and occlude the moving worm underneath.
export function createThoraxWorm(images,player) {
  const motion=createWormMotion(40);
  const headBlend=document.createElement('canvas'),headInk=headBlend.getContext('2d');
  let prepared=false,phase=0;
  function prepare(){prepared=true;}
  function path(ctx,nodes,side=1){
    ctx.moveTo(nodes[0].x,nodes[0].y+side*nodes[0].radius);
    for(let i=1;i<nodes.length;i++)ctx.lineTo(nodes[i].x,nodes[i].y+side*nodes[i].radius);
  }
  function halo(c,x,y,rx,ry,alpha){
    c.save();c.translate(x,y);c.scale(rx,ry);c.globalCompositeOperation='screen';c.globalAlpha=alpha;
    const g=c.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,'#f4c77c');g.addColorStop(.25,'#b06c2e');g.addColorStop(1,'#71340600');c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();
  }
  function drawHead(c,gx,gy,headWidth,reduced){
    const image=images.wormHead,cw=image.width/3,ch=image.height/3;
    const frame=reduced?0:phase%8,a=Math.floor(frame),b=Math.min(a+1,8),mix=frame-a;
    if(headBlend.width!==cw||headBlend.height!==ch){headBlend.width=cw;headBlend.height=ch;}
    headInk.clearRect(0,0,cw,ch);headInk.globalCompositeOperation='lighter';
    headInk.globalAlpha=1-mix;headInk.drawImage(image,a%3*cw,Math.floor(a/3)*ch,cw,ch,0,0,cw,ch);
    headInk.globalAlpha=mix;headInk.drawImage(image,b%3*cw,Math.floor(b/3)*ch,cw,ch,0,0,cw,ch);
    headInk.globalCompositeOperation='destination-in';headInk.globalAlpha=1;
    const fade=headInk.createLinearGradient(0,0,cw*.24,0);fade.addColorStop(0,'#0000');fade.addColorStop(1,'#000');headInk.fillStyle=fade;headInk.fillRect(0,0,cw,ch);
    const h=headWidth*ch/cw;
    c.save();c.translate(gx,gy);c.rotate(clamp(motion.velocity*.045,-.07,.07));
    c.shadowColor='#080502';c.shadowBlur=4;c.shadowOffsetY=3;
    c.drawImage(headBlend,-headWidth*.56,-h*.50,headWidth,h);c.restore();
  }
  function draw(c,r,{progress,dt,time,dragging,ambient,reduced,focused=false}){
    if(!prepared)return;
    const m=wormMetrics(r),gx=m.start+clamp(progress)*m.travel,cy=r.y+r.h*.5;
    motion.advance(progress,dt,{dragging,ambient,reduced});
    phase+=Math.min(dt,.1)*(reduced?0:dragging?10:ambient?1.2:0);
    const join=gx-m.headWidth*.35,materialLength=m.travel;
    const cage=images.wormCage,skin=images.wormSkin,lining=images.channel;
    const cageH=clamp(r.w*.175,50,82),cageY=cy-cageH*.50;
    const sourceMouth=r.x+r.w*.065;
    const bodyStart=sourceMouth,bodyEnd=Math.max(bodyStart,join);
    const bodyLength=bodyEnd-bodyStart;
    const pulse=ambient&&!reduced?Math.sin(time*.9)*.025:0;
    const contact=x=>Math.exp(-Math.pow((x-gx)/(m.headWidth*.65),2));

    // Tube interior is a soft dark cavity, not a second progress line.
    c.save();c.beginPath();c.roundRect(r.x+r.w*.035,cy-cageH*.34,r.w*.94,cageH*.68,cageH*.32);c.clip();
    const dark=c.createLinearGradient(0,cy-cageH*.36,0,cy+cageH*.36);
    dark.addColorStop(0,'#160f0a');dark.addColorStop(.48,'#050403');dark.addColorStop(1,'#21170e');c.fillStyle=dark;c.fillRect(r.x,cy-cageH/2,r.w,cageH);
    // A continuous painting forms each lining lip; only local contact yields.
    const lipHeight=cageH*.33,steps=54,sw=lining.width/steps;
    for(let i=0;i<steps;i++){
      const u=(i+.5)/steps,x=r.x+u*r.w;
      const behind=x<=join?1:0,local=contact(x),bulge=(2+Math.abs(motion.tension)*2)*behind+local*4;
      const wave=ambient&&!reduced?Math.sin(time*.9+u*5)*.5:0;
      for(const lower of [false,true]){
        const y=cy+(lower?m.diameter*.51+bulge:-m.diameter*.51-lipHeight-bulge)+wave;
        c.globalAlpha=.58;c.drawImage(lining,i*sw,lower?lining.height*.50:0,sw+.5,lining.height*.5,r.x+i*r.w/steps,y,r.w/steps+.4,lipHeight);
      }
    }c.restore();

    const count=Math.max(2,Math.ceil(bodyLength/5)),nodes=[];
    for(let i=0;i<=count;i++){
      const x=bodyStart+bodyLength*i/count,q=clamp((join-x)/materialLength),s=motion.sample(q);
      const radius=m.diameter*.5*s.radius;
      // Radial wrinkles live in material coordinates and move with the worm.
      const wrinkles=reduced?0:Math.sin(q*materialLength*1.04+Math.sin(q*17))*.035;
      nodes.push({x,y:cy+s.offset*2,radius:radius*(1+wrinkles),q});
    }
    if(bodyLength>.1){
      // One clipped continuous silhouette, with narrow uniquely mapped strips.
      c.save();c.beginPath();path(c,nodes,-1);for(let i=nodes.length-1;i>=0;i--)c.lineTo(nodes[i].x,nodes[i].y+nodes[i].radius);c.closePath();
      c.shadowColor='#000';c.shadowBlur=5;c.shadowOffsetY=3;c.fillStyle='#22170f';c.fill();c.clip();c.shadowBlur=0;c.shadowOffsetY=0;
      for(let i=0;i<nodes.length-1;i++){
        const a=nodes[i],b=nodes[i+1];
        const ua=wormTextureU(join,a.x,materialLength),ub=wormTextureU(join,b.x,materialLength);
        const sx=ua*skin.width,sw=Math.max(.4,(ub-ua)*skin.width);
        const top=Math.min(a.y-a.radius,b.y-b.radius),bottom=Math.max(a.y+a.radius,b.y+b.radius);
        c.drawImage(skin,sx,skin.height*.10,sw+1,skin.height*.80,a.x,top,b.x-a.x+.6,bottom-top);
        // Analytic cylinder lighting follows each actual section's thickness.
        const shade=c.createLinearGradient(0,top,0,bottom);
        shade.addColorStop(0,'#08050399');shade.addColorStop(.22,'#fff0cb22');shade.addColorStop(.46,'#ffffff00');shade.addColorStop(1,'#070402b3');
        c.fillStyle=shade;c.fillRect(a.x,top,b.x-a.x+.6,bottom-top);
      }
      c.shadowBlur=0;c.globalCompositeOperation='screen';
      c.beginPath();for(let i=0;i<nodes.length;i++){const n=nodes[i],y=n.y-n.radius*.34; if(i)c.lineTo(n.x,y);else c.moveTo(n.x,y);}
      c.strokeStyle='#f4ddb03b';c.lineWidth=.8;c.stroke();c.restore();
    }
    // Draw the generated soft head at the mesh's leading end, never detached.
    halo(c,gx,cy,m.headWidth*.7,m.diameter*1.4,.10+Math.abs(motion.tension)*.1+pulse);
    const gripSplit=gx-m.headWidth*.08;
    c.save();c.beginPath();c.rect(r.x,cy-cageH,Math.max(0,gripSplit-r.x),cageH*2);c.clip();
    drawHead(c,gx,cy,m.headWidth,reduced);c.restore();

    // Adhesive threads are attached to the lining and the current body surface.
    c.save();c.lineWidth=.65;
    for(let i=0;i<6;i++){
      const x=sourceMouth+(r.w*.83)*(i+.43)/6;
      if(x>join||Math.abs(x-gx)>m.headWidth*1.6)continue;
      const q=clamp((join-x)/materialLength),n=motion.sample(q),side=i%2?1:-1;
      const anchorY=cy+side*cageH*.32,bodyY=cy+n.offset*2+side*m.diameter*.5*n.radius;
      const pull=clamp(Math.abs(motion.tension)*2+.15),bend=Math.sin(time*2+i)*pull*2;
      c.globalAlpha=clamp(1-Math.abs(x-gx)/(m.headWidth*1.6));c.strokeStyle='#ccb08088';c.beginPath();c.moveTo(x,anchorY);c.quadraticCurveTo(x+bend,cy+side*cageH*.12,x+motion.tension*5,bodyY);c.stroke();
    }c.restore();

    // Cage is painted LAST and is pinned to the player, occluding actual tissue.
    c.save();c.shadowColor='#080501b3';c.shadowBlur=2;c.shadowOffsetY=2;
    c.drawImage(cage,r.x,cageY,r.w,cageH);c.restore();
    // The blunt leading tip lifts in front as a visible grip; its attached neck
    // remains behind the cage, so the body still threads through the ribs.
    c.save();c.beginPath();c.rect(gripSplit,cy-cageH,r.x+r.w-gripSplit,cageH*2);c.clip();
    drawHead(c,gx,cy,m.headWidth,reduced);c.restore();
    // Dark socket lip hides where fresh material enters the visible channel.
    c.save();c.strokeStyle='#24190fe6';c.lineWidth=2.5;c.beginPath();c.ellipse(sourceMouth,cy,m.headWidth*.13,cageH*.23,-.10,-Math.PI*.48,Math.PI*.48);c.stroke();c.restore();
    if(focused)halo(c,gx,cy,m.headWidth*.8,cageH*.50,.16);
    player.dataset.thoraxProgress=String(Math.round(progress*100));
    player.dataset.wormLength=bodyLength.toFixed(1);player.dataset.wormTension=motion.tension.toFixed(3);
    player.dataset.wormHead=gx.toFixed(1);player.dataset.wormSocket=sourceMouth.toFixed(1);
    player.dataset.wormMaterialStart=wormTextureU(join,bodyStart,materialLength).toFixed(4);
    player.dataset.wormRibs='fixed';
  }
  return {prepare,draw,reset:progress=>motion.reset(progress),get active(){return motion.active},metrics:wormMetrics};
}

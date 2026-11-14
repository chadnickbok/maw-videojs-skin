export function createSkinLoader({loadImage,waitUntil,afterPaint,onState}){
 let generation=0;
 return async function show(id,assets,isPainted){
  const current=++generation;onState('loading',id);
  try{
   await Promise.all(assets.map(loadImage));
   if(current!==generation)return;
   await waitUntil(()=>current!==generation||isPainted());
   if(current!==generation)return;
   await afterPaint();
   if(current===generation)onState('ready',id);
  }catch(error){if(current===generation)onState('error',id,error);}
 };
}
export const skinAssets={
 thorax:['thorax-poster.webp','thorax-body-v2.webp','thorax-compact-v2.webp','thorax-iris-v3.webp','thorax-volume-shell-v2.webp','thorax-volume-sacs-v2.webp','thorax-channel-v2.webp','thorax-worm-skin-v1.webp','thorax-worm-head-v3.webp','thorax-worm-cage-v1.webp'],
 maw:['maw-poster.webp','maw-frame-clean.webp','maw-mantle.webp','maw-play-pause.webp','maw-bellows.webp','scrubber/rail-base.webp','scrubber/rail-foreground.webp','scrubber/grub-squirm-atlas.webp']
};

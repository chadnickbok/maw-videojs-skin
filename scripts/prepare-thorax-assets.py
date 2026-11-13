from PIL import Image
from pathlib import Path
import argparse
parser=argparse.ArgumentParser(description='Normalize image-generated Thorax atlases without painting new anatomy.')
parser.add_argument('--source-directory',required=True,type=Path,help='Directory containing body.png, compact.png, valve.png, bellows.png, larva.png, channel.png, concept.png')
root=parser.parse_args().source_directory
out=Path('dist/tissue');docs=Path('docs/thorax')
out.mkdir(parents=True,exist_ok=True);docs.mkdir(parents=True,exist_ok=True)
assets={name:name+'.png' for name in ['body','compact','valve','bellows','larva','channel']}
for name,filename in assets.items():
 im=Image.open(root/filename).convert('RGBA')
 if name in ['body','compact','channel']:
  if name=='channel':im=im.crop(im.getchannel('A').point(lambda p:255 if p>20 else 0).getbbox())
  im.save(out/f'thorax-{name}-v2.webp',quality=91,method=6)
  continue
 cols,rows=(3,3) if name=='larva' else (5,3)
 frames=[im.crop((round(x*im.width/cols),round(y*im.height/rows),round((x+1)*im.width/cols),round((y+1)*im.height/rows))) for y in range(rows) for x in range(cols)]
 boxes=[f.getchannel('A').point(lambda p:255 if p>20 else 0).getbbox() for f in frames]
 box=(max(0,min(b[0] for b in boxes)-3),max(0,min(b[1] for b in boxes)-3),max(b[2] for b in boxes)+3,max(b[3] for b in boxes)+3)
 w,h=box[2]-box[0],box[3]-box[1]
 atlas=Image.new('RGBA',(w*cols,h*rows))
 for i,f in enumerate(frames):atlas.paste(f.crop(box),(i%cols*w,i//cols*h))
 atlas.save(out/f'thorax-{name}-v2.webp',quality=91,method=6)
 preview=[]
 sequence=list(range(len(frames)))
 if name!='larva':sequence+=list(range(len(frames)-2,0,-1))
 for i in sequence:
  f=frames[i].crop(box);f.thumbnail((300,200))
  bg=Image.new('RGBA',(340,230),'#12120f');bg.alpha_composite(f,((340-f.width)//2,(230-f.height)//2));preview.append(bg.convert('RGB'))
 preview[0].save(docs/f'{name}-study.gif',save_all=True,append_images=preview[1:],duration=75 if name!='larva' else 110,loop=0)
 print(name,atlas.size,'cell',w,h)
Image.open(root/'concept.png').save(docs/'concept.webp',quality=90)

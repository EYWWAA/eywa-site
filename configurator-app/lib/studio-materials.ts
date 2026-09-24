import * as T from 'three';

// Deterministic, locally generated material maps: no remote asset dependencies.
export function walnutTexture() {
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
  const ctx=canvas.getContext('2d')!, pixels=ctx.createImageData(1024,512);
  for(let y=0;y<512;y++) for(let x=0;x<1024;x++) {
    const flow=y + 9*Math.sin(x*.003+y*.015) + 4*Math.sin(x*.009+y*.023);
    const grain=Math.sin(flow*.75)*2.5 + Math.sin(flow*.19)*6 + Math.sin(flow*.065)*8;
    const pore=Math.pow(Math.max(0,Math.sin(flow*2.7 + Math.sin(x*.034))),18)*13;
    const fine=((Math.sin(x*127.1+y*311.7)*43758.5453)%1)*2;
    const shade=grain-pore+fine, i=(y*1024+x)*4;
    pixels.data[i]=86+shade;pixels.data[i+1]=57+shade*.72;pixels.data[i+2]=37+shade*.5;pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
  return map;
}
export function microTexture(brushed=false) {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const c=canvas.getContext('2d')!, p=c.createImageData(256,256);
  let seed=157;
  for(let y=0;y<256;y++) {
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const row=seed/4294967296;
    for(let x=0;x<256;x++) {
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const n=brushed?row*.85+seed/4294967296*.15:seed/4294967296;
      const i=(y*256+x)*4; p.data[i]=p.data[i+1]=p.data[i+2]=110+n*40;p.data[i+3]=255;
    }
  }
  c.putImageData(p,0,0);const map=new T.CanvasTexture(canvas);map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(brushed?2:6,brushed?6:6);return map;
}
export function contactTexture() {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const c=canvas.getContext('2d')!,g=c.createRadialGradient(128,128,12,128,128,128);
  g.addColorStop(0,'rgba(36,28,21,.32)');g.addColorStop(.48,'rgba(36,28,21,.20)');g.addColorStop(1,'rgba(36,28,21,0)');c.fillStyle=g;c.fillRect(0,0,256,256);
  return new T.CanvasTexture(canvas);
}

export function steelNormalTexture() {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const c=canvas.getContext('2d')!,p=c.createImageData(256,256);
  for(let y=0;y<256;y++)for(let x=0;x<256;x++) {
    // Minute waviness in pressed steel breaks up otherwise perfectly flat reflections.
    const nx=.13*Math.sin(x/255*Math.PI*2)+.028*Math.sin(x*.068+y*.006);
    const ny=.065*Math.sin(y/255*Math.PI*2)+.003*Math.sin(y*7.3);
    const i=(y*256+x)*4;
    p.data[i]=(nx+1)*127.5;p.data[i+1]=(ny+1)*127.5;p.data[i+2]=(Math.sqrt(1-nx*nx-ny*ny)+1)*127.5;p.data[i+3]=255;
  }
  c.putImageData(p,0,0);return new T.CanvasTexture(canvas);
}

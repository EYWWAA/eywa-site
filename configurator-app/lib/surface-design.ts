import type { Branding } from './types';

export type DesignOptions = {
  layout: 'signature' | 'graphic' | 'minimal';
  finish: 'matte' | 'satin';
  lighting: 'warm' | 'neutral' | 'none';
};
export const designNames = { signature: 'Signature', graphic: 'Graphique', minimal: 'Épure' };
export const defaultDesign = (brand: Branding): DesignOptions => ({ layout: 'signature', finish: brand.bar.finish, lighting: brand.bar.lighting });

// The artwork stays flat: changing a direction never changes the furniture.
export function surfaceArtwork(b: Branding, look: DesignOptions, logo: HTMLImageElement | null, surface: 'front' | 'side' | 'cup') {
  const canvas = document.createElement('canvas');
  canvas.width = surface === 'front' ? 2048 : 1024;
  canvas.height = surface === 'front' ? 1204 : surface === 'side' ? 1254 : 512;
  const c = canvas.getContext('2d')!;
  const w = canvas.width, h = canvas.height;
  c.fillStyle = surface === 'side' ? b.bar.side_color : b.bar.front_color;
  c.fillRect(0, 0, w, h);
  const luminance = (hex:string) => {const channels=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;};
  const sideLum=luminance(b.bar.side_color),inkLum=luminance(b.bar.logo_color);
  const contrast=(Math.max(sideLum,inkLum)+.05)/(Math.min(sideLum,inkLum)+.05);
  const accent=b.bar.accent_color,ink=surface==='side'&&contrast<3?(sideLum>.3?'#202420':'#F8F5ED'):b.bar.logo_color;
  const line = (x:number,y:number,width:number,height:number,color=accent) => { c.fillStyle=color;c.fillRect(x*w,y*h,width*w,height*h); };
  const text = (value:string,x:number,y:number,size:number,color=ink) => {
    c.fillStyle=color;c.font=`500 ${size*w}px "DM Sans Variable", Arial, sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(value,x*w,y*h,w*.84);
  };
  const mark = (x:number,y:number,width:number,height:number) => {
    if (logo) {
      const layer=document.createElement('canvas');layer.width=Math.ceil(width*w);layer.height=Math.ceil(height*h);
      const l=layer.getContext('2d')!, s=Math.min(layer.width/logo.naturalWidth,layer.height/logo.naturalHeight);
      const lw=logo.naturalWidth*s,lh=logo.naturalHeight*s;
      l.drawImage(logo,(layer.width-lw)/2,(layer.height-lh)/2,lw,lh);
      l.globalCompositeOperation='source-in';l.fillStyle=ink;l.fillRect(0,0,layer.width,layer.height);
      c.drawImage(layer,(x-width/2)*w,(y-height/2)*h);
    } else {
      c.fillStyle=ink;c.textAlign='center';c.textBaseline='middle';
      const serif=/dior|couture|luxury/i.test(b.brand.name+' '+b.brand.visual_style);
      c.font=`${serif?'400':'500'} ${Math.min(height*h*.86,width*w/Math.max(2,b.brand.name.length*.53))}px ${serif?'Georgia':'"DM Sans Variable", Arial'}, sans-serif`;
      c.fillText(b.brand.name,x*w,y*h,width*w);
    }
  };
  if(surface==='cup') {
    // Repeat opposite faces so one mark is legible from both sides of the cup.
    mark(.25,.49,.29,.35);mark(.75,.49,.29,.35);
    if(look.layout!=='minimal')line(0,.9,1,.035);
    return canvas;
  }
  if(look.layout==='graphic') {
    c.fillStyle=accent;c.beginPath();c.moveTo(w*.77,0);c.lineTo(w,0);c.lineTo(w,h);c.lineTo(w*.55,h);c.closePath();c.fill();
    c.globalAlpha=.10;c.fillStyle=ink;c.beginPath();c.moveTo(w*.94,0);c.lineTo(w,0);c.lineTo(w*.79,h);c.lineTo(w*.73,h);c.closePath();c.fill();c.globalAlpha=1;
    if(surface==='front') {mark(.33,.43,.49,.27);text('COFFEE EXPERIENCE',.30,.70,.018);line(.07,.79,.43,.003,ink);text('EYWA',.12,.88,.017);}
    else {c.save();c.translate(w*.32,h*.5);c.rotate(-Math.PI/2);text('COFFEE · EYWA',0,0,.078);c.restore();}
  } else if(look.layout==='minimal') {
    if(surface==='front') {mark(.5,.45,.40,.22);line(.475,.64,.05,.002);text('COFFEE CATERING',.5,.72,.015);}
    else {line(.5,.24,.002,.36);text('EYWA',.5,.73,.038);}
  } else {
    if(b.bar.accent_elements.includes('edge')) {
      c.strokeStyle=accent;c.lineWidth=2.5;c.strokeRect(w*.035,h*.048,w*.93,h*.904);
      c.globalAlpha=.3;c.strokeRect(w*.043,h*.06,w*.914,h*.88);c.globalAlpha=1;
    }
    if(b.bar.accent_elements.includes('diagonal')) {
      c.fillStyle=accent;c.beginPath();c.moveTo(w*.79,h);c.lineTo(w,h*.59);c.lineTo(w,h);c.closePath();c.fill();
      c.globalAlpha=.18;c.beginPath();c.moveTo(w*.69,h);c.lineTo(w,h*.39);c.lineTo(w,h*.47);c.lineTo(w*.73,h);c.closePath();c.fill();c.globalAlpha=1;
    }
    if(surface==='front') {mark(.5,.45,.62,.30);text('COFFEE EXPERIENCE',.5,.70,.015);}
    else {mark(.5,.43,.59,.18);text('EYWA COFFEE CATERING',.5,.71,.024);}
    if(b.bar.accent_elements.includes('line'))line(0,.914,1,.009);
  }
  return canvas;
}

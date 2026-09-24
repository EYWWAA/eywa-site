import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { filePath,type Masters } from './masters';
import type { Branding } from '../lib/types';
type Point=[number,number];
type Raster={data:Uint8Array;width:number;height:number};
export function homography(from:Point[],to:Point[]){const rows:number[][]=[];for(let i=0;i<4;i++){const[x,y]=from[i],[u,v]=to[i];rows.push([x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v]);}for(let c=0;c<8;c++){let p=c;for(let r=c+1;r<8;r++)if(Math.abs(rows[r][c])>Math.abs(rows[p][c]))p=r;[rows[c],rows[p]]=[rows[p],rows[c]];const divisor=rows[c][c];if(Math.abs(divisor)<1e-12)throw new Error('Invalid calibration');for(let j=c;j<9;j++)rows[c][j]/=divisor;for(let r=0;r<8;r++)if(r!==c){const factor=rows[r][c];for(let j=c;j<9;j++)rows[r][j]-=factor*rows[c][j];}}return [...rows.map(r=>r[8]),1];}
export function project(h:number[],x:number,y:number):Point{const z=h[6]*x+h[7]*y+1;return[(h[0]*x+h[1]*y+h[2])/z,(h[3]*x+h[4]*y+h[5])/z];}
const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const clamp=(v:number)=>Math.max(0,Math.min(255,Math.round(v)));
function logoSample(logo:Raster,u:number,v:number){const x=Math.floor(u*logo.width),y=Math.floor(v*logo.height);if(x<0||y<0||x>=logo.width||y>=logo.height)return 0;return logo.data[(y*logo.width+x)*4+3]/255;}
export function colorSurface(raster:Raster,quad:Point[],b:Branding,logo:Raster|null,isSide=false,cup=false){
 const h=homography(quad,[[0,0],[1,0],[1,1],[0,1]]),base=rgb(isSide?b.bar.side_color:b.bar.front_color),ink=rgb(b.bar.logo_color),accent=rgb(b.bar.accent_color);
 const minX=Math.max(0,Math.floor(Math.min(...quad.map(p=>p[0]))*raster.width)),maxX=Math.min(raster.width-1,Math.ceil(Math.max(...quad.map(p=>p[0]))*raster.width)),minY=Math.max(0,Math.floor(Math.min(...quad.map(p=>p[1]))*raster.height)),maxY=Math.min(raster.height-1,Math.ceil(Math.max(...quad.map(p=>p[1]))*raster.height));
 for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){let[u,v]=project(h,x/raster.width,y/raster.height);if(u<0||u>1||v<0||v>1)continue;const i=(y*raster.width+x)*4;if(raster.data[i+3]===0)continue;const luminance=(.2126*raster.data[i]+.7152*raster.data[i+1]+.0722*raster.data[i+2])/255;const shade=Math.max(.22,Math.min(1.3,luminance/.8));let color=base;
  if(!isSide){if(b.bar.accent_elements.includes('line')&&v>.88&&v<.891&&u>.06&&u<.94)color=accent;if(b.bar.accent_elements.includes('edge')&&(u>.03&&u<.038||u>.962&&u<.97)&&v>.06&&v<.94)color=accent;if(b.bar.accent_elements.includes('diagonal')&&u+v>1.78)color=accent;}
  const wrapped=cup?Math.asin(Math.max(-1,Math.min(1,(u-.5)*1.55)))/Math.PI+.5:u;
  const aspect=logo?logo.width/logo.height:2;const lw=cup?.64:.57,lh=Math.min(.35,lw/aspect*1.43);const alpha=!isSide&&logo?logoSample(logo,(wrapped-(1-lw)/2)/lw,(v-(1-lh)/2)/lh):0;
  for(let c=0;c<3;c++){const surface=color[c]*shade;raster.data[i+c]=clamp(surface*(1-alpha)+ink[c]*shade*alpha);}
 }
 return raster;
}
export function printFoam(raster:Raster,foam:Masters['latte']['foam'],logo:Raster){
 const angle=foam.rotation*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);const aspect=logo.width/logo.height,halfW=foam.rx*.65,halfH=Math.min(foam.ry*.58,halfW*raster.width/(aspect*raster.height));
 for(let y=0;y<raster.height;y++)for(let x=0;x<raster.width;x++){const dx=x/raster.width-foam.cx,dy=y/raster.height-foam.cy;const rx=cos*dx+sin*dy,ry=-sin*dx+cos*dy;if((rx/foam.rx)**2+(ry/foam.ry)**2>.78)continue;const alpha=logoSample(logo,rx/(2*halfW)+.5,ry/(2*halfH)+.5);if(!alpha)continue;const i=(y*raster.width+x)*4;const foamLum=(raster.data[i]+raster.data[i+1]+raster.data[i+2])/(3*255);const pore=((Math.sin(x*127.1+y*311.7)*43758.5453)%1+1)%1;const absorption=alpha*(.69+pore*.10)*Math.min(1,foamLum*1.4);const pigment=[77,43,25];for(let c=0;c<3;c++)raster.data[i+c]=clamp(raster.data[i+c]*(1-absorption)+pigment[c]*absorption*foamLum);}
 return raster;
}
async function raster(bytes:Buffer):Promise<Raster>{const{data,info}=await sharp(bytes,{limitInputPixels:24000000}).ensureAlpha().raw().toBuffer({resolveWithObject:true});return{data,width:info.width,height:info.height};}
const encode=(r:Raster)=>sharp(Buffer.from(r.data),{raw:{width:r.width,height:r.height,channels:4}}).png().toBuffer();
export async function composeCup(m:Masters,b:Branding,logoBytes:Buffer){const photo=await raster(await readFile(filePath(m.cup.image)));return encode(colorSurface(photo,m.cup.surface,b,await raster(logoBytes),false,true));}
export async function composeLatte(m:Masters,logoBytes:Buffer){const photo=await raster(await readFile(filePath(m.latte.image)));return encode(printFoam(photo,m.latte.foam,await raster(logoBytes)));}
export async function composeScene(m:Masters,b:Branding,logoBytes:Buffer,background:Buffer){const bar=await raster(await readFile(filePath(m.bar.cutout)));const logo=await raster(logoBytes);colorSurface(bar,m.bar.front,b,logo);if(m.bar.side)colorSurface(bar,m.bar.side,b,null,true);const bg=await sharp(background,{limitInputPixels:24000000}).resize(1536,1024,{fit:'cover'}).toBuffer();const width=Math.round(1536*m.bar.placement.width);const resized=await sharp(await encode(bar)).resize({width}).png().toBuffer();const meta=await sharp(resized).metadata();const left=Math.round(1536*m.bar.placement.x),top=Math.round(1024*m.bar.placement.y);if(left+width>1536||top+(meta.height||0)>1024)throw new Error('Bar placement outside scene');return sharp(bg).composite([{input:resized,left,top}]).png().toBuffer();}

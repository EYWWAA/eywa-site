'use client';
import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Plus, Minus, Move } from 'lucide-react';
import type { Branding } from '@/lib/types';
import { asset } from '@/lib/types';
type Controller = { brand:(b:Branding)=>Promise<void>; reset:()=>void; zoom:(n:number)=>void; dispose:()=>void; };
export default function BarViewer({branding, modelUrl}:{branding:Branding;modelUrl?:string}){
 const mount=useRef<HTMLDivElement>(null),controller=useRef<Controller|null>(null),latest=useRef(branding);
 const [state,setState]=useState<'loading'|'ready'|'light'|'error'>('loading');
 latest.current=branding;
 useEffect(()=>{let cancelled=false;setState('loading');import('@/lib/viewer').then(async({createViewer})=>{if(!mount.current||cancelled)return;const c=await createViewer(mount.current,modelUrl||asset('/models/eywa-bar-v1.glb'),s=>!cancelled&&setState(s));if(cancelled){c.dispose();return;}controller.current=c;await c.brand(latest.current);}).catch(()=>!cancelled&&setState('error'));return()=>{cancelled=true;controller.current?.dispose();controller.current=null;}},[modelUrl]);
 useEffect(()=>{void controller.current?.brand(branding)},[branding]);
 return <div className="viewer" data-viewer-state={state}>
   <div ref={mount} className="viewer-surface" role="img" aria-label={`Bar EYWA personnalisé pour ${branding.brand.name}, aperçu interactif. Façade ${branding.bar.front_color}.`}/>
   {state==='loading'&&<div className="viewer-loading"><span className="fine-spinner"/>Préparation du bar…</div>}
   {state==='error'&&<div className="viewer-loading">L’aperçu ne s’affiche pas sur cet appareil.<button onClick={()=>window.location.reload()}>Réessayer</button></div>}
   <div className="viewer-topline"><span>LE COFFEE BAR EYWA</span><span>{state==='light'?'APERÇU ALLÉGÉ':'VUE 360°'}</span></div>
   <div className="viewer-bottom"><span className="gesture-hint"><Move size={14}/> Faites glisser pour explorer</span><div className="viewer-buttons"><button onClick={()=>controller.current?.zoom(-1)} aria-label="Dézoomer"><Minus size={17}/></button><button onClick={()=>controller.current?.zoom(1)} aria-label="Zoomer"><Plus size={17}/></button><button onClick={()=>controller.current?.reset()} aria-label="Recentrer le bar"><RotateCcw size={16}/></button></div></div>
 </div>
}

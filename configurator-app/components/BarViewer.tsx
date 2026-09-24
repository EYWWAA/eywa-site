'use client';
import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Plus, Minus, Move, Maximize, Minimize } from 'lucide-react';
import type { Branding } from '@/lib/types';
import { asset } from '@/lib/types';
import { designNames, type DesignOptions } from '@/lib/surface-design';
import type { CameraView, createViewer } from '@/lib/viewer';
type Controller = Awaited<ReturnType<typeof createViewer>>;
export default function BarViewer({branding,modelUrl,look,onDesign}:{branding:Branding;modelUrl?:string;look:DesignOptions;onDesign:(look:DesignOptions)=>void}) {
 const mount=useRef<HTMLDivElement>(null),shell=useRef<HTMLDivElement>(null),controller=useRef<Controller|null>(null),latest=useRef({branding,look});
 const [state,setState]=useState<'loading'|'ready'|'light'|'error'>('loading');
 const [angle,setAngle]=useState<CameraView>('perspective'),[expanded,setExpanded]=useState(false);
 latest.current={branding,look};
 const source=modelUrl||asset('/models/eywa-bar-v3.glb');
 useEffect(()=>{
  let cancelled=false;setState('loading');
  import('@/lib/viewer').then(async({createViewer})=>{
   if(!mount.current||cancelled)return;
   const c=await createViewer(mount.current,source,s=>!cancelled&&setState(s));
   if(cancelled){c.dispose();return;}controller.current=c;
   await c.brand(latest.current.branding,latest.current.look);
  }).catch(()=>!cancelled&&setState('error'));
  return()=>{cancelled=true;controller.current?.dispose();controller.current=null;};
 },[source]);
 useEffect(()=>{void controller.current?.brand(branding,look).catch(()=>setState('error'));},[branding,look.layout,look.finish,look.lighting]);
 useEffect(()=>{
  if(!expanded)return;
  const previous=document.body.style.overflow,focus=document.activeElement as HTMLElement|null;document.body.style.overflow='hidden';
  shell.current?.querySelector<HTMLButtonElement>('.expand-view')?.focus();
  const escape=(e:KeyboardEvent)=>{
   if(e.key==='Escape')setExpanded(false);
   if(e.key==='Tab') {
    const items=Array.from(shell.current?.querySelectorAll<HTMLElement>('button,select')||[]),first=items[0],last=items[items.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
   }
  };window.addEventListener('keydown',escape);
  return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',escape);focus?.focus();};
 },[expanded]);
 const views:[CameraView,string][]=[['perspective','Perspective'],['front','Façade'],['detail','Matières'],['barista','Côté barista']];
 function changeView(view:CameraView){setAngle(view);controller.current?.view(view);}
 return <div ref={shell} className={`design-studio${expanded?' expanded':''}`} role={expanded?'dialog':undefined} aria-modal={expanded||undefined} aria-label={expanded?'Atelier 3D en grand':undefined}>
  <div className="viewer" data-viewer-state={state}>
   <div ref={mount} className="viewer-surface" role="img" aria-label={`Bar EYWA personnalisé pour ${branding.brand.name}. Composition ${designNames[look.layout]}, finition ${look.finish==='matte'?'mate':'satinée'}.`}/>
   {state==='loading'&&<div className="viewer-loading"><span className="fine-spinner"/>Préparation des matières…</div>}
   {state==='error'&&<div className="viewer-loading">L’aperçu ne s’affiche pas sur cet appareil.<button onClick={()=>window.location.reload()}>Réessayer</button></div>}
   <div className="viewer-topline"><span>EYWA <i/> COLLECTION SUR MESURE</span><button className="expand-view" onClick={()=>setExpanded(!expanded)} aria-label={expanded?'Réduire la vue 3D':'Agrandir la vue 3D'}>{expanded?<Minimize size={17}/>:<Maximize size={17}/>}</button></div>
   <div className="viewer-bottom"><span className="gesture-hint"><Move size={14}/>{state==='light'?'Aperçu allégé':'Faites glisser pour explorer'}</span><div className="viewer-buttons"><button onClick={()=>controller.current?.zoom(-1)} aria-label="Dézoomer"><Minus size={17}/></button><button onClick={()=>controller.current?.zoom(1)} aria-label="Zoomer"><Plus size={17}/></button><button onClick={()=>changeView('perspective')} aria-label="Recentrer le bar"><RotateCcw size={16}/></button></div></div>
  </div>
  <div className="camera-views" role="group" aria-label="Points de vue">{views.map(([value,label])=><button key={value} aria-pressed={angle===value} onClick={()=>changeView(value)}>{label}</button>)}</div>
  <div className="design-controls">
   <div className="design-control-heading"><span>COMPOSEZ VOTRE HABILLAGE 3D</span><span>01 — 03</span></div>
   <div className="design-directions" role="group" aria-label="Composition graphique">{(Object.entries(designNames) as [DesignOptions['layout'],string][]).map(([value,label],i)=><button key={value} aria-pressed={look.layout===value} onClick={()=>onDesign({...look,layout:value})}><span className={`direction-swatch swatch-${value}`} style={{'--swatch':branding.bar.front_color,'--accent':branding.bar.accent_color,'--mark':branding.bar.logo_color} as React.CSSProperties}><i/><b/></span><span><small>0{i+1}</small>{label}</span></button>)}</div>
   <div className="material-controls"><label>Finition<select value={look.finish} onChange={e=>onDesign({...look,finish:e.target.value as DesignOptions['finish']})}><option value="matte">Mat velouté</option><option value="satin">Satiné</option></select></label><label>Éclairage du bar<select value={look.lighting} onChange={e=>onDesign({...look,lighting:e.target.value as DesignOptions['lighting']})}><option value="warm">Chaleureux</option><option value="neutral">Neutre</option><option value="none">Éteint</option></select></label></div>
  </div>
 </div>;
}

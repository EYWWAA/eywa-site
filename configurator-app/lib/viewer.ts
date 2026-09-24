import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Branding } from './types';
import { asset } from './types';

export async function createViewer(host:HTMLElement,modelUrl:string,onReady:(s:'ready'|'light')=>void){
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.05,30);camera.position.set(1.65,1.43,2.7);
 let renderer:T.WebGLRenderer|import('three/addons/renderers/SVGRenderer.js').SVGRenderer;
 let webgl=true;
 let canWebgl=false;try{const probe=document.createElement('canvas');canWebgl=!!(probe.getContext('webgl2')||probe.getContext('webgl'));}catch{}
 try{if(!canWebgl)throw new Error('WebGL unavailable');renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;}catch{webgl=false;const {SVGRenderer}=await import('three/addons/renderers/SVGRenderer.js');renderer=new SVGRenderer();renderer.setQuality('high');}
 host.appendChild(renderer.domElement);
 renderer.domElement.style.background='transparent';
 const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.67,0);controls.enablePan=false;controls.enableDamping=webgl;controls.dampingFactor=.10;controls.minDistance=1.7;controls.maxDistance=4.8;controls.minPolarAngle=.28;controls.maxPolarAngle=Math.PI*.48;controls.zoomSpeed=.6;controls.rotateSpeed=.6;controls.update();
 let environment:T.WebGLRenderTarget|undefined;
 if(webgl){const pmrem=new T.PMREMGenerator(renderer as T.WebGLRenderer);const room=new RoomEnvironment();environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;pmrem.dispose();room.dispose();}
 scene.add(new T.HemisphereLight('#fffdf7','#a3a8a0',webgl?2.6:.9));
 const key=new T.DirectionalLight(webgl?'#fff4df':'#ffffff',webgl?3.0:.7);key.position.set(2,4,3);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-2;key.shadow.camera.right=2;key.shadow.camera.top=3;key.shadow.camera.bottom=-2;key.shadow.bias=-.0008;key.shadow.normalBias=.015;scene.add(key);
 const fill=new T.DirectionalLight('#ffffff',webgl?1.2:.25);fill.position.set(-3,2,-2);scene.add(fill);
 const model=(await new GLTFLoader().loadAsync(modelUrl)).scene;scene.add(model);
 model.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;if(!webgl){const m=o.material as T.MeshStandardMaterial;o.material=new T.MeshLambertMaterial({color:m.color});}}});
 const floor=new T.Mesh(new T.PlaneGeometry(10,10),webgl?new T.ShadowMaterial({opacity:.13}):new T.MeshBasicMaterial({color:'#edece7',transparent:true,opacity:0}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.position.y=-.002;scene.add(floor);
 if(webgl){const wood=document.createElement('canvas');wood.width=512;wood.height=128;const ctx=wood.getContext('2d')!;ctx.fillStyle='#4d3325';ctx.fillRect(0,0,512,128);for(let i=0;i<300;i++){ctx.strokeStyle=`rgba(${i%2?'26,13,6':'169,115,70'},${.02+(i%7)/80})`;ctx.lineWidth=.5+(i%3);ctx.beginPath();for(let x=0;x<520;x+=4){const y=(i*.67)%128+Math.sin(x*.011+i)*2+Math.sin(x*.04+i)*.35;x?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}const texture=new T.CanvasTexture(wood);texture.colorSpace=T.SRGBColorSpace;model.traverse(o=>{if(o instanceof T.Mesh&&o.name==='COUNTERTOP'){(o.material as T.MeshStandardMaterial).map=texture;(o.material as T.MeshStandardMaterial).color.set('#ffffff');}});}
 let alive=true,frame=0,remaining=0,visible=true,revision=0;
 const surfaceAccents=new T.Group();scene.add(surfaceAccents);
 const draw=()=>{if(!alive||!visible)return;controls.update();renderer.render(scene,camera);updateLabel();if(remaining-- >0)frame=requestAnimationFrame(draw);};
 const invalidate=()=>{remaining=webgl?24:0;cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);};
 // SVG fallback still projects the same GLB; no substitute furniture geometry.
 const logoLabel=document.createElement('div');logoLabel.className='software-brand';logoLabel.hidden=webgl;host.appendChild(logoLabel);
 const corners=[new T.Vector3(-.26,.63,.303),new T.Vector3(.26,.63,.303),new T.Vector3(-.26,.40,.303)];
 function updateLabel(){if(webgl)return;const [a,b,c]=corners.map(v=>v.clone().project(camera));const w=host.clientWidth,h=host.clientHeight;const p=(v:T.Vector3)=>({x:(v.x+1)*w/2,y:(1-v.y)*h/2});const A=p(a),B=p(b),C=p(c);logoLabel.style.transform=`matrix(${(B.x-A.x)/250},${(B.y-A.y)/250},${(C.x-A.x)/100},${(C.y-A.y)/100},${A.x},${A.y})`;logoLabel.style.opacity=camera.position.z>.05?'1':'0';}
 controls.addEventListener('change',invalidate);
 const resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(w<1||h<1)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();invalidate();});resize.observe(host);
 const visibility=new IntersectionObserver(([e])=>{visible=e.isIntersecting;if(visible)invalidate();else cancelAnimationFrame(frame);});visibility.observe(host);
 const onVis=()=>{visible=!document.hidden;if(visible)invalidate();};document.addEventListener('visibilitychange',onVis);
 async function brand(b:Branding){const current=++revision;let logo:HTMLImageElement|null=null;let loaded=false;
  if(b.bar.logo){try{logo=await new Promise<HTMLImageElement>((resolve,reject)=>{const im=new Image();im.crossOrigin='anonymous';im.onload=()=>resolve(im);im.onerror=reject;im.src=b.bar.logo.startsWith('/brands/')?asset(b.bar.logo):b.bar.logo;});loaded=true;}catch{logo=null;}}
  if(current!==revision||!alive)return;
  surfaceAccents.children.slice().forEach(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(o.material as T.Material).dispose();}surfaceAccents.remove(o);});
  if(!webgl){const accent=(w:number,h:number,x:number,y:number)=>{const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:b.bar.accent_color}));m.position.set(x,y,.301);surfaceAccents.add(m);};if(b.bar.accent_elements.includes('line'))accent(.96,.004,0,.215);if(b.bar.accent_elements.includes('edge')){accent(.003,.66,-.514,.51);accent(.003,.66,.514,.51);}if(b.bar.accent_elements.includes('diagonal')){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([.55,.13,.301,.55,.36,.301,.34,.13,.301],3));surfaceAccents.add(new T.Mesh(g,new T.MeshBasicMaterial({color:b.bar.accent_color,side:T.DoubleSide})));}}
  model.traverse(o=>{if(!(o instanceof T.Mesh))return;const name=o.name.replace(/\.\d+$/,'');if(name==='BODY'||name==='BAR_LEFT'||name==='BAR_RIGHT'){(o.material as T.MeshStandardMaterial).color.set(b.bar.side_color);}
  if(name==='BAR_FRONT'){const material=o.material as T.MeshStandardMaterial;material.color.set(b.bar.front_color);if(webgl){const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=720;const c=canvas.getContext('2d')!;c.fillStyle=b.bar.front_color;c.fillRect(0,0,1024,720);c.fillStyle=b.bar.accent_color;
   if(b.bar.accent_elements.includes('line'))c.fillRect(65,642,894,4);
   if(b.bar.accent_elements.includes('edge')){c.fillRect(35,45,3,630);c.fillRect(986,45,3,630);}
   if(b.bar.accent_elements.includes('diagonal')){c.beginPath();c.moveTo(780,720);c.lineTo(1024,430);c.lineTo(1024,720);c.fill();}
   if(logo){const layer=document.createElement('canvas');layer.width=700;layer.height=240;const l=layer.getContext('2d')!;const scale=Math.min(700/logo.naturalWidth,240/logo.naturalHeight);const w=logo.naturalWidth*scale,h=logo.naturalHeight*scale;l.drawImage(logo,(700-w)/2,(240-h)/2,w,h);l.globalCompositeOperation='source-in';l.fillStyle=b.bar.logo_color;l.fillRect(0,0,700,240);c.drawImage(layer,162,232);}else{c.fillStyle=b.bar.logo_color;c.textAlign='center';c.textBaseline='middle';c.font=`${b.brand.name==='celio'?'600':'500'} ${b.brand.name.length>10?74:105}px ${b.brand.name==='Dior'?'Georgia':'Arial'}`;c.fillText(b.brand.name,512,350,790);}
   const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;material.map?.dispose();material.map=texture;material.color.set('#ffffff');material.roughness=b.bar.finish==='matte'?.8:.35;material.needsUpdate=true;
  }}
  if(name==='LED'){o.visible=b.bar.lighting!=='none';if(webgl){const m=o.material as T.MeshStandardMaterial;m.emissive.set(b.bar.lighting==='warm'?'#ffd79f':'#ecf5ff');}}
 });
 logoLabel.replaceChildren();if(logo&&loaded){logoLabel.style.color=b.bar.logo_color;const image=document.createElement('div');image.style.cssText=`width:100%;height:100%;background:${b.bar.logo_color};mask:url("${logo.src}") center/contain no-repeat;-webkit-mask:url("${logo.src}") center/contain no-repeat`;logoLabel.appendChild(image);}else{logoLabel.textContent=b.brand.name;logoLabel.style.color=b.bar.logo_color;}invalidate();}
 onReady(webgl?'ready':'light');invalidate();
 return{brand,reset(){camera.position.set(1.65,1.43,2.7);controls.target.set(0,.67,0);invalidate();},zoom(n:number){const offset=camera.position.clone().sub(controls.target);offset.multiplyScalar(n>0?.86:1.16);offset.setLength(T.MathUtils.clamp(offset.length(),controls.minDistance,controls.maxDistance));camera.position.copy(controls.target).add(offset);invalidate();},dispose(){alive=false;revision++;cancelAnimationFrame(frame);resize.disconnect();visibility.disconnect();document.removeEventListener('visibilitychange',onVis);controls.dispose();environment?.dispose();model.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>{(m as T.MeshStandardMaterial).map?.dispose();m.dispose();});}});if(webgl)(renderer as T.WebGLRenderer).dispose();renderer.domElement.remove();logoLabel.remove();}};
}

import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Branding } from './types';
import { asset } from './types';
import { surfaceArtwork, defaultDesign, type DesignOptions } from './surface-design';
import { walnutTexture, microTexture, contactTexture, steelNormalTexture } from './studio-materials';

export type CameraView = 'perspective' | 'front' | 'detail' | 'barista';
export async function createViewer(host:HTMLElement, modelUrl:string, onReady:(s:'ready'|'light')=>void) {
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(30,1,.03,30);
  scene.background=new T.Color('#eae6df');scene.fog=new T.Fog('#eae6df',6,14);
  let renderer:T.WebGLRenderer|import('three/addons/renderers/SVGRenderer.js').SVGRenderer;
  let webgl=true;
  try {
    renderer=new T.WebGLRenderer({antialias:true,powerPreference:'default'});
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;
    renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
  } catch {
    webgl=false;const {SVGRenderer}=await import('three/addons/renderers/SVGRenderer.js');
    renderer=new SVGRenderer();renderer.setQuality('high');
  }
  host.appendChild(renderer.domElement);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enablePan=false;controls.enableDamping=webgl;controls.dampingFactor=.12;
  controls.minDistance=1;controls.maxDistance=5.2;controls.minPolarAngle=.28;
  controls.maxPolarAngle=Math.PI*.49;controls.zoomSpeed=.65;controls.rotateSpeed=.65;
  let environment:T.WebGLRenderTarget|undefined;
  if(webgl) {
    // Photographic softboxes produce readable bands of reflection in chrome.
    const studio=new T.Scene();
    studio.add(new T.Mesh(new T.BoxGeometry(12,9,12),new T.MeshBasicMaterial({color:'#6d6861',side:T.BackSide})));
    const panel=(x:number,y:number,z:number,w:number,h:number,intensity:number,color:string) => {
      const p=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(intensity),side:T.DoubleSide}));
      p.position.set(x,y,z);p.lookAt(0,.7,0);studio.add(p);
    };
    panel(-3,2.5,2,2.3,3.4,5,'#fff5e6');panel(3,2,-1,1.5,3.5,3,'#edf3ff');
    panel(0,4,0,3,2,4,'#ffffff');panel(-2,-.2,4,.6,5,4,'#ffffff');panel(3,-.3,-4,.85,4,4,'#ffffff');
    const pmrem=new T.PMREMGenerator(renderer as T.WebGLRenderer);
    environment=pmrem.fromScene(studio,.045);scene.environment=environment.texture;scene.environmentIntensity=.78;pmrem.dispose();
    studio.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(o.material as T.Material).dispose();}});
  }
  scene.add(new T.HemisphereLight('#f9f5ee','#6c6255',webgl?.38:1.4));
  const key=new T.DirectionalLight('#fff2dc',webgl?3:1.3);key.position.set(-2.5,4,3.4);key.castShadow=webgl;
  key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-2,right:2,top:2.6,bottom:-1.3,near:.1,far:10});
  key.shadow.bias=-.0001;key.shadow.normalBias=.002;key.shadow.radius=6;key.shadow.intensity=.68;scene.add(key);
  const fill=new T.DirectionalLight('#e6efff',webgl?.65:.4);fill.position.set(3,2,-2);scene.add(fill);
  let model:T.Group;
  const source=!webgl&&modelUrl.endsWith('/eywa-bar-v3.glb')?modelUrl.replace('/eywa-bar-v3.glb','/eywa-bar-v2.glb'):modelUrl;
  try {model=(await new GLTFLoader().loadAsync(source)).scene;} catch(e) {
    controls.dispose();environment?.dispose();if(webgl)(renderer as T.WebGLRenderer).dispose();renderer.domElement.remove();throw e;
  }
  scene.add(model);
  const textures=new Set<T.Texture>();
  const wood=webgl?walnutTexture():null,grain=webgl?microTexture():null,brushed=webgl?microTexture(true):null,steelNormal=webgl?steelNormalTexture():null;
  [wood,grain,brushed,steelNormal].forEach(t=>{if(t)textures.add(t);});
  const originals=new Set<T.Material>();
  model.traverse(o=>{
    if(!(o instanceof T.Mesh))return;
    o.castShadow=!/HOPPER$|CUP_BRAND/.test(o.name);o.receiveShadow=true;
    const original=o.material as T.MeshStandardMaterial;
    originals.add(original);
    if(!webgl) {o.material=new T.MeshLambertMaterial({color:original.color,transparent:original.transparent,opacity:original.opacity,side:original.side});return;}
    const m=original.clone();o.material=m;
    if(m.metalness>.5) {m.envMapIntensity=1.1;m.roughness=m.name.includes('Brushed')?.24:.13;m.bumpMap=brushed;m.bumpScale=.00012;if(o.name.startsWith('MACHINE')||o.name==='ESPRESSO_MACHINE'){m.normalMap=steelNormal;m.normalScale.set(.65,.65);}}
    if(o.name==='COUNTERTOP') {m.map=wood;m.color.set('#ffffff');m.bumpMap=wood;m.bumpScale=.0006;m.roughness=.36;}
    if(/BODY|BAR_|CUP_PAPER/.test(o.name)) {m.bumpMap=grain;m.bumpScale=.00013;}
    if(o.name==='GRINDER_HOPPER') {m.envMapIntensity=1.8;o.castShadow=false;}
  });
  originals.forEach(m=>m.dispose());
  const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#dfdad0',roughness:.92}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.002;floor.receiveShadow=true;scene.add(floor);
  if(webgl) {
    const map=contactTexture();textures.add(map);
    const shadow=(w:number,d:number,x:number,y:number,z:number,opacity:number)=>{
      const p=new T.Mesh(new T.PlaneGeometry(w,d),new T.MeshBasicMaterial({map,transparent:true,opacity,depthWrite:false}));
      p.rotation.x=-Math.PI/2;p.position.set(x,y,z);scene.add(p);
    };
    shadow(1.9,1.1,0,.001,0,.8);shadow(.37,.4,-.185,.876,-.025,.6);shadow(.21,.26,-.485,.876,-.025,.6);
  }
  const led=new T.PointLight('#ffd6a0',0,1,.8);led.position.set(0,.835,.325);scene.add(led);
  let lightWash:T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>|undefined;
  if(webgl) {
    const canvas=document.createElement('canvas');canvas.width=8;canvas.height=128;
    const c=canvas.getContext('2d')!,gradient=c.createLinearGradient(0,0,0,128);
    gradient.addColorStop(0,'rgba(255,255,255,.45)');gradient.addColorStop(.22,'rgba(255,255,255,.09)');gradient.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle=gradient;c.fillRect(0,0,8,128);
    const map=new T.CanvasTexture(canvas);textures.add(map);
    lightWash=new T.Mesh(new T.PlaneGeometry(1.22,.11),new T.MeshBasicMaterial({map,color:'#ffd6a0',transparent:true,depthWrite:false,blending:T.AdditiveBlending,opacity:.35}));
    lightWash.position.set(0,.783,.302);scene.add(lightWash);
  }
  const logoLabel=document.createElement('div');logoLabel.className='software-brand';logoLabel.hidden=webgl;host.appendChild(logoLabel);
  let alive=true,frame=0,remaining=0,intersecting=true,revision=0,view:CameraView='perspective';
  let previousLogo='',logoImage:HTMLImageElement|null=null;
  function updateLabel() {
    if(webgl)return;
    const corners=[new T.Vector3(-.37,.65,.302),new T.Vector3(.37,.65,.302),new T.Vector3(-.37,.39,.302)];
    const p=corners.map(v=>{v.project(camera);return {x:(v.x+1)*host.clientWidth/2,y:(1-v.y)*host.clientHeight/2};});
    const [a,b,c]=p;logoLabel.style.transform=`matrix(${(b.x-a.x)/250},${(b.y-a.y)/250},${(c.x-a.x)/100},${(c.y-a.y)/100},${a.x},${a.y})`;logoLabel.style.opacity=camera.position.z>.05?'1':'0';
  }
  function draw() {frame=0;if(!alive||!intersecting||document.hidden)return;controls.update();renderer.render(scene,camera);updateLabel();if(remaining-->0&&!frame)frame=requestAnimationFrame(draw);}
  function invalidate() {remaining=webgl?18:0;if(!frame&&alive)frame=requestAnimationFrame(draw);}
  function setView(next:CameraView) {
    view=next;
    const poses={perspective:[1.9,1.48,3.2,0,.73,0],front:[0,1.08,3.6,0,.73,0],detail:[1.05,1.55,1.40,.04,1.08,0],barista:[-1.9,1.6,-3.1,0,.73,0]};
    const p=poses[next];controls.target.set(p[3],p[4],p[5]);camera.position.set(p[0],p[1],p[2]);
    if(camera.aspect<.85)camera.position.sub(controls.target).multiplyScalar(1.15).add(controls.target);
    controls.update();invalidate();
  }
  controls.addEventListener('change',invalidate);
  const resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(w<1||h<1)return;const old=camera.aspect;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();if((old<.85)!==(camera.aspect<.85))setView(view);invalidate();});resize.observe(host);
  const visibility=new IntersectionObserver(([e])=>{intersecting=e.isIntersecting;if(intersecting)invalidate();else{cancelAnimationFrame(frame);frame=0;}});visibility.observe(host);
  const onVis=()=>{if(!document.hidden)invalidate();};document.addEventListener('visibilitychange',onVis);
  const activeArtwork=new Set<T.Texture>();
  async function brand(b:Branding,look:DesignOptions=defaultDesign(b)) {
    const current=++revision;
    if(b.bar.logo!==previousLogo) {
      let loaded:HTMLImageElement|null=null;
      if(b.bar.logo)try {
        loaded=await new Promise<HTMLImageElement>((resolve,reject)=>{
          const im=new Image(),timer=setTimeout(()=>reject(new Error('Logo timeout')),6000);
          im.crossOrigin='anonymous';im.onload=()=>{clearTimeout(timer);resolve(im);};im.onerror=()=>{clearTimeout(timer);reject(new Error('Logo unavailable'));};
          im.src=b.bar.logo.startsWith('/brands/')?asset(b.bar.logo):b.bar.logo;
        });
      } catch { /* Keep the brand name legible when a remote logo is unavailable. */ }
      if(current!==revision||!alive)return;previousLogo=b.bar.logo;logoImage=loaded;
    }
    await document.fonts.ready;
    if(current!==revision||!alive)return;
    activeArtwork.forEach(t=>t.dispose());activeArtwork.clear();
    const maps=new Map<string,T.CanvasTexture>();
    function artwork(surface:'front'|'side'|'cup') {
      if(!maps.has(surface)){const map=new T.CanvasTexture(surfaceArtwork(b,look,logoImage,surface));map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;maps.set(surface,map);activeArtwork.add(map);}
      return maps.get(surface)!;
    }
    model.traverse(o=>{
      if(!(o instanceof T.Mesh))return;
      const name=o.name.replace(/[._]\d+$/,''),m=o.material as T.MeshStandardMaterial;
      if(name==='BODY') {m.color.set(b.bar.side_color);if(webgl)m.roughness=look.finish==='matte'?.68:.29;}
      const surface=name==='BAR_FRONT'?'front':name==='BAR_LEFT'||name==='BAR_RIGHT'?'side':name==='CUP_BRAND'?'cup':null;
      if(surface) {
        m.color.set(surface==='side'?b.bar.side_color:b.bar.front_color);
        if(webgl){m.map=artwork(surface);m.color.set('#ffffff');m.roughness=look.finish==='matte'?.68:.29;m.needsUpdate=true;}
      }
      if(name==='LED') {o.visible=look.lighting!=='none';if(webgl){m.emissive.set(look.lighting==='warm'?'#ffd5a2':'#eaf3ff');m.emissiveIntensity=2;}}
    });
    led.color.set(look.lighting==='warm'?'#ffd4a0':'#eaf3ff');led.intensity=look.lighting==='none'?0:.045;
    if(lightWash){lightWash.visible=look.lighting!=='none';lightWash.material.color.copy(led.color);}
    logoLabel.textContent=b.brand.name;logoLabel.style.color=b.bar.logo_color;invalidate();
  }
  setView('perspective');onReady(webgl?'ready':'light');invalidate();
  return {
    brand,view:setView,reset(){setView('perspective');},
    zoom(n:number){const offset=camera.position.clone().sub(controls.target);offset.multiplyScalar(n>0?.86:1.16);offset.setLength(T.MathUtils.clamp(offset.length(),controls.minDistance,controls.maxDistance));camera.position.copy(controls.target).add(offset);invalidate();},
    dispose(){
      alive=false;revision++;cancelAnimationFrame(frame);resize.disconnect();visibility.disconnect();document.removeEventListener('visibilitychange',onVis);controls.dispose();environment?.dispose();key.shadow.map?.dispose();
      const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
      scene.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});
      geometries.forEach(g=>g.dispose());materials.forEach(m=>{const s=m as T.MeshStandardMaterial;if(s.map)textures.add(s.map);m.dispose();});
      activeArtwork.forEach(t=>textures.add(t));textures.forEach(t=>t.dispose());
      if(webgl)(renderer as T.WebGLRenderer).dispose();renderer.domElement.remove();logoLabel.remove();
    }
  };
}

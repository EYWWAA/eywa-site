import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { writeFile } from 'node:fs/promises';
globalThis.FileReader = class { readAsArrayBuffer(blob) { blob.arrayBuffer().then(b => { this.result=b; this.onloadend?.(); }); } };
const root = new T.Group(); root.name='EYWA_PRESENTATION_MODEL';
root.userData={version:'1.0',approved:false,units:'metres',width:1.1,depth:.6,height:.93,immutable:true};
const mat=(color,roughness=.5,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
const ivory=mat('#e9e6de',.65), walnut=mat('#493020',.42), dark=mat('#1b1e20',.48), metal=mat('#b9bdbe',.25,.85), black=mat('#171818',.9), cream=mat('#f7f5f0',.6);
function box(name,w,h,d,x,y,z,m){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.name=name;mesh.position.set(x,y,z);root.add(mesh);return mesh}
function cyl(name,r1,r2,h,x,y,z,m,segments=20){const mesh=new T.Mesh(new T.CylinderGeometry(r1,r2,h,segments),m);mesh.name=name;mesh.position.set(x,y,z);root.add(mesh);return mesh}
// Single flat planes for UV branding. No decorative frames or relief.
box('BODY',1.1,.77,.60,0,.515,0,ivory);
const front=new T.Mesh(new T.PlaneGeometry(1.1,.77),ivory.clone());front.name='BAR_FRONT';front.position.set(0,.515,.3002);root.add(front);
for(const sign of [-1,1]){const p=new T.Mesh(new T.PlaneGeometry(.60,.77),ivory.clone());p.name=sign<0?'BAR_LEFT':'BAR_RIGHT';p.rotation.y=sign*Math.PI/2;p.position.set(sign*.5502,.515,0);root.add(p);}
box('COUNTERTOP',1.20,.035,.65,0,.9175,0,walnut);
box('LED',1.08,.005,.005,0,.891,.303,new T.MeshStandardMaterial({color:'#ffdbb0',emissive:'#ffdbb0',emissiveIntensity:1.2}));
for(const x of [-.45,.45])for(const z of [-.21,.21]){box('WHEEL_FORK',.033,.065,.042,x,.101,z,metal);const w=cyl('WHEELS',.05,.05,.032,x,.052,z,black,16);w.rotation.z=Math.PI/2;const hub=cyl('WHEEL_HUB',.021,.021,.034,x,.052,z,metal,12);hub.rotation.z=Math.PI/2;}
// Espresso machine, boiler casing, cup rail, group and walnut controls.
box('ESPRESSO_MACHINE',.42,.28,.34,-.17,1.095,-.04,metal);
box('MACHINE_FACE',.419,.23,.012,-.17,1.095,.136,cream);
box('MACHINE_BASE',.43,.034,.39,-.17,.959,-.011,dark);
box('DRIP_TRAY',.36,.011,.13,-.17,.982,.165,metal);
for(let x=-.32;x<=-.02;x+=.035)box('TRAY_SLOT',.008,.002,.10,x,.989,.17,dark);
const group=cyl('GROUPHEAD',.037,.041,.075,-.17,1.094,.182,metal);group.rotation.x=Math.PI/2;
const port=cyl('PORTAFILTER',.012,.013,.095,-.17,1.06,.268,walnut);port.rotation.x=Math.PI/2;
for(const x of [-.327,-.013]){const knob=cyl('MACHINE_KNOB',.025,.025,.025,x,1.17,.156,walnut);knob.rotation.x=Math.PI/2;}
const gauge=cyl('GAUGE',.025,.025,.010,-.17,1.168,.153,cream);gauge.rotation.x=Math.PI/2;
for(const x of [-.354,.014])box('CUP_RAIL',.009,.025,.3,x,1.249,-.04,metal);
box('CUP_RAIL_BACK',.36,.025,.009,-.17,1.249,-.19,metal);
cyl('STEAM_WAND',.006,.006,.12,-.36,1.06,.19,metal,8);
for(const x of [-.25,-.15]){cyl('CUP',.031,.023,.055,x,1.278,-.018,cream);cyl('CUP_INNER',.025,.025,.001,x,1.306,-.018,black);}
// Grinder stays attached to the immutable assembly.
box('GRINDER_BODY',.16,.255,.19,.32,1.073,-.075,cream);
cyl('GRINDER_BASE',.105,.105,.022,.32,.946,-.075,dark);
cyl('GRINDER_HOPPER',.075,.055,.13,.32,1.255,-.075,mat('#554b3b',.35,.1));
cyl('GRINDER_LID',.078,.078,.015,.32,1.328,-.075,dark);
box('GRINDER_SPOUT',.046,.026,.084,.32,1.112,.055,metal);
box('GRINDER_DISPLAY',.06,.034,.007,.32,1.16,.024,dark);
root.updateMatrixWorld(true);
const data=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true});
await writeFile(new URL('../public/models/eywa-bar-v1.glb',import.meta.url),Buffer.from(data));
console.log('Fixed presentation GLB:',data.byteLength,'bytes');

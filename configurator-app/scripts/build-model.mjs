import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { writeFile } from 'node:fs/promises';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(b => { this.result = b; this.onloadend?.(); }); }
};

const root = new T.Group();
root.name = 'EYWA_PHOTO_BASED_FIXED_BAR';
root.userData = {
  version: '3.0',
  approved: false,
  dimensionStatus: 'estimated-from-one-photo',
  units: 'metres',
  width: 1.25,
  depth: .60,
  height: .875,
  immutable: true
};

const material = (name, color, roughness = .5, metalness = 0) => {
  const m = new T.MeshStandardMaterial({ color, roughness, metalness });
  m.name = name;
  return m;
};
const wrap = material('Matte wrap', '#e8e4db', .72);
const walnut = new T.MeshPhysicalMaterial({ color: '#493021', roughness: .37, clearcoat: .14, clearcoatRoughness: .4 });
const rubber = material('Rubber', '#141515', .92);
const steel = material('Polished stainless steel', '#d6dadb', .15, 1);
const satinSteel = material('Brushed stainless steel', '#a8adaf', .33, .86);
const black = material('Powder coated steel', '#111413', .43, .2);
const coffee = material('Coffee beans', '#29170e', .78);
const geometryCache = new Map();
function mesh(name, geometry, m, x, y, z) {
  const o = new T.Mesh(geometry, m);
  o.name = name;
  o.position.set(x, y, z);
  root.add(o);
  return o;
}
function box(name, w, h, d, x, y, z, m, radius = 0) {
  const key = [w, h, d, radius].join(',');
  if (!geometryCache.has(key)) geometryCache.set(key, radius ? new RoundedBoxGeometry(w, h, d, 2, radius) : new T.BoxGeometry(w, h, d));
  return mesh(name, geometryCache.get(key), m, x, y, z);
}
function cylinder(name, rt, rb, h, x, y, z, m, n = 28) {
  const key = ['c', rt, rb, h, n].join(',');
  if (!geometryCache.has(key)) geometryCache.set(key, new T.CylinderGeometry(rt, rb, h, n));
  return mesh(name, geometryCache.get(key), m, x, y, z);
}

// The furniture is one simple rectangular cabinet. Branding is applied only
// to BAR_FRONT/BAR_LEFT/BAR_RIGHT by the viewer; no relief or mouldings.
box('BODY', 1.25, .735, .60, 0, .4775, 0, wrap, .003);
const front = mesh('BAR_FRONT', new T.PlaneGeometry(1.25, .735), wrap.clone(), 0, .4775, .3006);
front.userData = { printable: true, shape: 'flat-plane' };
for (const sign of [-1, 1]) {
  const side = mesh(sign < 0 ? 'BAR_LEFT' : 'BAR_RIGHT', new T.PlaneGeometry(.60, .735), wrap.clone(), sign * .6256, .4775, 0);
  side.rotation.y = sign * Math.PI / 2;
}
box('COUNTERTOP', 1.38, .03, .68, 0, .86, 0, walnut, .003);
box('COUNTER_SHADOW_GAP', 1.24, .006, .59, 0, .84, 0, black, .001);
box('LED', 1.23, .004, .003, 0, .842, .302, new T.MeshStandardMaterial({ color: '#ffdcad', emissive: '#ffd29b', emissiveIntensity: 1 }));

// Four small caster assemblies, visible underneath the cabinet.
for (const x of [-.535, .535]) for (const z of [-.235, .235]) {
  cylinder('CASTER_PIVOT', .023, .023, .025, x, .101, z, satinSteel, 20);
  box('CASTER_MOUNT', .071, .005, .063, x, .112, z, satinSteel, .002);
  for (const sign of [-1, 1]) box('CASTER_FORK', .004, .047, .032, x + sign * .021, .065, z + .007, steel, .001);
  const wheel = cylinder('WHEELS', .041, .041, .035, x, .041, z + .014, rubber, 32);
  wheel.rotation.z = Math.PI / 2;
  const hub = cylinder('WHEEL_HUB', .019, .019, .038, x, .041, z + .014, satinSteel, 24);
  hub.rotation.z = Math.PI / 2;
}

// Photo-derived placement: narrow espresso machine beside the grinder on the
// left half, with a wide clear work area on the right.
const mx = -.185, mz = -.025;
box('ESPRESSO_MACHINE', .302, .397, .326, mx, 1.0935, mz, steel, .010);
box('MACHINE_BACK_INSET', .261, .334, .005, mx, 1.101, .141, satinSteel, .007);
box('MACHINE_BACK_REFLECTOR', .222, .272, .006, mx, 1.10, .145, steel, .004);
// Pressed folds and hardware give the steel real edges to catch studio light.
for (const side of [-1, 1]) {
  const fold = box('MACHINE_FOLD', .006, .264, .009, mx + side * .11, 1.1, .149, steel, .002);
  fold.rotation.z = side * .055;
  for (const y of [.951, 1.251]) {
    const screw = cylinder('MACHINE_SCREW', .0035, .0035, .002, mx + side * .117, y, .148, steel, 12);
    screw.rotation.x = Math.PI / 2;
    box('SCREW_SLOT', .004, .0006, .0005, mx + side * .117, y, .1492, black);
  }
}
for (let i = 0; i < 13; i++) box('MACHINE_VENT', .011, .002, .001, mx - .105 + i * .0175, 1.263, .148, black, .0006);
const emblem = cylinder('MACHINE_EMBLEM', .022, .022, .003, mx, 1.15, .15, satinSteel, 32);
emblem.rotation.x = Math.PI / 2;
for (const side of [-1, 1]) box('MACHINE_BACK_RAIL', .009, .364, .012, mx + side * .14, 1.100, .142, steel, .003);
box('MACHINE_BACK_TOP', .272, .010, .012, mx, 1.283, .142, steel, .003);
box('MACHINE_BACK_BOTTOM', .271, .009, .012, mx, .918, .142, steel, .003);
box('MACHINE_TOP', .291, .013, .310, mx, 1.299, mz, satinSteel, .006);
cylinder('MACHINE_FILLER_CAP', .031, .031, .029, mx + .045, 1.319, mz, black, 28);
for (const x of [mx - .11, mx + .11]) for (const z of [mz - .12, mz + .12]) cylinder('MACHINE_FOOT', .017, .019, .027, x, .888, z, rubber, 20);
box('MACHINE_CONTROL_PANEL', .257, .216, .008, mx, 1.123, -.193, black, .006);
box('DRIP_TRAY', .274, .025, .095, mx, .918, -.232, satinSteel, .005);
for (let i = 0; i < 11; i++) box('DRIP_SLOT', .012, .001, .070, mx - .117 + i * .0234, .931, -.234, black);
const group = cylinder('GROUPHEAD', .039, .047, .07, mx, 1.066, -.226, steel);
group.rotation.x = Math.PI / 2;
const filter = cylinder('PORTAFILTER_HANDLE', .012, .015, .106, mx, 1.047, -.315, black, 20);
filter.rotation.x = Math.PI / 2;
for (const x of [mx - .095, mx + .095]) {
  const knob = cylinder('MACHINE_CONTROL', .018, .018, .025, x, 1.184, -.208, black, 24);
  knob.rotation.x = Math.PI / 2;
}
const gauge = cylinder('MACHINE_GAUGE', .020, .020, .004, mx, 1.216, -.200, material('Gauge face', '#deddd3', .5), 24);
gauge.rotation.x = Math.PI / 2;
const wand = cylinder('STEAM_WAND', .004, .004, .13, mx - .137, 1.025, -.236, steel, 12);
wand.rotation.z = .12;
function tube(name, points, radius, m) {
  return mesh(name, new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))), 32, radius, 8, false), m, 0, 0, 0);
}
tube('STEAM_PIPE', [[mx-.11,1.16,-.21],[mx-.15,1.12,-.22],[mx-.16,1.03,-.27],[mx-.13,.98,-.28]], .004, steel);
tube('WATER_PIPE', [[mx+.10,1.15,-.21],[mx+.145,1.10,-.23],[mx+.14,1.03,-.26]], .004, steel);
const needle = box('GAUGE_NEEDLE', .002, .027, .001, mx, 1.216, -.203, black);
needle.rotation.z = -.7;
for (let i = 0; i < 10; i++) {
  const a = i * Math.PI * 1.5 / 9 - Math.PI * .75;
  const tick = box('GAUGE_TICK', .001, .003, .001, mx + Math.sin(a)*.015, 1.216 + Math.cos(a)*.015, -.203, black);
  tick.rotation.z = -a;
}
// Cup warmer: thin steel rails and perforations, rather than a solid block.
for (const side of [-1,1]) tube('CUP_RAIL', [[mx+side*.132,1.306,-.14],[mx+side*.132,1.334,-.12],[mx+side*.132,1.334,.10],[mx+side*.132,1.306,.12]], .003, steel);
for(let i=0;i<9;i++) box('TOP_VENT', .008,.001,.17,mx-.095+i*.023,1.306,mz,satinSteel);

// Tall black grinder with a clear bean hopper, proportioned from the reference.
const gx = -.485, gz = -.025;
box('GRINDER_BODY', .156, .352, .196, gx, 1.063, gz, black, .012);
box('GRINDER_BASE', .168, .019, .208, gx, .887, gz, rubber, .007);
cylinder('GRINDER_COLLAR', .055, .055, .032, gx, 1.255, gz, black);
const glass = new T.MeshPhysicalMaterial({ color: '#f1eee8', roughness: .08, transmission: .88, thickness: .003, ior: 1.46, side: T.DoubleSide });
const hopperProfile = [[.046,0],[.048,.014],[.105,.105],[.105,.23],[.103,.23],[.103,.105],[.046,.014]].map(p=>new T.Vector2(...p));
mesh('GRINDER_HOPPER', new T.LatheGeometry(hopperProfile,64), glass, gx,1.268,gz);
cylinder('HOPPER_BEANS', .075, .041, .13, gx, 1.333, gz, coffee, 32);
// Merged individual beans preserve an irregular silhouette without hundreds of draw calls.
let seed = 41;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const beans = [];
for (let i = 0; i < 280; i++) {
  const y = i<210 ? random()*.128 : .128, r = .04 + y * .27;
  const angle = random()*Math.PI*2, radial = i<210 ? r : Math.sqrt(random())*r;
  const g = new T.SphereGeometry(1,8,5);
  g.scale(.006+random()*.002,.004,.0045);
  g.rotateY(random()*Math.PI); g.rotateZ(random()*Math.PI);
  g.translate(gx+Math.cos(angle)*radial,1.273+y,gz+Math.sin(angle)*radial);
  const color=new T.Color().setHSL(.055+random()*.025,.36+random()*.2,.07+random()*.075);
  const colors=new Float32Array(g.attributes.position.count*3);
  for(let j=0;j<colors.length;j+=3){colors[j]=color.r;colors[j+1]=color.g;colors[j+2]=color.b;}
  g.setAttribute('color',new T.BufferAttribute(colors,3));
  beans.push(g);
}
const beanMaterial=material('Individual roasted beans','#ffffff',.57);beanMaterial.vertexColors=true;
mesh('INDIVIDUAL_BEANS', mergeGeometries(beans), beanMaterial, 0,0,0);
beans.forEach(g=>g.dispose());
cylinder('GRINDER_LID', .11, .11, .014, gx, 1.507, gz, black, 40);
cylinder('GRINDER_LID_RIM', .108, .108, .005, gx, 1.498, gz, satinSteel, 40);
box('GRINDER_CHUTE', .034, .047, .075, gx, 1.11, -.154, satinSteel, .005);
box('GRINDER_FORK', .058, .010, .051, gx, 1.008, -.145, steel, .002);
box('GRINDER_DISPLAY_FRAME', .083,.068,.006,gx,1.18,-.126,black,.005);
box('GRINDER_DISPLAY', .067,.051,.002,gx,1.18,-.130,material('Display', '#526e76', .25),.003);
const badge = cylinder('GRINDER_BADGE', .018,.018,.002,gx,1.16,.075,satinSteel,24);badge.rotation.x=Math.PI/2;
// Removable service accessories. They do not alter the bar's protected silhouette.
const paper = material('Uncoated paper', '#f5f0e4', .88);
const cupProfile = [[.028,0],[.03,.002],[.038,.089],[.041,.094],[.041,.098],[.037,.098],[.036,.092],[.029,.007]].map(p=>new T.Vector2(...p));
const cupGeometry = new T.LatheGeometry(cupProfile,48);
for(const [x,z] of [[.35,.08],[.46,-.02]]) {
  mesh('CUP_PAPER',cupGeometry,paper,x,.876,z);
  const sleeve = mesh('CUP_BRAND',new T.CylinderGeometry(.0372,.0317,.063,64,1,true),wrap.clone(),x,.921,z);
  sleeve.rotation.y = Math.PI/2;
  cylinder('COFFEE_SURFACE',.0357,.0357,.001,x,.966,z,material('Crema','#ac7541',.58),48);
}
// Rear panel join, inset base and realistic caster brakes are visible in the orbit.
box('BACK_PANEL_JOIN',.002,.64,.001,0,.47,-.3005,black);
box('BASE_RECESS',1.19,.025,.54,0,.115,0,black,.002);
for(const x of [-.535,.535]) box('CASTER_BRAKE',.04,.007,.027,x,.071,.28,satinSteel,.002);

root.updateMatrixWorld(true);
const buffer = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: true });
await writeFile(new URL('../public/models/eywa-bar-v3.glb', import.meta.url), Buffer.from(buffer));
console.log('Detailed photo-based GLB v3:', buffer.byteLength, 'bytes');

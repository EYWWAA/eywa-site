import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { writeFile } from 'node:fs/promises';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(b => { this.result = b; this.onloadend?.(); }); }
};

const root = new T.Group();
root.name = 'EYWA_PHOTO_BASED_FIXED_BAR';
root.userData = {
  version: '2.0',
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
const darkGlass = material('Dark machine panel', '#171411', .19, .73);
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
box('BODY', 1.25, .735, .60, 0, .4775, 0, wrap);
const front = mesh('BAR_FRONT', new T.PlaneGeometry(1.25, .735), wrap.clone(), 0, .4775, .3006);
front.userData = { printable: true, shape: 'flat-plane' };
for (const sign of [-1, 1]) {
  const side = mesh(sign < 0 ? 'BAR_LEFT' : 'BAR_RIGHT', new T.PlaneGeometry(.60, .735), wrap.clone(), sign * .6256, .4775, 0);
  side.rotation.y = sign * Math.PI / 2;
}
box('COUNTERTOP', 1.38, .03, .68, 0, .86, 0, walnut);
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
box('MACHINE_BACK_INSET', .261, .334, .005, mx, 1.101, .141, darkGlass, .007);
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

// Tall black grinder with a clear bean hopper, proportioned from the reference.
const gx = -.485, gz = -.025;
box('GRINDER_BODY', .156, .352, .196, gx, 1.063, gz, black, .012);
box('GRINDER_BASE', .168, .019, .208, gx, .887, gz, rubber, .007);
cylinder('GRINDER_COLLAR', .055, .055, .032, gx, 1.255, gz, black);
const glass = new T.MeshPhysicalMaterial({ color: '#ffffff', roughness: .10, transparent: true, opacity: .30, depthWrite: false, side: T.DoubleSide });
cylinder('GRINDER_HOPPER', .105, .046, .23, gx, 1.383, gz, glass, 40);
cylinder('HOPPER_BEANS', .075, .041, .13, gx, 1.333, gz, coffee, 32);
cylinder('GRINDER_LID', .11, .11, .014, gx, 1.507, gz, black, 40);
cylinder('GRINDER_LID_RIM', .108, .108, .005, gx, 1.498, gz, satinSteel, 40);
box('GRINDER_CHUTE', .034, .047, .075, gx, 1.11, -.154, satinSteel, .005);
box('GRINDER_FORK', .058, .010, .051, gx, 1.008, -.145, steel, .002);

root.updateMatrixWorld(true);
const buffer = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: true });
await writeFile(new URL('../public/models/eywa-bar-v2.glb', import.meta.url), Buffer.from(buffer));
console.log('Fixed photo-based GLB v2:', buffer.byteLength, 'bytes');

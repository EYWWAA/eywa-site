/* Configurateur 3D du bar EYWA.
   ------------------------------------------------------------------
   Site statique, pas de bundler : Three.js arrive par l'importmap
   declaree dans index.html, et n'est telecharge qu'au moment ou la
   section approche de l'ecran (lazy-load par IntersectionObserver).

   MODELE 3D
   Depose ton fichier dans  models/coffee-bar.glb  et il sera utilise
   automatiquement a la place du bar de secours construit ici en
   primitives. Tant que le fichier n'existe pas, une requete HEAD
   echoue silencieusement (un 404 dans la console est normal).

   NOMS DE MESHES ATTENDUS DANS LE GLB
     BAR_FRONT   facade avant      <- recoit le visuel
     BAR_LEFT    panneau gauche    <- recoit le visuel
     BAR_RIGHT   panneau droit     <- recoit le visuel
     COUNTERTOP  plan de travail   <- jamais texture
     FRAME       structure alu     <- jamais texture
     WHEELS      roulettes         <- jamais texture
   Les suffixes Blender (BAR_FRONT.001) sont tolerés.
   ------------------------------------------------------------------ */

const MODEL_URL = 'models/coffee-bar.glb';

/* Seuls ces meshes peuvent recevoir une texture. Le plan de travail,
   la structure et les roulettes sont volontairement exclus. */
const TEXTURABLE = ['BAR_FRONT', 'BAR_LEFT', 'BAR_RIGHT'];

const MODES = {
  logo:  { label: 'Logo centré',    targets: ['BAR_FRONT'], fit: 'contain' },
  full:  { label: 'Façade complète', targets: ['BAR_FRONT'], fit: 'cover' },
  sides: { label: 'Façade + côtés',  targets: ['BAR_FRONT', 'BAR_LEFT', 'BAR_RIGHT'], fit: 'cover' }
};

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 12 * 1024 * 1024;
const TEXTURE_WIDTH = 1024;

/* Cotes reelles du bar, en metres. Servent au bar de secours et au
   calcul du ratio de chaque panneau (pour ne jamais etirer le visuel). */
const BAR = {
  width: 1.20,
  height: 0.87,
  depth: 0.60,
  wheel: 0.04,      // rayon des roulettes
  top: 0.038,       // epaisseur du plan de travail
  overhang: 0.02    // debord du plan de travail
};
BAR.bodyHeight = BAR.height - BAR.wheel * 2 - BAR.top;
BAR.bodyBottom = BAR.wheel * 2;
BAR.bodyMid = BAR.bodyBottom + BAR.bodyHeight / 2;

const PANEL_COLOR = 0xf4f1ea;

/* ================================================================= */

const section = document.querySelector('[data-configurateur]');
if (section) start(section);

/* Amorcage : on attend que la section approche de l'ecran pour telecharger
   Three.js. Un repli par scroll double l'observateur, car celui-ci reste
   muet tant que l'onglet est en arriere-plan et ne rattrape pas toujours
   une page restauree deja scrollee sur la section. */
function start(root) {
  let launched = false;

  const launch = () => {
    if (launched) return;
    launched = true;
    window.removeEventListener('scroll', onScroll);
    boot(root).catch((err) => {
      console.error('[configurateur]', err);
      showFallback(root);
    });
  };

  const near = () => {
    const r = root.getBoundingClientRect();
    return r.top < window.innerHeight + 400 && r.bottom > -400;
  };

  const onScroll = () => { if (near()) launch(); };
  window.addEventListener('scroll', onScroll, { passive: true });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      launch();
    }, { rootMargin: '400px 0px' });
    observer.observe(root);
  }

  if (near()) launch();
}

function showFallback(root) {
  const stage = root.querySelector('.cfg-stage');
  if (!stage) return;
  stage.innerHTML =
    '<div class="cfg-fallback">' +
    '<p>L\'aperçu 3D n\'a pas pu se charger sur cet appareil.</p>' +
    '<p>Envoyez-nous votre visuel, nous vous renvoyons un aperçu du bar sous 24 h.</p>' +
    '</div>';
}

/* ================================================================= */

async function boot(root) {
  const stage = root.querySelector('.cfg-stage');
  const loader = root.querySelector('.cfg-loader');
  const hint = root.querySelector('.cfg-hint');
  const input = root.querySelector('.cfg-input');
  const uploadBtn = root.querySelector('.cfg-upload');
  const resetBtn = root.querySelector('.cfg-reset');
  const saveBtn = root.querySelector('.cfg-save');
  const ctaBtn = root.querySelector('.cfg-cta');
  const fileLine = root.querySelector('.cfg-file');
  const errorBox = root.querySelector('.cfg-error');
  const modeBtns = Array.from(root.querySelectorAll('.cfg-mode'));

  if (!isWebGLAvailable()) { showFallback(root); return; }

  const THREE = await import('three');
  const [{ OrbitControls }, { RoomEnvironment }] = await Promise.all([
    import('three/addons/controls/OrbitControls.js'),
    import('three/addons/environments/RoomEnvironment.js')
  ]);

  /* ---------- Renderer, scene, camera ---------- */

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
    /* Indispensable pour la capture PNG : sans cela le contenu du buffer
       est perdu des que la frame est composee, et toDataURL renvoie une
       image vide. */
    preserveDrawingBuffer: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(1.45, 0.98, 1.9);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, BAR.bodyMid, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.enablePan = false;
  controls.rotateSpeed = 0.75;
  controls.zoomSpeed = 0.55;
  controls.minDistance = 1.65;
  controls.maxDistance = 3.4;
  controls.minPolarAngle = 0.5;
  controls.maxPolarAngle = 1.47;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.55;
  controls.update();

  /* Lumiere studio : environnement PMREM pour les reflets doux du metal,
     plus une key light et une fill pour le modele. */
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(1.8, 2.6, 1.9);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 0.45);
  fill.position.set(-2.1, 1.3, -1.4);
  scene.add(fill);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c6, 0.35));

  scene.add(makeContactShadow(THREE));

  /* ---------- Modele ---------- */

  const model = await loadModel(THREE);
  scene.add(model);

  const panels = collectPanels(model);
  if (!panels.BAR_FRONT) {
    console.warn('[configurateur] aucun mesh BAR_FRONT trouvé, textures désactivées.');
  }

  /* Materiau d'origine de chaque panneau, pour pouvoir revenir en arriere. */
  const baseMaterials = {};
  TEXTURABLE.forEach((name) => {
    if (panels[name]) baseMaterials[name] = panels[name].material;
  });

  /* ---------- Etat ---------- */

  const state = {
    mode: 'full',
    image: null,
    fileName: '',
    objectUrl: null,
    textures: {}   // { BAR_FRONT: THREE.Texture, ... }
  };

  /* ---------- Boucle de rendu ---------- */

  let running = true;
  let dirty = true;
  const markDirty = () => { dirty = true; };
  controls.addEventListener('change', markDirty);

  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    markDirty();
  }

  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  resize();

  function tick() {
    if (!running) return;
    requestAnimationFrame(tick);
    const moved = controls.update();
    if (moved || dirty) {
      renderer.render(scene, camera);
      dirty = false;
    }
  }
  requestAnimationFrame(tick);

  /* On coupe la boucle quand la section quitte l'ecran : batterie preservee
     sur mobile, ce qui compte beaucoup sur iPhone. */
  const visibility = new IntersectionObserver((entries) => {
    const visible = entries.some((e) => e.isIntersecting);
    if (visible && !running) { running = true; markDirty(); requestAnimationFrame(tick); }
    running = visible;
  }, { threshold: 0 });
  visibility.observe(stage);

  /* Premier rendu pret : on retire le voile de chargement. */
  renderer.render(scene, camera);
  loader.classList.add('is-out');
  setTimeout(() => { loader.hidden = true; }, 520);

  /* La rotation automatique s'arrete des que le visiteur prend la main. */
  const stopAuto = () => {
    controls.autoRotate = false;
    if (hint) hint.classList.add('is-out');
    stage.removeEventListener('pointerdown', stopAuto);
    stage.removeEventListener('wheel', stopAuto);
  };
  stage.addEventListener('pointerdown', stopAuto, { passive: true });
  stage.addEventListener('wheel', stopAuto, { passive: true });

  /* ---------- Import du visuel ---------- */

  uploadBtn.addEventListener('click', () => input.click());

  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    input.value = '';           // permet de reimporter le meme fichier
    if (file) handleFile(file);
  });

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = '';
  }

  function handleFile(file) {
    clearError();

    if (!ACCEPTED.includes(file.type)) {
      showError('Format non accepté. Importez un fichier PNG, JPG ou WEBP.');
      return;
    }
    if (file.size > MAX_BYTES) {
      showError('Fichier trop lourd (' + formatSize(file.size) + '). Maximum 12 Mo.');
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';

    img.onload = () => {
      if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
      state.objectUrl = url;
      state.image = img;
      state.fileName = file.name;

      fileLine.innerHTML =
        '<span class="cfg-file-dot"></span><strong></strong>' +
        '<span>&middot; ' + img.naturalWidth + ' × ' + img.naturalHeight + ' px</span>';
      fileLine.querySelector('strong').textContent = file.name;

      modeBtns.forEach((b) => { b.disabled = false; });
      applyMode(state.mode);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      showError('Ce fichier n\'a pas pu être lu. Essayez un autre visuel.');
    };

    img.src = url;
  }

  /* ---------- Application des textures ---------- */

  function disposeTextures() {
    Object.keys(state.textures).forEach((name) => {
      state.textures[name].dispose();
      delete state.textures[name];
    });
  }

  function restoreBaseMaterials() {
    TEXTURABLE.forEach((name) => {
      const mesh = panels[name];
      if (mesh && baseMaterials[name]) mesh.material = baseMaterials[name];
    });
  }

  function applyMode(modeKey) {
    const mode = MODES[modeKey];
    if (!mode) return;
    state.mode = modeKey;

    modeBtns.forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.mode === modeKey));
    });

    disposeTextures();
    restoreBaseMaterials();

    if (!state.image) { markDirty(); return; }

    mode.targets.forEach((name) => {
      const mesh = panels[name];
      if (!mesh) return;

      const aspect = panelAspect(name);
      const canvas = paintPanel(state.image, mode.fit, aspect);

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texture.needsUpdate = true;
      state.textures[name] = texture;

      /* On clone le materiau d'origine pour garder son aspect PBR
         (rugosite, reflets) et n'y changer que la carte de couleur. */
      const material = baseMaterials[name]
        ? baseMaterials[name].clone()
        : new THREE.MeshStandardMaterial();
      material.map = texture;
      material.color.set(0xffffff);
      material.needsUpdate = true;
      mesh.material = material;
    });

    markDirty();
  }

  /* Ratio largeur/hauteur reel du panneau vise, pour que le canvas de
     texture ait exactement les proportions de la surface imprimee. */
  function panelAspect(name) {
    const height = BAR.bodyHeight;
    const width = name === 'BAR_FRONT' ? BAR.width : BAR.depth;
    return width / height;
  }

  modeBtns.forEach((btn) => {
    btn.addEventListener('click', () => applyMode(btn.dataset.mode));
  });

  resetBtn.addEventListener('click', () => {
    disposeTextures();
    restoreBaseMaterials();
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.image = null;
    state.objectUrl = null;
    state.fileName = '';
    state.mode = 'full';
    modeBtns.forEach((b) => {
      b.disabled = true;
      b.setAttribute('aria-pressed', String(b.dataset.mode === 'full'));
    });
    fileLine.innerHTML = '';
    clearError();
    controls.reset();
    controls.target.set(0, BAR.bodyMid, 0);
    camera.position.set(1.45, 0.98, 1.9);
    controls.update();
    markDirty();
  });

  /* ---------- Capture et transmission au devis ---------- */

  function capture() {
    renderer.render(scene, camera);
    try { return renderer.domElement.toDataURL('image/png'); }
    catch (e) { return ''; }
  }

  saveBtn.addEventListener('click', () => {
    const data = capture();
    if (!data) return;
    const a = document.createElement('a');
    a.href = data;
    a.download = 'apercu-bar-eywa.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  ctaBtn.addEventListener('click', () => {
    const params = new URLSearchParams({ visuel: state.mode });
    if (state.fileName) params.set('fichier', state.fileName);

    /* La capture ne peut pas transiter par l'URL (trop volumineuse).
       On la depose en sessionStorage : la page de devis la relit pour
       l'afficher, et elle reste entierement dans le navigateur. */
    if (state.image) {
      try { sessionStorage.setItem('eywa-cfg-preview', capture()); }
      catch (e) { /* quota depasse : on continue sans l'apercu */ }
    }

    window.location.href = 'devis-instantane.html?' + params.toString();
  });

  /* Etat initial : modes desactives tant qu'aucun visuel n'est importe. */
  modeBtns.forEach((b) => {
    b.disabled = true;
    b.setAttribute('aria-pressed', String(b.dataset.mode === 'full'));
  });

  /* Surface de diagnostic. Depuis la console du navigateur :
       document.querySelector('[data-configurateur]').eywa.etat()
     liste les meshes reconnus et les faces qui portent un visuel.
     Utile surtout apres avoir remplace le bar de secours par un .glb,
     pour verifier que les noms de meshes sont bien ceux attendus. */
  root.eywa = {
    etat: () => ({
      meshes: Object.keys(panels),
      texturees: Object.keys(state.textures),
      mode: state.mode,
      fichier: state.fileName,
      source: MODEL_URL_UTILISE
    }),
    render: () => renderer.render(scene, camera)
  };
}

/* ================================================================= */
/* Fabrication de la texture d'un panneau                            */
/* ================================================================= */

/* Dessine le visuel dans un canvas aux proportions exactes du panneau.
   'cover'   : le visuel remplit la surface, le debord est recadre.
   'contain' : le visuel est pose entier, centre, sans etirement.
   Dans les deux cas le ratio d'origine est respecte : on ne deforme
   jamais l'image. Le fond creme fait office de support imprime, ce qui
   restitue correctement les PNG a fond transparent. */
function paintPanel(img, fit, aspect) {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_WIDTH;
  canvas.height = Math.round(TEXTURE_WIDTH / aspect);

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const imgAspect = iw / ih;
  const boxAspect = canvas.width / canvas.height;

  let w, h;
  if (fit === 'cover') {
    if (imgAspect > boxAspect) { h = canvas.height; w = h * imgAspect; }
    else { w = canvas.width; h = w / imgAspect; }
  } else {
    const margin = 0.62;   // le logo occupe 62 % de la surface disponible
    const maxW = canvas.width * margin;
    const maxH = canvas.height * margin;
    if (imgAspect > maxW / maxH) { w = maxW; h = w / imgAspect; }
    else { h = maxH; w = h * imgAspect; }
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);

  return canvas;
}

/* ================================================================= */
/* Modele : GLB s'il existe, sinon bar de secours en primitives      */
/* ================================================================= */

/* Renseigne d'ou vient le modele affiche, lisible via l'API de diagnostic. */
let MODEL_URL_UTILISE = 'bar de secours (primitives)';

async function loadModel(THREE) {
  try {
    const head = await fetch(MODEL_URL, { method: 'HEAD' });
    const type = head.headers.get('content-type') || '';
    if (head.ok && !type.includes('text/html')) {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
      MODEL_URL_UTILISE = MODEL_URL;
      return gltf.scene;
    }
  } catch (e) {
    /* Pas de modele en ligne : on continue avec le bar de secours.
       Un 404 dans la console est normal tant que le .glb n'est pas deposé. */
  }
  return buildFallbackBar(THREE);
}

/* Range les meshes par nom, en tolerant les suffixes Blender (.001). */
function collectPanels(root) {
  const found = {};
  const wanted = TEXTURABLE.concat(['COUNTERTOP', 'FRAME', 'WHEELS']);
  root.traverse((child) => {
    /* Les groupes sont acceptes : dans le bar de secours, FRAME et WHEELS
       en sont. Seuls les noms de TEXTURABLE recoivent un materiau, et ceux-la
       sont toujours des meshes. */
    if ((!child.isMesh && !child.isGroup) || !child.name) return;
    const upper = child.name.toUpperCase();
    const match = wanted.find((name) => upper === name || upper.startsWith(name + '.'));
    if (match && !found[match]) found[match] = child;
  });
  return found;
}

/* Bar de secours : volumes simples mais proprement proportionnes,
   aux cotes reelles, avec les memes noms de meshes que le futur GLB. */
function buildFallbackBar(THREE) {
  const group = new THREE.Group();
  group.name = 'EYWA_BAR';

  const panelMaterial = () => new THREE.MeshStandardMaterial({
    color: PANEL_COLOR,
    roughness: 0.52,
    metalness: 0.04,
    envMapIntensity: 0.75
  });

  /* Caisson : volume plein derriere les panneaux. */
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(BAR.width - 0.008, BAR.bodyHeight, BAR.depth - 0.008),
    new THREE.MeshStandardMaterial({
      color: 0xe9e5dc, roughness: 0.7, metalness: 0.02, envMapIntensity: 0.5
    })
  );
  body.position.y = BAR.bodyMid;
  body.name = 'BODY';
  group.add(body);

  /* Les trois panneaux personnalisables, poses juste devant les faces
     du caisson. Ce sont eux, et eux seuls, qui recoivent les textures. */
  const front = new THREE.Mesh(
    new THREE.PlaneGeometry(BAR.width, BAR.bodyHeight), panelMaterial()
  );
  front.name = 'BAR_FRONT';
  front.position.set(0, BAR.bodyMid, BAR.depth / 2 + 0.002);
  group.add(front);

  const left = new THREE.Mesh(
    new THREE.PlaneGeometry(BAR.depth, BAR.bodyHeight), panelMaterial()
  );
  left.name = 'BAR_LEFT';
  left.position.set(-BAR.width / 2 - 0.002, BAR.bodyMid, 0);
  left.rotation.y = -Math.PI / 2;
  group.add(left);

  const right = new THREE.Mesh(
    new THREE.PlaneGeometry(BAR.depth, BAR.bodyHeight), panelMaterial()
  );
  right.name = 'BAR_RIGHT';
  right.position.set(BAR.width / 2 + 0.002, BAR.bodyMid, 0);
  right.rotation.y = Math.PI / 2;
  group.add(right);

  /* Plan de travail : noyer, chant adouci. Jamais texture. */
  const topGeo = new THREE.BoxGeometry(
    BAR.width + BAR.overhang * 2, BAR.top, BAR.depth + BAR.overhang * 2
  );
  const top = new THREE.Mesh(topGeo, new THREE.MeshStandardMaterial({
    color: 0x4b3526, roughness: 0.34, metalness: 0.03, envMapIntensity: 1.0
  }));
  top.name = 'COUNTERTOP';
  top.position.y = BAR.bodyBottom + BAR.bodyHeight + BAR.top / 2;
  group.add(top);

  /* Structure : montants d'angle et plinthe, en aluminium brosse. */
  const frame = new THREE.Group();
  frame.name = 'FRAME';
  const alu = new THREE.MeshStandardMaterial({
    color: 0xc9ced2, roughness: 0.29, metalness: 0.92, envMapIntensity: 1.25
  });

  const postGeo = new THREE.BoxGeometry(0.026, BAR.bodyHeight, 0.026);
  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
    const post = new THREE.Mesh(postGeo, alu);
    post.position.set(
      sx * (BAR.width / 2 + 0.004),
      BAR.bodyMid,
      sz * (BAR.depth / 2 + 0.004)
    );
    frame.add(post);
  });

  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(BAR.width - 0.06, 0.05, BAR.depth - 0.06), alu
  );
  plinth.position.y = BAR.bodyBottom + 0.025;
  frame.add(plinth);
  group.add(frame);

  /* Roulettes. Jamais texturees. */
  const wheels = new THREE.Group();
  wheels.name = 'WHEELS';
  const rubber = new THREE.MeshStandardMaterial({
    color: 0x1d2124, roughness: 0.82, metalness: 0.08
  });
  const wheelGeo = new THREE.CylinderGeometry(BAR.wheel, BAR.wheel, 0.024, 28);
  const forkGeo = new THREE.BoxGeometry(0.05, 0.045, 0.036);

  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
    const x = sx * (BAR.width / 2 - 0.09);
    const z = sz * (BAR.depth / 2 - 0.09);

    const wheel = new THREE.Mesh(wheelGeo, rubber);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, BAR.wheel, z);
    wheels.add(wheel);

    const fork = new THREE.Mesh(forkGeo, alu);
    fork.position.set(x, BAR.wheel + 0.05, z);
    wheels.add(fork);
  });
  group.add(wheels);

  return group;
}

/* Ombre de contact peinte dans un canvas : plus douce et bien moins
   couteuse qu'une shadow map, ce qui compte sur iPhone. */
function makeContactShadow(THREE) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0, size / 2, size / 2, size / 2
  );
  gradient.addColorStop(0, 'rgba(30,45,36,0.40)');
  gradient.addColorStop(0.45, 'rgba(30,45,36,0.18)');
  gradient.addColorStop(1, 'rgba(30,45,36,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(BAR.width * 1.75, BAR.depth * 2.3),
    new THREE.MeshBasicMaterial({
      map: texture, transparent: true, depthWrite: false, opacity: 0.95
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.001;
  shadow.name = 'CONTACT_SHADOW';
  return shadow;
}

/* ================================================================= */

function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch (e) { return false; }
}

function formatSize(bytes) {
  return (bytes / 1024 / 1024).toFixed(1).replace('.', ',') + ' Mo';
}

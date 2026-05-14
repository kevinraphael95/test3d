import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';

/* ===================================================== */
/* SCENE                                                  */
/* ===================================================== */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x6a8fa8);
scene.fog = new THREE.FogExp2(0x7a9db8, 0.0022);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 4000);
camera.position.set(0, 10, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

/* ===================================================== */
/* LUMIÈRES                                               */
/* ===================================================== */

scene.add(new THREE.HemisphereLight(0xc8d8e8, 0x2a3520, 0.9));

const sun = new THREE.DirectionalLight(0xffd580, 2.0);
sun.position.set(300, 150, -200);
sun.castShadow = true;
sun.shadow.mapSize.width = sun.shadow.mapSize.height = 2048;
sun.shadow.camera.left = sun.shadow.camera.bottom = -400;
sun.shadow.camera.right = sun.shadow.camera.top = 400;
sun.shadow.bias = -0.001;
scene.add(sun);

scene.add(Object.assign(new THREE.DirectionalLight(0x8ab4cc, 0.4), { position: new THREE.Vector3(-200, 200, 100) }));

/* ===================================================== */
/* TERRAIN                                                */
/* ===================================================== */

const groundGeo = new THREE.PlaneGeometry(1400, 1400, 120, 120); // réduit de 160→120
const gp = groundGeo.attributes.position.array;
for (let i = 0; i < gp.length; i += 3) {
    const x = gp[i], z = gp[i + 1];
    gp[i + 2] = Math.sin(x * 0.018) * 10 + Math.cos(z * 0.015) * 8
              + Math.sin((x + z) * 0.008) * 14 + Math.sin(x * 0.05) * 2;
}
groundGeo.computeVertexNormals();

const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: 0x2a3d1e, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
ground.updateMatrixWorld();

/* ===================================================== */
/* HEIGHT                                                 */
/* ===================================================== */

const rc = new THREE.Raycaster();
function findY(x, z) {
    rc.ray.origin.set(x, 400, z);
    rc.ray.direction.set(0, -1, 0);
    const hit = rc.intersectObject(ground);
    return hit.length ? hit[0].point.y : 0;
}

/* ===================================================== */
/* SYSTÈMES                                               */
/* ===================================================== */

const windObjects = [];
const colliders   = [];
const fireflies   = [];

/* ===================================================== */
/* HERBE instanciée                                       */
/* ===================================================== */

const grassMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.02, 0.06, 1.4, 3),
    new THREE.MeshStandardMaterial({ color: 0x3a5a25 }),
    2000  // réduit de 3000→2000
);
scene.add(grassMesh);
const dummy = new THREE.Object3D();
for (let i = 0; i < 2000; i++) {
    const x = (Math.random() - 0.5) * 900, z = (Math.random() - 0.5) * 900;
    dummy.position.set(x, findY(x, z) + 0.55, z);
    dummy.scale.setScalar(0.6 + Math.random() * 2.0);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.updateMatrix();
    grassMesh.setMatrixAt(i, dummy.matrix);
}

/* ===================================================== */
/* FLEURS — instanciées (au lieu d'objets individuels)   */
/* ===================================================== */

const FLOWER_COLORS = [0xffe0a0, 0xffffff, 0xaaddff, 0xffccaa];
const flowerCount = 400;
const stemMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.02, 0.03, 0.7, 5),
    new THREE.MeshStandardMaterial({ color: 0x2d4c1e }),
    flowerCount
);
scene.add(stemMesh);

// Une couleur par fleur via instancing basique (même matériau, couleur approximée)
const headMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.1, 5, 4),
    new THREE.MeshStandardMaterial({ color: 0xfff0cc }),
    flowerCount
);
scene.add(headMesh);

for (let i = 0; i < flowerCount; i++) {
    const x = (Math.random() - 0.5) * 800, z = (Math.random() - 0.5) * 800;
    const y = findY(x, z);
    dummy.position.set(x, y + 0.35, z);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    stemMesh.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, y + 0.78, z);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    headMesh.setMatrixAt(i, dummy.matrix);
}

/* ===================================================== */
/* ROCHERS — anguleux, style nordique                     */
/* ===================================================== */

// Géométrie partagée anguleuse (detail=0 → faces plates, comme un vrai caillou)
const rockGeoSmall  = new THREE.DodecahedronGeometry(1.0, 0);
const rockGeoMedium = new THREE.DodecahedronGeometry(1.8, 0);
const rockGeoLarge  = new THREE.DodecahedronGeometry(2.8, 0);
const rockMat = new THREE.MeshStandardMaterial({ color: 0x7a7a80, roughness: 1, metalness: 0, flatShading: true });

function spawnRock(x, z) {
    const y    = findY(x, z);
    const roll = Math.random();
    const geo  = roll < 0.5 ? rockGeoSmall : roll < 0.8 ? rockGeoMedium : rockGeoLarge;
    const size = geo === rockGeoSmall ? 1.0 : geo === rockGeoMedium ? 1.8 : 2.8;
    const rock = new THREE.Mesh(geo, rockMat);
    rock.position.set(x, y + size * 0.3, z);
    rock.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
    rock.scale.set(0.8 + Math.random()*0.5, 0.5 + Math.random()*0.3, 0.8 + Math.random()*0.5);
    rock.castShadow = rock.receiveShadow = true;
    scene.add(rock);
    colliders.push({ x, z, r: size * 1.1 });
}

/* ===================================================== */
/* ARBRES — géométries partagées, optimisé               */
/* ===================================================== */

const trunkMat   = new THREE.MeshStandardMaterial({ color: 0x4a2e14, roughness: 0.9 });
const foliageMat = [
    new THREE.MeshStandardMaterial({ color: 0x0d1f0d }),
    new THREE.MeshStandardMaterial({ color: 0x122212 }),
    new THREE.MeshStandardMaterial({ color: 0x0a1a0a }),
];

// Géométries de tronc pré-créées (quelques tailles)
const trunkGeos = [
    new THREE.CylinderGeometry(0.4, 1.0, 18, 8),
    new THREE.CylinderGeometry(0.55, 1.3, 24, 8),
    new THREE.CylinderGeometry(0.65, 1.5, 30, 8),
];
const coneGeos = [
    new THREE.ConeGeometry(3, 6, 7),
    new THREE.ConeGeometry(5, 7, 7),
    new THREE.ConeGeometry(7, 8, 7),
    new THREE.ConeGeometry(9, 9, 7),
];

function spawnTree(x, z) {
    const y     = findY(x, z);
    const tree  = new THREE.Group();
    const tier  = Math.random() * 3 | 0;  // 0=petit, 1=moyen, 2=grand
    const heights = [18, 24, 30];
    const height  = heights[tier];
    const tGeo    = trunkGeos[tier];

    const trunk = new THREE.Mesh(tGeo, trunkMat);
    trunk.position.y    = height * 0.5;
    trunk.castShadow    = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    // Feuillage : commence à 42% → bas du tronc visible
    const layers = 5 + (Math.random() * 4 | 0);
    for (let i = 0; i < layers; i++) {
        const ratio = i / layers;
        const cGeo  = coneGeos[Math.min(Math.floor((1-ratio) * coneGeos.length), coneGeos.length-1)];
        const cone  = new THREE.Mesh(cGeo, foliageMat[Math.random()*3|0]);
        cone.position.y = height * 0.42 + ratio * height * 0.62;
        cone.rotation.y = Math.random() * Math.PI;
        cone.castShadow = true;
        tree.add(cone);
        windObjects.push({ mesh: cone, phase: Math.random()*10, speed: 0.4, amp: 0.011 });
    }

    tree.position.set(x, y, z);
    scene.add(tree);
    colliders.push({ x, z, r: 1.5 + tier * 0.5 });
}

/* ===================================================== */
/* LUCIOLES                                               */
/* ===================================================== */

function spawnFirefly() {
    const light = new THREE.PointLight(0xaaffcc, 0.5, 10);
    const x = (Math.random()-0.5)*900, z = (Math.random()-0.5)*900;
    light.position.set(x, findY(x, z) + 2 + Math.random()*4, z);
    scene.add(light);
    fireflies.push({ light, baseY: light.position.y, phase: Math.random()*10 });
}

/* ===================================================== */
/* MONDE                                                  */
/* ===================================================== */

for (let i = 0; i < 180; i++) spawnTree((Math.random()-0.5)*950, (Math.random()-0.5)*950);
for (let i = 0; i < 130; i++) spawnRock((Math.random()-0.5)*900, (Math.random()-0.5)*900);
for (let i = 0; i < 50;  i++) spawnFirefly();

/* ===================================================== */
/* AUDIO — musique de fond uniquement, pas de bruitages  */
/* ===================================================== */

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let bgStarted  = false;

fetch('./background_sound.mp3')
    .then(r => r.arrayBuffer())
    .then(ab => audioCtx.decodeAudioData(ab))
    .then(buf => { window._bgBuf = buf; tryStartBg(); })
    .catch(() => {});

function tryStartBg() {
    if (!window._bgBuf || bgStarted || audioCtx.state !== 'running') return;
    bgStarted = true;
    const src = audioCtx.createBufferSource();
    src.buffer = window._bgBuf;
    src.loop   = true;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.4;
    src.connect(gain).connect(audioCtx.destination);
    src.start();
}

/* ===================================================== */
/* CONTROLS                                               */
/* ===================================================== */

const controls = new PointerLockControls(camera, document.body);

const overlay = document.createElement('div');
overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;
align-items:center;justify-content:center;color:#d4b896;font-family:serif;
font-size:22px;letter-spacing:3px;cursor:pointer;z-index:99;
text-shadow:0 0 20px rgba(212,184,150,0.5);`;
overlay.textContent = 'CLIQUER POUR EXPLORER';
document.body.appendChild(overlay);

overlay.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume().then(tryStartBg);
    controls.lock();
});
controls.addEventListener('lock',   () => overlay.style.display = 'none');
controls.addEventListener('unlock', () => overlay.style.display = 'flex');

const velocity  = new THREE.Vector3();
const keys      = { z:false, s:false, q:false, d:false, shift:false };
let jumpVel     = 0;
let grounded    = true;
let wasGrounded = true;

addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = true;
    if (e.shiftKey) keys.shift = true;
    if (e.code === 'Space' && grounded) {
        grounded = false;
        jumpVel  = 8.0;
    }
});
addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = false;
    if (!e.shiftKey) keys.shift = false;
});

/* ===================================================== */
/* MOUVEMENT                                              */
/* ===================================================== */

const clock = new THREE.Clock();

function updateMovement(dt) {
    const running = keys.shift && keys.z;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right   = new THREE.Vector3(1, 0,  0).applyQuaternion(camera.quaternion);
    forward.y = 0; right.y = 0;
    forward.normalize(); right.normalize();

    const targetSpeed = running ? 13.0 : 7.0;
    const accel       = 14 * dt;

    const wish = new THREE.Vector3();
    if (keys.z) wish.addScaledVector(forward,  1);
    if (keys.s) wish.addScaledVector(forward, -1);
    if (keys.q) wish.addScaledVector(right,   -1);
    if (keys.d) wish.addScaledVector(right,    1);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(targetSpeed);

    velocity.x += (wish.x - velocity.x) * accel;
    velocity.z += (wish.z - velocity.z) * accel;

    let nx = camera.position.x + velocity.x * dt;
    let nz = camera.position.z + velocity.z * dt;

    for (const c of colliders) {
        const dx = nx - c.x, dz = nz - c.z;
        const d  = Math.sqrt(dx*dx + dz*dz);
        if (d < c.r) {
            const a = Math.atan2(dz, dx);
            nx = c.x + Math.cos(a) * c.r;
            nz = c.z + Math.sin(a) * c.r;
            velocity.x *= 0.1;
            velocity.z *= 0.1;
        }
    }

    camera.position.x = nx;
    camera.position.z = nz;

    jumpVel = Math.max(jumpVel - 24 * dt, -25);
    camera.position.y += jumpVel * dt;

    const groundY = findY(nx, nz) + 1.8;
    if (camera.position.y <= groundY) {
        camera.position.y = groundY;
        if (!wasGrounded) { /* atterrissage silencieux */ }
        grounded = true;
        jumpVel  = 0;
    } else {
        grounded = false;
    }
    wasGrounded = grounded;
}

/* ===================================================== */
/* ANIMATION                                              */
/* ===================================================== */

function animate(t) {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    t *= 0.001;

    for (const w of windObjects)
        w.mesh.rotation.z = Math.sin(t * w.speed + w.phase) * w.amp;

    for (const f of fireflies) {
        f.light.position.y  = f.baseY + Math.sin(t + f.phase) * 0.6;
        f.light.position.x += Math.cos(t * 0.25 + f.phase) * 0.012;
    }

    if (controls.isLocked) updateMovement(dt);

    renderer.render(scene, camera);
}

animate(0);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

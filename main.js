import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';

/* ===================================================== */
/* SCENE                                                  */
/* ===================================================== */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x6a8fa8);
scene.fog = new THREE.FogExp2(0x7a9db8, 0.0022);

/* ===================================================== */
/* CAMERA                                                 */
/* ===================================================== */

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 4000);
camera.position.set(0, 10, 0);

/* ===================================================== */
/* RENDERER                                               */
/* ===================================================== */

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

/* ===================================================== */
/* LUMIÈRES — ambiance Skyrim : lumière froide, dramatique*/
/* ===================================================== */

// Lumière ambiante froide comme un ciel nordique nuageux
scene.add(new THREE.HemisphereLight(0xc8d8e8, 0x2a3520, 0.9));

// Soleil bas à l'horizon, lumière dorée rasante
const sun = new THREE.DirectionalLight(0xffd580, 2.0);
sun.position.set(300, 150, -200);
sun.castShadow = true;
sun.shadow.mapSize.width  = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.left   = -400;
sun.shadow.camera.right  =  400;
sun.shadow.camera.top    =  400;
sun.shadow.camera.bottom = -400;
sun.shadow.bias = -0.001;
scene.add(sun);

// Lumière de remplissage froide depuis l'opposé (ciel nuageux)
const fillLight = new THREE.DirectionalLight(0x8ab4cc, 0.4);
fillLight.position.set(-200, 200, 100);
scene.add(fillLight);

/* ===================================================== */
/* TERRAIN                                                */
/* ===================================================== */

const groundGeo = new THREE.PlaneGeometry(1400, 1400, 160, 160);
const p = groundGeo.attributes.position.array;
for (let i = 0; i < p.length; i += 3) {
    const x = p[i], z = p[i + 1];
    p[i + 2] =
        Math.sin(x * 0.018) * 10 +
        Math.cos(z * 0.015) * 8 +
        Math.sin((x + z) * 0.008) * 14 +
        Math.sin(x * 0.05) * 2 +
        Math.cos(z * 0.04) * 2;
}
groundGeo.computeVertexNormals();

// Sol Skyrim : herbe sombre avec teinte froide
const ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({ color: 0x2a3d1e, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
ground.updateMatrixWorld();

/* ===================================================== */
/* HEIGHT                                                 */
/* ===================================================== */

const raycaster = new THREE.Raycaster();
function findY(x, z) {
    raycaster.ray.origin.set(x, 400, z);
    raycaster.ray.direction.set(0, -1, 0);
    const hit = raycaster.intersectObject(ground);
    return hit.length ? hit[0].point.y : 0;
}

/* ===================================================== */
/* SYSTÈMES                                               */
/* ===================================================== */

const windObjects    = [];
const colliders      = [];
const fireflies      = [];
const scentParticles = [];

/* ===================================================== */
/* HERBE                                                  */
/* ===================================================== */

const grassMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.02, 0.06, 1.4, 3),
    new THREE.MeshStandardMaterial({ color: 0x3a5a25 }),
    3000
);
grassMesh.receiveShadow = true;
scene.add(grassMesh);
const dummy = new THREE.Object3D();
for (let i = 0; i < 3000; i++) {
    const x = (Math.random() - 0.5) * 1000, z = (Math.random() - 0.5) * 1000;
    dummy.position.set(x, findY(x, z) + 0.55, z);
    dummy.scale.setScalar(0.6 + Math.random() * 2.0);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.updateMatrix();
    grassMesh.setMatrixAt(i, dummy.matrix);
}

/* ===================================================== */
/* FLEURS                                                 */
/* ===================================================== */

const FLOWER_COLORS = [0xffe0a0, 0xffffff, 0xaaddff, 0xffccaa, 0xddffdd];

function spawnFlower(x, z) {
    const y  = findY(x, z);
    const g  = new THREE.Group();
    const fc = FLOWER_COLORS[Math.random() * FLOWER_COLORS.length | 0];

    const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.03, 0.7),
        new THREE.MeshStandardMaterial({ color: 0x2d4c1e })
    );
    stem.position.y = 0.35;

    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 6, 6),
        new THREE.MeshStandardMaterial({ color: fc, emissive: fc, emissiveIntensity: 0.05 })
    );
    head.position.y = 0.78;

    g.add(stem, head);
    g.position.set(x, y, z);
    scene.add(g);
    windObjects.push({ mesh: g, phase: Math.random() * 5, speed: 1.5, amp: 0.035 });
}

/* ===================================================== */
/* ROCHERS — style nordique, plus gros et imposants       */
/* ===================================================== */

function spawnRock(x, z) {
    const y    = findY(x, z);
    const size = 1.2 + Math.random() * 3.5;
    const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(size, 1),
        new THREE.MeshStandardMaterial({ color: 0x7a7a80, roughness: 0.95, metalness: 0.05 })
    );
    rock.position.set(x, y + size * 0.35, z);
    rock.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
    rock.scale.set(1 + Math.random()*0.4, 0.55 + Math.random()*0.35, 1 + Math.random()*0.4);
    rock.castShadow = rock.receiveShadow = true;
    scene.add(rock);
    colliders.push({ x, z, r: size * 1.2 });
}

/* ===================================================== */
/* ARBRES — style Skyrim : grands, sombres, majestueux    */
/* ===================================================== */

// Matériaux tronc partagés
const trunkMats = [
    new THREE.MeshStandardMaterial({ color: 0x4a2e14, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x3d2510, roughness: 0.95 }),
    new THREE.MeshStandardMaterial({ color: 0x5a3418, roughness: 0.88 }),
];
const foliageMats = [
    new THREE.MeshStandardMaterial({ color: 0x0d1f0d }),
    new THREE.MeshStandardMaterial({ color: 0x122212 }),
    new THREE.MeshStandardMaterial({ color: 0x0a1a0a }),
    new THREE.MeshStandardMaterial({ color: 0x162816 }),
];

function spawnTree(x, z) {
    const y           = findY(x, z);
    const tree        = new THREE.Group();
    const height      = 22 + Math.random() * 20;
    const trunkRadius = 0.9 + Math.random() * 0.8;

    // Tronc visible sur les 40% du bas — couleur bois
    const trunkH = height * 0.88;
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(trunkRadius * 0.45, trunkRadius * 1.15, trunkH, 9),
        trunkMats[Math.random() * trunkMats.length | 0]
    );
    trunk.position.y    = trunkH / 2;
    trunk.castShadow    = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    // Feuillage commence à 42% → bas du tronc toujours visible
    const layers = 8 + (Math.random() * 5 | 0);
    for (let i = 0; i < layers; i++) {
        const ratio  = i / layers;
        const size   = (1 - ratio) * (trunkRadius * 6.5) + 1.8;
        const coneH  = 6 + Math.random() * 3;
        const cone   = new THREE.Mesh(
            new THREE.ConeGeometry(size, coneH, 8),
            foliageMats[Math.random() * foliageMats.length | 0]
        );
        cone.position.y = height * 0.42 + ratio * height * 0.62;
        // Légère rotation aléatoire pour casser la symétrie
        cone.rotation.y = Math.random() * Math.PI;
        cone.castShadow = true;
        tree.add(cone);
        windObjects.push({ mesh: cone, phase: Math.random()*10, speed: 0.4 + Math.random()*0.3, amp: 0.012 });
    }

    tree.position.set(x, y, z);
    scene.add(tree);
    colliders.push({ x, z, r: trunkRadius + 1.0 });
}

/* ===================================================== */
/* LUCIOLES                                               */
/* ===================================================== */

function spawnFirefly() {
    const light = new THREE.PointLight(0xaaffcc, 0.6, 10);
    const x = (Math.random()-0.5)*900, z = (Math.random()-0.5)*900;
    light.position.set(x, findY(x, z) + 1.5 + Math.random()*5, z);
    scene.add(light);
    fireflies.push({ light, baseY: light.position.y, phase: Math.random()*10 });
}

/* ===================================================== */
/* MONDE                                                  */
/* ===================================================== */

for (let i = 0; i < 200; i++) spawnTree((Math.random()-0.5)*1000, (Math.random()-0.5)*1000);
for (let i = 0; i < 500; i++) spawnFlower((Math.random()-0.5)*800, (Math.random()-0.5)*800);
for (let i = 0; i < 150; i++) spawnRock((Math.random()-0.5)*900, (Math.random()-0.5)*900);
for (let i = 0; i < 60;  i++) spawnFirefly();

/* ===================================================== */
/* AUDIO                                                  */
/* ===================================================== */

const audioCtx  = new (window.AudioContext || window.webkitAudioContext)();
let bgStarted   = false;

fetch('./background_sound.mp3')
    .then(r => r.arrayBuffer())
    .then(ab => audioCtx.decodeAudioData(ab))
    .then(buf => {
        window._bgBuffer = buf;
        tryStartBg();
    })
    .catch(() => {});

function tryStartBg() {
    if (!window._bgBuffer || bgStarted || audioCtx.state !== 'running') return;
    bgStarted = true;
    const src  = audioCtx.createBufferSource();
    src.buffer = window._bgBuffer;
    src.loop   = true;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.4;
    src.connect(gain).connect(audioCtx.destination);
    src.start();
}

function playFootstep() {
    const len  = audioCtx.sampleRate * 0.1 | 0;
    const buf  = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    let last   = 0;
    for (let i = 0; i < len; i++) {
        last    = (last + 0.022 * (Math.random()*2-1)) / 1.022;
        data[i] = last * 9 * Math.pow(1 - i/len, 2.2);
    }
    const src  = audioCtx.createBufferSource();
    src.buffer = buf;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.2;
    src.connect(gain).connect(audioCtx.destination);
    src.start();
}

function playJump() {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.22);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.22);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.22);
}

function playLand() {
    const len  = audioCtx.sampleRate * 0.08 | 0;
    const buf  = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++)
        data[i] = (Math.random()*2-1) * Math.pow(1 - i/len, 2.8);
    const src  = audioCtx.createBufferSource();
    src.buffer = buf;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.25;
    src.connect(gain).connect(audioCtx.destination);
    src.start();
}

/* ===================================================== */
/* CONTROLS                                               */
/* ===================================================== */

const controls = new PointerLockControls(camera, document.body);

// Overlay click-to-start
const overlay = document.createElement('div');
overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.72);
    display:flex;align-items:center;justify-content:center;
    color:#d4b896;font-family:serif;font-size:22px;letter-spacing:3px;
    cursor:pointer;z-index:99;user-select:none;
    text-shadow:0 0 20px rgba(212,184,150,0.5);
`;
overlay.textContent = 'CLIQUER POUR EXPLORER';
document.body.appendChild(overlay);

overlay.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume().then(tryStartBg);
    controls.lock();
});
controls.addEventListener('lock',   () => overlay.style.display = 'none');
controls.addEventListener('unlock', () => overlay.style.display = 'flex');

const velocity   = new THREE.Vector3();
const keys       = { z:false, s:false, q:false, d:false, shift:false };
let jumpVel      = 0;
let grounded     = true;
let wasGrounded  = true;
let stepTimer    = 0;

addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = true;
    if (e.shiftKey) keys.shift = true;
    if (e.code === 'Space' && grounded) {
        grounded = false;
        jumpVel  = 7.5;   // unités/s vers le haut
        playJump();
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
    const moving  = keys.z || keys.s || keys.q || keys.d;
    const running = keys.shift && keys.z;

    // Sons de pas
    if (moving && grounded) {
        stepTimer -= dt;
        if (stepTimer <= 0) {
            playFootstep();
            stepTimer = running ? 0.27 : 0.48;
        }
    } else {
        stepTimer = 0;
    }

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right   = new THREE.Vector3(1, 0,  0).applyQuaternion(camera.quaternion);
    forward.y = 0; right.y = 0;
    forward.normalize(); right.normalize();

    // Vitesse : marche 7 m/s, course 13 m/s — Skyrim-like, pas réaliste
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

    // Collisions
    for (const c of colliders) {
        const dx = nx - c.x, dz = nz - c.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        if (dist < c.r) {
            const a = Math.atan2(dz, dx);
            nx = c.x + Math.cos(a) * c.r;
            nz = c.z + Math.sin(a) * c.r;
            velocity.x *= 0.1;
            velocity.z *= 0.1;
        }
    }

    camera.position.x = nx;
    camera.position.z = nz;

    // Gravité
    const GRAVITY = 24;
    jumpVel = Math.max(jumpVel - GRAVITY * dt, -25);
    camera.position.y += jumpVel * dt;

    const groundY = findY(nx, nz) + 1.8;
    if (camera.position.y <= groundY) {
        if (!wasGrounded) playLand();
        camera.position.y = groundY;
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

    // Vent
    for (const w of windObjects)
        w.mesh.rotation.z = Math.sin(t * w.speed + w.phase) * w.amp;

    // Lucioles
    for (const f of fireflies) {
        f.light.position.y  = f.baseY + Math.sin(t + f.phase) * 0.6;
        f.light.position.x += Math.cos(t * 0.25 + f.phase) * 0.012;
    }

    if (controls.isLocked) updateMovement(dt);

    renderer.render(scene, camera);
}

animate(0);

/* ===================================================== */
/* RESIZE                                                 */
/* ===================================================== */

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

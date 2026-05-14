import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';

/* ===================================================== */
/* SCENE                                                  */
/* ===================================================== */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87a7c4);
scene.fog = new THREE.FogExp2(0x9bb4c7, 0.0028);

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
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

/* ===================================================== */
/* LUMIÈRES                                               */
/* ===================================================== */

scene.add(new THREE.HemisphereLight(0xddeeff, 0x3d2f1b, 1));

const sun = new THREE.DirectionalLight(0xfff2d6, 2.5);
sun.position.set(200, 300, 100);
sun.castShadow = true;
sun.shadow.mapSize.width  = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.left   = -300;
sun.shadow.camera.right  =  300;
sun.shadow.camera.top    =  300;
sun.shadow.camera.bottom = -300;
scene.add(sun);

/* ===================================================== */
/* TERRAIN                                                */
/* ===================================================== */

const groundGeo = new THREE.PlaneGeometry(1200, 1200, 140, 140);
const p = groundGeo.attributes.position.array;
for (let i = 0; i < p.length; i += 3) {
    const x = p[i], z = p[i + 1];
    p[i + 2] = Math.sin(x * 0.025) * 8 + Math.cos(z * 0.02) * 6 + Math.sin((x + z) * 0.01) * 12;
}
groundGeo.computeVertexNormals();
const ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({ color: 0x243b1d, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
ground.updateMatrixWorld();

/* ===================================================== */
/* HEIGHT (raycaster)                                     */
/* ===================================================== */

const raycaster = new THREE.Raycaster();
function findY(x, z) {
    raycaster.ray.origin.set(x, 300, z);
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
    new THREE.CylinderGeometry(0.02, 0.05, 1.2, 3),
    new THREE.MeshStandardMaterial({ color: 0x3f6b2d }),
    2500
);
scene.add(grassMesh);
const dummy = new THREE.Object3D();
for (let i = 0; i < 2500; i++) {
    const x = (Math.random() - 0.5) * 900, z = (Math.random() - 0.5) * 900;
    dummy.position.set(x, findY(x, z) + 0.5, z);
    dummy.scale.setScalar(0.7 + Math.random() * 1.8);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.updateMatrix();
    grassMesh.setMatrixAt(i, dummy.matrix);
}

/* ===================================================== */
/* FLEURS + PARTICULES                                    */
/* ===================================================== */

const FLOWER_COLORS = [0xff4444, 0x4444ff, 0xffff55, 0xffffff, 0xff66cc];

function spawnFlower(x, z) {
    const y  = findY(x, z);
    const g  = new THREE.Group();
    const fc = FLOWER_COLORS[Math.random() * 5 | 0];

    const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.03, 0.7),
        new THREE.MeshStandardMaterial({ color: 0x2d4c1e })
    );
    stem.position.y = 0.35;

    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 6),
        new THREE.MeshStandardMaterial({ color: fc, emissive: fc, emissiveIntensity: 0.1 })
    );
    head.position.y = 0.8;

    g.add(stem, head);
    g.position.set(x, y, z);
    scene.add(g);
    windObjects.push({ mesh: g, phase: Math.random() * 5, speed: 2, amp: 0.04 });

    // Particules odeur
    const n         = 4 + Math.random() * 4 | 0;
    const positions = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
        positions[i*3]   = x + (Math.random()-0.5)*0.6;
        positions[i*3+1] = y + 0.8 + Math.random()*1.5;
        positions[i*3+2] = z + (Math.random()-0.5)*0.6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
        color: fc, size: 0.06+Math.random()*0.06,
        transparent: true, opacity: 0.22,
        depthWrite: false, blending: THREE.AdditiveBlending
    }));
    scene.add(pts);
    scentParticles.push({
        points: pts, positions,
        baseX: x, baseY: y+0.8, baseZ: z,
        phases: Array.from({ length: n }, () => Math.random()*Math.PI*2)
    });
}

/* ===================================================== */
/* ROCHERS                                                */
/* ===================================================== */

function spawnRock(x, z) {
    const y    = findY(x, z);
    const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1 + Math.random() * 2, 0),
        new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 1 })
    );
    rock.position.set(x, y + 0.5, z);
    rock.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
    rock.scale.y = 0.6;
    rock.castShadow = rock.receiveShadow = true;
    scene.add(rock);
    colliders.push({ x, z, r: 2 });
}

/* ===================================================== */
/* ARBRES — bas du tronc bien visible                     */
/* ===================================================== */

function spawnTree(x, z) {
    const y           = findY(x, z);
    const tree        = new THREE.Group();
    const height      = 18 + Math.random() * 18;
    const trunkRadius = 1 + Math.random() * 0.6;
    const trunkH      = height * 0.85;

    // Tronc — brun clair visible, éclairé
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(trunkRadius * 0.5, trunkRadius * 1.1, trunkH, 10),
        new THREE.MeshStandardMaterial({ color: 0x6b3a1f, roughness: 0.85 })
    );
    trunk.position.y    = trunkH / 2;
    trunk.castShadow    = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    // Racines
    for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 / 5) * i;
        const rg    = new THREE.Group();
        rg.position.set(Math.cos(angle)*trunkRadius*0.9, 0.4, Math.sin(angle)*trunkRadius*0.9);
        rg.rotation.y = angle;
        rg.rotation.z = -(Math.PI/2 - 0.65);
        const rm = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.28, 3.2, 5),
            new THREE.MeshStandardMaterial({ color: 0x4a2e12, roughness: 1 })
        );
        rm.position.y = -1;
        rg.add(rm);
        tree.add(rg);
    }

    // Feuillage — démarre à 45% de la hauteur
    // → le bas du tronc (45%) reste toujours dégagé et visible
    const layers = 7 + (Math.random() * 4 | 0);
    for (let i = 0; i < layers; i++) {
        const ratio = i / layers;
        const size  = (1 - ratio) * (trunkRadius * 7) + 2;
        const cone  = new THREE.Mesh(
            new THREE.ConeGeometry(size, 7, 8),
            new THREE.MeshStandardMaterial({
                color: [0x0f240f, 0x163016, 0x1c3d1c][Math.random()*3|0]
            })
        );
        cone.position.y = height * 0.45 + ratio * height * 0.6;
        cone.castShadow = true;
        tree.add(cone);
        windObjects.push({ mesh: cone, phase: Math.random()*10, speed: 0.5, amp: 0.015 });
    }

    tree.position.set(x, y, z);
    scene.add(tree);
    colliders.push({ x, z, r: trunkRadius + 1.2 });
}

/* ===================================================== */
/* LUCIOLES                                               */
/* ===================================================== */

function spawnFirefly() {
    const light = new THREE.PointLight(0xffffaa, 0.7, 8);
    const x = (Math.random()-0.5)*800, z = (Math.random()-0.5)*800;
    light.position.set(x, findY(x, z) + 2 + Math.random()*4, z);
    scene.add(light);
    fireflies.push({ light, baseY: light.position.y, phase: Math.random()*10 });
}

/* ===================================================== */
/* MONDE                                                  */
/* ===================================================== */

for (let i = 0; i < 170; i++) spawnTree((Math.random()-0.5)*900, (Math.random()-0.5)*900);
for (let i = 0; i < 700; i++) spawnFlower((Math.random()-0.5)*700, (Math.random()-0.5)*700);
for (let i = 0; i < 120; i++) spawnRock((Math.random()-0.5)*800, (Math.random()-0.5)*800);
for (let i = 0; i < 90;  i++) spawnFirefly();

/* ===================================================== */
/* AUDIO                                                  */
/* ===================================================== */

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// --- Musique de fond : background_sound.mp3 ---
let bgBuffer = null;
let bgStarted = false;

fetch('./background_sound.mp3')
    .then(r => r.arrayBuffer())
    .then(ab => audioCtx.decodeAudioData(ab))
    .then(buf => { bgBuffer = buf; tryStartBg(); })
    .catch(() => console.warn('background_sound.mp3 introuvable'));

function tryStartBg() {
    if (!bgBuffer || bgStarted || audioCtx.state !== 'running') return;
    bgStarted = true;
    const src  = audioCtx.createBufferSource();
    src.buffer = bgBuffer;
    src.loop   = true;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.35;
    src.connect(gain).connect(audioCtx.destination);
    src.start();
}

// --- Bruitage PAS (bruit brun synthétique) ---
function playFootstep() {
    const len  = audioCtx.sampleRate * 0.09 | 0;
    const buf  = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    let last   = 0;
    for (let i = 0; i < len; i++) {
        last    = (last + 0.025 * (Math.random()*2-1)) / 1.025;
        data[i] = last * 10 * Math.pow(1 - i/len, 2.5);
    }
    const src  = audioCtx.createBufferSource();
    src.buffer = buf;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.22;
    src.connect(gain).connect(audioCtx.destination);
    src.start();
}

// --- Bruitage SAUT ---
function playJump() {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, audioCtx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
}

// --- Bruitage ATTERRISSAGE ---
function playLand() {
    const len  = audioCtx.sampleRate * 0.07 | 0;
    const buf  = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++)
        data[i] = (Math.random()*2-1) * Math.pow(1 - i/len, 3);
    const src  = audioCtx.createBufferSource();
    src.buffer = buf;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.28;
    src.connect(gain).connect(audioCtx.destination);
    src.start();
}

/* ===================================================== */
/* CONTROLS                                               */
/* ===================================================== */

const controls = new PointerLockControls(camera, document.body);

document.body.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume().then(tryStartBg);
    controls.lock();
});

controls.addEventListener('lock', tryStartBg);

const velocity  = new THREE.Vector3();
const keys      = { z: false, s: false, q: false, d: false, shift: false };
let jumpVel     = 0;
let grounded    = true;
let wasGrounded = true;
let stamina     = 100;
let stepTimer   = 0;

addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = true;
    if (e.shiftKey) keys.shift = true;
    if (e.code === 'Space' && grounded) {
        grounded = false;
        jumpVel  = 0.28;
        playJump();
    }
});
addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = false;
    if (!e.shiftKey) keys.shift = false;
});

/* ===================================================== */
/* MOUVEMENT — réaliste, dt-indépendant                  */
/* ===================================================== */

const clock = new THREE.Clock();

function updateMovement(dt) {
    const moving  = keys.z || keys.s || keys.q || keys.d;
    const running = keys.shift && stamina > 0 && keys.z;

    stamina = running
        ? Math.max(0,   stamina - dt * 22)
        : Math.min(100, stamina + dt *  8);
    document.getElementById('sp').style.width = stamina + '%';

    // Sons de pas
    if (moving && grounded) {
        stepTimer -= dt;
        if (stepTimer <= 0) {
            playFootstep();
            stepTimer = running ? 0.30 : 0.52;
        }
    } else {
        stepTimer = 0;
    }

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right   = new THREE.Vector3(1, 0,  0).applyQuaternion(camera.quaternion);
    forward.y = 0; right.y = 0;
    forward.normalize(); right.normalize();

    // Vitesses réalistes : marche ~4 m/s, sprint ~7.5 m/s
    const targetSpeed = running ? 7.5 : 4.0;
    const accel       = 16 * dt;

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
            velocity.x *= 0.2;
            velocity.z *= 0.2;
        }
    }

    camera.position.x = nx;
    camera.position.z = nz;

    // Gravité
    jumpVel = Math.max(jumpVel - 22 * dt, -20);
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

    for (const w of windObjects)
        w.mesh.rotation.z = Math.sin(t * w.speed + w.phase) * w.amp;

    for (const f of fireflies) {
        f.light.position.y  = f.baseY + Math.sin(t + f.phase) * 0.5;
        f.light.position.x += Math.cos(t * 0.3 + f.phase) * 0.01;
    }

    for (const s of scentParticles) {
        const pos = s.positions, n = pos.length / 3;
        for (let i = 0; i < n; i++) {
            pos[i*3+1] += 0.003;
            pos[i*3]   += Math.sin(t * 0.8 + s.phases[i]) * 0.001;
            if (pos[i*3+1] > s.baseY + 3.5) {
                pos[i*3]   = s.baseX + (Math.random()-0.5)*0.6;
                pos[i*3+1] = s.baseY;
                pos[i*3+2] = s.baseZ + (Math.random()-0.5)*0.6;
            }
        }
        s.points.geometry.attributes.position.needsUpdate = true;
        s.points.material.opacity = 0.12 + Math.sin(t * 1.2 + s.phases[0]) * 0.08;
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

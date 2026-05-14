import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';

/* ===================================================== */
/* PERLIN NOISE 2D                                        */
/* ===================================================== */

const _perm = new Uint8Array(512);
{
    const b = new Uint8Array(256);
    for (let i = 0; i < 256; i++) b[i] = i;
    for (let i = 255; i > 0; i--) {
        const j = Math.random() * (i + 1) | 0;
        [b[i], b[j]] = [b[j], b[i]];
    }
    for (let i = 0; i < 512; i++) _perm[i] = b[i & 255];
}

function _fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function _lerp(a, b, t) { return a + (b - a) * t; }
function _grad2(h, x, y) {
    switch (h & 3) {
        case 0: return  x + y;
        case 1: return -x + y;
        case 2: return  x - y;
        default: return -x - y;
    }
}

function perlin(x, y) {
    const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x),   yf = y - Math.floor(y);
    const u = _fade(xf), v = _fade(yf);
    const aa = _perm[_perm[xi]     + yi],   ab = _perm[_perm[xi]     + yi + 1];
    const ba = _perm[_perm[xi + 1] + yi],   bb = _perm[_perm[xi + 1] + yi + 1];
    return _lerp(
        _lerp(_grad2(aa, xf,     yf    ), _grad2(ba, xf - 1, yf    ), u),
        _lerp(_grad2(ab, xf,     yf - 1), _grad2(bb, xf - 1, yf - 1), u),
        v
    );
}

function fbm(x, y, octaves = 6) {
    let v = 0, amp = 1, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
        v   += perlin(x * freq, y * freq) * amp;
        max += amp;
        amp  *= 0.5;
        freq *= 2.0;
    }
    return v / max;
}

function getHeight(wx, wz) {
    const s = 0.003;
    return fbm(wx * s, wz * s, 6) * 40
         + Math.sin(wx * 0.015) * 5
         + Math.cos(wz * 0.012) * 4;
}

/* ===================================================== */
/* SCENE                                                  */
/* ===================================================== */

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x9bb4c7, 0.0022);
scene.background = new THREE.Color(0x87a7c4);

/* ===================================================== */
/* SKYBOX SHADER                                          */
/* ===================================================== */

const SUN_DIR = new THREE.Vector3(0.45, 0.35, -0.82).normalize();
scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(4000, 32, 16),
    new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false,
        uniforms: {
            topColor:   { value: new THREE.Color(0x1a3d6e) },
            midColor:   { value: new THREE.Color(0x6aaed6) },
            horizColor: { value: new THREE.Color(0xd4eaf8) },
            sunDir:     { value: SUN_DIR.clone() },
            sunColor:   { value: new THREE.Color(0xfffbe0) },
            sunSize:    { value: 0.9990 },
            glowSize:   { value: 0.9940 },
        },
        vertexShader: `
            varying vec3 vDir;
            void main(){
                vDir = normalize((modelMatrix * vec4(position,1.0)).xyz);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
            }`,
        fragmentShader: `
            uniform vec3 topColor, midColor, horizColor, sunDir, sunColor;
            uniform float sunSize, glowSize;
            varying vec3 vDir;
            void main(){
                float h = vDir.y;
                vec3 sky = mix(horizColor, midColor,  smoothstep(0.0, 0.25, h));
                sky       = mix(sky,        topColor,  smoothstep(0.2, 0.80, h));
                sky       = mix(vec3(0.08,0.06,0.04), sky, smoothstep(-0.04, 0.01, h));
                float d   = dot(normalize(vDir), normalize(sunDir));
                sky += sunColor * smoothstep(sunSize,  1.000, d);
                sky += sunColor * smoothstep(glowSize, sunSize, d) * 0.5;
                gl_FragColor = vec4(sky, 1.0);
            }`
    })
));

/* ===================================================== */
/* CAMERA                                                 */
/* ===================================================== */

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 4000);
camera.position.set(0, getHeight(0, 0) + 1.8, 0);

/* ===================================================== */
/* RENDERER                                               */
/* ===================================================== */

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.appendChild(renderer.domElement);

/* ===================================================== */
/* LUMIERES                                               */
/* ===================================================== */

scene.add(new THREE.HemisphereLight(0xc8ddf5, 0x2a3d1a, 0.85));
const sun = new THREE.DirectionalLight(0xfff5d0, 2.6);
sun.position.copy(SUN_DIR).multiplyScalar(800);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -400;
sun.shadow.camera.right = sun.shadow.camera.top   =  400;
sun.shadow.bias = -0.0003;
scene.add(sun);

/* ===================================================== */
/* MATERIAUX PARTAGES                                     */
/* ===================================================== */

const matGround = new THREE.MeshStandardMaterial({ color: 0x243b1d, roughness: 1 });
const matTrunk  = new THREE.MeshStandardMaterial({ color: 0x1a0f0a });
const matRoot   = new THREE.MeshStandardMaterial({ color: 0x22150f });
const matLeafs  = [
    new THREE.MeshStandardMaterial({ color: 0x0f240f }),
    new THREE.MeshStandardMaterial({ color: 0x163016 }),
    new THREE.MeshStandardMaterial({ color: 0x1c3d1c }),
];
const matStem   = new THREE.MeshStandardMaterial({ color: 0x2d4c1e });
const matRock   = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 1 });
const matGrass  = new THREE.MeshStandardMaterial({ color: 0x3f6b2d });

const FLOWER_COLORS = [0xff4444, 0x4444ff, 0xffff55, 0xffffff, 0xff66cc];

/* ===================================================== */
/* CHUNK SYSTEM                                           */
/* ===================================================== */

const CHUNK_SIZE    = 120;
const CHUNK_SEGS    = 40;
const LOAD_RADIUS   = 3;
const UNLOAD_RADIUS = 5;

const loadedChunks  = new Map(); // key → { group, cx, cz }
const chunkColliders = new Map(); // key → [{cx,cy,cz,r}]

function chunkKey(cx, cz) { return `${cx},${cz}`; }

/* ===================================================== */
/* SYSTEMES GLOBAUX                                       */
/* ===================================================== */

const windObjects = [];
const scentLines  = [];
const fireflyList = [];
const WIND_DIR    = new THREE.Vector2(1.0, 0.3).normalize().multiplyScalar(1.4);

function spawnScentLines(group, x, y, z, color) {
    const n = 2 + (Math.random() * 2 | 0);
    for (let t = 0; t < n; t++) {
        const SEG = 8;
        const pts = [];
        for (let i = 0; i <= SEG; i++) pts.push(new THREE.Vector3());
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({
            color, transparent: true,
            opacity: 0.15 + Math.random() * 0.12,
            depthWrite: false, blending: THREE.AdditiveBlending
        });
        const line = new THREE.Line(geo, mat);
        group.add(line);
        scentLines.push({
            line, geo,
            baseX: x, baseY: y + 0.85, baseZ: z,
            phase:  Math.random() * Math.PI * 2,
            speed:  0.4 + Math.random() * 0.6,
            driftX: (Math.random() - 0.5) * 1.2,
            driftZ: (Math.random() - 0.5) * 0.4,
            offset: Math.random() * 3, SEG
        });
    }
}

function updateScentLines(t) {
    for (const s of scentLines) {
        const pts = s.geo.attributes.position;
        const age = t * s.speed + s.offset;
        for (let i = 0; i <= s.SEG; i++) {
            const r = i / s.SEG;
            pts.setXYZ(i,
                s.baseX + WIND_DIR.x * r * 2.5 + s.driftX * r + Math.sin(age + r * 3) * 0.3,
                s.baseY + r * 2.2 + Math.sin(age * 1.3 + r * 2) * 0.18,
                s.baseZ + WIND_DIR.y * r * 2.5 + s.driftZ * r + Math.cos(age * 0.9 + r * 2.5) * 0.22
            );
        }
        pts.needsUpdate = true;
        const cycle = ((t * s.speed + s.offset) % (Math.PI * 2)) / (Math.PI * 2);
        s.line.material.opacity = (0.10 + Math.sin(t * 0.8 + s.phase) * 0.05) * Math.sin(cycle * Math.PI);
        if (cycle < s.speed * 0.016) {
            s.driftX = (Math.random() - 0.5) * 1.2;
            s.driftZ = (Math.random() - 0.5) * 0.4;
        }
    }
}

/* ===================================================== */
/* SEEDED RNG (déterministe par chunk)                    */
/* ===================================================== */

function seededRng(cx, cz) {
    let s = ((cx * 73856093) ^ (cz * 19349663)) >>> 0;
    return () => {
        s = (s ^ (s << 13)) >>> 0;
        s = (s ^ (s >> 17)) >>> 0;
        s = (s ^ (s <<  5)) >>> 0;
        return s / 0xFFFFFFFF;
    };
}

/* ===================================================== */
/* BUILD CHUNK                                            */
/* ===================================================== */

function buildChunk(cx, cz) {
    const group = new THREE.Group();
    const ox = cx * CHUNK_SIZE;
    const oz = cz * CHUNK_SIZE;

    // --- TERRAIN ---
    const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SEGS, CHUNK_SEGS);
    const pos = geo.attributes.position.array;
    // PlaneGeometry sur XY avant rotation : x=pos[i], y=pos[i+1], z=pos[i+2]
    // Après rotation.x = -PI/2 : x→x, y→z, z→y
    // Donc on déplace Z (hauteur) en fonction de (ox+x, oz+y)
    for (let i = 0; i < pos.length; i += 3) {
        const lx = pos[i], ly = pos[i + 1];
        pos[i + 2] = getHeight(ox + lx, oz + ly);
    }
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(geo, matGround);
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.set(ox, 0, oz);
    terrain.receiveShadow = true;
    group.add(terrain);

    // --- OBJETS ---
    const rng = seededRng(cx, cz);
    const half = CHUNK_SIZE / 2;
    const cols = [];

    // Arbres
    const treeCount = 4 + (rng() * 6 | 0);
    for (let i = 0; i < treeCount; i++) {
        const x = ox + (rng() - 0.5) * CHUNK_SIZE;
        const z = oz + (rng() - 0.5) * CHUNK_SIZE;
        const y = getHeight(x, z);
        const height = 18 + rng() * 18;
        const tr = 1 + rng() * 0.6;
        const tree = new THREE.Group();

        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(tr * 0.55, tr * 1.1, height + 10, 8),
            matTrunk
        );
        trunk.position.y = height / 2 - 5;
        trunk.castShadow = true;
        tree.add(trunk);

        // Racines
        for (let r = 0; r < 5; r++) {
            const angle = (Math.PI * 2 / 5) * r;
            const rLen = 2.5 + rng() * 1.5;
            const rThick = 0.12 + rng() * 0.08;
            const pivot = new THREE.Group();
            pivot.position.set(Math.cos(angle) * tr * 0.85, 0.1, Math.sin(angle) * tr * 0.85);
            pivot.rotation.y = angle;
            pivot.rotation.z = Math.PI / 2 + 0.75 + rng() * 0.35;
            const rootMesh = new THREE.Mesh(
                new THREE.CylinderGeometry(rThick * 0.35, rThick, rLen, 5),
                matRoot
            );
            rootMesh.position.y = -rLen / 2;
            pivot.add(rootMesh);
            tree.add(pivot);
        }

        // Feuillage
        const layers = 7 + (rng() * 4 | 0);
        for (let l = 0; l < layers; l++) {
            const ratio = l / layers;
            const size = (1 - ratio) * (tr * 7) + 2;
            const cone = new THREE.Mesh(
                new THREE.ConeGeometry(size, 7, 8),
                matLeafs[rng() * 3 | 0]
            );
            cone.position.y = height * 0.28 + ratio * height * 0.75;
            cone.castShadow = true;
            tree.add(cone);
            windObjects.push({ mesh: cone, phase: rng() * 10, speed: 0.5, amp: 0.015 });
        }

        tree.position.set(x, y, z);
        group.add(tree);
        cols.push({ cx: x, cy: y + 4,  cz: z, r: tr + 1.0 });
        cols.push({ cx: x, cy: y + 12, cz: z, r: tr + 0.8 });
    }

    // Rochers
    const rockCount = 2 + (rng() * 5 | 0);
    for (let i = 0; i < rockCount; i++) {
        const x = ox + (rng() - 0.5) * CHUNK_SIZE;
        const z = oz + (rng() - 0.5) * CHUNK_SIZE;
        const y = getHeight(x, z);
        const size = 1 + rng() * 2;
        const rock = new THREE.Mesh(
            new THREE.DodecahedronGeometry(size, 0),
            matRock
        );
        rock.position.set(x, y + size * 0.3, z);
        rock.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
        rock.scale.y = 0.6;
        rock.castShadow = true;
        rock.receiveShadow = true;
        group.add(rock);
        cols.push({ cx: x, cy: y + size * 0.3, cz: z, r: size * 0.9 });
    }

    // Fleurs
    const flowerCount = 10 + (rng() * 25 | 0);
    for (let i = 0; i < flowerCount; i++) {
        const x = ox + (rng() - 0.5) * CHUNK_SIZE;
        const z = oz + (rng() - 0.5) * CHUNK_SIZE;
        const y = getHeight(x, z);
        const color = FLOWER_COLORS[rng() * FLOWER_COLORS.length | 0];
        const g = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.7, 5), matStem);
        stem.position.y = 0.35;
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 6, 6),
            new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.1 })
        );
        head.position.y = 0.8;
        g.add(stem, head);
        g.position.set(x, y, z);
        group.add(g);
        windObjects.push({ mesh: g, phase: rng() * 5, speed: 2, amp: 0.04 });
        spawnScentLines(group, x, y, z, color);
    }

    // Herbe instanciée
    const grassCount = 100 + (rng() * 150 | 0);
    const grassMesh = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.02, 0.05, 1.2, 3),
        matGrass, grassCount
    );
    const d = new THREE.Object3D();
    for (let i = 0; i < grassCount; i++) {
        const gx = ox + (rng() - 0.5) * CHUNK_SIZE;
        const gz = oz + (rng() - 0.5) * CHUNK_SIZE;
        d.position.set(gx, getHeight(gx, gz) + 0.5, gz);
        d.scale.setScalar(0.7 + rng() * 1.8);
        d.rotation.y = rng() * Math.PI;
        d.updateMatrix();
        grassMesh.setMatrixAt(i, d.matrix);
    }
    group.add(grassMesh);

    // Lucioles
    const ffCount = 1 + (rng() * 3 | 0);
    for (let i = 0; i < ffCount; i++) {
        const fx = ox + (rng() - 0.5) * CHUNK_SIZE;
        const fz = oz + (rng() - 0.5) * CHUNK_SIZE;
        const fy = getHeight(fx, fz) + 2 + rng() * 4;
        const light = new THREE.PointLight(0xffffaa, 0.65, 9);
        light.position.set(fx, fy, fz);
        group.add(light);
        fireflyList.push({ light, baseY: fy, baseX: fx, baseZ: fz, phase: rng() * 10 });
    }

    scene.add(group);
    loadedChunks.set(chunkKey(cx, cz), { group, cx, cz });
    chunkColliders.set(chunkKey(cx, cz), cols);
}

function unloadChunk(key) {
    const chunk = loadedChunks.get(key);
    if (!chunk) return;

    const set = new Set();
    chunk.group.traverse(o => set.add(o));

    for (let i = windObjects.length - 1; i >= 0; i--)
        if (set.has(windObjects[i].mesh)) windObjects.splice(i, 1);
    for (let i = fireflyList.length - 1; i >= 0; i--)
        if (set.has(fireflyList[i].light)) fireflyList.splice(i, 1);
    for (let i = scentLines.length - 1; i >= 0; i--)
        if (set.has(scentLines[i].line)) scentLines.splice(i, 1);

    scene.remove(chunk.group);
    chunk.group.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        // matériaux créés à la volée (fleurs) : on les dispose
        if (o.material && ![ matGround, matTrunk, matRoot, matStem, matRock, matGrass, ...matLeafs ].includes(o.material))
            o.material.dispose();
    });
    loadedChunks.delete(key);
    chunkColliders.delete(key);
}

function updateChunks() {
    const pcx = Math.round(camera.position.x / CHUNK_SIZE);
    const pcz = Math.round(camera.position.z / CHUNK_SIZE);

    for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz++)
    for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++)
        if (Math.hypot(dx, dz) <= LOAD_RADIUS && !loadedChunks.has(chunkKey(pcx + dx, pcz + dz)))
            buildChunk(pcx + dx, pcz + dz);

    for (const [key, chunk] of loadedChunks)
        if (Math.hypot(chunk.cx - pcx, chunk.cz - pcz) > UNLOAD_RADIUS)
            unloadChunk(key);
}

/* ===================================================== */
/* PHYSIQUE CAPSULE                                       */
/* ===================================================== */

const PLAYER_RADIUS = 0.5;
const PLAYER_HEIGHT = 1.8;
const GRAVITY       = -18;
const JUMP_VEL      = 7;
const MOVE_ACCEL    = 28;
const MOVE_DRAG     = 8;

const playerVel = new THREE.Vector3();
let   grounded  = false;
let   stamina   = 100;

const _fwd   = new THREE.Vector3();
const _right  = new THREE.Vector3();
const _up     = new THREE.Vector3(0, 1, 0);

function resolveSphere(s) {
    const cy_lo = camera.position.y - PLAYER_HEIGHT + PLAYER_RADIUS;
    const cy_hi = camera.position.y - PLAYER_RADIUS;
    const ccy   = Math.max(cy_lo, Math.min(cy_hi, s.cy));
    const dx = camera.position.x - s.cx;
    const dy = camera.position.y - ccy;
    const dz = camera.position.z - s.cz;
    const d2 = dx*dx + dy*dy + dz*dz;
    const minD = s.r + PLAYER_RADIUS;
    if (d2 >= minD * minD) return;
    const d = Math.sqrt(d2) || 0.001;
    const pen = minD - d;
    camera.position.x += (dx / d) * pen;
    camera.position.z += (dz / d) * pen;
    const vd = playerVel.x * (dx/d) + playerVel.z * (dz/d);
    if (vd < 0) { playerVel.x -= vd * (dx/d); playerVel.z -= vd * (dz/d); }
}

function physicsStep(dt) {
    const running = keys.shift && stamina > 0 && keys.z;
    stamina = running ? Math.max(0, stamina - 45*dt) : Math.min(100, stamina + 20*dt);
    document.getElementById('sp').style.width = stamina + '%';

    camera.getWorldDirection(_fwd); _fwd.y = 0; _fwd.normalize();
    _right.crossVectors(_fwd, _up).negate().normalize();

    const spd = MOVE_ACCEL * (running ? 1.8 : 1);
    if (keys.z) { playerVel.x += _fwd.x * spd*dt;   playerVel.z += _fwd.z * spd*dt;   }
    if (keys.s) { playerVel.x -= _fwd.x * spd*dt;   playerVel.z -= _fwd.z * spd*dt;   }
    if (keys.q) { playerVel.x -= _right.x * spd*dt; playerVel.z -= _right.z * spd*dt; }
    if (keys.d) { playerVel.x += _right.x * spd*dt; playerVel.z += _right.z * spd*dt; }

    const drag = Math.exp(-MOVE_DRAG * dt);
    playerVel.x *= drag; playerVel.z *= drag;
    if (!grounded) playerVel.y += GRAVITY * dt;

    camera.position.x += playerVel.x * dt;
    camera.position.y += playerVel.y * dt;
    camera.position.z += playerVel.z * dt;

    // Collisions chunks voisins
    const pcx = Math.round(camera.position.x / CHUNK_SIZE);
    const pcz = Math.round(camera.position.z / CHUNK_SIZE);
    for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++) {
        const cols = chunkColliders.get(chunkKey(pcx+dx, pcz+dz));
        if (cols) for (const s of cols) resolveSphere(s);
    }

    // Sol
    const gy = getHeight(camera.position.x, camera.position.z) + PLAYER_HEIGHT;
    if (camera.position.y <= gy) {
        camera.position.y = gy;
        if (playerVel.y < 0) playerVel.y = 0;
        grounded = true;
    } else {
        grounded = false;
    }
}

/* ===================================================== */
/* CONTROLS                                               */
/* ===================================================== */

const controls = new PointerLockControls(camera, document.body);
document.body.addEventListener('click', () => controls.lock());

const keys = { z: false, s: false, q: false, d: false, shift: false };
addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = true;
    if (e.shiftKey) keys.shift = true;
    if (e.code === 'Space' && grounded) { playerVel.y = JUMP_VEL; grounded = false; }
});
addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = false;
    if (!e.shiftKey) keys.shift = false;
});

/* ===================================================== */
/* BOUCLE PRINCIPALE                                      */
/* ===================================================== */

let lastTime = performance.now();
let lastChunkTick = 0;

function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    const t = now * 0.001;

    // Chunks — toutes les 250ms max
    if (now - lastChunkTick > 250) {
        updateChunks();
        lastChunkTick = now;
    }

    // Vent
    for (const w of windObjects)
        w.mesh.rotation.z = Math.sin(t * w.speed + w.phase) * w.amp;

    // Lucioles
    for (const f of fireflyList) {
        f.light.position.y = f.baseY + Math.sin(t + f.phase) * 0.6;
        f.light.position.x = f.baseX + Math.cos(t * 0.25 + f.phase) * 2;
        f.light.position.z = f.baseZ + Math.sin(t * 0.2  + f.phase) * 2;
        f.light.intensity  = 0.4 + Math.sin(t * 3 + f.phase) * 0.25;
    }

    updateScentLines(t);

    if (controls.isLocked) physicsStep(dt);

    renderer.render(scene, camera);
}

animate(performance.now());

/* ===================================================== */
/* RESIZE                                                 */
/* ===================================================== */

addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});

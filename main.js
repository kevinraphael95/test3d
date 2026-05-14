import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';

/* ===================================================== */
/* RENDERER */
/* ===================================================== */

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

/* ===================================================== */
/* SCENE / CAMERA */
/* ===================================================== */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87a7c4);
scene.fog = new THREE.FogExp2(0x9bb4c7, 0.0028);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 4000);
camera.position.set(0, 10, 0);

/* ===================================================== */
/* LIGHTS */
/* ===================================================== */

scene.add(new THREE.HemisphereLight(0xddeeff, 0x3d2f1b, 1));
const sun = new THREE.DirectionalLight(0xfff2d6, 2.5);
sun.position.set(200, 300, 100);
sun.castShadow = true;
sun.shadow.mapSize.width = sun.shadow.mapSize.height = 2048;
sun.shadow.camera.left = sun.shadow.camera.bottom = -300;
sun.shadow.camera.right = sun.shadow.camera.top = 300;
scene.add(sun);

/* ===================================================== */
/* SIMPLEX NOISE — seed aléatoire, terrain infini-style  */
/* ===================================================== */

// Implémentation Simplex 2D légère, sans dépendance externe
const SEED = Math.random() * 65536 | 0;
console.log('Terrain seed:', SEED);

function buildPermTable(seed) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    // Fisher-Yates avec seed
    let s = seed;
    for (let i = 255; i > 0; i--) {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        const j = (s >>> 24) % (i + 1);
        [p[i], p[j]] = [p[j], p[i]];
    }
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    return perm;
}

const perm = buildPermTable(SEED);

const GRAD2 = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];

function dot2(g, x, y) { return g[0]*x + g[1]*y; }

function simplex2(xin, yin) {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    const s  = (xin + yin) * F2;
    const i  = Math.floor(xin + s);
    const j  = Math.floor(yin + s);
    const t  = (i + j) * G2;
    const X0 = i - t, Y0 = j - t;
    const x0 = xin - X0, y0 = yin - Y0;
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2*G2, y2 = y0 - 1 + 2*G2;
    const ii = i & 255, jj = j & 255;
    const gi0 = perm[ii + perm[jj]]          % 8;
    const gi1 = perm[ii + i1 + perm[jj + j1]] % 8;
    const gi2 = perm[ii + 1  + perm[jj + 1]]  % 8;
    let n0=0,n1=0,n2=0;
    let t0 = 0.5 - x0*x0 - y0*y0; if(t0>=0){t0*=t0;n0=t0*t0*dot2(GRAD2[gi0],x0,y0);}
    let t1 = 0.5 - x1*x1 - y1*y1; if(t1>=0){t1*=t1;n1=t1*t1*dot2(GRAD2[gi1],x1,y1);}
    let t2 = 0.5 - x2*x2 - y2*y2; if(t2>=0){t2*=t2;n2=t2*t2*dot2(GRAD2[gi2],x2,y2);}
    return 70 * (n0 + n1 + n2); // [-1, 1]
}

// Fractales multi-octave comme Minecraft
function fbm(x, z) {
    return (
        simplex2(x * 0.002,  z * 0.002)  * 14 +  // grandes collines très douces
        simplex2(x * 0.008,  z * 0.008)  * 5  +  // ondulations légères
        simplex2(x * 0.025,  z * 0.025)  * 1.5   // micro-détails subtils
    );
}

/* ===================================================== */
/* HEIGHTMAP — grille O(1) en coordonnées monde          */
/* PlaneGeometry avant rotation.x=-PI/2 :               */
/*   pos[i]   = x_local = x_monde                       */
/*   pos[i+1] = y_local = -z_monde  → on passe -y       */
/*   pos[i+2] = hauteur (devient Y monde après rotation) */
/* ===================================================== */

const WORLD   = 1200;
const HM_SIZE = 512;

const heightmap = new Float32Array(HM_SIZE * HM_SIZE);
for (let row = 0; row < HM_SIZE; row++) {
    for (let col = 0; col < HM_SIZE; col++) {
        const wx = (col / (HM_SIZE - 1) - 0.5) * WORLD;
        const wz = (row / (HM_SIZE - 1) - 0.5) * WORLD;
        heightmap[row * HM_SIZE + col] = fbm(wx, wz);
    }
}

function findY(wx, wz) {
    const u  = (wx / WORLD + 0.5) * (HM_SIZE - 1);
    const v  = (wz / WORLD + 0.5) * (HM_SIZE - 1);
    const c0 = Math.max(0, Math.min(HM_SIZE - 2, Math.floor(u)));
    const r0 = Math.max(0, Math.min(HM_SIZE - 2, Math.floor(v)));
    const fu = u - c0, fv = v - r0;
    const h00 = heightmap[ r0      * HM_SIZE + c0    ];
    const h10 = heightmap[ r0      * HM_SIZE + c0 + 1];
    const h01 = heightmap[(r0 + 1) * HM_SIZE + c0    ];
    const h11 = heightmap[(r0 + 1) * HM_SIZE + c0 + 1];
    return h00*(1-fu)*(1-fv) + h10*fu*(1-fv) + h01*(1-fu)*fv + h11*fu*fv;
}

/* ===================================================== */
/* TERRAIN */
/* ===================================================== */

const groundGeo = new THREE.PlaneGeometry(WORLD, WORLD, 180, 180);
const vp = groundGeo.attributes.position.array;
for (let i = 0; i < vp.length; i += 3) {
    vp[i + 2] = fbm(vp[i], -vp[i + 1]); // x_local=x_monde, y_local=-z_monde
}
groundGeo.computeVertexNormals();

const ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({ color: 0x243b1d, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

/* ===================================================== */
/* SYSTEMS */
/* ===================================================== */

const windObjects = [];
const colliders   = [];

/* ===================================================== */
/* HERBE */
/* ===================================================== */

const GRASS_COUNT = 2500;
const grassMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.02, 0.05, 1.2, 3),
    new THREE.MeshStandardMaterial({ color: 0x3f6b2d }),
    GRASS_COUNT
);
grassMesh.frustumCulled = false;
scene.add(grassMesh);

const dummy = new THREE.Object3D();
for (let i = 0; i < GRASS_COUNT; i++) {
    const x = (Math.random() - 0.5) * 900;
    const z = (Math.random() - 0.5) * 900;
    dummy.position.set(x, findY(x, z) + 0.0, z);
    dummy.scale.setScalar(0.7 + Math.random() * 1.8);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.updateMatrix();
    grassMesh.setMatrixAt(i, dummy.matrix);
}
grassMesh.instanceMatrix.needsUpdate = true;

/* ===================================================== */
/* FLEURS */
/* ===================================================== */

const FLOWER_COUNT      = 700;
const FLOWER_COLORS_HEX = [0xff4444, 0x4444ff, 0xffff55, 0xffffff, 0xff66cc];
const NC = FLOWER_COLORS_HEX.length;

const stemMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.02, 0.03, 0.7, 5),
    new THREE.MeshStandardMaterial({ color: 0x2d4c1e }),
    FLOWER_COUNT
);
stemMesh.frustumCulled = false;
scene.add(stemMesh);

const FLOWER_BUCKETS = FLOWER_COLORS_HEX.map(hex =>
    new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.12, 6, 6),
        new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.1 }),
        Math.ceil(FLOWER_COUNT / NC) + 10
    )
);
FLOWER_BUCKETS.forEach(m => { m.frustumCulled = false; scene.add(m); });
const bucketCounts = new Int32Array(NC);
const flowerPos = new Float32Array(FLOWER_COUNT * 3);

for (let i = 0; i < FLOWER_COUNT; i++) {
    const x = (Math.random() - 0.5) * 700;
    const z = (Math.random() - 0.5) * 700;
    const y = findY(x, z);
    flowerPos[i*3]=x; flowerPos[i*3+1]=y; flowerPos[i*3+2]=z;

    dummy.position.set(x, y + 0.0, z);
    dummy.rotation.set(0, Math.random() * Math.PI, 0);
    dummy.scale.set(1,1,1);
    dummy.updateMatrix();
    stemMesh.setMatrixAt(i, dummy.matrix);

    const ci = (Math.random() * NC) | 0;
    dummy.position.set(x, y + 0.45, z);
    dummy.updateMatrix();
    FLOWER_BUCKETS[ci].setMatrixAt(bucketCounts[ci]++, dummy.matrix);
}
stemMesh.instanceMatrix.needsUpdate = true;
FLOWER_BUCKETS.forEach((m, i) => { m.count = bucketCounts[i]; m.instanceMatrix.needsUpdate = true; });

/* ===================================================== */
/* SCENT PARTICLES */
/* ===================================================== */

const SCENT_PER_FLOWER = 5;
const SCENT_TOTAL      = FLOWER_COUNT * SCENT_PER_FLOWER;
const scentPos    = new Float32Array(SCENT_TOTAL * 3);
const scentPhase  = new Float32Array(SCENT_TOTAL);
const scentBaseY  = new Float32Array(SCENT_TOTAL);
const scentBaseXZ = new Float32Array(SCENT_TOTAL * 2);

for (let fi = 0; fi < FLOWER_COUNT; fi++) {
    const bx = flowerPos[fi*3], by = flowerPos[fi*3+1]+0.8, bz = flowerPos[fi*3+2];
    for (let k = 0; k < SCENT_PER_FLOWER; k++) {
        const si = fi * SCENT_PER_FLOWER + k;
        scentPos[si*3]   = bx + (Math.random()-.5)*.6;
        scentPos[si*3+1] = by + Math.random()*1.5;
        scentPos[si*3+2] = bz + (Math.random()-.5)*.6;
        scentPhase[si] = Math.random()*Math.PI*2;
        scentBaseY[si] = by;
        scentBaseXZ[si*2]=bx; scentBaseXZ[si*2+1]=bz;
    }
}
const scentGeo = new THREE.BufferGeometry();
scentGeo.setAttribute('position', new THREE.BufferAttribute(scentPos, 3));
const scentMat = new THREE.PointsMaterial({
    color:0xffffff, size:0.08, transparent:true, opacity:0.18,
    depthWrite:false, blending:THREE.AdditiveBlending
});
scene.add(new THREE.Points(scentGeo, scentMat));

/* ===================================================== */
/* ROCHERS */
/* ===================================================== */

const ROCK_COUNT = 120;
const rockMesh = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 1 }),
    ROCK_COUNT
);
rockMesh.castShadow = rockMesh.receiveShadow = true;
scene.add(rockMesh);

for (let i = 0; i < ROCK_COUNT; i++) {
    const x = (Math.random()-.5)*800, z = (Math.random()-.5)*800;
    const y = findY(x, z);
    const s = 0.7 + Math.random()*1.5, sy = s*0.6;
    dummy.position.set(x, y - sy*0.15, z);
    dummy.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
    dummy.scale.set(s, sy, s);
    dummy.updateMatrix();
    rockMesh.setMatrixAt(i, dummy.matrix);
    colliders.push({ x, z, r: s*1.2 });
}
rockMesh.instanceMatrix.needsUpdate = true;

/* ===================================================== */
/* ARBRES — tronc ancré au sol, feuillage couvre tronc   */
/* ===================================================== */

const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0e });
const coneMats = [0x0f240f, 0x163016, 0x1c3d1c].map(c =>
    new THREE.MeshStandardMaterial({ color: c })
);

function spawnTree(x, z) {
    const groundY = findY(x, z);
    const tree    = new THREE.Group();

    // Dimensions de l'arbre
    const h  = 12 + Math.random() * 14;   // hauteur totale feuillage
    const tr = 0.4 + Math.random() * 0.4; // rayon tronc

    // TRONC : part du sol, monte jusqu'en haut du feuillage
    // On le prolonge légèrement sous le sol pour masquer le gap
    const trunkH = h * 0.6;
    const trunk  = new THREE.Mesh(
        new THREE.CylinderGeometry(tr * 0.5, tr, trunkH + 4, 8), // +4 = enterré profond
        trunkMat
    );
    trunk.position.y = trunkH / 2 - 2;
    trunk.castShadow = true;
    tree.add(trunk);

    // FEUILLAGE : cônes empilés qui couvrent tout le tronc
    // Le premier cône démarre au sol (y=0) et ils montent jusqu'à h
    const layers = 6 + (Math.random() * 4 | 0);
    for (let i = 0; i < layers; i++) {
        const ratio  = i / (layers - 1);                     // 0..1
        const coneY  = ratio * h;                             // position Y du cône
        // Rayon décroît du bas vers le haut
        const radius = tr * 8 * (1 - ratio * 0.75) + 1.5;
        const coneH  = h / layers * 1.8;                     // chevauchement intentionnel

        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(radius, coneH, 8),
            coneMats[(Math.random() * 3) | 0]
        );
        cone.position.y = coneY;
        cone.castShadow = true;
        tree.add(cone);

        windObjects.push({ mesh: cone, phase: Math.random()*10, speed: 0.5, amp: 0.012 });
    }

    // Positionner le groupe au sol exactement
    tree.position.set(x, groundY, z);
    scene.add(tree);
    colliders.push({ x, z, r: tr * 3 + 1 });
}

for (let i = 0; i < 170; i++)
    spawnTree((Math.random()-.5)*900, (Math.random()-.5)*900);

/* ===================================================== */
/* LUCIOLES */
/* ===================================================== */

const fireflyLights = [], fireflyFakes = [];
const ffFakeMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
const ffFakeGeo = new THREE.SphereGeometry(0.08, 4, 4);

for (let i = 0; i < 90; i++) {
    const fx = (Math.random()-.5)*800, fz = (Math.random()-.5)*800;
    const fy = findY(fx, fz) + 2 + Math.random()*4;
    const phase = Math.random()*10;
    if (i < 12) {
        const l = new THREE.PointLight(0xffffaa, 0.7, 8);
        l.position.set(fx, fy, fz); scene.add(l);
        fireflyLights.push({ light: l, baseY: fy, phase });
    } else {
        const m = new THREE.Mesh(ffFakeGeo, ffFakeMat);
        m.position.set(fx, fy, fz); scene.add(m);
        fireflyFakes.push({ mesh: m, baseY: fy, phase });
    }
}

/* ===================================================== */
/* CONTROLS */
/* ===================================================== */

const controls = new PointerLockControls(camera, document.body);
document.body.addEventListener('click', () => controls.lock());

const velocity = new THREE.Vector3();
const keys = { z:false, s:false, q:false, d:false, shift:false };
let jumpVel=0, grounded=true, stamina=100;

addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = true;
    if (e.shiftKey) keys.shift = true;
    if (e.code === 'Space' && grounded) { grounded=false; jumpVel=0.28; }
});
addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = false;
    if (!e.shiftKey) keys.shift = false;
});

/* ===================================================== */
/* MOUVEMENT */
/* ===================================================== */

const _fwd = new THREE.Vector3(), _right = new THREE.Vector3();

function updateMovement() {
    const running = keys.shift && stamina > 0 && keys.z;
    stamina = running ? stamina - 0.45 : Math.min(100, stamina + 0.2);
    document.getElementById('sp').style.width = stamina + '%';

    _fwd.set(0,0,-1).applyQuaternion(camera.quaternion);
    _right.set(1,0,0).applyQuaternion(camera.quaternion);
    _fwd.y = 0; _right.y = 0; _fwd.normalize(); _right.normalize();

    const accel = running ? 0.05 : 0.025;
    if (keys.z) velocity.addScaledVector(_fwd,    accel);
    if (keys.s) velocity.addScaledVector(_fwd,   -accel);
    if (keys.q) velocity.addScaledVector(_right, -accel);
    if (keys.d) velocity.addScaledVector(_right,  accel);
    velocity.multiplyScalar(0.9);

    let nx = camera.position.x + velocity.x;
    let nz = camera.position.z + velocity.z;

    for (const c of colliders) {
        const dx = nx-c.x, dz = nz-c.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        if (dist < c.r) {
            const a = Math.atan2(dz, dx);
            nx = c.x + Math.cos(a)*c.r;
            nz = c.z + Math.sin(a)*c.r;
            velocity.multiplyScalar(0.6);
        }
    }

    camera.position.x = nx;
    camera.position.z = nz;

    const groundY = findY(nx, nz) + 1.8;
    jumpVel -= 0.012;
    camera.position.y += jumpVel;
    if (camera.position.y < groundY) {
        camera.position.y = groundY;
        grounded = true; jumpVel = 0;
    }
}

/* ===================================================== */
/* ANIMATION */
/* ===================================================== */

let frameCount = 0;

function animate(t) {
    requestAnimationFrame(animate);
    t *= 0.001; frameCount++;

    for (const w of windObjects)
        w.mesh.rotation.z = Math.sin(t * w.speed + w.phase) * w.amp;

    for (const f of fireflyLights) {
        f.light.position.y  = f.baseY + Math.sin(t + f.phase) * 0.5;
        f.light.position.x += Math.cos(t * 0.3 + f.phase) * 0.01;
    }
    for (const f of fireflyFakes) {
        f.mesh.position.y  = f.baseY + Math.sin(t + f.phase) * 0.5;
        f.mesh.position.x += Math.cos(t * 0.3 + f.phase) * 0.01;
    }

    if (frameCount % 2 === 0) {
        for (let i = 0; i < SCENT_TOTAL; i++) {
            scentPos[i*3+1] += 0.003;
            scentPos[i*3]   += Math.sin(t*0.8 + scentPhase[i]) * 0.001;
            if (scentPos[i*3+1] > scentBaseY[i] + 3.5) {
                scentPos[i*3]   = scentBaseXZ[i*2]   + (Math.random()-.5)*.6;
                scentPos[i*3+1] = scentBaseY[i];
                scentPos[i*3+2] = scentBaseXZ[i*2+1] + (Math.random()-.5)*.6;
            }
        }
        scentGeo.attributes.position.needsUpdate = true;
        scentMat.opacity = 0.12 + Math.sin(t*1.2)*0.06;
    }

    if (controls.isLocked) updateMovement();
    renderer.render(scene, camera);
}

animate();

/* ===================================================== */
/* RESIZE */
/* ===================================================== */

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

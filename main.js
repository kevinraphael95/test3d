import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';

/* ===================================================== */
/* SCENE                                                  */
/* ===================================================== */

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xc8d8e8, 0.0022);

/* ===================================================== */
/* SKYBOX — style Skyrim : gradient + disque soleil       */
/* ===================================================== */

const SUN_DIR = new THREE.Vector3(0.45, 0.35, -0.82).normalize();

const skyGeo = new THREE.SphereGeometry(2800, 32, 16);
const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
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
        }
    `,
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
        }
    `
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

/* ===================================================== */
/* CAMERA                                                 */
/* ===================================================== */

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 2800);
camera.position.set(0, 10, 0);

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
/* LUMIERE — alignée avec la skybox                       */
/* ===================================================== */

scene.add(new THREE.HemisphereLight(0xc8ddf5, 0x2a3d1a, 0.85));

const sun = new THREE.DirectionalLight(0xfff5d0, 2.6);
sun.position.copy(SUN_DIR).multiplyScalar(500);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -280;
sun.shadow.camera.right = sun.shadow.camera.top   =  280;
sun.shadow.bias = -0.0003;
scene.add(sun);

/* ===================================================== */
/* TERRAIN                                                */
/* ===================================================== */

const TERRAIN_SIZE = 1200;
const TERRAIN_SEGS = 140;

const groundGeo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGS, TERRAIN_SEGS);
const gpos = groundGeo.attributes.position.array;
for (let i = 0; i < gpos.length; i += 3) {
    const x = gpos[i], z = gpos[i + 1];
    gpos[i + 2] =
        Math.sin(x * 0.025) * 8 +
        Math.cos(z * 0.020) * 6 +
        Math.sin((x + z) * 0.01) * 12;
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
/* HEIGHTMAP CACHE O(1)                                   */
/* ===================================================== */

const HM_RES  = 256;
const HM_HALF = TERRAIN_SIZE / 2;
const heightCache = new Float32Array(HM_RES * HM_RES);
{
    const _r = new THREE.Raycaster();
    for (let iz = 0; iz < HM_RES; iz++) {
        for (let ix = 0; ix < HM_RES; ix++) {
            const wx = -HM_HALF + (ix / (HM_RES - 1)) * TERRAIN_SIZE;
            const wz = -HM_HALF + (iz / (HM_RES - 1)) * TERRAIN_SIZE;
            _r.ray.origin.set(wx, 300, wz);
            _r.ray.direction.set(0, -1, 0);
            const hit = _r.intersectObject(ground);
            heightCache[iz * HM_RES + ix] = hit.length ? hit[0].point.y : 0;
        }
    }
}

function findY(x, z) {
    const fx = (x + HM_HALF) / TERRAIN_SIZE * (HM_RES - 1);
    const fz = (z + HM_HALF) / TERRAIN_SIZE * (HM_RES - 1);
    const ix = Math.max(0, Math.min(HM_RES - 2, fx | 0));
    const iz = Math.max(0, Math.min(HM_RES - 2, fz | 0));
    const tx = fx - ix, tz = fz - iz;
    const h00 = heightCache[ iz      * HM_RES + ix    ];
    const h10 = heightCache[ iz      * HM_RES + ix + 1];
    const h01 = heightCache[(iz + 1) * HM_RES + ix    ];
    const h11 = heightCache[(iz + 1) * HM_RES + ix + 1];
    return h00*(1-tx)*(1-tz) + h10*tx*(1-tz) + h01*(1-tx)*tz + h11*tx*tz;
}

/* ===================================================== */
/* PHYSIQUE 3D — capsule player, sphères statiques        */
/* Spatial grid pour broad phase                          */
/* ===================================================== */

const PLAYER_RADIUS = 0.5;
const PLAYER_HEIGHT = 1.8;
const GRAVITY       = -18;
const JUMP_VEL      =  7;

const playerVel = new THREE.Vector3();
let grounded = false;

const staticSpheres = []; // { cx, cy, cz, r }
const GRID_CELL = 20;
const gridMap   = new Map();

function _gridKey(x, z) {
    return `${Math.floor(x / GRID_CELL)},${Math.floor(z / GRID_CELL)}`;
}

function addStaticSphere(cx, cy, cz, r) {
    const idx = staticSpheres.length;
    staticSpheres.push({ cx, cy, cz, r });
    // Enregistrer dans toutes les cellules touchées
    const cells = new Set();
    for (let ddx = -1; ddx <= 1; ddx++)
    for (let ddz = -1; ddz <= 1; ddz++)
        cells.add(_gridKey(cx + ddx * r, cz + ddz * r));
    for (const k of cells) {
        if (!gridMap.has(k)) gridMap.set(k, []);
        gridMap.get(k).push(idx);
    }
}

function resolveCapsuleSphere(s) {
    // Segment de la capsule : [cy_lo, cy_hi]
    const cy_lo = camera.position.y - PLAYER_HEIGHT + PLAYER_RADIUS;
    const cy_hi = camera.position.y - PLAYER_RADIUS;
    const ccy   = Math.max(cy_lo, Math.min(cy_hi, s.cy));

    const dx = camera.position.x - s.cx;
    const dy = camera.position.y - ccy;
    const dz = camera.position.z - s.cz;
    const dist2 = dx*dx + dy*dy + dz*dz;
    const minD  = s.r + PLAYER_RADIUS;
    if (dist2 >= minD * minD) return;

    const dist = Math.sqrt(dist2) || 0.001;
    const pen  = minD - dist;
    camera.position.x += (dx / dist) * pen;
    camera.position.z += (dz / dist) * pen;

    const vDot = playerVel.x * (dx/dist) + playerVel.z * (dz/dist);
    if (vDot < 0) {
        playerVel.x -= vDot * (dx/dist);
        playerVel.z -= vDot * (dz/dist);
    }
}

/* ===================================================== */
/* SYSTEMES                                               */
/* ===================================================== */

const windObjects = [];
const scentLines  = [];
const fireflyList = [];

/* ===================================================== */
/* GRASS — instanced                                      */
/* ===================================================== */

const grassMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.02, 0.05, 1.2, 3),
    new THREE.MeshStandardMaterial({ color: 0x3f6b2d }),
    2500
);
scene.add(grassMesh);
{
    const d = new THREE.Object3D();
    for (let i = 0; i < 2500; i++) {
        const gx = (Math.random()-.5)*900, gz = (Math.random()-.5)*900;
        d.position.set(gx, findY(gx,gz)+0.5, gz);
        d.scale.setScalar(0.7 + Math.random()*1.8);
        d.rotation.y = Math.random()*Math.PI;
        d.updateMatrix();
        grassMesh.setMatrixAt(i, d.matrix);
    }
}

/* ===================================================== */
/* FLEURS + LIGNES D'ODEUR                                */
/* ===================================================== */

const FLOWER_COLORS = [0xff4444, 0x4444ff, 0xffff55, 0xdddddd, 0xff66cc];
const WIND_DIR = new THREE.Vector2(1.0, 0.3).normalize().multiplyScalar(1.4);

function spawnScentLines(x, y, z, color) {
    const trailCount = 2 + (Math.random()*2|0);
    for (let t = 0; t < trailCount; t++) {
        const SEG = 8;
        const pts = [];
        for (let i = 0; i <= SEG; i++) pts.push(new THREE.Vector3());
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: 0.15 + Math.random()*0.12,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const line = new THREE.Line(geo, mat);
        scene.add(line);
        scentLines.push({
            line, geo,
            baseX: x, baseY: y+0.85, baseZ: z,
            phase:  Math.random()*Math.PI*2,
            speed:  0.4 + Math.random()*0.6,
            driftX: (Math.random()-.5)*1.2,
            driftZ: (Math.random()-.5)*0.4,
            offset: Math.random()*3,
            SEG
        });
    }
}

function spawnFlower(x, z) {
    const y = findY(x, z);
    const g = new THREE.Group();
    const color = FLOWER_COLORS[Math.random()*FLOWER_COLORS.length|0];

    const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.03, 0.7, 5),
        new THREE.MeshStandardMaterial({ color: 0x2d4c1e })
    );
    stem.position.y = 0.35;

    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 6),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.1 })
    );
    head.position.y = 0.8;

    g.add(stem, head);
    g.position.set(x, y, z);
    scene.add(g);
    windObjects.push({ mesh: g, phase: Math.random()*5, speed: 2, amp: 0.04 });
    spawnScentLines(x, y, z, color);
}

/* ===================================================== */
/* ROCHERS                                                */
/* ===================================================== */

function spawnRock(x, z) {
    const y    = findY(x, z);
    const size = 1 + Math.random()*2;
    const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(size, 0),
        new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 1 })
    );
    rock.position.set(x, y + size*0.3, z);
    rock.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
    rock.scale.y = 0.6;
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
    addStaticSphere(x, y + size*0.3, z, size*0.9);
}

/* ===================================================== */
/* ARBRES — racines vers le bas                           */
/* ===================================================== */

const trunkMat = new THREE.MeshStandardMaterial({ color: 0x1a0f0a });
const rootMat  = new THREE.MeshStandardMaterial({ color: 0x22150f });
const leafMats = [
    new THREE.MeshStandardMaterial({ color: 0x0f240f }),
    new THREE.MeshStandardMaterial({ color: 0x163016 }),
    new THREE.MeshStandardMaterial({ color: 0x1c3d1c }),
];

function spawnTree(x, z) {
    const y      = findY(x, z);
    const tree   = new THREE.Group();
    const height = 18 + Math.random()*18;
    const tr     = 1  + Math.random()*0.6;

    // Tronc prolongé vers le bas pour masquer les gaps de terrain
    const trunkMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(tr*0.55, tr*1.1, height+10, 8),
        trunkMat
    );
    trunkMesh.position.y = height/2 - 5;
    trunkMesh.castShadow = true;
    tree.add(trunkMesh);

    // Racines — pivotent depuis la base du tronc, plongent vers le sol
    const ROOT_N = 5;
    for (let i = 0; i < ROOT_N; i++) {
        const angle  = (Math.PI*2/ROOT_N)*i;
        const rLen   = 2.5 + Math.random()*1.5;
        const rThick = 0.12 + Math.random()*0.08;

        const pivot = new THREE.Group();
        // Positionné à la base du tronc, côté extérieur
        pivot.position.set(
            Math.cos(angle) * tr*0.85,
            0.1,
            Math.sin(angle) * tr*0.85
        );
        pivot.rotation.y = angle;
        // Inclinaison : >90° = plonge sous l'horizontal (vers le bas du sol)
        pivot.rotation.z = Math.PI/2 + 0.75 + Math.random()*0.35;

        const rootMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(rThick*0.35, rThick, rLen, 5),
            rootMat
        );
        // La base du cylindre (grosse) est au pivot, la pointe va vers le bas
        rootMesh.position.y = -rLen/2;
        pivot.add(rootMesh);
        tree.add(pivot);
    }

    // Feuillage cônes empilés
    const layers = 7 + (Math.random()*4|0);
    for (let i = 0; i < layers; i++) {
        const ratio = i/layers;
        const size  = (1-ratio)*(tr*7)+2;
        const cone  = new THREE.Mesh(
            new THREE.ConeGeometry(size, 7, 8),
            leafMats[Math.random()*3|0]
        );
        cone.position.y = height*0.28 + ratio*height*0.75;
        cone.castShadow = true;
        tree.add(cone);
        windObjects.push({ mesh: cone, phase: Math.random()*10, speed: 0.5, amp: 0.015 });
    }

    tree.position.set(x, y, z);
    scene.add(tree);

    // 2 sphères de collision sur la hauteur du tronc
    addStaticSphere(x, y+4,  z, tr+1.0);
    addStaticSphere(x, y+12, z, tr+0.8);
}

/* ===================================================== */
/* LUCIOLES                                               */
/* ===================================================== */

function spawnFirefly() {
    const light = new THREE.PointLight(0xffffaa, 0.65, 9);
    const fx = (Math.random()-.5)*800, fz = (Math.random()-.5)*800;
    const fy = findY(fx,fz)+2+Math.random()*4;
    light.position.set(fx, fy, fz);
    scene.add(light);
    fireflyList.push({ light, baseY: fy, baseX: fx, baseZ: fz, phase: Math.random()*10 });
}

/* ===================================================== */
/* GENERATION DU MONDE                                    */
/* ===================================================== */

for (let i=0; i<170; i++) spawnTree((Math.random()-.5)*900, (Math.random()-.5)*900);
for (let i=0; i<600; i++) spawnFlower((Math.random()-.5)*700, (Math.random()-.5)*700);
for (let i=0; i<120; i++) spawnRock((Math.random()-.5)*800, (Math.random()-.5)*800);
for (let i=0; i< 60; i++) spawnFirefly();

/* ===================================================== */
/* CONTROLS                                               */
/* ===================================================== */

const controls = new PointerLockControls(camera, document.body);
document.body.addEventListener('click', () => controls.lock());

const keys = { z:false, s:false, q:false, d:false, shift:false };
let stamina = 100;

addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = true;
    if (e.shiftKey) keys.shift = true;
    if (e.code==='Space' && grounded) { playerVel.y = JUMP_VEL; grounded = false; }
});
addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = false;
    if (!e.shiftKey) keys.shift = false;
});

/* ===================================================== */
/* PHYSIQUE                                               */
/* ===================================================== */

const _fwd   = new THREE.Vector3();
const _right = new THREE.Vector3();
const MOVE_ACCEL = 28;
const MOVE_DRAG  = 8;

let lastTime = performance.now();

function physicsStep(dt) {
    const running = keys.shift && stamina>0 && keys.z;
    stamina = running ? Math.max(0, stamina-45*dt) : Math.min(100, stamina+20*dt);
    document.getElementById('sp').style.width = stamina+'%';

    _fwd.set(0,0,-1).applyQuaternion(camera.quaternion); _fwd.y=0; _fwd.normalize();
    _right.set(1,0,0).applyQuaternion(camera.quaternion); _right.y=0; _right.normalize();

    const spd = MOVE_ACCEL * (running ? 1.8 : 1);
    if (keys.z) { playerVel.x += _fwd.x*spd*dt;   playerVel.z += _fwd.z*spd*dt;   }
    if (keys.s) { playerVel.x -= _fwd.x*spd*dt;   playerVel.z -= _fwd.z*spd*dt;   }
    if (keys.q) { playerVel.x -= _right.x*spd*dt; playerVel.z -= _right.z*spd*dt; }
    if (keys.d) { playerVel.x += _right.x*spd*dt; playerVel.z += _right.z*spd*dt; }

    const drag = Math.exp(-MOVE_DRAG*dt);
    playerVel.x *= drag;
    playerVel.z *= drag;
    if (!grounded) playerVel.y += GRAVITY*dt;

    camera.position.x += playerVel.x*dt;
    camera.position.y += playerVel.y*dt;
    camera.position.z += playerVel.z*dt;

    // Broad phase grid + résolution capsule/sphère
    const near = gridMap.get(_gridKey(camera.position.x, camera.position.z)) || [];
    for (const idx of near) resolveCapsuleSphere(staticSpheres[idx]);

    // Terrain
    const gy = findY(camera.position.x, camera.position.z) + PLAYER_HEIGHT;
    if (camera.position.y <= gy) {
        camera.position.y = gy;
        if (playerVel.y < 0) playerVel.y = 0;
        grounded = true;
    } else {
        grounded = false;
    }
}

/* ===================================================== */
/* ANIMATION LIGNES D'ODEUR                              */
/* ===================================================== */

function updateScentLines(t) {
    for (const s of scentLines) {
        const pts = s.geo.attributes.position;
        const age = t*s.speed + s.offset;

        for (let i = 0; i <= s.SEG; i++) {
            const r = i/s.SEG;
            pts.setXYZ(i,
                s.baseX + WIND_DIR.x*r*2.5 + s.driftX*r + Math.sin(age + r*3.0)*0.3,
                s.baseY + r*2.2             + Math.sin(age*1.3 + r*2)*0.18,
                s.baseZ + WIND_DIR.y*r*2.5 + s.driftZ*r + Math.cos(age*0.9 + r*2.5)*0.22
            );
        }
        pts.needsUpdate = true;

        // Opacité : fondu entrée/sortie par cycle
        const cycle = ((t*s.speed + s.offset) % (Math.PI*2)) / (Math.PI*2);
        s.line.material.opacity =
            (0.10 + Math.sin(t*0.8+s.phase)*0.05) * Math.sin(cycle*Math.PI);

        // Reset aléatoire à chaque cycle pour variation
        if (cycle < s.speed*0.016) {
            s.driftX = (Math.random()-.5)*1.2;
            s.driftZ = (Math.random()-.5)*0.4;
        }
    }
}

/* ===================================================== */
/* BOUCLE PRINCIPALE                                      */
/* ===================================================== */

function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min((now-lastTime)/1000, 0.05);
    lastTime = now;
    const t  = now*0.001;

    for (const w of windObjects)
        w.mesh.rotation.z = Math.sin(t*w.speed+w.phase)*w.amp;

    for (const f of fireflyList) {
        f.light.position.y = f.baseY + Math.sin(t+f.phase)*0.6;
        f.light.position.x = f.baseX + Math.cos(t*0.25+f.phase)*2;
        f.light.position.z = f.baseZ + Math.sin(t*0.2+f.phase)*2;
        f.light.intensity  = 0.4 + Math.sin(t*3+f.phase)*0.25;
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
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});

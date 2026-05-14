import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';
import { mergeGeometries } from 'https://unpkg.com/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js';

/* ===================================================== */
/* HEIGHTMAP — formule mathématique directe              */
/* PlaneGeometry avant rotation: x=X, y=Z, z=hauteur    */
/* Après rotation.x=-PI/2 : x=X, y=hauteur, z=Z         */
/* ===================================================== */

function findY(x, z) {
    return Math.sin(x * 0.025) * 8
         + Math.cos(z * 0.020) * 6
         + Math.sin((x + z) * 0.01) * 12;
}

/* ===================================================== */
/* SCENE                                                  */
/* ===================================================== */

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xb8cfe0, 0.0028);

/* ===================================================== */
/* SKYBOX                                                 */
/* ===================================================== */

const SUN_DIR = new THREE.Vector3(0.45, 0.35, -0.82).normalize();

scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(2400, 20, 12),
    new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { sunDir: { value: SUN_DIR } },
        vertexShader: `
            varying vec3 vDir;
            void main(){
                vDir = normalize((modelMatrix * vec4(position,1.0)).xyz);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 sunDir;
            varying vec3 vDir;
            void main(){
                float h = clamp(vDir.y, -1.0, 1.0);
                vec3 top   = vec3(0.10, 0.24, 0.50);
                vec3 mid   = vec3(0.40, 0.66, 0.85);
                vec3 horiz = vec3(0.80, 0.90, 0.97);
                vec3 sky   = mix(horiz, mid,  smoothstep(0.0, 0.20, h));
                sky        = mix(sky,   top,  smoothstep(0.15, 0.70, h));
                sky        = mix(vec3(0.06,0.04,0.03), sky, smoothstep(-0.05, 0.0, h));
                float d    = dot(normalize(vDir), normalize(sunDir));
                vec3 sun   = vec3(1.0, 0.97, 0.88);
                sky += sun * smoothstep(0.9992, 1.000, d);
                sky += sun * smoothstep(0.994,  0.999, d) * 0.5;
                sky += sun * smoothstep(0.97,   0.994, d) * 0.1;
                gl_FragColor = vec4(sky, 1.0);
            }
        `
    })
));

/* ===================================================== */
/* CAMERA                                                 */
/* ===================================================== */

const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 1400);
camera.position.set(0, findY(0,0) + 1.8, 0);

/* ===================================================== */
/* RENDERER                                               */
/* ===================================================== */

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

/* ===================================================== */
/* LUMIERES                                               */
/* ===================================================== */

scene.add(new THREE.HemisphereLight(0xd0e8ff, 0x3a4a20, 1.4));
const sun = new THREE.DirectionalLight(0xfff5d0, 2.2);
sun.position.copy(SUN_DIR).multiplyScalar(500);
scene.add(sun);

/* ===================================================== */
/* TERRAIN                                                */
/* PlaneGeometry non-rotaté: positions[i]=x, [i+1]=z_local (futur Z monde), [i+2]=hauteur
   Après rotation.x=-PI/2: x reste x, y devient la hauteur, z devient le z monde          */
/* ===================================================== */

const groundGeo = new THREE.PlaneGeometry(1200, 1200, 80, 80);
{
    const p = groundGeo.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
        // Dans PlaneGeometry avant rotation: p[i]=X, p[i+1]=Y_plan (= futur -Z monde), p[i+2]=Z_plan
        // On met la hauteur dans p[i+2] (l'axe qui deviendra Y après rotation)
        const wx = p[i];
        const wz = p[i+1]; // avant rotation c'est Y local = futur Z monde (avec signe)
        p[i+2] = findY(wx, wz);
    }
    groundGeo.computeVertexNormals();
}

const ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshLambertMaterial({ color: 0x2d4a1e })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

/* ===================================================== */
/* PHYSIQUE — capsule + sphères + spatial grid            */
/* ===================================================== */

const PLAYER_R = 0.5, PLAYER_H = 1.8;
const GRAVITY = -18, JUMP_VEL = 7;
const playerVel = new THREE.Vector3();
let grounded = false;

const staticSpheres = [];
const CELL = 20;
const grid = new Map();

function gkey(x, z) { return `${Math.floor(x/CELL)},${Math.floor(z/CELL)}`; }

function addSphere(cx, cy, cz, r) {
    const idx = staticSpheres.length;
    staticSpheres.push({ cx, cy, cz, r });
    const cells = new Set();
    for (let a=-1; a<=1; a++) for (let b=-1; b<=1; b++) cells.add(gkey(cx+a*r, cz+b*r));
    for (const k of cells) { if (!grid.has(k)) grid.set(k,[]); grid.get(k).push(idx); }
}

function resolveVsSphere(s) {
    const lo = camera.position.y - PLAYER_H + PLAYER_R;
    const hi = camera.position.y - PLAYER_R;
    const cy = Math.max(lo, Math.min(hi, s.cy));
    const dx = camera.position.x - s.cx;
    const dy = camera.position.y - cy;
    const dz = camera.position.z - s.cz;
    const d2 = dx*dx + dy*dy + dz*dz;
    const mn = s.r + PLAYER_R;
    if (d2 >= mn*mn) return;
    const d = Math.sqrt(d2) || 0.001;
    const p = mn - d;
    camera.position.x += dx/d*p;
    camera.position.z += dz/d*p;
    const vd = playerVel.x*(dx/d) + playerVel.z*(dz/d);
    if (vd < 0) { playerVel.x -= vd*(dx/d); playerVel.z -= vd*(dz/d); }
}

/* ===================================================== */
/* HELPERS — merge + add scene                           */
/* ===================================================== */

function mergeAdd(geos, mat) {
    if (!geos.length) return;
    const m = mergeGeometries(geos, false);
    if (m) scene.add(new THREE.Mesh(m, mat));
    geos.forEach(g => g.dispose());
}

/* ===================================================== */
/* GRASS — instanced                                      */
/* ===================================================== */

const GRASS_N = 1500;
const gMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.02, 0.05, 1.0, 3, 1),
    new THREE.MeshLambertMaterial({ color: 0x4a7a30 }),
    GRASS_N
);
scene.add(gMesh);
{
    const d = new THREE.Object3D();
    for (let i = 0; i < GRASS_N; i++) {
        const gx = (Math.random()-.5)*800, gz = (Math.random()-.5)*800;
        d.position.set(gx, findY(gx,gz) + 0.4, gz);
        d.scale.setScalar(0.5 + Math.random()*1.4);
        d.rotation.y = Math.random()*Math.PI;
        d.updateMatrix();
        gMesh.setMatrixAt(i, d.matrix);
    }
    gMesh.instanceMatrix.needsUpdate = true;
}

/* ===================================================== */
/* FLEURS — instanced têtes + merged tiges + scent lines  */
/* ===================================================== */

const FCOLS = [0xff3333, 0x4466ff, 0xffee44, 0xdddddd, 0xff55bb];
const FLOWER_N = 350;
const SEG = 6;
const WIND = new THREE.Vector2(1.0, 0.3).normalize().multiplyScalar(1.2);

const fMeshes = FCOLS.map(c => {
    const m = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.12, 5, 4),
        new THREE.MeshLambertMaterial({ color: c, emissive: new THREE.Color(c).multiplyScalar(0.2) }),
        Math.ceil(FLOWER_N / FCOLS.length) + 2
    );
    m.frustumCulled = true;
    scene.add(m);
    return m;
});

const scentLines = [];
const stemGeos   = [];
const stemMat    = new THREE.MeshLambertMaterial({ color: 0x2d5a1e });
const fcounters  = new Array(FCOLS.length).fill(0);
const fDummy     = new THREE.Object3D();

for (let i = 0; i < FLOWER_N; i++) {
    const fx = (Math.random()-.5)*700, fz = (Math.random()-.5)*700;
    const fy = findY(fx, fz);
    const ci = Math.random()*FCOLS.length | 0;

    fDummy.position.set(fx, fy+0.8, fz);
    fDummy.updateMatrix();
    fMeshes[ci].setMatrixAt(fcounters[ci]++, fDummy.matrix);

    const sg = new THREE.CylinderGeometry(0.02, 0.03, 0.7, 4, 1);
    sg.translate(fx, fy+0.35, fz);
    stemGeos.push(sg);

    const pts = [];
    for (let s = 0; s <= SEG; s++) pts.push(new THREE.Vector3());
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
        color: FCOLS[ci], transparent: true, opacity: 0.0,
        depthWrite: false, blending: THREE.AdditiveBlending
    }));
    scene.add(line);
    scentLines.push({
        line, geo,
        bx: fx, by: fy+0.85, bz: fz,
        phase: Math.random()*Math.PI*2,
        speed: 0.3 + Math.random()*0.5,
        dx: (Math.random()-.5)*0.9,
        dz: (Math.random()-.5)*0.3,
        off: Math.random()*3
    });
}

fMeshes.forEach((m, i) => { m.count = fcounters[i]; m.instanceMatrix.needsUpdate = true; });
mergeAdd(stemGeos, stemMat);

/* ===================================================== */
/* ROCHERS — instanced                                    */
/* ===================================================== */

const ROCK_N = 80;
const rkMesh = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshLambertMaterial({ color: 0x777788 }),
    ROCK_N
);
rkMesh.frustumCulled = true;
scene.add(rkMesh);
{
    const d = new THREE.Object3D();
    for (let i = 0; i < ROCK_N; i++) {
        const rx = (Math.random()-.5)*800, rz = (Math.random()-.5)*800;
        const ry = findY(rx, rz);
        const s  = 0.8 + Math.random()*1.8;
        d.position.set(rx, ry + s*0.3, rz);
        d.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
        d.scale.set(s, s*0.6, s);
        d.updateMatrix();
        rkMesh.setMatrixAt(i, d.matrix);
        addSphere(rx, ry+s*0.3, rz, s*0.9);
    }
    rkMesh.instanceMatrix.needsUpdate = true;
}

/* ===================================================== */
/* ARBRES — tout mergé                                    */
/* Racines vers le bas via rotation sur l'axe Z local     */
/* ===================================================== */

const TREE_N  = 100;
const trunkGs = [], rootGs = [], leafGs = [[], [], []];
const trunkMat = new THREE.MeshLambertMaterial({ color: 0x2a1a0a });
const rootMat  = new THREE.MeshLambertMaterial({ color: 0x1e1208 });
const leafMats = [0x0f2a0f, 0x163a16, 0x1e4a1e].map(c =>
    new THREE.MeshLambertMaterial({ color: c })
);

for (let i = 0; i < TREE_N; i++) {
    const tx = (Math.random()-.5)*900, tz = (Math.random()-.5)*900;
    const ty = findY(tx, tz);
    const h  = 18 + Math.random()*18;
    const tr = 1  + Math.random()*0.6;

    // Tronc — prolongé sous terre pour masquer gaps
    const tg = new THREE.CylinderGeometry(tr*0.5, tr*1.1, h+10, 7, 1);
    tg.translate(tx, ty + h/2 - 5, tz);
    trunkGs.push(tg);

    // Racines — 5 pattes qui plongent vers le sol
    // On crée un cylindre vertical, on le penche vers le bas, on le place
    for (let r = 0; r < 5; r++) {
        const ang  = (Math.PI*2/5)*r;
        const rLen = 2.0 + Math.random()*1.2;
        const rT   = 0.08 + Math.random()*0.07;

        // Cylindre de base (vertical, centre à l'origine)
        const rg = new THREE.CylinderGeometry(rT*0.3, rT, rLen, 4, 1);

        // 1) Pencher fortement vers le bas : rotation Z de ~120° (30° sous le sol)
        rg.rotateZ(Math.PI/2 + 0.9 + Math.random()*0.25);
        // 2) Orienter autour de l'arbre
        rg.rotateY(ang);
        // 3) Placer au pied du tronc, légèrement sous la surface
        rg.translate(
            tx + Math.cos(ang) * tr * 0.9,
            ty - rLen * 0.45,
            tz + Math.sin(ang) * tr * 0.9
        );
        rootGs.push(rg);
    }

    // Feuillage cônes empilés
    const layers = 5 + (Math.random()*3|0);
    for (let l = 0; l < layers; l++) {
        const ratio = l / layers;
        const size  = (1-ratio)*(tr*6) + 1.5;
        const ci    = Math.random()*3 | 0;
        const cg    = new THREE.ConeGeometry(size, 6, 7, 1);
        cg.translate(tx, ty + h*0.28 + ratio*h*0.75, tz);
        leafGs[ci].push(cg);
    }

    addSphere(tx, ty+5,  tz, tr+1.0);
    addSphere(tx, ty+13, tz, tr+0.7);
}

mergeAdd(trunkGs, trunkMat);
mergeAdd(rootGs,  rootMat);
for (let i = 0; i < 3; i++) mergeAdd(leafGs[i], leafMats[i]);

/* ===================================================== */
/* LUCIOLES                                               */
/* ===================================================== */

const fireflies = [];
for (let i = 0; i < 20; i++) {
    const light = new THREE.PointLight(0xffffaa, 0.5, 10);
    const fx = (Math.random()-.5)*600, fz = (Math.random()-.5)*600;
    const fy = findY(fx,fz) + 2 + Math.random()*4;
    light.position.set(fx, fy, fz);
    scene.add(light);
    fireflies.push({ light, bx: fx, bz: fz, by: fy, phase: Math.random()*10 });
}

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
    if (e.code === 'Space' && grounded) { playerVel.y = JUMP_VEL; grounded = false; }
});
addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = false;
    if (!e.shiftKey) keys.shift = false;
});

/* ===================================================== */
/* PHYSIQUE                                               */
/* ===================================================== */

const _fwd = new THREE.Vector3(), _right = new THREE.Vector3();
const ACCEL = 28, DRAG = 8;
let lastTime = performance.now();

function physicsStep(dt) {
    const run = keys.shift && stamina > 0 && keys.z;
    stamina = run ? Math.max(0, stamina-45*dt) : Math.min(100, stamina+20*dt);
    document.getElementById('sp').style.width = stamina + '%';

    _fwd.set(0,0,-1).applyQuaternion(camera.quaternion); _fwd.y=0; _fwd.normalize();
    _right.set(1,0,0).applyQuaternion(camera.quaternion); _right.y=0; _right.normalize();

    const spd = ACCEL * (run ? 1.8 : 1);
    if (keys.z) { playerVel.x += _fwd.x*spd*dt;   playerVel.z += _fwd.z*spd*dt; }
    if (keys.s) { playerVel.x -= _fwd.x*spd*dt;   playerVel.z -= _fwd.z*spd*dt; }
    if (keys.q) { playerVel.x -= _right.x*spd*dt; playerVel.z -= _right.z*spd*dt; }
    if (keys.d) { playerVel.x += _right.x*spd*dt; playerVel.z += _right.z*spd*dt; }

    playerVel.x *= Math.exp(-DRAG*dt);
    playerVel.z *= Math.exp(-DRAG*dt);
    if (!grounded) playerVel.y += GRAVITY * dt;

    camera.position.addScaledVector(playerVel, dt);

    const near = grid.get(gkey(camera.position.x, camera.position.z)) || [];
    for (const idx of near) resolveVsSphere(staticSpheres[idx]);

    const gy = findY(camera.position.x, camera.position.z) + PLAYER_H;
    if (camera.position.y <= gy) {
        camera.position.y = gy;
        if (playerVel.y < 0) playerVel.y = 0;
        grounded = true;
    } else {
        grounded = false;
    }
}

/* ===================================================== */
/* SCENT LINES                                            */
/* ===================================================== */

function updateScent(t) {
    for (const s of scentLines) {
        const pts = s.geo.attributes.position;
        const age = t * s.speed + s.off;
        for (let i = 0; i <= SEG; i++) {
            const r = i / SEG;
            pts.setXYZ(i,
                s.bx + WIND.x*r*2.0 + s.dx*r + Math.sin(age + r*2.8)*0.22,
                s.by + r*1.8        + Math.sin(age*1.1 + r*1.6)*0.13,
                s.bz + WIND.y*r*2.0 + s.dz*r + Math.cos(age*0.85 + r*2.2)*0.18
            );
        }
        pts.needsUpdate = true;
        const cycle = (age % (Math.PI*2)) / (Math.PI*2);
        s.line.material.opacity = (0.09 + Math.sin(t*0.6+s.phase)*0.04) * Math.max(0, Math.sin(cycle*Math.PI));
    }
}

/* ===================================================== */
/* BOUCLE                                                 */
/* ===================================================== */

function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    const t = now * 0.001;

    for (const f of fireflies) {
        f.light.position.y = f.by + Math.sin(t + f.phase)*0.6;
        f.light.position.x = f.bx + Math.cos(t*0.2 + f.phase)*1.5;
        f.light.position.z = f.bz + Math.sin(t*0.18 + f.phase)*1.5;
    }

    updateScent(t);
    if (controls.isLocked) physicsStep(dt);
    renderer.render(scene, camera);
}

animate(performance.now());

addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});

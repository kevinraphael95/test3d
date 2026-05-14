import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';

/* ===================================================== */
/* RENDERER                                               */
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
/* SCENE / CAMERA                                         */
/* ===================================================== */

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 10, 0);

/* ===================================================== */
/* SKYBOX DÉGRADÉ                                         */
/* ===================================================== */

// Skybox via shader sur une grande sphère inversée
const skyGeo = new THREE.SphereGeometry(1800, 16, 8);
skyGeo.scale(-1, 1, 1); // inverser pour voir de l'intérieur
const skyMat = new THREE.ShaderMaterial({
    uniforms: {
        topColor:    { value: new THREE.Color(0x1a3a6e) },
        horizonColor:{ value: new THREE.Color(0x87bcd4) },
        bottomColor: { value: new THREE.Color(0x3d5a2a) },
    },
    vertexShader: `
        varying vec3 vWorldPos;
        void main() {
            vWorldPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPos;
        void main() {
            float h = normalize(vWorldPos).y;
            vec3 col;
            if (h > 0.0) {
                col = mix(horizonColor, topColor, pow(h, 0.6));
            } else {
                col = mix(horizonColor, bottomColor, pow(-h, 0.4));
            }
            gl_FragColor = vec4(col, 1.0);
        }
    `,
    side: THREE.BackSide,
    depthWrite: false,
});
const skyMesh = new THREE.Mesh(skyGeo, skyMat);
scene.add(skyMesh);

/* ===================================================== */
/* FOG                                                    */
/* ===================================================== */

scene.fog = new THREE.FogExp2(0x9bb4c7, 0.004);

/* ===================================================== */
/* LUMIÈRES                                               */
/* ===================================================== */

scene.add(new THREE.HemisphereLight(0xddeeff, 0x3d2f1b, 1));

const sun = new THREE.DirectionalLight(0xfff2d6, 2.5);
sun.position.set(400, 500, 200);
sun.castShadow = true;
sun.shadow.mapSize.width = sun.shadow.mapSize.height = 2048;
sun.shadow.camera.left = sun.shadow.camera.bottom = -200;
sun.shadow.camera.right = sun.shadow.camera.top = 200;
sun.shadow.camera.far = 1500;
scene.add(sun);

/* ===================================================== */
/* SPRITE SOLEIL                                          */
/* ===================================================== */

const sunCanvas = document.createElement('canvas');
sunCanvas.width = sunCanvas.height = 128;
const ctx2d = sunCanvas.getContext('2d');
const grad = ctx2d.createRadialGradient(64, 64, 0, 64, 64, 64);
grad.addColorStop(0,   'rgba(255,255,200,1)');
grad.addColorStop(0.3, 'rgba(255,220,80,0.9)');
grad.addColorStop(0.7, 'rgba(255,160,30,0.3)');
grad.addColorStop(1,   'rgba(255,100,0,0)');
ctx2d.fillStyle = grad;
ctx2d.fillRect(0, 0, 128, 128);
const sunTex = new THREE.CanvasTexture(sunCanvas);

const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sunTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
}));
sunSprite.scale.set(120, 120, 1);
// Positionner dans la même direction que la directional light mais loin
const sunDir = sun.position.clone().normalize().multiplyScalar(1500);
sunSprite.position.copy(sunDir);
scene.add(sunSprite);

/* ===================================================== */
/* SIMPLEX NOISE                                          */
/* ===================================================== */

const SEED = Math.random() * 65536 | 0;
console.log('Terrain seed:', SEED);

function buildPermTable(seed) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
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
    const F2 = 0.5*(Math.sqrt(3)-1), G2 = (3-Math.sqrt(3))/6;
    const s=(xin+yin)*F2, i=Math.floor(xin+s)|0, j=Math.floor(yin+s)|0;
    const t=(i+j)*G2, X0=i-t, Y0=j-t;
    const x0=xin-X0, y0=yin-Y0;
    const i1=x0>y0?1:0, j1=x0>y0?0:1;
    const x1=x0-i1+G2, y1=y0-j1+G2, x2=x0-1+2*G2, y2=y0-1+2*G2;
    const ii=i&255, jj=j&255;
    const gi0=perm[ii+perm[jj]]%8;
    const gi1=perm[ii+i1+perm[jj+j1]]%8;
    const gi2=perm[ii+1+perm[jj+1]]%8;
    let n0=0,n1=0,n2=0;
    let t0=0.5-x0*x0-y0*y0; if(t0>=0){t0*=t0;n0=t0*t0*dot2(GRAD2[gi0],x0,y0);}
    let t1=0.5-x1*x1-y1*y1; if(t1>=0){t1*=t1;n1=t1*t1*dot2(GRAD2[gi1],x1,y1);}
    let t2=0.5-x2*x2-y2*y2; if(t2>=0){t2*=t2;n2=t2*t2*dot2(GRAD2[gi2],x2,y2);}
    return 70*(n0+n1+n2);
}

function fbm(x, z) {
    return (
        simplex2(x*0.002, z*0.002) * 14 +
        simplex2(x*0.008, z*0.008) * 5  +
        simplex2(x*0.025, z*0.025) * 1.5
    );
}

/* ===================================================== */
/* HEIGHTMAP CACHE infini par grille sparse               */
/* ===================================================== */

const hCache = new Map();
function heightAt(wx, wz) {
    const kx = Math.round(wx * 4), kz = Math.round(wz * 4);
    const key = kx + ',' + kz;
    let h = hCache.get(key);
    if (h === undefined) {
        h = fbm(wx, wz);
        hCache.set(key, h);
    }
    return h;
}

// Interpolation bilinéaire
function findY(wx, wz) {
    const step = 0.25;
    const x0 = Math.floor(wx/step)*step, z0 = Math.floor(wz/step)*step;
    const fu = (wx-x0)/step, fv = (wz-z0)/step;
    return (
        heightAt(x0,      z0)      * (1-fu)*(1-fv) +
        heightAt(x0+step, z0)      * fu*(1-fv)     +
        heightAt(x0,      z0+step) * (1-fu)*fv     +
        heightAt(x0+step, z0+step) * fu*fv
    );
}

/* ===================================================== */
/* CHUNKS                                                 */
/* ===================================================== */

const CHUNK_SIZE  = 80;   // unités monde par chunk
const CHUNK_SEGS  = 24;   // subdivisions
const CHUNK_RADIUS = 3;   // chunks visibles autour du joueur (carré 7x7)

const loadedChunks = new Map(); // clé "cx,cz" → { terrain, objects, colliders }

const trunkMat   = new THREE.MeshStandardMaterial({ color: 0x2a1a0e });
const coneMats   = [0x0f240f, 0x163016, 0x1c3d1c].map(c => new THREE.MeshStandardMaterial({ color: c }));
const rockMat    = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 1 });
const groundMat  = new THREE.MeshStandardMaterial({ color: 0x243b1d, roughness: 1 });
const stemMat    = new THREE.MeshStandardMaterial({ color: 0x2d4c1e });
const FLOWER_COLORS_HEX = [0xff4444, 0x4444ff, 0xffff55, 0xffffff, 0xff66cc];

// Systèmes globaux animation
const windObjects  = [];
const fireflyData  = [];
let   scentSystem  = null; // géré globalement

/* ===================================================== */
/* COLLIDERS 3D                                           */
/* Format:                                                */
/*   { type:'cylinder', x, y, z, r, h }  tronc arbre     */
/*   { type:'box',      x, y, z, hw, hh, hd }  rocher    */
/* ===================================================== */

const globalColliders = []; // tous les colliders actifs

/* ===================================================== */
/* GÉNÉRATION D'UN CHUNK                                  */
/* ===================================================== */

function chunkKey(cx, cz) { return cx + ',' + cz; }

function generateChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    if (loadedChunks.has(key)) return;

    const group = new THREE.Group();
    scene.add(group);

    const localColliders = [];

    // --- Terrain ---
    const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SEGS, CHUNK_SEGS);
    const vp = geo.attributes.position.array;
    const originX = cx * CHUNK_SIZE;
    const originZ = cz * CHUNK_SIZE;

    for (let i = 0; i < vp.length; i += 3) {
        const wx = originX + vp[i];
        const wz = originZ - vp[i+1]; // y_local = -z_monde avant rotation
        vp[i+2] = fbm(wx, wz);
    }
    geo.computeVertexNormals();

    const terrainMesh = new THREE.Mesh(geo, groundMat);
    terrainMesh.rotation.x = -Math.PI/2;
    terrainMesh.position.set(originX, 0, originZ);
    terrainMesh.receiveShadow = true;
    group.add(terrainMesh);

    // Seed déterministe par chunk pour reproductibilité
    const rng = seededRng(cx * 73856093 ^ cz * 19349663);

    // --- Arbres ---
    const treeCount = 5 + (rng() * 8 | 0);
    for (let i = 0; i < treeCount; i++) {
        const lx = (rng() - 0.5) * CHUNK_SIZE * 0.9;
        const lz = (rng() - 0.5) * CHUNK_SIZE * 0.9;
        const wx = originX + lx, wz = originZ + lz;
        const gy = findY(wx, wz);

        const treeGroup = new THREE.Group();

        const h  = 12 + rng() * 14;
        const tr = 0.4 + rng() * 0.4;
        const trunkH = h * 0.6;

        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(tr * 0.5, tr, trunkH + 4, 8),
            trunkMat
        );
        trunk.position.y = trunkH / 2 - 2;
        trunk.castShadow = true;
        treeGroup.add(trunk);

        const layers = 6 + (rng() * 4 | 0);
        for (let li = 0; li < layers; li++) {
            const ratio  = li / (layers - 1);
            const coneY  = ratio * h;
            const radius = tr * 8 * (1 - ratio * 0.75) + 1.5;
            const coneH  = h / layers * 1.8;

            const cone = new THREE.Mesh(
                new THREE.ConeGeometry(radius, coneH, 8),
                coneMats[(rng() * 3) | 0]
            );
            cone.position.y = coneY;
            cone.castShadow = true;
            treeGroup.add(cone);

            windObjects.push({ mesh: cone, phase: rng() * 10, speed: 0.5, amp: 0.012 });
        }

        treeGroup.position.set(wx, gy, wz);
        group.add(treeGroup);

        // Collider cylindre pour le tronc
        localColliders.push({
            type: 'cylinder',
            x: wx, y: gy, z: wz,
            r: tr * 1.4,
            h: trunkH + 4,
        });
    }

    // --- Rochers ---
    const rockCount = 3 + (rng() * 6 | 0);
    for (let i = 0; i < rockCount; i++) {
        const lx = (rng() - 0.5) * CHUNK_SIZE * 0.9;
        const lz = (rng() - 0.5) * CHUNK_SIZE * 0.9;
        const wx = originX + lx, wz = originZ + lz;
        const gy = findY(wx, wz);

        const sx = 0.8 + rng() * 1.5;
        const sy = sx * 0.65;
        const sz = 0.8 + rng() * 1.5;

        const rock = new THREE.Mesh(
            new THREE.DodecahedronGeometry(1, 0),
            rockMat
        );
        rock.scale.set(sx, sy, sz);
        rock.rotation.set(rng()*Math.PI, rng()*Math.PI, rng()*Math.PI);
        rock.position.set(wx, gy + sy * 0.5, wz);
        rock.castShadow = rock.receiveShadow = true;
        group.add(rock);

        // Collider boîte
        localColliders.push({
            type: 'box',
            x: wx, y: gy, z: wz,
            hw: sx * 1.1,
            hh: sy,
            hd: sz * 1.1,
        });
    }

    // --- Fleurs ---
    const flowerCount = 20 + (rng() * 40 | 0);
    for (let i = 0; i < flowerCount; i++) {
        const lx = (rng() - 0.5) * CHUNK_SIZE * 0.9;
        const lz = (rng() - 0.5) * CHUNK_SIZE * 0.9;
        const wx = originX + lx, wz = originZ + lz;
        const gy = findY(wx, wz);

        const stem = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.03, 0.7, 5),
            stemMat
        );
        stem.position.set(wx, gy + 0.35, wz);
        group.add(stem);

        const ci = (rng() * FLOWER_COLORS_HEX.length) | 0;
        const fc = FLOWER_COLORS_HEX[ci];
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 6, 6),
            new THREE.MeshStandardMaterial({ color: fc, emissive: fc, emissiveIntensity: 0.1 })
        );
        head.position.set(wx, gy + 0.8, wz);
        group.add(head);
    }

    // --- Herbe instanciée ---
    const grassCount = 60 + (rng() * 80 | 0);
    const grassGeo = new THREE.CylinderGeometry(0.02, 0.05, 1.2, 3);
    const grassMat2 = new THREE.MeshStandardMaterial({ color: 0x3f6b2d });
    const grassMesh = new THREE.InstancedMesh(grassGeo, grassMat2, grassCount);
    grassMesh.frustumCulled = false;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < grassCount; i++) {
        const lx = (rng() - 0.5) * CHUNK_SIZE;
        const lz = (rng() - 0.5) * CHUNK_SIZE;
        const wx2 = originX + lx, wz2 = originZ + lz;
        const gy2 = findY(wx2, wz2);
        dummy.position.set(wx2, gy2 + 0.6, wz2);
        dummy.scale.setScalar(0.7 + rng() * 1.8);
        dummy.rotation.y = rng() * Math.PI;
        dummy.updateMatrix();
        grassMesh.setMatrixAt(i, dummy.matrix);
    }
    grassMesh.instanceMatrix.needsUpdate = true;
    group.add(grassMesh);

    // Lucioles légères (fakes visuels)
    const ffCount = 3 + (rng() * 5 | 0);
    const ffGeo = new THREE.SphereGeometry(0.07, 4, 4);
    const ffMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
    for (let i = 0; i < ffCount; i++) {
        const lx = (rng() - 0.5) * CHUNK_SIZE * 0.9;
        const lz = (rng() - 0.5) * CHUNK_SIZE * 0.9;
        const wx2 = originX + lx, wz2 = originZ + lz;
        const gy2 = findY(wx2, wz2) + 2 + rng() * 4;
        const m = new THREE.Mesh(ffGeo, ffMat);
        m.position.set(wx2, gy2, wz2);
        group.add(m);
        fireflyData.push({ mesh: m, baseY: gy2, phase: rng() * 10 });
    }

    globalColliders.push(...localColliders);

    loadedChunks.set(key, { group, localColliders });
}

function unloadChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    const data = loadedChunks.get(key);
    if (!data) return;

    scene.remove(data.group);
    data.group.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
    });

    // Retirer les colliders de ce chunk
    for (const c of data.localColliders) {
        const idx = globalColliders.indexOf(c);
        if (idx !== -1) globalColliders.splice(idx, 1);
    }

    // Retirer les lucioles de ce chunk
    data.group.traverse(obj => {
        const fi = fireflyData.findIndex(f => f.mesh === obj);
        if (fi !== -1) fireflyData.splice(fi, 1);
        const wi = windObjects.findIndex(w => w.mesh === obj);
        if (wi !== -1) windObjects.splice(wi, 1);
    });

    loadedChunks.delete(key);
}

function updateChunks(px, pz) {
    const cx = Math.round(px / CHUNK_SIZE);
    const cz = Math.round(pz / CHUNK_SIZE);

    // Charger les chunks dans le rayon
    for (let dx = -CHUNK_RADIUS; dx <= CHUNK_RADIUS; dx++) {
        for (let dz = -CHUNK_RADIUS; dz <= CHUNK_RADIUS; dz++) {
            generateChunk(cx + dx, cz + dz);
        }
    }

    // Décharger les chunks trop loin
    for (const [key, _] of loadedChunks) {
        const [kcx, kcz] = key.split(',').map(Number);
        if (Math.abs(kcx - cx) > CHUNK_RADIUS + 1 || Math.abs(kcz - cz) > CHUNK_RADIUS + 1) {
            unloadChunk(kcx, kcz);
        }
    }
}

/* ===================================================== */
/* RNG DÉTERMINISTE PAR CHUNK                             */
/* ===================================================== */

function seededRng(seed) {
    let s = seed | 0;
    return function() {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
    };
}

/* ===================================================== */
/* PHYSIQUE 3D — résolution colliders avec Y             */
/* ===================================================== */

/**
 * Résout la position (nx, ny, nz) du joueur contre tous les colliders.
 * Retourne { x, y, z, onTop } où onTop = on est posé sur ce collider.
 */
function resolveColliders(nx, ny, nz, playerH) {
    const PLAYER_R = 0.4;
    const PLAYER_FEET = ny - playerH; // Y du bas du joueur
    let onTop = false;

    for (const c of globalColliders) {

        if (c.type === 'cylinder') {
            // Cylindre : tronc d'arbre
            const dx = nx - c.x, dz = nz - c.z;
            const distXZ = Math.sqrt(dx*dx + dz*dz);

            const cTop    = c.y + c.h;
            const cBottom = c.y;

            // Vérifier chevauchement vertical
            const playerTop = ny;
            const playerBot = ny - playerH;
            const overlapV = playerTop > cBottom && playerBot < cTop;

            if (distXZ < c.r + PLAYER_R && overlapV) {
                // Le joueur est-il AU DESSUS du cylindre (pose sur le dessus) ?
                const feetAboveTop = playerBot >= cTop - 0.3 && playerBot < cTop + 1.0;
                if (feetAboveTop) {
                    // Poser le joueur sur le dessus
                    ny = cTop + playerH;
                    onTop = true;
                } else {
                    // Repousser latéralement
                    const a = Math.atan2(dz, dx);
                    nx = c.x + Math.cos(a) * (c.r + PLAYER_R);
                    nz = c.z + Math.sin(a) * (c.r + PLAYER_R);
                }
            }

        } else if (c.type === 'box') {
            // Boîte : rocher
            const minX = c.x - c.hw - PLAYER_R, maxX = c.x + c.hw + PLAYER_R;
            const minZ = c.z - c.hd - PLAYER_R, maxZ = c.z + c.hd + PLAYER_R;
            const boxTop    = c.y + c.hh;
            const boxBottom = c.y;

            const inX = nx > minX && nx < maxX;
            const inZ = nz > minZ && nz < maxZ;

            const playerTop = ny;
            const playerBot = ny - playerH;
            const overlapV  = playerTop > boxBottom && playerBot < boxTop;

            if (inX && inZ && overlapV) {
                const feetAboveTop = playerBot >= boxTop - 0.3 && playerBot < boxTop + 1.0;
                if (feetAboveTop) {
                    ny = boxTop + playerH;
                    onTop = true;
                } else {
                    // Repousser selon l'axe de moindre pénétration
                    const overlapLeft  = nx - minX;
                    const overlapRight = maxX - nx;
                    const overlapFront = nz - minZ;
                    const overlapBack  = maxZ - nz;
                    const minOverlap   = Math.min(overlapLeft, overlapRight, overlapFront, overlapBack);

                    if (minOverlap === overlapLeft)       nx = minX;
                    else if (minOverlap === overlapRight) nx = maxX;
                    else if (minOverlap === overlapFront) nz = minZ;
                    else                                   nz = maxZ;
                }
            }
        }
    }

    return { x: nx, y: ny, z: nz, onTop };
}

/* ===================================================== */
/* CONTROLS                                               */
/* ===================================================== */

const controls = new PointerLockControls(camera, document.body);
document.body.addEventListener('click', () => controls.lock());

const velocity  = new THREE.Vector3();
const keys      = { z:false, s:false, q:false, d:false, shift:false };
let jumpVel     = 0;
let grounded    = true;
let stamina     = 100;
const PLAYER_HEIGHT = 1.8;

addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = true;
    if (e.shiftKey) keys.shift = true;
    if (e.code === 'Space' && grounded) { grounded = false; jumpVel = 0.3; }
});
addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = false;
    if (!e.shiftKey) keys.shift = false;
});

/* ===================================================== */
/* MOUVEMENT + PHYSIQUE                                   */
/* ===================================================== */

const _fwd   = new THREE.Vector3();
const _right = new THREE.Vector3();

function updateMovement() {
    const running = keys.shift && stamina > 0 && keys.z;
    stamina = running ? stamina - 0.45 : Math.min(100, stamina + 0.2);
    document.getElementById('sp').style.width = stamina + '%';

    _fwd.set(0,0,-1).applyQuaternion(camera.quaternion);
    _right.set(1,0,0).applyQuaternion(camera.quaternion);
    _fwd.y = 0; _right.y = 0;
    _fwd.normalize(); _right.normalize();

    const accel = running ? 0.05 : 0.025;
    if (keys.z) velocity.addScaledVector(_fwd,    accel);
    if (keys.s) velocity.addScaledVector(_fwd,   -accel);
    if (keys.q) velocity.addScaledVector(_right, -accel);
    if (keys.d) velocity.addScaledVector(_right,  accel);
    velocity.multiplyScalar(0.88);

    let nx = camera.position.x + velocity.x;
    let ny = camera.position.y;
    let nz = camera.position.z + velocity.z;

    // Gravité / saut
    jumpVel -= 0.015;
    ny += jumpVel;

    // Sol du terrain
    const groundY = findY(nx, nz) + PLAYER_HEIGHT;

    // Résoudre les colliders 3D
    const { x: rx, y: ry, z: rz, onTop } = resolveColliders(nx, ny, nz, PLAYER_HEIGHT);
    nx = rx; ny = ry; nz = rz;

    // Coller au terrain si on est en dessous
    if (ny < groundY) {
        ny = groundY;
        grounded = true;
        jumpVel = 0;
    } else if (onTop) {
        grounded = true;
        jumpVel = Math.max(jumpVel, 0);
    } else if (ny > groundY) {
        grounded = false;
    }

    camera.position.set(nx, ny, nz);

    // Skybox suit la caméra
    skyMesh.position.copy(camera.position);
    // Sprite soleil suit (il est déjà loin, juste mettre à jour position relative)
    sunSprite.position.copy(camera.position).addScaledVector(sunDir.clone().normalize(), 1500);
}

/* ===================================================== */
/* ANIMATION                                              */
/* ===================================================== */

let lastChunkX = Infinity, lastChunkZ = Infinity;
let frameCount = 0;

// Chargement initial
updateChunks(0, 0);

function animate(t) {
    requestAnimationFrame(animate);
    t *= 0.001;
    frameCount++;

    // Vent sur cônes
    for (const w of windObjects) {
        w.mesh.rotation.z = Math.sin(t * w.speed + w.phase) * w.amp;
    }

    // Lucioles
    for (const f of fireflyData) {
        f.mesh.position.y  = f.baseY + Math.sin(t + f.phase) * 0.5;
        f.mesh.position.x += Math.cos(t * 0.3 + f.phase) * 0.01;
    }

    if (controls.isLocked) updateMovement();

    // Chunks : vérifier toutes les 30 frames
    if (frameCount % 30 === 0) {
        const cx = Math.round(camera.position.x / CHUNK_SIZE);
        const cz = Math.round(camera.position.z / CHUNK_SIZE);
        if (cx !== lastChunkX || cz !== lastChunkZ) {
            lastChunkX = cx; lastChunkZ = cz;
            updateChunks(camera.position.x, camera.position.z);
        }
    }

    renderer.render(scene, camera);
}

animate();

/* ===================================================== */
/* RESIZE                                                 */
/* ===================================================== */

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

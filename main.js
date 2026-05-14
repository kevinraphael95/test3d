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
scene.fog = new THREE.FogExp2(0x9bb4c7, 0.004);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 10, 0);

/* ===================================================== */
/* SKYBOX SHADER                                          */
/* ===================================================== */

const skyGeo = new THREE.SphereGeometry(1800, 16, 8);
skyGeo.scale(-1, 1, 1);
const skyUniforms = {
    topColor:     { value: new THREE.Color(0x1a6eb5) },
    horizonColor: { value: new THREE.Color(0x87ceeb) },
    bottomColor:  { value: new THREE.Color(0x3d5a2a) },
};
const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    vertexShader: `
        varying vec3 vWorldPos;
        void main() {
            vWorldPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }`,
    fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPos;
        void main() {
            float h = normalize(vWorldPos).y;
            vec3 col = h > 0.0
                ? mix(horizonColor, topColor, pow(h, 0.5))
                : mix(horizonColor, bottomColor, pow(-h, 0.4));
            gl_FragColor = vec4(col, 1.0);
        }`,
    side: THREE.BackSide,
    depthWrite: false,
});
const skyMesh = new THREE.Mesh(skyGeo, skyMat);
scene.add(skyMesh);

/* ===================================================== */
/* LUMIERES                                               */
/* ===================================================== */

const hemi = new THREE.HemisphereLight(0xddeeff, 0x3d2f1b, 1.2);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff5e0, 3.0);
sun.castShadow = true;
sun.shadow.mapSize.width = sun.shadow.mapSize.height = 2048;
sun.shadow.camera.left = sun.shadow.camera.bottom = -200;
sun.shadow.camera.right = sun.shadow.camera.top  =  200;
sun.shadow.camera.far = 1500;
scene.add(sun);

const moonLight = new THREE.DirectionalLight(0x4466bb, 0.0);
scene.add(moonLight);

/* ===================================================== */
/* SPRITES SOLEIL & LUNE                                  */
/* ===================================================== */

function makeCircleSprite(inner, outer, size) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128,128,0, 128,128,128);
    g.addColorStop(0,   inner);
    g.addColorStop(0.3, outer);
    g.addColorStop(0.7, outer.replace(/[\d.]+\)$/, '0.1)'));
    g.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,256,256);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(c),
        transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
    }));
    sp.scale.set(size, size, 1);
    return sp;
}

const sunSprite  = makeCircleSprite('rgba(255,255,200,1)',  'rgba(255,210,60,0.9)',  220);
const sunGlow    = makeCircleSprite('rgba(255,180,40,0.5)', 'rgba(255,120,0,0.2)',   560);
const moonSprite = makeCircleSprite('rgba(240,245,255,1)',  'rgba(180,200,240,0.8)', 160);
const moonGlow   = makeCircleSprite('rgba(80,100,200,0.4)', 'rgba(40,60,160,0.1)',   400);
scene.add(sunSprite, sunGlow, moonSprite, moonGlow);

/* ===================================================== */
/* ETOILES                                                */
/* ===================================================== */

const STAR_COUNT = 1200;
const starPositions = new Float32Array(STAR_COUNT * 3);
const starSizes     = new Float32Array(STAR_COUNT);
for (let i = 0; i < STAR_COUNT; i++) {
    const theta = 2 * Math.PI * Math.random();
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = 1600;
    starPositions[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i*3+1] = Math.abs(r * Math.cos(phi)) + 80;
    starPositions[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
    starSizes[i] = 1.8 + Math.random() * 4.0;
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
starGeo.setAttribute('size',     new THREE.BufferAttribute(starSizes, 1));
const starMat = new THREE.ShaderMaterial({
    uniforms: { uOpacity:{ value:0.0 }, uTime:{ value:0.0 } },
    vertexShader: `
        attribute float size;
        uniform float uTime;
        void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * (1.0 + 0.35*sin(uTime*1.8+size*11.3));
            gl_Position  = projectionMatrix * mv;
        }`,
    fragmentShader: `
        uniform float uOpacity;
        void main() {
            float d = length(gl_PointCoord - 0.5);
            if (d > 0.5) discard;
            float b = pow(1.0 - d*2.0, 1.4);
            gl_FragColor = vec4(1.0,1.0,0.95, b*uOpacity);
        }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

/* ===================================================== */
/* CYCLE JOUR/NUIT                                        */
/*                                                        */
/* Cycle total : 780s (10 min jour + 3 min nuit)         */
/* Le soleil tourne sur un plan incliné autour du monde. */
/* dayAngle : 0 = aube, PI/2 = midi, PI = crépuscule,   */
/*            3PI/2 = minuit                              */
/* ===================================================== */

const DAY_SEC    = 600;   // 10 min
const NIGHT_SEC  = 180;   // 3 min
const TOTAL_SEC  = DAY_SEC + NIGHT_SEC;
const ORBIT_R    = 1400;

// Angle linéaire mais temps jour > temps nuit
function getDayAngle(elapsed) {
    const t = elapsed % TOTAL_SEC;
    // t in [0, DAY_SEC[ → angle in [0, PI[  (jour, soleil en haut)
    // t in [DAY_SEC, TOTAL_SEC[ → angle in [PI, 2PI[ (nuit, soleil en bas)
    if (t < DAY_SEC) {
        return (t / DAY_SEC) * Math.PI;
    } else {
        return Math.PI + ((t - DAY_SEC) / NIGHT_SEC) * Math.PI;
    }
}

// Couleurs ciel clairement distinctes jour/nuit
const SKY = {
    day:    { top: new THREE.Color(0x1565c0), horizon: new THREE.Color(0x64b5f6), bottom: new THREE.Color(0x3d5a2a) },
    sunset: { top: new THREE.Color(0x1a1a4a), horizon: new THREE.Color(0xff6020), bottom: new THREE.Color(0x3d2a1a) },
    night:  { top: new THREE.Color(0x030610), horizon: new THREE.Color(0x080e1e), bottom: new THREE.Color(0x06080a) },
    dawn:   { top: new THREE.Color(0x1a1a4a), horizon: new THREE.Color(0xff8850), bottom: new THREE.Color(0x252018) },
};

function lerpSky(a, b, t) {
    skyUniforms.topColor.value.copy(a.top).lerp(b.top, t);
    skyUniforms.horizonColor.value.copy(a.horizon).lerp(b.horizon, t);
    skyUniforms.bottomColor.value.copy(a.bottom).lerp(b.bottom, t);
}

// Vecteurs réutilisables pour updateDayNight
const _sd = new THREE.Vector3();
const _md = new THREE.Vector3();

function updateDayNight(elapsed) {
    const a     = getDayAngle(elapsed);  // [0, 2PI]
    const sinA  = Math.sin(a);           // >0 = soleil visible (jour)
    const sf    = Math.max(0, sinA);     // facteur jour [0,1]
    const mf    = Math.max(0, -sinA);    // facteur nuit [0,1]
    const sfS   = sf*sf*(3 - 2*sf);     // smoothstep jour
    const mfS   = mf*mf*(3 - 2*mf);    // smoothstep nuit

    // Position orbitale : plan légèrement incliné (comme le vrai soleil)
    const sunX =  Math.cos(a) * ORBIT_R;
    const sunY =  Math.sin(a) * ORBIT_R;
    const sunZ =  Math.sin(a * 0.5) * ORBIT_R * 0.3; // légère inclinaison
    sun.position.set(sunX, sunY, sunZ);
    moonLight.position.set(-sunX, -sunY, -sunZ);

    // Sprites toujours face caméra, placés loin
    const cp = camera.position;
    _sd.set(sunX, sunY, sunZ).normalize();
    _md.set(-sunX, -sunY, -sunZ).normalize();
    sunSprite.position.copy(cp).addScaledVector(_sd, 1350);
    sunGlow.position.copy(cp).addScaledVector(_sd, 1340);
    moonSprite.position.copy(cp).addScaledVector(_md, 1350);
    moonGlow.position.copy(cp).addScaledVector(_md, 1340);

    // Intensités lumineuses
    sun.intensity       = 0.5 + sfS * 2.8;   // jamais 0 pour éviter noir total
    moonLight.intensity = 0.05 + mfS * 0.45;
    hemi.intensity      = 0.3 + sfS * 0.9;

    // Opacité sprites
    sunSprite.material.opacity  = Math.pow(sf, 0.35);
    sunGlow.material.opacity    = Math.pow(sf, 0.55) * 0.75;
    moonSprite.material.opacity = Math.pow(mf, 0.35);
    moonGlow.material.opacity   = Math.pow(mf, 0.55) * 0.65;

    // Tone mapping : plus lumineux le jour
    renderer.toneMappingExposure = 0.7 + sfS * 0.7;

    // Brouillard : bleu clair le jour, quasi noir la nuit
    scene.fog.color.lerpColors(
        new THREE.Color(0x030610),
        new THREE.Color(0x87ceeb),
        sfS
    );

    // Étoiles : apparaissent quand le soleil descend (sfS < 0.4)
    starMat.uniforms.uOpacity.value = Math.max(0, 1.0 - sfS * 3.5) * 0.9;
    stars.position.copy(cp);

    // Ciel — transitions selon l'angle
    // a in [0,PI] = jour ; [PI, 2PI] = nuit
    const DAWN_END    = Math.PI * 0.12;  // fin de l'aube
    const SUNSET_START= Math.PI * 0.88;  // début coucher
    const DUSK_END    = Math.PI * 1.12;  // fin du crépuscule

    if (a < DAWN_END) {
        // Aube : nuit → aube
        lerpSky(SKY.night, SKY.dawn, a / DAWN_END);
    } else if (a < SUNSET_START) {
        // Journée : aube → ciel bleu de jour
        lerpSky(SKY.dawn, SKY.day, Math.min((a - DAWN_END) / (SUNSET_START - DAWN_END), 1));
    } else if (a < Math.PI) {
        // Coucher : jour → sunset
        lerpSky(SKY.day, SKY.sunset, (a - SUNSET_START) / (Math.PI - SUNSET_START));
    } else if (a < DUSK_END) {
        // Crépuscule : sunset → nuit
        lerpSky(SKY.sunset, SKY.night, (a - Math.PI) / (DUSK_END - Math.PI));
    } else {
        // Nuit profonde
        skyUniforms.topColor.value.copy(SKY.night.top);
        skyUniforms.horizonColor.value.copy(SKY.night.horizon);
        skyUniforms.bottomColor.value.copy(SKY.night.bottom);
    }

    // Skybox suit la caméra
    skyMesh.position.copy(cp);
}

/* ===================================================== */
/* MUSIQUE                                                */
/* ===================================================== */

function initMusic() {
    const audio = new Audio('background_sound.mp3');
    audio.volume = 0.45;
    audio.loop   = false;
    audio.addEventListener('ended', () => {
        setTimeout(() => { audio.currentTime = 0; audio.play().catch(()=>{}); }, 120000);
    });
    let started = false;
    document.addEventListener('click', () => {
        if (started) return;
        started = true;
        audio.play().catch(()=>{});
    }, { once: true });
}
initMusic();

/* ===================================================== */
/* SIMPLEX NOISE                                          */
/* ===================================================== */

const SEED = Math.random() * 65536 | 0;
console.log('Seed:', SEED);

function buildPerm(seed) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = seed;
    for (let i = 255; i > 0; i--) {
        s = (s*1664525+1013904223) & 0xffffffff;
        const j = (s>>>24)%(i+1);
        [p[i],p[j]] = [p[j],p[i]];
    }
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i&255];
    return perm;
}
const perm = buildPerm(SEED);
const GRAD = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];

function simplex2(xin, yin) {
    const F2=0.5*(Math.sqrt(3)-1), G2=(3-Math.sqrt(3))/6;
    const s=(xin+yin)*F2;
    const i=Math.floor(xin+s)|0, j=Math.floor(yin+s)|0;
    const t=(i+j)*G2;
    const x0=xin-(i-t), y0=yin-(j-t);
    const i1=x0>y0?1:0, j1=x0>y0?0:1;
    const x1=x0-i1+G2, y1=y0-j1+G2, x2=x0-1+2*G2, y2=y0-1+2*G2;
    const ii=i&255, jj=j&255;
    const g0=perm[ii+perm[jj]]%8, g1=perm[ii+i1+perm[jj+j1]]%8, g2=perm[ii+1+perm[jj+1]]%8;
    let n0=0,n1=0,n2=0;
    let t0=0.5-x0*x0-y0*y0; if(t0>=0){t0*=t0; n0=t0*t0*(GRAD[g0][0]*x0+GRAD[g0][1]*y0);}
    let t1=0.5-x1*x1-y1*y1; if(t1>=0){t1*=t1; n1=t1*t1*(GRAD[g1][0]*x1+GRAD[g1][1]*y1);}
    let t2=0.5-x2*x2-y2*y2; if(t2>=0){t2*=t2; n2=t2*t2*(GRAD[g2][0]*x2+GRAD[g2][1]*y2);}
    return 70*(n0+n1+n2);
}

function fbm(x, z) {
    return simplex2(x*0.002,z*0.002)*14
         + simplex2(x*0.008,z*0.008)*5
         + simplex2(x*0.025,z*0.025)*1.5;
}

/* ===================================================== */
/* HEIGHTMAP                                              */
/* ===================================================== */

const HSTEP = 0.5;
const hCache = new Map();

function heightAt(wx, wz) {
    const kx = Math.round(wx/HSTEP)|0, kz = Math.round(wz/HSTEP)|0;
    const key = kx*100003+kz;
    let h = hCache.get(key);
    if (h===undefined) { h=fbm(wx,wz); hCache.set(key,h); }
    return h;
}

function findY(wx, wz) {
    const x0=Math.floor(wx/HSTEP)*HSTEP, z0=Math.floor(wz/HSTEP)*HSTEP;
    const fu=(wx-x0)/HSTEP, fv=(wz-z0)/HSTEP;
    return heightAt(x0,   z0)*(1-fu)*(1-fv)
         + heightAt(x0+HSTEP,z0)*fu*(1-fv)
         + heightAt(x0,z0+HSTEP)*(1-fu)*fv
         + heightAt(x0+HSTEP,z0+HSTEP)*fu*fv;
}

/* ===================================================== */
/* MATERIAUX & GEOMETRIES PARTAGES                        */
/* ===================================================== */

const MAT = {
    trunk:  new THREE.MeshStandardMaterial({ color:0x2a1a0e }),
    cone0:  new THREE.MeshStandardMaterial({ color:0x0f240f }),
    cone1:  new THREE.MeshStandardMaterial({ color:0x163016 }),
    cone2:  new THREE.MeshStandardMaterial({ color:0x1c3d1c }),
    rock:   new THREE.MeshStandardMaterial({ color:0x707070, roughness:0.95, metalness:0.05 }),
    ground: new THREE.MeshStandardMaterial({ color:0x243b1d, roughness:1 }),
    stem:   new THREE.MeshStandardMaterial({ color:0x2d4c1e }),
    grass:  new THREE.MeshStandardMaterial({ color:0x3f6b2d }),
    ff:     new THREE.MeshBasicMaterial({ color:0xffffaa }),
};
const CONE_MATS       = [MAT.cone0, MAT.cone1, MAT.cone2];
const FLOWER_COLORS   = [0xff4444, 0x4444ff, 0xffff55, 0xffffff, 0xff66cc];
const flowerMatsCache = {};

function flowerMat(hex) {
    if (!flowerMatsCache[hex])
        flowerMatsCache[hex] = new THREE.MeshStandardMaterial({ color:hex, emissive:hex, emissiveIntensity:0.1 });
    return flowerMatsCache[hex];
}

const GEO = {
    grass:  new THREE.CylinderGeometry(0.015,0.04,0.5,3),
    ff:     new THREE.SphereGeometry(0.07,4,4),
    stem:   new THREE.CylinderGeometry(0.025,0.035,0.8,5),
    flower: new THREE.SphereGeometry(0.14,6,6),
    rock:   new THREE.DodecahedronGeometry(1,0),
};

/* ===================================================== */
/* SYSTEMES GLOBAUX                                       */
/* ===================================================== */

const windObjects     = [];
const fireflyData     = [];
const globalColliders = [];

/* ===================================================== */
/* CHUNKS                                                 */
/* ===================================================== */

const CHUNK_SIZE   = 80;
const CHUNK_SEGS   = 18;
const CHUNK_RADIUS = 2;

const loadedChunks = new Map();
const chunkFadeIn  = new Map();

function seededRng(seed) {
    let s = (seed ^ 0xdeadbeef) | 0;
    return () => {
        s = Math.imul(s^(s>>>16), 0x45d9f3b);
        s = Math.imul(s^(s>>>16), 0x45d9f3b);
        s ^= s>>>16;
        return (s>>>0) / 0xffffffff;
    };
}

function generateChunk(cx, cz) {
    const key = cx+','+cz;
    if (loadedChunks.has(key)) return;
    loadedChunks.set(key, null);
    requestAnimationFrame(() => _buildChunk(cx, cz, key));
}

function _buildChunk(cx, cz, key) {
    if (!loadedChunks.has(key)) return;

    const originX = cx * CHUNK_SIZE;
    const originZ = cz * CHUNK_SIZE;
    const rng     = seededRng(cx*73856093 ^ cz*19349663);
    const group   = new THREE.Group();
    const localColliders = [];

    /* ---- Terrain ---- */
    const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SEGS, CHUNK_SEGS);
    const vp  = geo.attributes.position.array;
    for (let i = 0; i < vp.length; i += 3)
        vp[i+2] = fbm(originX+vp[i], originZ-vp[i+1]);
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(geo, MAT.ground);
    terrain.rotation.x = -Math.PI/2;
    terrain.position.set(originX, 0, originZ);
    terrain.receiveShadow = true;
    group.add(terrain);

    /* ---- Arbres (identiques à doc3) ---- */
    const treeCount = 4 + (rng()*6|0);
    for (let i = 0; i < treeCount; i++) {
        const wx = originX + (rng()-0.5)*CHUNK_SIZE*0.88;
        const wz = originZ + (rng()-0.5)*CHUNK_SIZE*0.88;
        const gy = findY(wx, wz);
        const h  = 16 + rng()*18;
        const tr = 0.6 + rng()*0.6;
        const trunkH = h * 0.55;
        const tg = new THREE.Group();

        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(tr*0.55, tr*1.1, trunkH+5, 8),
            MAT.trunk
        );
        trunk.position.y = trunkH/2 - 2.5;
        trunk.castShadow = true;
        tg.add(trunk);

        const layers = 7 + (rng()*5|0);
        for (let li = 0; li < layers; li++) {
            const ratio  = li / (layers-1);
            const coneY  = ratio * h * 0.92;
            const radius = tr*10*(1-ratio*0.72) + 2.2;
            const coneH  = (h/layers) * 2.0;
            const cone   = new THREE.Mesh(
                new THREE.ConeGeometry(radius, coneH, 8),
                CONE_MATS[(rng()*3)|0]
            );
            cone.position.y = coneY;
            cone.castShadow = true;
            tg.add(cone);
            windObjects.push({ mesh:cone, phase:rng()*10, speed:0.5, amp:0.013 });
        }

        tg.position.set(wx, gy, wz);
        group.add(tg);
        localColliders.push({ type:'cylinder', x:wx, y:gy, z:wz, r:tr*1.5, h:trunkH+5 });
    }

    /* ---- Rochers — plateformes inclinées marchables ---- */
    /*
     * Chaque rocher a un collider "platform" :
     *   - AABB horizontale réduite (hw, hd)
     *   - topY = surface sur laquelle on peut marcher
     *   - tilt = inclinaison aléatoire (pour info visuelle)
     * Le mesh est incliné mais le collider garde un topY plat
     * légèrement adapté selon l'inclinaison (pente douce).
     */
    const rockCount = 3 + (rng()*7|0);
    for (let i = 0; i < rockCount; i++) {
        const wx = originX + (rng()-0.5)*CHUNK_SIZE*0.88;
        const wz = originZ + (rng()-0.5)*CHUNK_SIZE*0.88;
        const gy = findY(wx, wz);
        const sx = 0.9 + rng()*2.0;
        const sy = sx * (0.5 + rng()*0.35);
        const sz = 0.9 + rng()*2.0;

        // Inclinaison aléatoire douce (pas plus de 25°)
        const tiltX = (rng()-0.5) * 0.45;
        const tiltZ = (rng()-0.5) * 0.45;

        const rock = new THREE.Mesh(GEO.rock, MAT.rock);
        rock.scale.set(sx, sy, sz);
        rock.rotation.set(tiltX, rng()*Math.PI, tiltZ);
        const centerY = gy + sy * 0.52;
        rock.position.set(wx, centerY, wz);
        rock.castShadow = rock.receiveShadow = true;
        group.add(rock);

        // topY tient compte de l'inclinaison (le coin le plus haut)
        const tiltOffset = (Math.abs(tiltX)*sx + Math.abs(tiltZ)*sz) * 0.4;
        const topY = gy + sy + tiltOffset;

        localColliders.push({
            type: 'platform',
            x:  wx,   z:  wz,
            hw: sx * 0.75,   // demi-largeur conservative
            hd: sz * 0.75,
            baseY: gy,
            topY:  topY,
            // Pente locale : normale approximée de la surface inclinée
            nx: Math.sin(tiltZ),   // composante X de la normale
            nz: -Math.sin(tiltX),  // composante Z
        });
    }

    /* ---- Fleurs ---- */
    const flowerCount = 25 + (rng()*50|0);
    for (let i = 0; i < flowerCount; i++) {
        const wx = originX + (rng()-0.5)*CHUNK_SIZE*0.9;
        const wz = originZ + (rng()-0.5)*CHUNK_SIZE*0.9;
        const gy = findY(wx, wz);
        const stem = new THREE.Mesh(GEO.stem, MAT.stem);
        stem.position.set(wx, gy+0.4, wz);
        group.add(stem);
        const fc = FLOWER_COLORS[(rng()*FLOWER_COLORS.length)|0];
        const head = new THREE.Mesh(GEO.flower, flowerMat(fc));
        head.position.set(wx, gy+0.9, wz);
        group.add(head);
    }

    /* ---- Herbe instanciée ---- */
    const grassCount = 40 + (rng()*50|0);
    const gMesh = new THREE.InstancedMesh(GEO.grass, MAT.grass, grassCount);
    gMesh.frustumCulled = false;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < grassCount; i++) {
        const wx2 = originX + (rng()-0.5)*CHUNK_SIZE;
        const wz2 = originZ + (rng()-0.5)*CHUNK_SIZE;
        dummy.position.set(wx2, findY(wx2,wz2)+0.25, wz2);
        dummy.scale.setScalar(0.5+rng()*0.8);
        dummy.rotation.y = rng()*Math.PI;
        dummy.updateMatrix();
        gMesh.setMatrixAt(i, dummy.matrix);
    }
    gMesh.instanceMatrix.needsUpdate = true;
    group.add(gMesh);

    /* ---- Lucioles ---- */
    const ffCount = 2 + (rng()*6|0);
    for (let i = 0; i < ffCount; i++) {
        const wx2 = originX + (rng()-0.5)*CHUNK_SIZE*0.88;
        const wz2 = originZ + (rng()-0.5)*CHUNK_SIZE*0.88;
        const fy  = findY(wx2,wz2)+2+rng()*4;
        const m   = new THREE.Mesh(GEO.ff, MAT.ff);
        m.position.set(wx2, fy, wz2);
        group.add(m);
        fireflyData.push({ mesh:m, baseY:fy, phase:rng()*10 });
    }

    /* ---- Fade-in ---- */
    group.traverse(obj => {
        if (obj.isMesh) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            const cloned = mats.map(m => {
                const c = m.clone();
                c._baseOpacity = c.opacity ?? 1;
                c.transparent  = true;
                c.opacity      = 0;
                return c;
            });
            obj.material = Array.isArray(obj.material) ? cloned : cloned[0];
        }
    });

    globalColliders.push(...localColliders);
    scene.add(group);
    loadedChunks.set(key, { group, localColliders });
    chunkFadeIn.set(key, { group, alpha: 0 });
}

function unloadChunk(cx, cz) {
    const key = cx+','+cz;
    const data = loadedChunks.get(key);
    if (!data) { loadedChunks.delete(key); return; }

    scene.remove(data.group);
    data.group.traverse(obj => {
        if (!obj.isMesh) return;
        if (obj.geometry && obj.geometry !== GEO.grass && obj.geometry !== GEO.ff &&
            obj.geometry !== GEO.stem && obj.geometry !== GEO.flower && obj.geometry !== GEO.rock)
            obj.geometry.dispose();
        if (obj.material?._baseOpacity !== undefined) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach(m => m.dispose());
        }
    });
    for (const c of data.localColliders) {
        const idx = globalColliders.indexOf(c);
        if (idx !== -1) globalColliders.splice(idx, 1);
    }
    data.group.traverse(obj => {
        let fi = fireflyData.findIndex(f => f.mesh === obj);
        if (fi !== -1) fireflyData.splice(fi, 1);
        let wi = windObjects.findIndex(w => w.mesh === obj);
        if (wi !== -1) windObjects.splice(wi, 1);
    });
    loadedChunks.delete(key);
    chunkFadeIn.delete(key);
}

let lastCX = Infinity, lastCZ = Infinity;

function updateChunks(px, pz) {
    const cx = Math.round(px/CHUNK_SIZE);
    const cz = Math.round(pz/CHUNK_SIZE);
    if (cx === lastCX && cz === lastCZ) return;
    lastCX = cx; lastCZ = cz;
    for (let dx = -CHUNK_RADIUS; dx <= CHUNK_RADIUS; dx++)
        for (let dz = -CHUNK_RADIUS; dz <= CHUNK_RADIUS; dz++)
            generateChunk(cx+dx, cz+dz);
    for (const [key] of loadedChunks) {
        const [kcx,kcz] = key.split(',').map(Number);
        if (Math.abs(kcx-cx) > CHUNK_RADIUS+1 || Math.abs(kcz-cz) > CHUNK_RADIUS+1)
            unloadChunk(kcx, kcz);
    }
}

/* ===================================================== */
/* PHYSIQUE                                               */
/* ===================================================== */

const PLAYER_R = 0.4;
const PLAYER_H = 1.8;

function resolveColliders(nx, ny, nz) {
    let onTop    = false;
    let surfaceY = -Infinity;

    for (const c of globalColliders) {

        /* ---- CYLINDRE (troncs) ---- */
        if (c.type === 'cylinder') {
            const dx = nx-c.x, dz = nz-c.z;
            const dXZ = Math.sqrt(dx*dx+dz*dz);
            const cTop = c.y+c.h, pBot = ny-PLAYER_H;
            if (dXZ < c.r+PLAYER_R && ny > c.y && pBot < cTop) {
                if (pBot >= cTop-0.7) {
                    ny = cTop+PLAYER_H; onTop = true;
                    surfaceY = Math.max(surfaceY, cTop);
                } else {
                    const a = Math.atan2(dz,dx);
                    nx = c.x + Math.cos(a)*(c.r+PLAYER_R);
                    nz = c.z + Math.sin(a)*(c.r+PLAYER_R);
                }
            }

        /* ---- PLATFORM (rochers inclinés) ---- */
        } else if (c.type === 'platform') {
            const dx = nx - c.x;
            const dz = nz - c.z;

            // Rejet rapide
            if (Math.abs(dx) > c.hw + PLAYER_R) continue;
            if (Math.abs(dz) > c.hd + PLAYER_R) continue;

            const pBot = ny - PLAYER_H;

            // Joueur bien en-dessous → skip
            if (ny < c.baseY) continue;

            const LAND = 1.2; // tolérance d'atterrissage en unités

            if (pBot >= c.topY - LAND) {
                // ---- Atterrissage sur la plateforme ----
                // topY local ajusté à la pente : le point sous le joueur
                // sur la surface inclinée vaut topY + pente * offset
                const localTopY = c.topY + c.nx * dx + c.nz * dz;
                const wantedY   = localTopY + PLAYER_H;
                if (ny <= wantedY + 0.05) {
                    ny       = wantedY;
                    onTop    = true;
                    surfaceY = Math.max(surfaceY, localTopY);
                }
            } else {
                // ---- Collision latérale : push minimal ----
                const olXp = (c.hw + PLAYER_R) - dx;
                const olXn = dx + (c.hw + PLAYER_R);
                const olZp = (c.hd + PLAYER_R) - dz;
                const olZn = dz + (c.hd + PLAYER_R);
                const min  = Math.min(olXp, olXn, olZp, olZn);
                if      (min === olXp && olXp > 0) nx = c.x + c.hw + PLAYER_R;
                else if (min === olXn && olXn > 0) nx = c.x - c.hw - PLAYER_R;
                else if (min === olZp && olZp > 0) nz = c.z + c.hd + PLAYER_R;
                else if (min === olZn && olZn > 0) nz = c.z - c.hd - PLAYER_R;
            }
        }
    }

    return { x:nx, y:ny, z:nz, onTop, surfaceY };
}

/* ===================================================== */
/* CONTROLS                                               */
/* ===================================================== */

const controls = new PointerLockControls(camera, document.body);
document.body.addEventListener('click', () => controls.lock());

const velocity = new THREE.Vector3();
const keys = { z:false, s:false, q:false, d:false, shift:false };
let jumpVel = 0, grounded = true, stamina = 100;
let camY = 10;

addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = true;
    if (e.shiftKey) keys.shift = true;
    if (e.code === 'Space' && grounded) { grounded = false; jumpVel = 0.30; }
});
addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = false;
    if (!e.shiftKey) keys.shift = false;
});

/* ===================================================== */
/* MOUVEMENT                                              */
/* ===================================================== */

const _fwd   = new THREE.Vector3();
const _right = new THREE.Vector3();

function updateMovement(dt) {
    const moving  = keys.z||keys.s||keys.q||keys.d;
    const running = keys.shift && stamina > 0 && moving;
    stamina = running ? Math.max(0,stamina-0.45) : Math.min(100,stamina+0.2);
    document.getElementById('sp').style.width = stamina+'%';

    _fwd.set(0,0,-1).applyQuaternion(camera.quaternion);
    _right.set(1,0,0).applyQuaternion(camera.quaternion);
    _fwd.y=0; _right.y=0; _fwd.normalize(); _right.normalize();

    const accel = running ? 0.055 : 0.028;
    if (keys.z) velocity.addScaledVector(_fwd,    accel);
    if (keys.s) velocity.addScaledVector(_fwd,   -accel);
    if (keys.q) velocity.addScaledVector(_right, -accel);
    if (keys.d) velocity.addScaledVector(_right,  accel);
    velocity.multiplyScalar(0.88);

    let nx = camera.position.x + velocity.x;
    let nz = camera.position.z + velocity.z;

    // Gravité
    jumpVel = Math.max(jumpVel - 0.016, -1.2);
    let ny = camera.position.y + jumpVel;

    // Colliders
    const res = resolveColliders(nx, ny, nz);
    nx=res.x; ny=res.y; nz=res.z;

    // Sol terrain
    const terrainY = findY(nx, nz) + PLAYER_H;

    if (res.onTop) {
        // Sur plateforme/tronc : lisser le Y
        const tY = res.surfaceY + PLAYER_H;
        if (jumpVel <= 0) {
            const diff  = tY - camY;
            const speed = diff < 0 ? 20 : 12;
            camY += Math.sign(diff) * Math.min(Math.abs(diff), speed * dt);
            ny   = Math.max(camY, tY);
            camY = ny;
            jumpVel = 0; grounded = true;
        } else {
            camY = ny;
        }
    } else if (ny <= terrainY) {
        // Sol terrain : lisser
        if (jumpVel <= 0) {
            const diff  = terrainY - camY;
            const speed = diff < 0 ? 20 : 12;
            camY += Math.sign(diff) * Math.min(Math.abs(diff), speed * dt);
            ny   = Math.max(camY, terrainY);
            camY = ny;
            jumpVel = 0; grounded = true;
        } else {
            ny = terrainY; camY = ny; jumpVel = 0; grounded = true;
        }
    } else {
        // En l'air
        camY = ny; grounded = false;
    }

    camera.position.set(nx, ny, nz);
}

/* ===================================================== */
/* BOUCLE PRINCIPALE                                      */
/* ===================================================== */

const clock = new THREE.Clock();
// Démarre tôt le matin (a=PI*0.05 → juste après l'aube)
let elapsed = TOTAL_SEC * 0.03;

camY = findY(0,0) + PLAYER_H;
camera.position.y = camY;

updateChunks(0, 0);

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    const t = elapsed;
    for (const w of windObjects)
        w.mesh.rotation.z = Math.sin(t*w.speed+w.phase)*w.amp;
    for (const f of fireflyData) {
        f.mesh.position.y  = f.baseY + Math.sin(t+f.phase)*0.5;
        f.mesh.position.x += Math.cos(t*0.3+f.phase)*0.008;
    }

    starMat.uniforms.uTime.value = elapsed;

    // Fade-in chunks
    for (const [key, fd] of chunkFadeIn) {
        fd.alpha = Math.min(1, fd.alpha + dt*2.2);
        fd.group.traverse(obj => {
            if (!obj.isMesh) return;
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (const m of mats)
                if (m._baseOpacity !== undefined) m.opacity = fd.alpha * m._baseOpacity;
        });
        if (fd.alpha >= 1) {
            fd.group.traverse(obj => {
                if (!obj.isMesh) return;
                const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                for (const m of mats)
                    if (m._baseOpacity !== undefined) { m.opacity = m._baseOpacity; m.transparent = m._baseOpacity < 1; }
            });
            chunkFadeIn.delete(key);
        }
    }

    updateDayNight(elapsed);
    if (controls.isLocked) updateMovement(dt);
    updateChunks(camera.position.x, camera.position.z);
    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

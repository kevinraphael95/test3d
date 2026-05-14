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
/* SKYBOX SHADER — dégradé dynamique                      */
/* ===================================================== */

const skyGeo = new THREE.SphereGeometry(1800, 16, 8);
skyGeo.scale(-1, 1, 1);
const skyUniforms = {
    topColor:     { value: new THREE.Color(0x4a90d9) },
    horizonColor: { value: new THREE.Color(0xadd8f0) },
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
                ? mix(horizonColor, topColor,    pow(h,  0.6))
                : mix(horizonColor, bottomColor, pow(-h, 0.4));
            gl_FragColor = vec4(col, 1.0);
        }`,
    side: THREE.BackSide,
    depthWrite: false,
});
const skyMesh = new THREE.Mesh(skyGeo, skyMat);
scene.add(skyMesh);

/* ===================================================== */
/* LUMIÈRES                                               */
/* ===================================================== */

const hemi = new THREE.HemisphereLight(0xddeeff, 0x3d2f1b, 1.0);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff2d6, 2.5);
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
    g.addColorStop(0.7, outer.replace(/[\d.]+\)$/, '0.15)'));
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

function makeGlowSprite(color, size) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128,128,0, 128,128,128);
    g.addColorStop(0,   color);
    g.addColorStop(0.4, color.replace(/[\d.]+\)$/, '0.3)'));
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

const sunSprite   = makeCircleSprite('rgba(255,255,220,1)', 'rgba(255,200,50,0.8)', 200);
const sunGlow     = makeGlowSprite('rgba(255,160,30,0.6)', 500);
const moonSprite  = makeCircleSprite('rgba(230,240,255,1)', 'rgba(150,170,220,0.7)', 140);
const moonGlow    = makeGlowSprite('rgba(80,100,180,0.4)', 360);
scene.add(sunSprite);
scene.add(sunGlow);
scene.add(moonSprite);
scene.add(moonGlow);

/* ===================================================== */
/* ÉTOILES                                                */
/* ===================================================== */

const STAR_COUNT = 1200;
const starPositions = new Float32Array(STAR_COUNT * 3);
const starSizes     = new Float32Array(STAR_COUNT);
for (let i = 0; i < STAR_COUNT; i++) {
    const u = Math.random(), v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi   = Math.acos(2 * v - 1);
    const r     = 1600;
    starPositions[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i*3+1] = Math.abs(r * Math.cos(phi)) + 80;
    starPositions[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
    starSizes[i] = 1.5 + Math.random() * 3.5;
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

const starMat = new THREE.ShaderMaterial({
    uniforms: {
        uOpacity: { value: 0.0 },
        uTime:    { value: 0.0 },
    },
    vertexShader: `
        attribute float size;
        uniform float uTime;
        varying float vTwinkle;
        void main() {
            vTwinkle = size;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * (1.0 + 0.3 * sin(uTime * 2.0 + size * 13.7));
            gl_Position = projectionMatrix * mv;
        }`,
    fragmentShader: `
        uniform float uOpacity;
        varying float vTwinkle;
        void main() {
            vec2 uv = gl_PointCoord - 0.5;
            float d = length(uv);
            if (d > 0.5) discard;
            float bright = 1.0 - d * 2.0;
            bright = pow(bright, 1.5);
            gl_FragColor = vec4(1.0, 1.0, 0.95, bright * uOpacity);
        }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
});
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

/* ===================================================== */
/* CYCLE JOUR / NUIT — démarre au matin (t=0.18)          */
/* DAY_DURATION = 1200s = 20 min                          */
/* ===================================================== */

const DAY_DURATION = 1200;
const ORBIT_R = 1400;

// Couleurs revues : jour très bleu clair, nuit bleu foncé mais pas trop sombre
const SKY = {
    day:    { top:new THREE.Color(0x1a6abf), horizon:new THREE.Color(0xadd8f0), bottom:new THREE.Color(0x3d5a2a) },
    sunset: { top:new THREE.Color(0x1a1a3a), horizon:new THREE.Color(0xff7030), bottom:new THREE.Color(0x3d2a1a) },
    night:  { top:new THREE.Color(0x05102a), horizon:new THREE.Color(0x0d1a35), bottom:new THREE.Color(0x080f08) },
    dawn:   { top:new THREE.Color(0x1a1a3a), horizon:new THREE.Color(0xff9060), bottom:new THREE.Color(0x2a2218) },
};

function lerpSky(a, b, t) {
    skyUniforms.topColor.value.copy(a.top).lerp(b.top, t);
    skyUniforms.horizonColor.value.copy(a.horizon).lerp(b.horizon, t);
    skyUniforms.bottomColor.value.copy(a.bottom).lerp(b.bottom, t);
}

function updateDayNight(elapsed) {
    const dayAngle = (elapsed / DAY_DURATION) * Math.PI * 2;
    const sinA = Math.sin(dayAngle);

    const sunX =  Math.cos(dayAngle) * ORBIT_R;
    const sunY =  Math.sin(dayAngle) * ORBIT_R;
    const mnX  = -sunX, mnY = -sunY;

    sun.position.set(sunX, sunY, ORBIT_R * 0.3);
    moonLight.position.set(mnX, mnY, ORBIT_R * 0.3);

    const cp = camera.position;
    const sd = new THREE.Vector3(sunX, sunY, ORBIT_R*0.3).normalize();
    const md = new THREE.Vector3(mnX,  mnY,  ORBIT_R*0.3).normalize();

    sunSprite.position.copy(cp).addScaledVector(sd, 1350);
    sunGlow.position.copy(cp).addScaledVector(sd, 1340);
    moonSprite.position.copy(cp).addScaledVector(md, 1350);
    moonGlow.position.copy(cp).addScaledVector(md, 1340);

    const sf = Math.max(0, sinA);
    const mf = Math.max(0, -sinA);

    const sfSmooth = sf * sf * (3 - 2*sf);
    const mfSmooth = mf * mf * (3 - 2*mf);

    sun.intensity       = sfSmooth * 2.8;
    // Lumière de nuit plus forte pour rester visible
    moonLight.intensity = 0.25 + mfSmooth * 0.6;
    hemi.intensity      = 0.35 + sfSmooth * 0.75;

    sunSprite.material.opacity  = Math.pow(sf, 0.4);
    sunGlow.material.opacity    = Math.pow(sf, 0.6) * 0.8;
    moonSprite.material.opacity = Math.pow(mf, 0.4);
    moonGlow.material.opacity   = Math.pow(mf, 0.6) * 0.7;

    // Exposition plus haute la nuit pour rester lisible
    renderer.toneMappingExposure = 1.0 + sfSmooth * 0.4;

    scene.fog.color.lerpColors(new THREE.Color(0x050a18), new THREE.Color(0x9bb4c7), sfSmooth);
    scene.fog.density = 0.003 + (1 - sfSmooth) * 0.002;

    // Étoiles
    const starOpacity = Math.max(0, Math.min(1, (1 - sfSmooth * 1.8)));
    starMat.uniforms.uOpacity.value = starOpacity * 0.95;
    stars.position.copy(camera.position);

    // Phases ciel
    const a = ((dayAngle % (Math.PI*2)) + Math.PI*2) % (Math.PI*2);
    if      (a < Math.PI/6)            lerpSky(SKY.night,  SKY.dawn,   a/(Math.PI/6));
    else if (a < Math.PI*5/6) {
        const t = Math.min((a - Math.PI/6) / (Math.PI*2/3) * 1.5, 1);
        lerpSky(SKY.dawn, SKY.day, t);
    }
    else if (a < Math.PI)              lerpSky(SKY.day,    SKY.sunset, (a-Math.PI*5/6)/(Math.PI/6));
    else if (a < Math.PI*7/6)          lerpSky(SKY.sunset, SKY.night,  (a-Math.PI)/(Math.PI/6));
    else {
        skyUniforms.topColor.value.copy(SKY.night.top);
        skyUniforms.horizonColor.value.copy(SKY.night.horizon);
        skyUniforms.bottomColor.value.copy(SKY.night.bottom);
    }
}

/* ===================================================== */
/* MUSIQUE                                                */
/* ===================================================== */

const SILENCE_BETWEEN = 120;

function initMusic() {
    const audio = new Audio('background_sound.mp3');
    audio.volume = 0.45;
    function playWithDelay() { audio.currentTime = 0; audio.play().catch(() => {}); }
    audio.addEventListener('ended', () => { setTimeout(playWithDelay, SILENCE_BETWEEN * 1000); });
    let started = false;
    const startAudio = () => {
        if (started) return;
        started = true;
        playWithDelay();
        document.removeEventListener('click', startAudio);
    };
    document.addEventListener('click', startAudio);
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
/* HEIGHTMAP interpolée                                   */
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
    return heightAt(x0,   z0)  *(1-fu)*(1-fv)
         + heightAt(x0+HSTEP,z0)*fu*(1-fv)
         + heightAt(x0,z0+HSTEP)*(1-fu)*fv
         + heightAt(x0+HSTEP,z0+HSTEP)*fu*fv;
}

function terrainNormal(wx, wz) {
    const d = HSTEP;
    const hL = findY(wx-d, wz);
    const hR = findY(wx+d, wz);
    const hD = findY(wx, wz-d);
    const hU = findY(wx, wz+d);
    return new THREE.Vector3(hL-hR, 2*d, hD-hU).normalize();
}

/* ===================================================== */
/* MATÉRIAUX & GÉOMÉTRIES PARTAGÉS                        */
/* ===================================================== */

const MAT = {
    trunk:     new THREE.MeshStandardMaterial({ color:0x2a1a0e }),
    cone0:     new THREE.MeshStandardMaterial({ color:0x0f240f }),
    cone1:     new THREE.MeshStandardMaterial({ color:0x163016 }),
    cone2:     new THREE.MeshStandardMaterial({ color:0x1c3d1c }),
    rock:      new THREE.MeshStandardMaterial({ color:0x777777, roughness:1 }),
    ground:    new THREE.MeshStandardMaterial({ color:0x243b1d, roughness:1 }),
    stem:      new THREE.MeshStandardMaterial({ color:0x2d4c1e }),
    grass:     new THREE.MeshStandardMaterial({ color:0x3f6b2d }),
    ff:        new THREE.MeshBasicMaterial({ color:0xffffaa }),
    mushCap:   new THREE.MeshStandardMaterial({ color:0xcc3300 }),
    mushCap2:  new THREE.MeshStandardMaterial({ color:0xaa2200 }),
    mushSpot:  new THREE.MeshStandardMaterial({ color:0xffffff }),
    mushStem:  new THREE.MeshStandardMaterial({ color:0xe8dcc8 }),
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
/* SYSTÈMES GLOBAUX                                       */
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

/* ===================================================== */
/* CHAMPIGNONS                                            */
/* ===================================================== */

function buildMushroom(wx, wz, gy, rng, group) {
    const scale  = 0.4 + rng() * 1.2;
    const stemH  = 0.5 * scale;
    const capR   = 0.55 * scale;
    const capH   = 0.35 * scale;

    const stemGeo = new THREE.CylinderGeometry(capR*0.28, capR*0.35, stemH, 7);
    const stemMesh = new THREE.Mesh(stemGeo, MAT.mushStem);
    stemMesh.position.set(wx, gy + stemH*0.5, wz);
    stemMesh.castShadow = true;
    group.add(stemMesh);

    // Chapeau (demi-sphère aplatie)
    const capGeo = new THREE.SphereGeometry(capR, 10, 6, 0, Math.PI*2, 0, Math.PI*0.55);
    const capMesh = new THREE.Mesh(capGeo, rng() > 0.3 ? MAT.mushCap : MAT.mushCap2);
    capMesh.position.set(wx, gy + stemH + capR*0.05, wz);
    capMesh.castShadow = true;
    group.add(capMesh);

    // Quelques spots blancs sur le chapeau
    const spotCount = 3 + (rng()*4|0);
    const spotGeo = new THREE.SphereGeometry(capR*0.09, 5, 5);
    for (let s = 0; s < spotCount; s++) {
        const ang = rng() * Math.PI * 2;
        const rad = capR * (0.2 + rng() * 0.55);
        const sx  = wx + Math.cos(ang) * rad;
        const sz  = wz + Math.sin(ang) * rad;
        const sy  = gy + stemH + Math.sqrt(Math.max(0, capR*capR - rad*rad)) * 0.92;
        const spot = new THREE.Mesh(spotGeo, MAT.mushSpot);
        spot.position.set(sx, sy, sz);
        group.add(spot);
    }
}

/* ===================================================== */
/* CHUNK BUILD                                            */
/* ===================================================== */

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

    /* Terrain */
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

    /* ================================================= */
    /* ARBRES — taille réaliste (25-45 unités ≈ 25-45 m) */
    /* ================================================= */
    const treeCount = 4 + (rng()*6|0);
    for (let i = 0; i < treeCount; i++) {
        const wx = originX + (rng()-0.5)*CHUNK_SIZE*0.88;
        const wz = originZ + (rng()-0.5)*CHUNK_SIZE*0.88;
        const gy = findY(wx, wz);

        // Hauteur réaliste : 25-45 unités
        const h      = 28 + rng() * 18;
        const tr     = 0.8 + rng() * 0.7;
        // Tronc : occupe les 40% du bas — les feuilles commencent plus haut
        const trunkRatio = 0.40 + rng() * 0.08;
        const trunkH = h * trunkRatio;

        const tg = new THREE.Group();

        // Tronc plus épais et plus haut
        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(tr * 0.5, tr * 1.2, trunkH + 6, 9),
            MAT.trunk
        );
        trunk.position.y = trunkH / 2 - 3;
        trunk.castShadow = true;
        tg.add(trunk);

        // Couches de feuillage — commencent à trunkH (pas plus bas)
        const layers = 8 + (rng() * 6 | 0);
        const foliageH = h - trunkH; // hauteur réservée au feuillage
        for (let li = 0; li < layers; li++) {
            const ratio  = li / (layers - 1);
            // Y commence à trunkH et monte jusqu'au sommet
            const coneY  = trunkH + ratio * foliageH * 0.90;
            // Rayon décroît du bas vers le haut du feuillage
            const radius = tr * 9 * (1 - ratio * 0.75) + 2.5;
            const coneH  = (foliageH / layers) * 2.2;
            const cone   = new THREE.Mesh(
                new THREE.ConeGeometry(radius, coneH, 9),
                CONE_MATS[(rng() * 3) | 0]
            );
            cone.position.y = coneY;
            cone.castShadow = true;
            tg.add(cone);
            windObjects.push({ mesh:cone, phase:rng()*10, speed:0.5, amp:0.012 });
        }

        tg.position.set(wx, gy, wz);
        group.add(tg);
        localColliders.push({ type:'cylinder', x:wx, y:gy, z:wz, r:tr*1.6, h:trunkH+6 });
    }

    /* ================================================= */
    /* ROCHERS — collision box (AABB orientée)            */
    /* On crée une boîte légèrement oversize autour du    */
    /* dodecaèdre. Pour les gros, on incline la plateforme*/
    /* du dessus pour qu'on puisse se poser dessus.       */
    /* ================================================= */
    const rockCount = 3 + (rng()*7|0);
    for (let i = 0; i < rockCount; i++) {
        const wx = originX + (rng()-0.5)*CHUNK_SIZE*0.88;
        const wz = originZ + (rng()-0.5)*CHUNK_SIZE*0.88;
        const gy = findY(wx, wz);

        // Scale non-uniforme du dodecaèdre
        const sx = 1.2 + rng() * 2.2;
        const sy = sx  * (0.6 + rng() * 0.5);  // légèrement aplati
        const sz = 1.2 + rng() * 2.2;
        const rotY = rng() * Math.PI * 2;

        const rock = new THREE.Mesh(GEO.rock, MAT.rock);
        rock.scale.set(sx, sy, sz);
        rock.rotation.set(rng()*0.4 - 0.2, rotY, rng()*0.4 - 0.2);
        rock.position.set(wx, gy + sy * 0.45, wz);
        rock.castShadow = rock.receiveShadow = true;
        group.add(rock);

        // Boîte collision : on prend ~110% de la demi-taille visuelle
        // pour être légèrement genereux (mieux trop que trop petit)
        const hw = sx * 1.05;  // demi-largeur X
        const hh = sy * 1.00;  // demi-hauteur Y (centre à gy + sy*0.45)
        const hd = sz * 1.05;  // demi-profondeur Z
        const cy = gy + sy * 0.45; // centre Y du rocher

        // Angle d'inclinaison du dessus — suit la légère rotation du rocher
        // pour donner l'impression d'une plateforme inclinée sur les gros
        const tiltX = rock.rotation.x; // inclinaison visuelle
        const tiltZ = rock.rotation.z;

        localColliders.push({
            type: 'box',
            x: wx, y: cy, z: wz,
            hw, hh, hd,
            rotY,          // rotation Y de la boîte (suit le rocher)
            tiltX,         // inclinaison du dessus X
            tiltZ,         // inclinaison du dessus Z
            topY: cy + hh, // Y du dessus de la boîte (en global)
            baseY: gy,
        });
    }

    /* Fleurs */
    const flowerCount = 25 + (rng()*50|0);
    for (let i = 0; i < flowerCount; i++) {
        const wx = originX + (rng()-0.5)*CHUNK_SIZE*0.9;
        const wz = originZ + (rng()-0.5)*CHUNK_SIZE*0.9;
        const gy = findY(wx, wz);
        const stem = new THREE.Mesh(GEO.stem, MAT.stem);
        stem.position.set(wx, gy+0.4, wz);
        group.add(stem);
        const fc   = FLOWER_COLORS[(rng()*FLOWER_COLORS.length)|0];
        const head = new THREE.Mesh(GEO.flower, flowerMat(fc));
        head.position.set(wx, gy+0.9, wz);
        group.add(head);
    }

    /* Champignons */
    const mushCount = 1 + (rng() * 5 | 0);
    for (let i = 0; i < mushCount; i++) {
        const wx = originX + (rng()-0.5)*CHUNK_SIZE*0.88;
        const wz = originZ + (rng()-0.5)*CHUNK_SIZE*0.88;
        const gy = findY(wx, wz);
        buildMushroom(wx, wz, gy, rng, group);

        // Petits groupes de champignons
        if (rng() > 0.5) {
            const clusterCount = 2 + (rng() * 4 | 0);
            for (let c = 0; c < clusterCount; c++) {
                const offX = wx + (rng()-0.5)*2.5;
                const offZ = wz + (rng()-0.5)*2.5;
                buildMushroom(offX, offZ, findY(offX, offZ), rng, group);
            }
        }
    }

    /* Herbe instanciée */
    const grassCount = 40 + (rng()*50|0);
    const gMesh = new THREE.InstancedMesh(GEO.grass, MAT.grass, grassCount);
    gMesh.frustumCulled = false;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < grassCount; i++) {
        const wx2 = originX + (rng()-0.5)*CHUNK_SIZE;
        const wz2 = originZ + (rng()-0.5)*CHUNK_SIZE;
        dummy.position.set(wx2, findY(wx2,wz2)+0.7, wz2);
        dummy.scale.setScalar(0.5+rng()*0.8);
        dummy.rotation.y = rng()*Math.PI;
        dummy.updateMatrix();
        gMesh.setMatrixAt(i, dummy.matrix);
    }
    gMesh.instanceMatrix.needsUpdate = true;
    group.add(gMesh);

    /* Lucioles */
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

    // Fade-in
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
/* PHYSIQUE 3D — collisions                              */
/* ===================================================== */

const PLAYER_R = 0.4;
const PLAYER_H = 1.8;

// Transforme un point world en espace local de la box (rotation Y seulement)
function worldToBoxLocal(px, pz, cx, cz, rotY) {
    const dx = px - cx, dz = pz - cz;
    const cos = Math.cos(-rotY), sin = Math.sin(-rotY);
    return {
        lx: dx * cos - dz * sin,
        lz: dx * sin + dz * cos,
    };
}

function resolveColliders(nx, ny, nz) {
    let onTop = false;

    for (const c of globalColliders) {

        if (c.type === 'cylinder') {
            const dx = nx-c.x, dz = nz-c.z;
            const distXZ = Math.sqrt(dx*dx+dz*dz);
            const cTop   = c.y + c.h;
            const pBot   = ny - PLAYER_H;

            if (distXZ < c.r+PLAYER_R && ny > c.y && pBot < cTop) {
                if (pBot >= cTop - 0.6) {
                    ny    = cTop + PLAYER_H;
                    onTop = true;
                } else {
                    const a = Math.atan2(dz,dx);
                    nx = c.x + Math.cos(a)*(c.r+PLAYER_R);
                    nz = c.z + Math.sin(a)*(c.r+PLAYER_R);
                }
            }

        } else if (c.type === 'box') {
            // Passer en espace local de la box (rotation Y)
            const { lx, lz } = worldToBoxLocal(nx, nz, c.x, c.z, c.rotY);

            const inX = lx > -(c.hw + PLAYER_R) && lx < (c.hw + PLAYER_R);
            const inZ = lz > -(c.hd + PLAYER_R) && lz < (c.hd + PLAYER_R);
            const pBot = ny - PLAYER_H;

            // Y du dessus du rocher à la position XZ du joueur (tilt)
            // On calcule un Y de surface incliné selon tiltX/tiltZ
            const topYAtPlayer = c.topY
                + Math.tan(c.tiltX) * lz * 0.5
                + Math.tan(c.tiltZ) * lx * 0.5;

            const inY = ny > c.y - c.hh && pBot < topYAtPlayer + 0.2;

            if (inX && inZ && inY) {
                // Le joueur peut-il se poser dessus ?
                if (pBot >= topYAtPlayer - 0.7) {
                    ny    = topYAtPlayer + PLAYER_H;
                    onTop = true;
                } else {
                    // Pousser vers l'extérieur de la face la plus proche
                    const overlapX  = c.hw + PLAYER_R - Math.abs(lx);
                    const overlapZ  = c.hd + PLAYER_R - Math.abs(lz);

                    // Rotation inverse pour repousser en world space
                    const cos = Math.cos(c.rotY), sin = Math.sin(c.rotY);
                    if (overlapX < overlapZ) {
                        const pushLX = lx > 0 ? overlapX : -overlapX;
                        nx += pushLX * cos;
                        nz += pushLX * sin;
                    } else {
                        const pushLZ = lz > 0 ? overlapZ : -overlapZ;
                        nx += -pushLZ * sin;
                        nz +=  pushLZ * cos;
                    }
                }
            }
        }
    }

    return { x:nx, y:ny, z:nz, onTop };
}

/* ===================================================== */
/* CONTROLS                                               */
/* ===================================================== */

const controls = new PointerLockControls(camera, document.body);
document.body.addEventListener('click', () => controls.lock());

const velocity = new THREE.Vector3();
const keys = { z:false, s:false, q:false, d:false, shift:false };
let jumpVel    = 0;
let grounded   = true;
let stamina    = 100;
let smoothGroundY = null;

addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = true;
    if (e.shiftKey) keys.shift = true;
    if (e.code === 'Space' && grounded) { grounded = false; jumpVel = 0.32; }
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
    const running = keys.shift && stamina > 0 && (keys.z || keys.s || keys.q || keys.d);
    stamina = running ? Math.max(0,stamina-0.45) : Math.min(100,stamina+0.2);
    document.getElementById('sp').style.width = stamina+'%';

    _fwd.set(0,0,-1).applyQuaternion(camera.quaternion);
    _right.set(1,0,0).applyQuaternion(camera.quaternion);
    _fwd.y=0; _right.y=0;
    _fwd.normalize(); _right.normalize();

    const norm = terrainNormal(camera.position.x, camera.position.z);
    const slope = 1 - Math.abs(norm.y);
    const slopeSlowdown = 1 - slope * 0.5;

    const accel = (running ? 0.055 : 0.028) * slopeSlowdown;
    if (keys.z) velocity.addScaledVector(_fwd,    accel);
    if (keys.s) velocity.addScaledVector(_fwd,   -accel);
    if (keys.q) velocity.addScaledVector(_right, -accel);
    if (keys.d) velocity.addScaledVector(_right,  accel);
    velocity.multiplyScalar(0.88);

    let nx = camera.position.x + velocity.x;
    let ny = camera.position.y;
    let nz = camera.position.z + velocity.z;

    jumpVel = Math.max(jumpVel - 0.016, -1.2);
    ny += jumpVel;

    const res = resolveColliders(nx, ny, nz);
    nx=res.x; ny=res.y; nz=res.z;

    const targetGroundY = findY(nx, nz) + PLAYER_H;

    if (ny <= targetGroundY) {
        if (jumpVel <= 0 && !res.onTop) {
            if (smoothGroundY === null) smoothGroundY = ny;
            const lerpSpeed = 0.25 + (1 - slope) * 0.25;
            smoothGroundY += (targetGroundY - smoothGroundY) * Math.min(1, lerpSpeed + dt * 8);
            ny = Math.max(smoothGroundY, targetGroundY - 0.05);
        } else {
            ny = targetGroundY;
            smoothGroundY = ny;
        }
        if (jumpVel <= 0) { jumpVel = 0; grounded = true; }
    } else if (res.onTop) {
        smoothGroundY = ny;
        if (jumpVel <= 0) { jumpVel = 0; grounded = true; }
    } else {
        smoothGroundY = null;
        grounded = false;
    }

    camera.position.set(nx, ny, nz);
    skyMesh.position.copy(camera.position);
}

/* ===================================================== */
/* BOUCLE PRINCIPALE                                      */
/* ===================================================== */

const clock = new THREE.Clock();
// Démarre au matin (environ 8h = ~33% du cycle, angle ≈ PI*0.33)
// sin(angle) > 0 = jour — on vise environ PI/4 pour un beau matin
let elapsed = DAY_DURATION * (0.12);

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

    for (const [key, fd] of chunkFadeIn) {
        fd.alpha = Math.min(1, fd.alpha + dt*2.2);
        fd.group.traverse(obj => {
            if (!obj.isMesh) return;
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (const m of mats) {
                if (m._baseOpacity !== undefined)
                    m.opacity = fd.alpha * m._baseOpacity;
            }
        });
        if (fd.alpha >= 1) {
            fd.group.traverse(obj => {
                if (!obj.isMesh) return;
                const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                for (const m of mats) {
                    if (m._baseOpacity !== undefined) {
                        m.opacity     = m._baseOpacity;
                        m.transparent = m._baseOpacity < 1;
                    }
                }
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

/* ===================================================== */
/* RESIZE                                                 */
/* ===================================================== */

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

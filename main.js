import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';

/* ═══════════════════════════════════════════════════════
   MOBILE GUARD
═══════════════════════════════════════════════════════ */
if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || ('ontouchstart' in window && navigator.maxTouchPoints > 1)) {
    document.body.style.cssText = 'margin:0;background:#0a0f0a;display:flex;align-items:center;justify-content:center;height:100vh;';
    document.body.innerHTML = `<div style="text-align:center;color:#d4c9a8;font-family:'Cinzel',serif;padding:40px;max-width:340px;"><div style="font-size:64px;margin-bottom:24px;">🌲</div><div style="font-size:28px;font-weight:700;letter-spacing:4px;margin-bottom:20px;">UNE FORÊT</div><div style="font-size:14px;letter-spacing:2px;opacity:0.75;line-height:2;">NON DISPONIBLE<br>SUR MOBILE</div></div>`;
    throw new Error('mobile');
}

/* ═══════════════════════════════════════════════════════
   RENDERER
═══════════════════════════════════════════════════════ */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
document.body.appendChild(renderer.domElement);

/* ═══════════════════════════════════════════════════════
   SCENE / CAMERA
═══════════════════════════════════════════════════════ */
const scene  = new THREE.Scene();
// Brouillard linéaire Skyrim — commence loin, finit très loin
scene.fog    = new THREE.Fog(0xb8cfd8, 60, 600);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 2000);
camera.position.set(0, 10, 0);

/* ═══════════════════════════════════════════════════════
   SKYBOX — canvas gradient dynamique
═══════════════════════════════════════════════════════ */
const SKY_CANVAS = document.createElement('canvas');
SKY_CANVAS.width = 2; SKY_CANVAS.height = 512;
const SKY_CTX = SKY_CANVAS.getContext('2d');
const skyTex  = new THREE.CanvasTexture(SKY_CANVAS);
scene.background = skyTex;

// Palettes Skyrim-like : tons froids, nordiques
const SKY = {
    day:    { top:[0.28,0.42,0.58], mid:[0.55,0.72,0.82], hor:[0.75,0.86,0.90] },
    sunset: { top:[0.18,0.14,0.28], mid:[0.70,0.32,0.12], hor:[0.95,0.55,0.25] },
    night:  { top:[0.04,0.07,0.18], mid:[0.07,0.12,0.25], hor:[0.10,0.16,0.32] },
    dawn:   { top:[0.15,0.14,0.28], mid:[0.55,0.30,0.18], hor:[0.90,0.55,0.30] },
};

let _skyTop=[...SKY.day.top], _skyMid=[...SKY.day.mid], _skyHor=[...SKY.day.hor];

function lerp3(a,b,t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
function toCSS([r,g,b]){ return `rgb(${r*255|0},${g*255|0},${b*255|0})`; }

function setSky(s){ _skyTop=[...s.top]; _skyMid=[...s.mid]; _skyHor=[...s.hor]; }
function lerpSky(a,b,t){ _skyTop=lerp3(a.top,b.top,t); _skyMid=lerp3(a.mid,b.mid,t); _skyHor=lerp3(a.hor,b.hor,t); }

function drawSky(){
    const g = SKY_CTX.createLinearGradient(0,0,0,512);
    g.addColorStop(0,   toCSS(_skyTop));
    g.addColorStop(0.5, toCSS(_skyMid));
    g.addColorStop(1,   toCSS(_skyHor));
    SKY_CTX.fillStyle = g;
    SKY_CTX.fillRect(0,0,2,512);
    skyTex.needsUpdate = true;
}

/* ═══════════════════════════════════════════════════════
   LUMIÈRES — ambiance nordique froide
═══════════════════════════════════════════════════════ */
// Lumière ambiante froide (ciel gris-bleu) + sol sombre
const hemi = new THREE.HemisphereLight(0xc8dde8, 0x4a6030, 2.8);
scene.add(hemi);

// Soleil bas et rasant — lumière froide légèrement dorée
const sun = new THREE.DirectionalLight(0xfff8e8, 4.5);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(2048);
sun.shadow.camera.left   = sun.shadow.camera.bottom = -80;
sun.shadow.camera.right  = sun.shadow.camera.top    =  80;
sun.shadow.camera.far    = 400;
sun.shadow.bias = -0.001;
scene.add(sun);
scene.add(sun.target);

const moonLight = new THREE.DirectionalLight(0x3a5580, 0);
scene.add(moonLight);

/* ═══════════════════════════════════════════════════════
   SPRITES SOLEIL & LUNE
═══════════════════════════════════════════════════════ */
function makeSprite(inner, outer, size){
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128,128,0,128,128,128);
    g.addColorStop(0, inner);
    g.addColorStop(0.3, outer);
    g.addColorStop(0.7, outer.replace(/[\d.]+\)$/,'0.1)'));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,256,256);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(c), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending }));
    sp.scale.setScalar(size);
    return sp;
}
const sunSprite  = makeSprite('rgba(255,255,220,1)', 'rgba(255,200,80,0.7)',  180);
const sunGlow    = makeSprite('rgba(255,160,40,0.5)','rgba(255,120,20,0.2)',  450);
const moonSprite = makeSprite('rgba(220,235,255,1)', 'rgba(140,160,210,0.6)', 130);
const moonGlow   = makeSprite('rgba(80,100,180,0.3)','rgba(40,60,120,0.1)',   340);
scene.add(sunSprite, sunGlow, moonSprite, moonGlow);

/* ═══════════════════════════════════════════════════════
   ÉTOILES
═══════════════════════════════════════════════════════ */
const STAR_N = 1200;
const starPos = new Float32Array(STAR_N*3), starSz = new Float32Array(STAR_N);
for(let i=0; i<STAR_N; i++){
    const th=2*Math.PI*Math.random(), ph=Math.acos(2*Math.random()-1), r=1600;
    starPos[i*3]   = r*Math.sin(ph)*Math.cos(th);
    starPos[i*3+1] = Math.abs(r*Math.cos(ph))+80;
    starPos[i*3+2] = r*Math.sin(ph)*Math.sin(th);
    starSz[i] = 1.5+Math.random()*3.5;
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos,3));
starGeo.setAttribute('size',     new THREE.BufferAttribute(starSz,1));
const starMat = new THREE.ShaderMaterial({
    uniforms: { uOp:{value:0}, uT:{value:0} },
    vertexShader:   `attribute float size;uniform float uT;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=size*(1.+0.3*sin(uT*2.+size*13.7));gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform float uOp;void main(){vec2 uv=gl_PointCoord-.5;float d=length(uv);if(d>.5)discard;float b=pow(1.-d*2.,1.5);gl_FragColor=vec4(1.,1.,.95,b*uOp);}`,
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
});
const starsObj = new THREE.Points(starGeo, starMat);
scene.add(starsObj);

/* ═══════════════════════════════════════════════════════
   CYCLE JOUR / NUIT
═══════════════════════════════════════════════════════ */
const DAY_DURATION = 1200, ORBIT_R = 1400;
const _fogDay   = new THREE.Color(0xb8cfd8);
const _fogNight = new THREE.Color(0x0a1428);
const _sd = new THREE.Vector3(), _md = new THREE.Vector3();

function updateDayNight(elapsed){
    const angle = ((elapsed/DAY_DURATION)*Math.PI*2) % (Math.PI*2);
    const sinA  = Math.sin(angle);
    const sf    = Math.max(0, sinA);
    const sfS   = sf*sf*(3-2*sf);   // smoothstep
    const mf    = Math.max(0,-sinA);
    const mfS   = mf*mf*(3-2*mf);

    const sunX = Math.cos(angle)*ORBIT_R, sunY = Math.sin(angle)*ORBIT_R;
    sun.position.set(
        camera.position.x + sunX,
        sunY,
        camera.position.z + ORBIT_R*0.2
    );
    sun.target.position.set(camera.position.x, 0, camera.position.z);
    sun.target.updateMatrixWorld();
    moonLight.position.set(-sunX,-sunY, ORBIT_R*0.2);

    const cp = camera.position;
    _sd.set(sunX,sunY,ORBIT_R*0.2).normalize();
    _md.copy(_sd).negate();
    sunSprite.position.copy(cp).addScaledVector(_sd,1350);
    sunGlow.position.copy(cp).addScaledVector(_sd,1340);
    moonSprite.position.copy(cp).addScaledVector(_md,1350);
    moonGlow.position.copy(cp).addScaledVector(_md,1340);

    sun.intensity       = 0.05 + sfS*3.0;
    moonLight.intensity = 0.8  + mfS*1.2;   // lune bien plus forte
    hemi.intensity = 0.75 + sfS*1.05;  // ambiance nuit bleutée visible

    sunSprite.material.opacity  = Math.pow(sf, 0.35);
    sunGlow.material.opacity    = Math.pow(sf, 0.5)*0.7;
    moonSprite.material.opacity = Math.pow(mf, 0.35);
    moonGlow.material.opacity   = Math.pow(mf, 0.5)*0.6;

    // Brouillard : lointain le jour, dense et sombre la nuit
    scene.fog.color.lerpColors(_fogNight, _fogDay, sfS);
    scene.fog.near = 60  + sfS*40;
    scene.fog.far  = 500 + sfS*300;

    starMat.uniforms.uOp.value = Math.max(0, 1-sfS*2)*0.9;
    starMat.uniforms.uT.value  = elapsed;
    starsObj.position.copy(cp);

    // Phases ciel avec point milieu pour gradient 3 couleurs
    const a = angle, PI = Math.PI;
    if      (a < PI*0.20) lerpSky(SKY.dawn,   SKY.day,    a/(PI*0.20));
    else if (a < PI*0.75) setSky(SKY.day);
    else if (a < PI*1.10) lerpSky(SKY.day,    SKY.sunset, (a-PI*0.75)/(PI*0.35));
    else if (a < PI*1.40) lerpSky(SKY.sunset, SKY.night,  (a-PI*1.10)/(PI*0.30));
    else if (a < PI*1.75) setSky(SKY.night);
    else                  lerpSky(SKY.night,  SKY.dawn,   (a-PI*1.75)/(PI*0.25));
    drawSky();
}

/* ═══════════════════════════════════════════════════════
   MUSIQUE
═══════════════════════════════════════════════════════ */
function initMusic(){
    const audio = new Audio('background_sound.mp3');
    audio.volume = 0.45;
    const play = () => { audio.currentTime=0; audio.play().catch(()=>{}); };
    audio.addEventListener('ended', ()=>setTimeout(play, 120000));
    let started = false;
    const start = () => { if(started)return; started=true; play(); document.removeEventListener('click',start); };
    document.addEventListener('click', start);
}
initMusic();

/* ═══════════════════════════════════════════════════════
   SIMPLEX NOISE
═══════════════════════════════════════════════════════ */
const SEED = Math.random()*2147483647|0;
document.getElementById('seed-display').textContent = 'seed : '+SEED;

function buildPerm(seed){
    const p = new Uint8Array(256); for(let i=0;i<256;i++) p[i]=i; let s=seed;
    for(let i=255;i>0;i--){ s=(s*1664525+1013904223)&0xffffffff; const j=(s>>>24)%(i+1); [p[i],p[j]]=[p[j],p[i]]; }
    const pm = new Uint8Array(512); for(let i=0;i<512;i++) pm[i]=p[i&255]; return pm;
}
const perm = buildPerm(SEED);
const GRAD = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];

function simplex2(xin, yin){
    const F2=0.5*(Math.sqrt(3)-1), G2=(3-Math.sqrt(3))/6;
    const s=(xin+yin)*F2, i=Math.floor(xin+s)|0, j=Math.floor(yin+s)|0, t=(i+j)*G2;
    const x0=xin-(i-t), y0=yin-(j-t), i1=x0>y0?1:0, j1=x0>y0?0:1;
    const x1=x0-i1+G2, y1=y0-j1+G2, x2=x0-1+2*G2, y2=y0-1+2*G2;
    const ii=i&255, jj=j&255;
    const g0=perm[ii+perm[jj]]%8, g1=perm[ii+i1+perm[jj+j1]]%8, g2=perm[ii+1+perm[jj+1]]%8;
    let n0=0,n1=0,n2=0;
    let t0=0.5-x0*x0-y0*y0; if(t0>=0){t0*=t0; n0=t0*t0*(GRAD[g0][0]*x0+GRAD[g0][1]*y0);}
    let t1=0.5-x1*x1-y1*y1; if(t1>=0){t1*=t1; n1=t1*t1*(GRAD[g1][0]*x1+GRAD[g1][1]*y1);}
    let t2=0.5-x2*x2-y2*y2; if(t2>=0){t2*=t2; n2=t2*t2*(GRAD[g2][0]*x2+GRAD[g2][1]*y2);}
    return 70*(n0+n1+n2);
}

// FBM avec grandes collines Skyrim-like (dénivelé ~35u max)
function fbm(x,z){
    return simplex2(x*0.0008,z*0.0008)*32   // grandes collines
         + simplex2(x*0.003, z*0.003 )*10   // collines moyennes
         + simplex2(x*0.010, z*0.010 )*3.5  // détails
         + simplex2(x*0.028, z*0.028 )*1.0; // micro-relief
}

/* ═══════════════════════════════════════════════════════
   HEIGHTMAP avec cache
═══════════════════════════════════════════════════════ */
const HSTEP   = 0.5;
const hCache  = new Map();

function heightAt(wx, wz){
    const kx = Math.round(wx/HSTEP)|0, kz = Math.round(wz/HSTEP)|0;
    const key = kx*100003+kz;
    let h = hCache.get(key);
    if(h === undefined){ h = fbm(wx,wz); hCache.set(key,h); }
    return h;
}

function findY(wx, wz){
    const x0=Math.floor(wx/HSTEP)*HSTEP, z0=Math.floor(wz/HSTEP)*HSTEP;
    const fu=(wx-x0)/HSTEP, fv=(wz-z0)/HSTEP;
    return heightAt(x0,z0)    *(1-fu)*(1-fv)
         + heightAt(x0+HSTEP,z0)*fu*(1-fv)
         + heightAt(x0,z0+HSTEP)*(1-fu)*fv
         + heightAt(x0+HSTEP,z0+HSTEP)*fu*fv;
}

function terrainNormal(wx, wz){
    const d = HSTEP;
    return new THREE.Vector3(
        findY(wx-d,wz)-findY(wx+d,wz), 2*d, findY(wx,wz-d)-findY(wx,wz+d)
    ).normalize();
}

/* ═══════════════════════════════════════════════════════
   MONTAGNES LOINTAINES
═══════════════════════════════════════════════════════ */
(function buildMountains(){
    const mtnMat  = new THREE.MeshStandardMaterial({ color:0x6a7a8a, roughness:1, flatShading:true });
    const snowMat = new THREE.MeshStandardMaterial({ color:0xe8eef2, roughness:0.7 });
    for(let i=0; i<20; i++){
        const angle = (i/20)*Math.PI*2 + Math.random()*0.25;
        const dist  = 700 + Math.random()*400;
        const mx = Math.cos(angle)*dist, mz = Math.sin(angle)*dist;
        const h = 180+Math.random()*160, r = 100+Math.random()*100;
        const groundY = fbm(mx,mz);
        const mesh = new THREE.Mesh(new THREE.ConeGeometry(r,h,7), mtnMat);
        mesh.position.set(mx, groundY - h*0.35, mz);
        scene.add(mesh);
        const snow = new THREE.Mesh(new THREE.ConeGeometry(r*0.28,h*0.22,7), snowMat);
        snow.position.set(mx, groundY - h*0.35 + h*0.42, mz);
        scene.add(snow);
    }
})();


/* ═══════════════════════════════════════════════════════
   MATÉRIAUX — tous partagés
═══════════════════════════════════════════════════════ */
const MAT = {
    // Terrain verdoyant mais froid
    ground: new THREE.MeshStandardMaterial({ color:0x4a6a30, roughness:0.9 }),
    // Arbres — troncs et feuillage sombres/froids
    trunk:    new THREE.MeshStandardMaterial({ color:0x3d2410 }),
    cone0:    new THREE.MeshStandardMaterial({ color:0x1e4020 }),
    cone1:    new THREE.MeshStandardMaterial({ color:0x254d28 }),
    cone2:    new THREE.MeshStandardMaterial({ color:0x2d5a30 }),
    // Rochers gris-bleutés style nordique
    rock:     new THREE.MeshStandardMaterial({ color:0x6a6e72, roughness:1, flatShading:true }),
    // Flore
    stem:     new THREE.MeshStandardMaterial({ color:0x2a4018 }),
    grass:    new THREE.MeshStandardMaterial({ color:0x354d20 }),
    ff:       new THREE.MeshBasicMaterial({ color:0xaaffaa }),
    // Champignons
    mushCap:  new THREE.MeshStandardMaterial({ color:0xcc3300 }),
    mushCap2: new THREE.MeshStandardMaterial({ color:0xaa2200 }),
    mushSpot: new THREE.MeshStandardMaterial({ color:0xffffff }),
    mushStem: new THREE.MeshStandardMaterial({ color:0xe0d4b8 }),
    // Tour
    towLog:   new THREE.MeshStandardMaterial({ color:0x1e0f06, roughness:1.0 }),
    towPlank: new THREE.MeshStandardMaterial({ color:0x2c1a0a, roughness:0.95 }),
    towRail:  new THREE.MeshStandardMaterial({ color:0x170c04, roughness:1.0 }),
};

const CONE_MATS    = [MAT.cone0, MAT.cone1, MAT.cone2];
const FLOWER_COLORS = [0xffe8c0, 0xffffff, 0xc8e8ff, 0xffe0c0, 0xd0f0d0]; // tons froids
const flowerCache  = {};
function flowerMat(hex){
    if(!flowerCache[hex]) flowerCache[hex] = new THREE.MeshStandardMaterial({ color:hex, emissive:hex, emissiveIntensity:0.05 });
    return flowerCache[hex];
}

/* ═══════════════════════════════════════════════════════
   GÉOMÉTRIES PARTAGÉES
═══════════════════════════════════════════════════════ */
const GEO = {
    grass:    new THREE.CylinderGeometry(0.015, 0.04,  0.5,  3),
    ff:       new THREE.SphereGeometry(0.07, 4, 4),
    stem:     new THREE.CylinderGeometry(0.025,0.035,  0.8,  5),
    flower:   new THREE.SphereGeometry(0.14, 6, 6),
    rock:     new THREE.DodecahedronGeometry(1, 0),
    mushStem: new THREE.CylinderGeometry(0.1,  0.12,   0.4,  6),
    mushCap:  new THREE.SphereGeometry(0.5, 8, 5, 0, Math.PI*2, 0, Math.PI*0.55),
    mushSpot: new THREE.SphereGeometry(0.07, 4, 4),
    towPlank: new THREE.BoxGeometry(1, 0.18, 0.65),
    towBarV:  new THREE.CylinderGeometry(0.05, 0.05, 1.15, 5),
};

/* ═══════════════════════════════════════════════════════
   SYSTÈMES GLOBAUX
═══════════════════════════════════════════════════════ */
const windObjects     = [];
const fireflyData     = [];
const globalColliders = [];

/* ═══════════════════════════════════════════════════════
   TOUR D'OBSERVATION
═══════════════════════════════════════════════════════ */
const TOWER_H  = 40;
const PLT_HALF = 2.6;

function chunkHasTower(cx, cz){
    if(cx===0 && cz===0) return true;
    const cellX=Math.floor(cx/5), cellZ=Math.floor(cz/5);
    if(cellX===0 && cellZ===0) return false;
    let h = (cx*374761393+cz*668265263)^0xdeadbeef;
    h = Math.imul(h^(h>>>16),0x45d9f3b); h ^= h>>>16;
    const val = (h>>>0)/0xffffffff;
    for(let dx=-4;dx<=4;dx++) for(let dz=-4;dz<=4;dz++){
        if(dx===0&&dz===0) continue;
        const nx=cx+dx, nz=cz+dz;
        if(Math.floor(nx/5)!==cellX || Math.floor(nz/5)!==cellZ) continue;
        let h2=(nx*374761393+nz*668265263)^0xdeadbeef;
        h2=Math.imul(h2^(h2>>>16),0x45d9f3b); h2^=h2>>>16;
        if((h2>>>0)/0xffffffff>val) return false;
    }
    return true;
}

function buildTower(wx, wz, grp, lc){
    const gy = findY(wx,wz);
    const tg = new THREE.Group();
    const pillarH = TOWER_H+4;

    // 4 piliers
    const pDef = [
        {ox:-PLT_HALF, oz:-PLT_HALF, rb:0.65, rt:0.55},
        {ox: PLT_HALF, oz:-PLT_HALF, rb:0.62, rt:0.52},
        {ox: PLT_HALF, oz: PLT_HALF, rb:0.68, rt:0.58},
        {ox:-PLT_HALF, oz: PLT_HALF, rb:0.60, rt:0.50},
    ];
    for(const p of pDef){
        const m = new THREE.Mesh(new THREE.CylinderGeometry(p.rt,p.rb,pillarH,10), MAT.towLog);
        m.position.set(p.ox, pillarH/2-4, p.oz); m.castShadow=true; tg.add(m);
        lc.push({type:'cylinder', x:wx+p.ox, y:gy-4, z:wz+p.oz, r:p.rb+0.15, h:pillarH});
    }

    // Renforts horizontaux
    const beamLen = PLT_HALF*2+0.5;
    for(let y=6; y<TOWER_H-2; y+=7){
        for(const oz of [-PLT_HALF, PLT_HALF]){
            const b = new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.17,beamLen,7), MAT.towLog);
            b.rotation.z=Math.PI/2; b.position.set(0,y,oz); tg.add(b);
        }
        for(const ox of [-PLT_HALF, PLT_HALF]){
            const b = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,beamLen,7), MAT.towLog);
            b.rotation.x=Math.PI/2; b.position.set(ox,y+0.4,0); tg.add(b);
        }
    }

    // Échelle collée face Z+
    const LADDER_W=1.2, LADDER_Z=PLT_HALF+0.3;
    const RUNG_COUNT=Math.floor(TOWER_H/0.8), RUNG_SPACING=TOWER_H/RUNG_COUNT;
    for(const sx of [-LADDER_W*0.5, LADDER_W*0.5]){
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,TOWER_H+0.5,7), MAT.towLog);
        post.position.set(sx, TOWER_H*0.5, LADDER_Z); tg.add(post);
    }
    for(let i=1; i<=RUNG_COUNT; i++){
        const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,LADDER_W,6), MAT.towLog);
        rung.rotation.z=Math.PI/2; rung.position.set(0,i*RUNG_SPACING,LADDER_Z); tg.add(rung);
    }
    lc.push({ type:'ladder', minX:wx-LADDER_W*0.6, maxX:wx+LADDER_W*0.6, minZ:wz+LADDER_Z-0.4, maxZ:wz+LADDER_Z+0.4, bottom:gy, top:gy+TOWER_H-0.2 });

    // Plancher plateforme
    const floorW = PLT_HALF*2+0.15;
    for(let i=0; i<9; i++){
        const pl = new THREE.Mesh(GEO.towPlank, MAT.towPlank);
        pl.scale.x=floorW; pl.position.set(0, TOWER_H, -PLT_HALF+(i/8)*PLT_HALF*2);
        pl.receiveShadow=true; tg.add(pl);
    }
    lc.push({type:'cylinder', x:wx, y:gy+TOWER_H-0.1, z:wz, r:PLT_HALF+0.5, h:0.4});
    for(const oz of [-PLT_HALF*0.5, PLT_HALF*0.5]){
        const sb = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.18,floorW+0.3,7), MAT.towLog);
        sb.rotation.z=Math.PI/2; sb.position.set(0,TOWER_H-0.28,oz); tg.add(sb);
    }

    // Garde-corps 3 côtés (Z+ ouvert = côté échelle)
    const railTop=TOWER_H+1.15, railMid=TOWER_H+0.58;
    const gcSides = [
        { cx:0,            cz:-PLT_HALF-0.1, ry:0,         len:floorW },
        { cx:-PLT_HALF-0.1, cz:0,            ry:Math.PI/2, len:floorW },
        { cx: PLT_HALF+0.1, cz:0,            ry:Math.PI/2, len:floorW },
    ];
    for(const s of gcSides){
        for(const rh of [railMid, railTop]){
            const r = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,s.len,5), MAT.towRail);
            r.rotation.set(0,s.ry,Math.PI/2); r.position.set(s.cx,rh,s.cz); tg.add(r);
        }
        const nb = Math.ceil(s.len/0.62)+1;
        for(let i=0; i<=nb; i++){
            const t2=(i/nb-0.5)*s.len;
            const bar = new THREE.Mesh(GEO.towBarV, MAT.towRail);
            bar.position.set(s.ry===0?s.cx+t2:s.cx, TOWER_H+0.72, s.ry===0?s.cz:s.cz+t2); tg.add(bar);
        }
        lc.push({ type:'wall', cx:wx+s.cx, cz:wz+s.cz, hw:s.ry===0?s.len*0.5+PLAYER_R:0.6, hd:s.ry===0?0.6:s.len*0.5+PLAYER_R, bottom:gy+TOWER_H-0.1, top:gy+TOWER_H+1.6 });
    }
    for(const [px,pz] of [[-PLT_HALF,-PLT_HALF],[PLT_HALF,-PLT_HALF],[PLT_HALF,PLT_HALF],[-PLT_HALF,PLT_HALF]]){
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,railTop-TOWER_H+0.1,6), MAT.towRail);
        post.position.set(px, TOWER_H+(railTop-TOWER_H)/2, pz); tg.add(post);
    }

    // Toit porté par 4 piliers
    const roofPH=5, roofBase=TOWER_H;
    for(const [px,pz] of [[-PLT_HALF,-PLT_HALF],[PLT_HALF,-PLT_HALF],[PLT_HALF,PLT_HALF],[-PLT_HALF,PLT_HALF]]){
        const rp = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,roofPH,7), MAT.towLog);
        rp.position.set(px, roofBase+roofPH/2, pz); tg.add(rp);
    }
    const roofH=4, roofHalf=PLT_HALF+1.0;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(roofHalf*Math.SQRT2,roofH,4), MAT.towLog);
    roof.rotation.y=Math.PI/4; roof.position.set(0,roofBase+roofPH+roofH*0.5,0);
    roof.castShadow=true; tg.add(roof);

    tg.position.set(wx,gy,wz);
    grp.add(tg);
    return { wx, wz, clearR:PLT_HALF+6 };
}

/* ═══════════════════════════════════════════════════════
   CHAMPIGNONS
═══════════════════════════════════════════════════════ */
function buildMushroom(wx, wz, gy, r, grp){
    const sc=0.12+r()*0.25, sH=0.45*sc, cR=0.5*sc;
    const sm = new THREE.Mesh(GEO.mushStem, MAT.mushStem);
    sm.scale.set(cR*0.6,sH*2.5,cR*0.6); sm.position.set(wx,gy+sH*0.5,wz); grp.add(sm);
    const cm = new THREE.Mesh(GEO.mushCap, r()>0.3?MAT.mushCap:MAT.mushCap2);
    cm.scale.setScalar(cR*2); cm.position.set(wx,gy+sH+cR*0.05,wz); grp.add(cm);
    for(let i=0,n=3+(r()*3|0); i<n; i++){
        const ang=r()*Math.PI*2, rad=cR*(0.2+r()*0.55);
        const sp = new THREE.Mesh(GEO.mushSpot, MAT.mushSpot);
        sp.scale.setScalar(cR*0.18);
        sp.position.set(wx+Math.cos(ang)*rad, gy+sH+Math.sqrt(Math.max(0,cR*cR-rad*rad))*0.9, wz+Math.sin(ang)*rad);
        grp.add(sp);
    }
}

/* ═══════════════════════════════════════════════════════
   CHUNKS — génération infinie asynchrone
═══════════════════════════════════════════════════════ */
const CHUNK_SIZE   = 80;
const CHUNK_SEGS   = 14;
const CHUNK_RADIUS = 3;
const loadedChunks = new Map();
const chunkFadeIn  = new Map();

function seededRng(seed){
    let s = (seed^0xdeadbeef)|0;
    return () => { s=Math.imul(s^(s>>>16),0x45d9f3b); s=Math.imul(s^(s>>>16),0x45d9f3b); s^=s>>>16; return (s>>>0)/0xffffffff; };
}

function generateChunk(cx, cz){
    const key = cx+','+cz;
    if(loadedChunks.has(key)) return;
    loadedChunks.set(key, null);
    requestAnimationFrame(() => _buildChunk(cx,cz,key));
}

function _buildChunk(cx, cz, key){
    if(!loadedChunks.has(key)) return;
    const oX=cx*CHUNK_SIZE, oZ=cz*CHUNK_SIZE;
    const r = seededRng(cx*73856093^cz*19349663);
    const grp = new THREE.Group(), lc = [];

    // Sol
    const tgeo = new THREE.PlaneGeometry(CHUNK_SIZE,CHUNK_SIZE,CHUNK_SEGS,CHUNK_SEGS);
    const vp   = tgeo.attributes.position.array;
    for(let i=0; i<vp.length; i+=3) vp[i+2] = fbm(oX+vp[i], oZ-vp[i+1]);
    tgeo.computeVertexNormals();
    const terr = new THREE.Mesh(tgeo, MAT.ground);
    terr.rotation.x=-Math.PI/2; terr.position.set(oX,0,oZ); terr.receiveShadow=true; grp.add(terr);

    // Tour
    let towerInfo = null;
    if(chunkHasTower(cx,cz)){
        let twx, twz;
        if(cx===0&&cz===0){ twx=22; twz=22; }
        else { const rng2=seededRng(cx*19349663^cz*73856093); twx=oX+(rng2()-0.5)*CHUNK_SIZE*0.5; twz=oZ+(rng2()-0.5)*CHUNK_SIZE*0.5; }
        towerInfo = buildTower(twx,twz,grp,lc);
    }

    // Système de placement sans chevauchement
    const occupied = [];
    if(towerInfo) occupied.push({x:towerInfo.wx, z:towerInfo.wz, r:towerInfo.clearR+5});
    const canPlace = (wx,wz,d) => !occupied.some(o=>{ const dx=wx-o.x,dz=wz-o.z; return dx*dx+dz*dz<(d+o.r)*(d+o.r); });
    const occupy   = (wx,wz,rad) => occupied.push({x:wx,z:wz,r:rad});

    // Arbres — plus nombreux et plus variés pour horizon dense
    const treeN = 9+(r()*9|0), tpts = [];
    for(let i=0; i<treeN; i++){
        let wx,wz,ok=false,tries=0;
        do{
            wx=oX+(r()-0.5)*CHUNK_SIZE*0.85; wz=oZ+(r()-0.5)*CHUNK_SIZE*0.85;
            ok=canPlace(wx,wz,8) && !tpts.some(p=>{const dx=p[0]-wx,dz=p[1]-wz;return dx*dx+dz*dz<14*14;});
        } while(!ok&&++tries<20);
        if(tries>=20) continue;
        tpts.push([wx,wz]); occupy(wx,wz,8);

        const gy=findY(wx,wz), h=26+r()*22, tr=1.2+r()*1.2, trunkH=h*(0.26+r()*0.10);
        const tgr = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(tr*0.55,tr*1.4,trunkH+6,9), MAT.trunk);
        trunk.position.y=trunkH/2-3; trunk.castShadow=true; tgr.add(trunk);

        const layers=9+(r()*6|0), foliageH=h-trunkH;
        for(let li=0; li<layers; li++){
            const ratio=li/(layers-1);
            const coneY=trunkH+ratio*foliageH*0.90;
            const radius=tr*4.5*(1-ratio*0.72)+1.5;
            const coneH=(foliageH/layers)*2.2;
            const cone = new THREE.Mesh(new THREE.ConeGeometry(radius,coneH,8), CONE_MATS[(r()*3)|0]);
            cone.position.y=coneY; cone.castShadow=true; tgr.add(cone);
            windObjects.push({mesh:cone, phase:r()*10, speed:0.5, amp:0.011});
        }
        tgr.position.set(wx,gy,wz); grp.add(tgr);
        lc.push({type:'cylinder', x:wx, y:gy, z:wz, r:tr*1.7, h:trunkH+6});
    }

    // Rochers — plus gros, style nordique
    for(let i=0, n=2+(r()*4|0); i<n; i++){
        let wx,wz,tries=0;
        do{ wx=oX+(r()-0.5)*CHUNK_SIZE*0.88; wz=oZ+(r()-0.5)*CHUNK_SIZE*0.88; } while(!canPlace(wx,wz,3)&&++tries<15);
        if(tries>=15) continue;
        const gy=findY(wx,wz), sx=1.2+r()*3.0, sy=sx*(0.5+r()*0.5), sz=1.2+r()*3.0;
        const rock = new THREE.Mesh(GEO.rock, MAT.rock);
        rock.scale.set(sx,sy,sz); rock.rotation.set((r()-0.5)*0.4,r()*Math.PI*2,(r()-0.5)*0.4);
        rock.position.set(wx,gy+sy*0.35,wz); rock.castShadow=rock.receiveShadow=true; grp.add(rock);
        lc.push({type:'sphere', x:wx, y:gy+sy*0.48, z:wz, r:Math.max(sx,sz)*0.9, topY:gy+sy*0.48+sy*0.85});
        occupy(wx,wz,Math.max(sx,sz)*1.2);
    }

    // Fleurs — teintes froides
    for(let i=0, n=20+(r()*40|0); i<n; i++){
        let wx,wz,tries=0;
        do{ wx=oX+(r()-0.5)*CHUNK_SIZE*0.9; wz=oZ+(r()-0.5)*CHUNK_SIZE*0.9; } while(!canPlace(wx,wz,1.5)&&++tries<10);
        if(tries>=10) continue;
        const gy=findY(wx,wz);
        const st = new THREE.Mesh(GEO.stem, MAT.stem); st.position.set(wx,gy+0.15,wz); grp.add(st);
        const hd = new THREE.Mesh(GEO.flower, flowerMat(FLOWER_COLORS[(r()*FLOWER_COLORS.length)|0]));
        hd.position.set(wx,gy+0.65,wz); grp.add(hd); occupy(wx,wz,0.8);
    }

    // Champignons
    for(let i=0, n=1+(r()*3|0); i<n; i++){
        let wx,wz,tries=0;
        do{ wx=oX+(r()-0.5)*CHUNK_SIZE*0.88; wz=oZ+(r()-0.5)*CHUNK_SIZE*0.88; } while(!canPlace(wx,wz,2)&&++tries<15);
        if(tries>=15) continue;
        buildMushroom(wx,wz,findY(wx,wz),r,grp); occupy(wx,wz,1.5);
        if(r()>0.5) for(let c=0,cn=2+(r()*3|0);c<cn;c++){
            const ox=wx+(r()-0.5)*2.5, oz=wz+(r()-0.5)*2.5;
            if(canPlace(ox,oz,1)){ buildMushroom(ox,oz,findY(ox,oz),r,grp); occupy(ox,oz,1); }
        }
    }


    // Herbe haute dense
        const bladeMats = [
            new THREE.MeshStandardMaterial({ color:0x2d4a18 }),
            new THREE.MeshStandardMaterial({ color:0x3a5a20 }),
            new THREE.MeshStandardMaterial({ color:0x4a6a28 }),
        ];
        const bladeGeos = [
            new THREE.CylinderGeometry(0.008,0.05,1.2,3),
            new THREE.CylinderGeometry(0.010,0.06,1.8,3),
            new THREE.CylinderGeometry(0.012,0.07,2.4,3),
        ];
        for(let vi=0; vi<3; vi++){
            const gm2 = new THREE.InstancedMesh(bladeGeos[vi], bladeMats[vi], 150);
            gm2.frustumCulled = false;
            const dm2 = new THREE.Object3D();
            for(let i=0; i<150; i++){
                const wx2=oX+(r()-0.5)*CHUNK_SIZE*0.95, wz2=oZ+(r()-0.5)*CHUNK_SIZE*0.95;
                dm2.position.set(wx2, findY(wx2,wz2), wz2);
                dm2.scale.setScalar(0.7+r()*0.8);
                dm2.rotation.y=r()*Math.PI;
                dm2.rotation.z=(r()-0.5)*0.25;
                dm2.updateMatrix();
                gm2.setMatrixAt(i, dm2.matrix);
            }
            gm2.instanceMatrix.needsUpdate=true;
            grp.add(gm2);
        }

    // Lucioles
    for(let i=0, n=2+(r()*5|0); i<n; i++){
        const wx=oX+(r()-0.5)*CHUNK_SIZE*0.88, wz=oZ+(r()-0.5)*CHUNK_SIZE*0.88;
        const fy=findY(wx,wz)+2+r()*4;
        const m = new THREE.Mesh(GEO.ff, MAT.ff); m.position.set(wx,fy,wz); grp.add(m);
        fireflyData.push({mesh:m, baseY:fy, phase:r()*10});
    }

    // Fade-in — opacité 0 → 1
    grp.traverse(obj=>{
        if(!obj.isMesh) return;
        const mats = Array.isArray(obj.material)?obj.material:[obj.material];
        const cl = mats.map(m=>{ const c=m.clone(); c._bOp=c.opacity??1; c.transparent=true; c.opacity=0; return c; });
        obj.material = Array.isArray(obj.material)?cl:cl[0];
    });

    globalColliders.push(...lc);
    scene.add(grp);
    loadedChunks.set(key, {group:grp, localColliders:lc});
    chunkFadeIn.set(key, {group:grp, alpha:0});
}

function unloadChunk(cx, cz){
    const key  = cx+','+cz;
    const data = loadedChunks.get(key);
    if(!data){ loadedChunks.delete(key); return; }
    scene.remove(data.group);
    const sharedGeos = Object.values(GEO);
    data.group.traverse(obj=>{
        if(!obj.isMesh) return;
        if(obj.geometry && !sharedGeos.includes(obj.geometry)) obj.geometry.dispose();
        const mats = Array.isArray(obj.material)?obj.material:[obj.material];
        mats.forEach(m=>{ if(m._bOp!==undefined) m.dispose(); });
    });
    for(const c of data.localColliders){ const idx=globalColliders.indexOf(c); if(idx!==-1) globalColliders.splice(idx,1); }
    data.group.traverse(obj=>{
        const fi=fireflyData.findIndex(f=>f.mesh===obj); if(fi!==-1) fireflyData.splice(fi,1);
        const wi=windObjects.findIndex(w=>w.mesh===obj);  if(wi!==-1) windObjects.splice(wi,1);
    });
    loadedChunks.delete(key); chunkFadeIn.delete(key);
}

let lastCX=Infinity, lastCZ=Infinity;
function updateChunks(px, pz){
    const cx=Math.round(px/CHUNK_SIZE), cz=Math.round(pz/CHUNK_SIZE);
    if(cx===lastCX && cz===lastCZ) return;
    lastCX=cx; lastCZ=cz;
    for(let dx=-CHUNK_RADIUS;dx<=CHUNK_RADIUS;dx++)
        for(let dz=-CHUNK_RADIUS;dz<=CHUNK_RADIUS;dz++)
            generateChunk(cx+dx, cz+dz);
    for(const [key] of loadedChunks){
        const [kcx,kcz] = key.split(',').map(Number);
        if(Math.abs(kcx-cx)>CHUNK_RADIUS+1 || Math.abs(kcz-cz)>CHUNK_RADIUS+1) unloadChunk(kcx,kcz);
    }
}

/* ═══════════════════════════════════════════════════════
   PHYSIQUE
═══════════════════════════════════════════════════════ */
const PLAYER_R = 0.4, PLAYER_H = 1.8;

function resolveColliders(nx, ny, nz){
    let onTop=false, isOnLadder=false;
    for(const c of globalColliders){
        if(c.type==='ladder'){
            if(nx>c.minX&&nx<c.maxX&&nz>c.minZ&&nz<c.maxZ && ny>c.bottom&&(ny-PLAYER_H)<c.top) isOnLadder=true;
            continue;
        }
        if(c.type==='wall'){
            if(ny>c.bottom && (ny-PLAYER_H)<c.top){
                const dx=nx-c.cx, dz=nz-c.cz;
                const penX=c.hw-Math.abs(dx), penZ=c.hd-Math.abs(dz);
                if(penX>0&&penZ>0){ if(penX<penZ) nx+=Math.sign(dx)*penX; else nz+=Math.sign(dz)*penZ; }
            }
            continue;
        }
        if(c.type==='cylinder'){
            const dx=nx-c.x, dz=nz-c.z, dXZ=Math.sqrt(dx*dx+dz*dz), cTop=c.y+c.h, pBot=ny-PLAYER_H;
            if(dXZ<c.r+PLAYER_R && ny>c.y && pBot<cTop){
                if(pBot>=cTop-0.65){ ny=cTop+PLAYER_H; onTop=true; }
                else{ const a=Math.atan2(dz,dx); nx=c.x+Math.cos(a)*(c.r+PLAYER_R); nz=c.z+Math.sin(a)*(c.r+PLAYER_R); }
            }
        } else if(c.type==='sphere'){
            const dx=nx-c.x, dz=nz-c.z, dxz=Math.sqrt(dx*dx+dz*dz), pBot=ny-PLAYER_H;
            const dy=(ny-PLAYER_H*0.5)-c.y, dist3=Math.sqrt(dx*dx+dy*dy+dz*dz);
            if(dist3<c.r+PLAYER_R && dist3>0.001){
                if(pBot>=c.topY-0.8&&dy>-0.2){ ny=c.topY+PLAYER_H; onTop=true; }
                else if(dxz>0.01){ const need=c.r+PLAYER_R*1.1; if(dxz<need){ nx+=(dx/dxz)*(need-dxz); nz+=(dz/dxz)*(need-dxz); } }
            }
        }
    }
    return {x:nx, y:ny, z:nz, onTop, isOnLadder};
}

/* ═══════════════════════════════════════════════════════
   CONTROLS & MOUVEMENT
═══════════════════════════════════════════════════════ */
const controls = new PointerLockControls(camera, document.body);
document.body.addEventListener('click', ()=>controls.lock());

const velocity = new THREE.Vector3();
const keys     = {z:false, s:false, q:false, d:false, shift:false};
let jumpVel=0, grounded=true, smoothGroundY=null;

addEventListener('keydown', e=>{
    const k=e.key.toLowerCase(); if(k in keys) keys[k]=true;
    if(e.shiftKey) keys.shift=true;
    if(e.code==='Space'&&grounded){ grounded=false; jumpVel=0.32; }
});
addEventListener('keyup', e=>{
    const k=e.key.toLowerCase(); if(k in keys) keys[k]=false;
    if(!e.shiftKey) keys.shift=false;
});

const _fwd=new THREE.Vector3(), _right=new THREE.Vector3();

function updateMovement(dt){
    const run = keys.shift && (keys.z||keys.s||keys.q||keys.d);
    _fwd.set(0,0,-1).applyQuaternion(camera.quaternion); _fwd.y=0; _fwd.normalize();
    _right.set(1,0,0).applyQuaternion(camera.quaternion); _right.y=0; _right.normalize();

    const check = resolveColliders(camera.position.x, camera.position.y, camera.position.z);

    if(check.isOnLadder){
        velocity.set(0,0,0); jumpVel=0; grounded=true;
        const climbSpeed = 0.18;
        if(keys.z) camera.position.y += climbSpeed;
        if(keys.s){
            const minY = findY(camera.position.x,camera.position.z)+PLAYER_H;
            camera.position.y = Math.max(camera.position.y-climbSpeed, minY);
            if(camera.position.y <= minY+0.3){
                const ladder = globalColliders.find(c=>c.type==='ladder');
                if(ladder){
                    const midZ=(ladder.minZ+ladder.maxZ)*0.5;
                    const dir=camera.position.z>midZ?1:-1;
                    const t=1-(camera.position.y-minY)/0.3;
                    camera.position.z += dir*0.08*t;
                }
            }
        }
        if(keys.q) camera.position.addScaledVector(_right,-0.05);
        if(keys.d) camera.position.addScaledVector(_right, 0.05);
        return;
    }

    const slope = 1-Math.abs(terrainNormal(camera.position.x,camera.position.z).y);
    const accel = (run?0.065:0.032)*(1-slope*0.5);
    if(keys.z) velocity.addScaledVector(_fwd,   accel);
    if(keys.s) velocity.addScaledVector(_fwd,  -accel);
    if(keys.q) velocity.addScaledVector(_right,-accel);
    if(keys.d) velocity.addScaledVector(_right, accel);
    velocity.multiplyScalar(0.88);

    let nx=camera.position.x+velocity.x, ny=camera.position.y, nz=camera.position.z+velocity.z;
    jumpVel=Math.max(jumpVel-0.016,-1.2); ny+=jumpVel;

    const res = resolveColliders(nx,ny,nz);
    nx=res.x; ny=res.y; nz=res.z;

    const tgy = findY(nx,nz)+PLAYER_H;
    if(ny<=tgy){
        if(jumpVel<=0&&!res.onTop){
            if(smoothGroundY===null) smoothGroundY=ny;
            smoothGroundY += (tgy-smoothGroundY)*Math.min(1,0.25+(1-slope)*0.25+dt*8);
            ny = Math.max(smoothGroundY, tgy-0.05);
        } else { ny=tgy; smoothGroundY=ny; }
        if(jumpVel<=0){ jumpVel=0; grounded=true; }
    } else if(res.onTop){
        smoothGroundY=ny; if(jumpVel<=0){ jumpVel=0; grounded=true; }
    } else { smoothGroundY=null; grounded=false; }

    camera.position.set(nx,ny,nz);
}

/* ═══════════════════════════════════════════════════════
   BOUCLE PRINCIPALE
═══════════════════════════════════════════════════════ */
const clock = new THREE.Clock();
let elapsed = DAY_DURATION*0.25; // démarre à midi
updateChunks(0,0);

function animate(){
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    // Vent sur les cônes (limité aux objets proches)
    const cx=camera.position.x, cz=camera.position.z;
    for(const w of windObjects){
        const p=w.mesh.parent?.position;
        if(p && (p.x-cx)*(p.x-cx)+(p.z-cz)*(p.z-cz) < 5000)
            w.mesh.rotation.z = Math.sin(elapsed*w.speed+w.phase)*w.amp;
    }

    // Lucioles
    for(const f of fireflyData){
        f.mesh.position.y  = f.baseY+Math.sin(elapsed+f.phase)*0.5;
        f.mesh.position.x += Math.cos(elapsed*0.3+f.phase)*0.008;
    }

    // Fade-in chunks
    for(const [key,fd] of chunkFadeIn){
        fd.alpha = Math.min(1, fd.alpha+dt*1.5);
        fd.group.traverse(obj=>{
            if(!obj.isMesh) return;
            const mats=Array.isArray(obj.material)?obj.material:[obj.material];
            for(const m of mats) if(m._bOp!==undefined) m.opacity=fd.alpha*m._bOp;
        });
        if(fd.alpha>=1){
            fd.group.traverse(obj=>{
                if(!obj.isMesh) return;
                const mats=Array.isArray(obj.material)?obj.material:[obj.material];
                for(const m of mats) if(m._bOp!==undefined){ m.opacity=m._bOp; m.transparent=m._bOp<1; }
            });
            chunkFadeIn.delete(key);
        }
    }

    updateDayNight(elapsed);
    sun.shadow.camera.updateProjectionMatrix();
    if(controls.isLocked) updateMovement(dt);
    updateChunks(camera.position.x, camera.position.z);
    renderer.render(scene, camera);
}

animate();

/* ═══════════════════════════════════════════════════════
   RESIZE
═══════════════════════════════════════════════════════ */
addEventListener('resize', ()=>{
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});

import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';

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
const scene = new THREE.Scene();
// Brouillard linéaire : near/far contrôlés dynamiquement
const FOG_NEAR = 180, FOG_FAR = 700;
scene.fog = new THREE.Fog(0x9bb4c7, FOG_NEAR, FOG_FAR);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 3000);
camera.position.set(0, 10, 0);

/* ═══════════════════════════════════════════════════════
   SKYBOX canvas 2D — dégradé garanti visible
═══════════════════════════════════════════════════════ */
const SKY_CANVAS = document.createElement('canvas');
SKY_CANVAS.width = 2; SKY_CANVAS.height = 256;
const SKY_CTX = SKY_CANVAS.getContext('2d');
const skyTex = new THREE.CanvasTexture(SKY_CANVAS);
scene.background = skyTex;

const SKY = {
    day:    { top:[0.08,0.38,0.80], hor:[0.42,0.72,0.92] },
    sunset: { top:[0.20,0.05,0.35], hor:[1.00,0.28,0.00] },
    night:  { top:[0.01,0.02,0.08], hor:[0.04,0.07,0.16] },
    dawn:   { top:[0.18,0.05,0.30], hor:[1.00,0.42,0.10] },
};

function lerp3(a,b,t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
function toCSS(rgb){ return `rgb(${(rgb[0]*255)|0},${(rgb[1]*255)|0},${(rgb[2]*255)|0})`; }

let _top = SKY.day.top.slice(), _hor = SKY.day.hor.slice();
function setSky(s){ _top=s.top.slice(); _hor=s.hor.slice(); }
function lerpSky(a,b,t){ _top=lerp3(a.top,b.top,t); _hor=lerp3(a.hor,b.hor,t); }
function drawSky(){
    const g = SKY_CTX.createLinearGradient(0,0,0,256);
    g.addColorStop(0, toCSS(_top)); g.addColorStop(1, toCSS(_hor));
    SKY_CTX.fillStyle = g; SKY_CTX.fillRect(0,0,2,256);
    skyTex.needsUpdate = true;
}

/* ═══════════════════════════════════════════════════════
   LUMIÈRES
═══════════════════════════════════════════════════════ */
const hemi = new THREE.HemisphereLight(0xddeeff, 0x3d2f1b, 1.2);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff5e0, 3.0);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -200;
sun.shadow.camera.right = sun.shadow.camera.top = 200;
sun.shadow.camera.far = 1500;
sun.shadow.bias = -0.0005;
scene.add(sun);

// Lumière ambiante nocturne — clé pour voir la nuit
const nightAmbient = new THREE.AmbientLight(0x1a2a4a, 0.0);
scene.add(nightAmbient);

const moonLight = new THREE.DirectionalLight(0x4466bb, 0);
scene.add(moonLight);

/* ═══════════════════════════════════════════════════════
   SPRITES SOLEIL & LUNE — plus réalistes
   Soleil : disque net + halo doux + corona
═══════════════════════════════════════════════════════ */
function makeSunDisc(){
    // Disque solaire net avec limbe sombre (réaliste)
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const ctx = c.getContext('2d');
    // Corona externe
    const gc = ctx.createRadialGradient(256,256,0,256,256,256);
    gc.addColorStop(0,   'rgba(255,250,200,1)');
    gc.addColorStop(0.12,'rgba(255,245,180,1)');
    gc.addColorStop(0.14,'rgba(255,220,100,0.6)');
    gc.addColorStop(0.30,'rgba(255,180,40,0.25)');
    gc.addColorStop(0.60,'rgba(255,140,20,0.08)');
    gc.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = gc; ctx.fillRect(0,0,512,512);
    // Disque opaque net par-dessus
    ctx.beginPath(); ctx.arc(256,256,62,0,Math.PI*2);
    const gd = ctx.createRadialGradient(240,240,0,256,256,62);
    gd.addColorStop(0,   'rgba(255,255,230,1)');
    gd.addColorStop(0.7, 'rgba(255,240,160,1)');
    gd.addColorStop(1,   'rgba(230,180,60,1)');
    ctx.fillStyle = gd; ctx.fill();
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
    sp.scale.setScalar(380);
    return sp;
}

function makeMoonDisc(){
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const gc = ctx.createRadialGradient(128,128,0,128,128,128);
    gc.addColorStop(0,   'rgba(230,240,255,1)');
    gc.addColorStop(0.10,'rgba(220,235,255,1)');
    gc.addColorStop(0.12,'rgba(180,200,240,0.5)');
    gc.addColorStop(0.35,'rgba(100,130,200,0.15)');
    gc.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = gc; ctx.fillRect(0,0,256,256);
    ctx.beginPath(); ctx.arc(128,128,38,0,Math.PI*2);
    const gd = ctx.createRadialGradient(118,118,0,128,128,38);
    gd.addColorStop(0,   'rgba(250,255,255,1)');
    gd.addColorStop(0.8, 'rgba(200,220,250,1)');
    gd.addColorStop(1,   'rgba(160,185,230,1)');
    ctx.fillStyle = gd; ctx.fill();
    // Cratères légers
    ctx.globalAlpha = 0.12;
    [[145,110,8],[115,140,6],[135,135,5]].forEach(([x,y,r])=>{
        ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
        ctx.fillStyle='rgba(0,0,0,1)'; ctx.fill();
    });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
    sp.scale.setScalar(200);
    return sp;
}

const sunSprite  = makeSunDisc();
const moonSprite = makeMoonDisc();
scene.add(sunSprite, moonSprite);

/* ═══════════════════════════════════════════════════════
   ÉTOILES
═══════════════════════════════════════════════════════ */
const STAR_COUNT = 1200;
const starPos = new Float32Array(STAR_COUNT*3), starSz = new Float32Array(STAR_COUNT);
for(let i=0;i<STAR_COUNT;i++){
    const th=2*Math.PI*Math.random(), ph=Math.acos(2*Math.random()-1), r=2400;
    starPos[i*3]   = r*Math.sin(ph)*Math.cos(th);
    starPos[i*3+1] = Math.abs(r*Math.cos(ph))+80;
    starPos[i*3+2] = r*Math.sin(ph)*Math.sin(th);
    starSz[i] = 1.8 + Math.random()*4.0;
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos,3));
starGeo.setAttribute('size',     new THREE.BufferAttribute(starSz,1));
const starMat = new THREE.ShaderMaterial({
    uniforms:{ uOp:{value:0}, uT:{value:0} },
    vertexShader:`attribute float size;uniform float uT;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=size*(1.0+0.3*sin(uT*2.0+size*13.7));gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float uOp;void main(){float d=length(gl_PointCoord-0.5);if(d>0.5)discard;float b=pow(1.0-d*2.0,1.5);gl_FragColor=vec4(1.0,1.0,0.95,b*uOp);}`,
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
});
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

/* ═══════════════════════════════════════════════════════
   MONTAGNES LOINTAINES — décor LOD ultra-simple
   Mesh silhouette généré une seule fois, placé à ~1200u
═══════════════════════════════════════════════════════ */
function buildDistantMountains(){
    const matMtn = new THREE.MeshStandardMaterial({ color:0x4a5a6a, roughness:1, metalness:0 });
    const grp = new THREE.Group();

    // Disposition en anneau autour de l'origine
    const RING_R  = 1100;   // rayon des sommets
    const N_MTN   = 28;     // nombre de pics
    const SEG     = 8;      // segments par montagne (très bas-poly)

    for(let i=0;i<N_MTN;i++){
        const angle  = (i / N_MTN) * Math.PI * 2 + Math.random()*0.4;
        const cx     = Math.cos(angle) * RING_R;
        const cz     = Math.sin(angle) * RING_R;
        const height = 120 + Math.random() * 180;   // 120–300u de haut
        const baseR  = 80  + Math.random() * 120;   // rayon base

        // Cône très bas-poly (=3 faces visibles suffisent en silhouette)
        const geo = new THREE.ConeGeometry(baseR, height, SEG, 1);
        // Déformer légèrement les sommets pour aspect naturel
        const pos = geo.attributes.position.array;
        for(let v=0;v<pos.length;v+=3){
            const vx=pos[v], vy=pos[v+1], vz=pos[v+2];
            if(vy < height*0.45){ // seulement la base
                pos[v]   += (Math.random()-0.5)*baseR*0.25;
                pos[v+2] += (Math.random()-0.5)*baseR*0.25;
            }
        }
        geo.computeVertexNormals();

        const mesh = new THREE.Mesh(geo, matMtn);
        mesh.position.set(cx, -8, cz);
        mesh.castShadow = false; mesh.receiveShadow = false;
        grp.add(mesh);

        // Neige au sommet (simple cone blanc plus petit)
        if(height > 160){
            const snowH = height * 0.25;
            const sg = new THREE.ConeGeometry(baseR*0.28, snowH, SEG, 1);
            const sm = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({color:0xeef4ff,roughness:1}));
            sm.position.set(cx, -8 + height*0.5 - snowH*0.3, cz);
            grp.add(sm);
        }
    }
    scene.add(grp);
    return grp;
}
const mtnGroup = buildDistantMountains();

/* ═══════════════════════════════════════════════════════
   CYCLE JOUR / NUIT
═══════════════════════════════════════════════════════ */
const DAY_DURATION = 1200, ORBIT_R = 1400;
const _sd = new THREE.Vector3(), _md = new THREE.Vector3();

function updateDayNight(elapsed){
    const angle = ((elapsed/DAY_DURATION)*Math.PI*2) % (Math.PI*2);
    const sinA  = Math.sin(angle);
    const sf    = Math.max(0,sinA),  sfS = sf*sf*(3-2*sf);
    const mf    = Math.max(0,-sinA), mfS = mf*mf*(3-2*mf);

    const sunX = Math.cos(angle)*ORBIT_R, sunY = Math.sin(angle)*ORBIT_R;
    sun.position.set(sunX, sunY, ORBIT_R*0.25);
    moonLight.position.set(-sunX,-sunY,ORBIT_R*0.25);

    const cp = camera.position;
    _sd.set(sunX,sunY,ORBIT_R*0.25).normalize();
    _md.copy(_sd).negate();
    sunSprite.position.copy(cp).addScaledVector(_sd,1350);
    moonSprite.position.copy(cp).addScaledVector(_md,1350);

    // Lumières
    sun.intensity       = 0.05 + sfS * 3.0;
    moonLight.intensity = 0.10 + mfS * 0.40;
    hemi.intensity      = 0.25 + sfS * 0.95;
    // Ambiant nuit — assure la visibilité minimale
    nightAmbient.intensity = 0.35 * mfS;

    sunSprite.material.opacity  = Math.pow(sf,0.30);
    moonSprite.material.opacity = Math.pow(mf,0.30);

    renderer.toneMappingExposure = 0.9 + sfS*0.4;

    // Brouillard
    const fogColor = new THREE.Color();
    fogColor.lerpColors(new THREE.Color(0x04091f), new THREE.Color(0x9bb4c7), sfS);
    scene.fog.color.copy(fogColor);
    // Nuit → brouillard plus resserré pour ne pas tout assombrir
    scene.fog.near = 180 + sfS*20;
    scene.fog.far  = 400 + sfS*300;

    // Étoiles
    starMat.uniforms.uOp.value = Math.max(0, 1-sfS*2.0)*0.92;
    starMat.uniforms.uT.value  = elapsed;
    stars.position.copy(cp);

    // Couleur ciel
    const a = angle;
    if     (a < Math.PI*0.20) lerpSky(SKY.dawn,   SKY.day,    a/(Math.PI*0.20));
    else if(a < Math.PI*0.75) setSky(SKY.day);
    else if(a < Math.PI*1.10) lerpSky(SKY.day,    SKY.sunset, (a-Math.PI*0.75)/(Math.PI*0.35));
    else if(a < Math.PI*1.40) lerpSky(SKY.sunset, SKY.night,  (a-Math.PI*1.10)/(Math.PI*0.30));
    else if(a < Math.PI*1.75) setSky(SKY.night);
    else                       lerpSky(SKY.night,  SKY.dawn,   (a-Math.PI*1.75)/(Math.PI*0.25));
    drawSky();

    // Montagnes s'assombrissent la nuit
    mtnGroup.children.forEach(m=>{
        if(m.material && m.material.color){
            m.material.color.lerpColors(new THREE.Color(0x1a2030), new THREE.Color(0x4a5a6a), sfS);
        }
    });
}

/* ═══════════════════════════════════════════════════════
   MUSIQUE
═══════════════════════════════════════════════════════ */
function initMusic(){
    const audio = new Audio('background_sound.mp3'); audio.volume=0.45;
    const play  = ()=>{audio.currentTime=0;audio.play().catch(()=>{});};
    audio.addEventListener('ended',()=>setTimeout(play,120000));
    let started=false;
    document.addEventListener('click',()=>{if(started)return;started=true;play();},{once:true});
}
initMusic();

/* ═══════════════════════════════════════════════════════
   SIMPLEX NOISE
═══════════════════════════════════════════════════════ */
const SEED=Math.random()*65536|0; console.log('Seed:',SEED);
function buildPerm(seed){
    const p=new Uint8Array(256);for(let i=0;i<256;i++)p[i]=i;let s=seed;
    for(let i=255;i>0;i--){s=(s*1664525+1013904223)&0xffffffff;const j=(s>>>24)%(i+1);[p[i],p[j]]=[p[j],p[i]];}
    const perm=new Uint8Array(512);for(let i=0;i<512;i++)perm[i]=p[i&255];return perm;
}
const perm=buildPerm(SEED);
const GRAD=[[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
function simplex2(xin,yin){
    const F2=0.5*(Math.sqrt(3)-1),G2=(3-Math.sqrt(3))/6;
    const s=(xin+yin)*F2,i=Math.floor(xin+s)|0,j=Math.floor(yin+s)|0,t=(i+j)*G2;
    const x0=xin-(i-t),y0=yin-(j-t),i1=x0>y0?1:0,j1=x0>y0?0:1;
    const x1=x0-i1+G2,y1=y0-j1+G2,x2=x0-1+2*G2,y2=y0-1+2*G2;
    const ii=i&255,jj=j&255,g0=perm[ii+perm[jj]]%8,g1=perm[ii+i1+perm[jj+j1]]%8,g2=perm[ii+1+perm[jj+1]]%8;
    let n0=0,n1=0,n2=0;
    let t0=0.5-x0*x0-y0*y0;if(t0>=0){t0*=t0;n0=t0*t0*(GRAD[g0][0]*x0+GRAD[g0][1]*y0);}
    let t1=0.5-x1*x1-y1*y1;if(t1>=0){t1*=t1;n1=t1*t1*(GRAD[g1][0]*x1+GRAD[g1][1]*y1);}
    let t2=0.5-x2*x2-y2*y2;if(t2>=0){t2*=t2;n2=t2*t2*(GRAD[g2][0]*x2+GRAD[g2][1]*y2);}
    return 70*(n0+n1+n2);
}
function fbm(x,z){return simplex2(x*0.002,z*0.002)*14+simplex2(x*0.008,z*0.008)*5+simplex2(x*0.025,z*0.025)*1.5;}

/* ═══════════════════════════════════════════════════════
   HEIGHTMAP
═══════════════════════════════════════════════════════ */
const HSTEP=0.5, hCache=new Map();
function heightAt(wx,wz){
    const kx=Math.round(wx/HSTEP)|0,kz=Math.round(wz/HSTEP)|0,key=kx*100003+kz;
    let h=hCache.get(key);if(h===undefined){h=fbm(wx,wz);hCache.set(key,h);}return h;
}
function findY(wx,wz){
    const x0=Math.floor(wx/HSTEP)*HSTEP,z0=Math.floor(wz/HSTEP)*HSTEP,fu=(wx-x0)/HSTEP,fv=(wz-z0)/HSTEP;
    return heightAt(x0,z0)*(1-fu)*(1-fv)+heightAt(x0+HSTEP,z0)*fu*(1-fv)+heightAt(x0,z0+HSTEP)*(1-fu)*fv+heightAt(x0+HSTEP,z0+HSTEP)*fu*fv;
}
function terrainNormal(wx,wz){const d=HSTEP;return new THREE.Vector3(findY(wx-d,wz)-findY(wx+d,wz),2*d,findY(wx,wz-d)-findY(wx,wz+d)).normalize();}

/* ═══════════════════════════════════════════════════════
   MATÉRIAUX
═══════════════════════════════════════════════════════ */
const MAT={
    trunk: new THREE.MeshStandardMaterial({color:0x3a2010}),
    cone0: new THREE.MeshStandardMaterial({color:0x0e220e}),
    cone1: new THREE.MeshStandardMaterial({color:0x152d15}),
    cone2: new THREE.MeshStandardMaterial({color:0x1a3a1a}),
    rock:  new THREE.MeshStandardMaterial({color:0x777777,roughness:1}),
    ground:new THREE.MeshStandardMaterial({color:0x243b1d,roughness:1}),
    stem:  new THREE.MeshStandardMaterial({color:0x2d4c1e}),
    grass: new THREE.MeshStandardMaterial({color:0x3f6b2d}),
    ff:    new THREE.MeshBasicMaterial({color:0xffffaa}),
    // Tour
    stone: new THREE.MeshStandardMaterial({color:0x888070,roughness:0.9}),
    stoneDark: new THREE.MeshStandardMaterial({color:0x665a4a,roughness:1}),
    // Champignons
    mushCap: new THREE.MeshStandardMaterial({color:0xcc3300}),
    mushCap2:new THREE.MeshStandardMaterial({color:0xaa2200}),
    mushSpot:new THREE.MeshStandardMaterial({color:0xffffff}),
    mushStem:new THREE.MeshStandardMaterial({color:0xe8dcc8}),
};
const CONE_MATS=[MAT.cone0,MAT.cone1,MAT.cone2];
const FLOWER_COLORS=[0xff4444,0x4444ff,0xffff55,0xffffff,0xff66cc];
const flowerCache={};
function flowerMat(hex){if(!flowerCache[hex])flowerCache[hex]=new THREE.MeshStandardMaterial({color:hex,emissive:hex,emissiveIntensity:0.1});return flowerCache[hex];}
const GEO={
    grass: new THREE.CylinderGeometry(0.015,0.04,0.5,3),
    ff:    new THREE.SphereGeometry(0.07,4,4),
    stem:  new THREE.CylinderGeometry(0.025,0.035,0.8,5),
    flower:new THREE.SphereGeometry(0.14,6,6),
    rock:  new THREE.DodecahedronGeometry(1,0),
};

/* ═══════════════════════════════════════════════════════
   TOUR MÉDIÉVALE CARRÉE
   - Corps carré avec créneaux
   - Escalier hélicoïdal autour du périmètre (marches larges)
   - Toit pointu haut
   - Collision : piliers d'angle + murs + marches + barrière sommet
═══════════════════════════════════════════════════════ */
function buildTower(wx, wz, gy, colliders){
    const grp = new THREE.Group();
    const BASE = 8;       // demi-côté de la tour (16u total)
    const WALL_H = 36;    // hauteur des murs
    const WALL_T = 1.8;   // épaisseur des murs
    const ROOF_H = 20;    // hauteur du toit

    /* ── Murs ── */
    // 4 murs plats + 4 piliers d'angle
    const wallMat = MAT.stone;

    // Mur avant/arrière
    const wallFBGeo = new THREE.BoxGeometry(BASE*2, WALL_H, WALL_T);
    [-1,1].forEach(side=>{
        const w = new THREE.Mesh(wallFBGeo, wallMat);
        w.position.set(0, WALL_H/2, side*BASE);
        w.castShadow = w.receiveShadow = true;
        grp.add(w);
        // Collision mur Z
        colliders.push({type:'box',
            x:wx, z:wz+side*BASE,
            y:gy, topY:gy+WALL_H,
            hw:BASE, hd:WALL_T/2+0.3
        });
    });
    // Mur gauche/droite
    const wallLRGeo = new THREE.BoxGeometry(WALL_T, WALL_H, BASE*2);
    [-1,1].forEach(side=>{
        const w = new THREE.Mesh(wallLRGeo, wallMat);
        w.position.set(side*BASE, WALL_H/2, 0);
        w.castShadow = w.receiveShadow = true;
        grp.add(w);
        // Collision mur X
        colliders.push({type:'box',
            x:wx+side*BASE, z:wz,
            y:gy, topY:gy+WALL_H,
            hw:WALL_T/2+0.3, hd:BASE
        });
    });

    /* ── Piliers d'angle ── */
    const pillarGeo = new THREE.CylinderGeometry(1.8, 2.0, WALL_H+3, 8);
    [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([sx,sz])=>{
        const px = sx*BASE, pz = sz*BASE;
        const p = new THREE.Mesh(pillarGeo, MAT.stoneDark);
        p.position.set(px, WALL_H/2+1.5, pz);
        p.castShadow = p.receiveShadow = true;
        grp.add(p);
        // Collision pilier cylindrique
        colliders.push({type:'cylinder',
            x:wx+px, y:gy, z:wz+pz,
            r:2.2, h:WALL_H+4
        });
    });

    /* ── Sol intérieur ── */
    const floorGeo = new THREE.BoxGeometry(BASE*2-WALL_T*2, 0.6, BASE*2-WALL_T*2);
    const floor = new THREE.Mesh(floorGeo, MAT.stoneDark);
    floor.position.set(0, 0.3, 0);
    floor.receiveShadow = true;
    grp.add(floor);

    /* ── Créneaux au sommet ── */
    const merH=2.5, merW=2.4, merD=1.8;
    const merGeo = new THREE.BoxGeometry(merW, merH, merD);
    // Créneaux sur les 4 faces
    const crenel_cfg = [
        // face +Z
        {axis:'z', side:+1, offsets:[-5,-1.5,2,5.5]},
        // face -Z
        {axis:'z', side:-1, offsets:[-5,-1.5,2,5.5]},
        // face +X
        {axis:'x', side:+1, offsets:[-5,-1.5,2,5.5]},
        // face -X
        {axis:'x', side:-1, offsets:[-5,-1.5,2,5.5]},
    ];
    crenel_cfg.forEach(cfg=>{
        cfg.offsets.forEach(off=>{
            const m = new THREE.Mesh(merGeo, wallMat);
            if(cfg.axis==='z'){
                m.position.set(off, WALL_H+merH/2, cfg.side*(BASE+merD/2-0.1));
            } else {
                m.position.set(cfg.side*(BASE+merD/2-0.1), WALL_H+merH/2, off);
                m.rotation.y = Math.PI/2;
            }
            m.castShadow = true;
            grp.add(m);
        });
    });

    /* ── Toit pointu ── */
    const roofGeo = new THREE.ConeGeometry(BASE*1.42, ROOF_H, 4, 1);
    roofGeo.rotateY(Math.PI/4); // aligner sur les coins carrés
    const roof = new THREE.Mesh(roofGeo, MAT.stoneDark);
    roof.position.set(0, WALL_H+ROOF_H/2+merH, 0);
    roof.castShadow = true;
    grp.add(roof);

    /* ── ESCALIER autour du périmètre extérieur ──
       Marches larges, pas en zigzag :
       On fait le tour dans le sens horaire en 4 segments (un par face),
       chaque segment contient N marches successives.
       Chaque marche = boîte posée contre le mur extérieur.
    ── */
    const STAIR_W  = 3.2;   // largeur marche (direction "long du mur")
    const STAIR_D  = 1.6;   // profondeur marche (direction "hors du mur")
    const STAIR_RISE = 0.55; // hauteur par marche

    // Nombre de marches par face pour atteindre le sommet
    const facelen = BASE * 2;               // longueur d'une face = 16
    const stepsPerFace = Math.floor(facelen / STAIR_W); // ~5
    const totalSteps = stepsPerFace * 4;
    const totalHeight = WALL_H + 1;
    const risePerStep = totalHeight / totalSteps;

    // 4 faces dans l'ordre : +Z (gauche→droite), +X (haut→bas en Z), -Z, -X
    const faces = [
        // [face normale, position fixe, direction de progression, signe offset]
        { norm:[0,0,1],  fixed:'z', fixedVal:+BASE+STAIR_D*0.5, prog:'x', from:-(BASE-STAIR_W*0.5), dir:+1 },
        { norm:[1,0,0],  fixed:'x', fixedVal:+BASE+STAIR_D*0.5, prog:'z', from:-(BASE-STAIR_W*0.5), dir:+1 },
        { norm:[0,0,-1], fixed:'z', fixedVal:-(BASE+STAIR_D*0.5), prog:'x', from:+(BASE-STAIR_W*0.5), dir:-1 },
        { norm:[-1,0,0], fixed:'x', fixedVal:-(BASE+STAIR_D*0.5), prog:'z', from:+(BASE-STAIR_W*0.5), dir:-1 },
    ];

    let stepIndex = 0;
    faces.forEach(face=>{
        for(let s=0;s<stepsPerFace;s++){
            const stepY  = stepIndex * risePerStep;
            const progPos = face.from + face.dir * s * STAIR_W + face.dir*STAIR_W*0.5;

            const stepGeo = new THREE.BoxGeometry(
                face.fixed==='z' ? STAIR_W : STAIR_D,
                STAIR_RISE + 0.05,
                face.fixed==='z' ? STAIR_D : STAIR_W
            );
            const step = new THREE.Mesh(stepGeo, wallMat);
            step.castShadow = step.receiveShadow = true;

            const sx = face.fixed==='z' ? progPos : face.fixedVal;
            const sz = face.fixed==='z' ? face.fixedVal : progPos;
            step.position.set(sx, stepY + STAIR_RISE/2, sz);
            grp.add(step);

            // Collider plateforme pour chaque marche
            colliders.push({type:'platform',
                x:wx+sx, z:wz+sz,
                y:gy+stepY,
                topY:gy+stepY+STAIR_RISE,
                hw: (face.fixed==='z' ? STAIR_W : STAIR_D)*0.5 + 0.1,
                hd: (face.fixed==='z' ? STAIR_D : STAIR_W)*0.5 + 0.1,
                nx:0, nz:0
            });
            stepIndex++;
        }
    });

    /* ── Palier au sommet ── */
    const palierGeo = new THREE.BoxGeometry(BASE*2+STAIR_D*2, 0.5, BASE*2+STAIR_D*2);
    const palier = new THREE.Mesh(palierGeo, wallMat);
    palier.position.set(0, WALL_H+0.25, 0);
    palier.receiveShadow = true;
    grp.add(palier);
    // Collision palier
    colliders.push({type:'platform',
        x:wx, z:wz,
        y:gy+WALL_H,
        topY:gy+WALL_H+0.5,
        hw:BASE+STAIR_D+0.3, hd:BASE+STAIR_D+0.3,
        nx:0, nz:0
    });

    /* ── Barrière au sommet ── */
    const barrH = 1.5, barrT = 0.4;
    const barrY = WALL_H+0.5+barrH/2;
    const barrOuter = BASE+STAIR_D;
    // 4 côtés
    [
        {geo:new THREE.BoxGeometry(barrOuter*2+barrT*2, barrH, barrT), px:0,  pz:+(barrOuter), cx_:0, cz_:+(barrOuter), hw_:barrOuter+barrT, hd_:barrT*0.5+0.3},
        {geo:new THREE.BoxGeometry(barrOuter*2+barrT*2, barrH, barrT), px:0,  pz:-(barrOuter), cx_:0, cz_:-(barrOuter), hw_:barrOuter+barrT, hd_:barrT*0.5+0.3},
        {geo:new THREE.BoxGeometry(barrT, barrH, barrOuter*2),         px:+(barrOuter), pz:0, cx_:+(barrOuter), cz_:0, hw_:barrT*0.5+0.3, hd_:barrOuter},
        {geo:new THREE.BoxGeometry(barrT, barrH, barrOuter*2),         px:-(barrOuter), pz:0, cx_:-(barrOuter), cz_:0, hw_:barrT*0.5+0.3, hd_:barrOuter},
    ].forEach(b=>{
        const bm = new THREE.Mesh(b.geo, MAT.stoneDark);
        bm.position.set(b.px, barrY, b.pz);
        bm.castShadow = true;
        grp.add(bm);
        colliders.push({type:'box',
            x:wx+b.cx_, z:wz+b.cz_,
            y:gy+WALL_H+0.5, topY:gy+WALL_H+0.5+barrH,
            hw:b.hw_, hd:b.hd_
        });
    });

    grp.position.set(wx, gy, wz);
    scene.add(grp);
    return grp;
}

/* ═══════════════════════════════════════════════════════
   GLOBAUX
═══════════════════════════════════════════════════════ */
const windObjects=[], fireflyData=[], globalColliders=[];

/* ═══════════════════════════════════════════════════════
   CHAMPIGNONS
═══════════════════════════════════════════════════════ */
function buildMushroom(wx,wz,gy,rng,grp){
    const sc=0.12+rng()*0.25, sH=0.45*sc, cR=0.5*sc;
    const sm=new THREE.Mesh(new THREE.CylinderGeometry(cR*0.28,cR*0.35,sH,6),MAT.mushStem);
    sm.position.set(wx,gy+sH*0.5,wz); grp.add(sm);
    const cm=new THREE.Mesh(new THREE.SphereGeometry(cR,8,5,0,Math.PI*2,0,Math.PI*0.55),rng()>0.3?MAT.mushCap:MAT.mushCap2);
    cm.position.set(wx,gy+sH+cR*0.05,wz); grp.add(cm);
    const sg=new THREE.SphereGeometry(cR*0.09,4,4);
    for(let s=0;s<3+(rng()*3|0);s++){
        const ang=rng()*Math.PI*2, rad=cR*(0.2+rng()*0.55);
        const spot=new THREE.Mesh(sg,MAT.mushSpot);
        spot.position.set(wx+Math.cos(ang)*rad, gy+sH+Math.sqrt(Math.max(0,cR*cR-rad*rad))*0.9, wz+Math.sin(ang)*rad);
        grp.add(spot);
    }
}

/* ═══════════════════════════════════════════════════════
   CHUNKS — LOD selon distance
═══════════════════════════════════════════════════════ */
const CHUNK_SIZE=80, CHUNK_SEGS=18, CHUNK_SEGS_FAR=8, CHUNK_RADIUS=3;
const loadedChunks=new Map(), chunkFadeIn=new Map();

// Tour placée une seule fois au centre du premier chunk
let towerBuilt = false;

function seededRng(seed){
    let s=(seed^0xdeadbeef)|0;
    return()=>{s=Math.imul(s^(s>>>16),0x45d9f3b);s=Math.imul(s^(s>>>16),0x45d9f3b);s^=s>>>16;return(s>>>0)/0xffffffff;};
}

function generateChunk(cx,cz){
    const key=cx+','+cz;
    if(loadedChunks.has(key))return;
    loadedChunks.set(key,null);
    requestAnimationFrame(()=>_buildChunk(cx,cz,key));
}

function _buildChunk(cx,cz,key){
    if(!loadedChunks.has(key))return;
    const oX=cx*CHUNK_SIZE, oZ=cz*CHUNK_SIZE;
    const rng=seededRng(cx*73856093^cz*19349663);
    const grp=new THREE.Group(), lc=[];

    // Distance au joueur pour LOD
    const distChunks = Math.max(Math.abs(cx-lastCX), Math.abs(cz-lastCZ));
    const isFar = distChunks >= 2;  // chunks ≥2 cases = LOD bas

    /* ── Terrain ── */
    const segs = isFar ? CHUNK_SEGS_FAR : CHUNK_SEGS;
    const tgeo=new THREE.PlaneGeometry(CHUNK_SIZE,CHUNK_SIZE,segs,segs);
    const vp=tgeo.attributes.position.array;
    for(let i=0;i<vp.length;i+=3) vp[i+2]=fbm(oX+vp[i],oZ-vp[i+1]);
    tgeo.computeVertexNormals();
    const terr=new THREE.Mesh(tgeo,MAT.ground);
    terr.rotation.x=-Math.PI/2; terr.position.set(oX,0,oZ);
    terr.receiveShadow=true; grp.add(terr);

    /* ── Arbres ── */
    const treeN = isFar ? 4+(rng()*4|0) : 7+(rng()*7|0);
    const tpts=[];
    for(let i=0;i<treeN;i++){
        let wx,wz,ok=false,tries=0;
        do{
            wx=oX+(rng()-0.5)*CHUNK_SIZE*0.85;
            wz=oZ+(rng()-0.5)*CHUNK_SIZE*0.85;
            ok=!tpts.some(p=>{const dx=p[0]-wx,dz=p[1]-wz;return dx*dx+dz*dz<16*16;});
        }while(!ok&&++tries<12);
        tpts.push([wx,wz]);

        const gy=findY(wx,wz), h=28+rng()*18, tr=1.4+rng()*1.0;
        const trunkH=h*(0.28+rng()*0.08);
        const tgr=new THREE.Group();

        // Tronc
        const trunk=new THREE.Mesh(
            new THREE.CylinderGeometry(tr*0.55,tr*1.4,trunkH+6, isFar?6:9),
            MAT.trunk
        );
        trunk.position.y=trunkH/2-3;
        trunk.castShadow=true; tgr.add(trunk);

        // Feuillage — ombre activée
        const layers = isFar ? 4+(rng()*3|0) : 9+(rng()*5|0);
        const foliageH=h-trunkH;
        for(let li=0;li<layers;li++){
            const ratio=li/(layers-1);
            const coneY=trunkH+ratio*foliageH*0.90;
            const radius=tr*4.5*(1-ratio*0.72)+1.5;
            const coneH=(foliageH/layers)*2.2;
            const cone=new THREE.Mesh(
                new THREE.ConeGeometry(radius,coneH, isFar?6:8),
                CONE_MATS[(rng()*3)|0]
            );
            cone.position.y=coneY;
            cone.castShadow=true;   // ← ombre des feuilles
            cone.receiveShadow=false;
            tgr.add(cone);
            if(!isFar) windObjects.push({mesh:cone,phase:rng()*10,speed:0.5,amp:0.012});
        }

        tgr.position.set(wx,gy,wz); grp.add(tgr);
        if(!isFar) lc.push({type:'cylinder',x:wx,y:gy,z:wz,r:tr*1.7,h:trunkH+6});
    }

    if(!isFar){
        /* ── Rochers ── */
        for(let i=0,n=3+(rng()*7|0);i<n;i++){
            const wx=oX+(rng()-0.5)*CHUNK_SIZE*0.88, wz=oZ+(rng()-0.5)*CHUNK_SIZE*0.88, gy=findY(wx,wz);
            const sx=1.0+rng()*2.6, sy=sx*(0.5+rng()*0.5), sz=1.0+rng()*2.6;
            const rock=new THREE.Mesh(GEO.rock,MAT.rock);
            rock.scale.set(sx,sy,sz);
            rock.rotation.set((rng()-0.5)*0.4,rng()*Math.PI*2,(rng()-0.5)*0.4);
            rock.position.set(wx,gy+sy*0.48,wz);
            rock.castShadow=rock.receiveShadow=true; grp.add(rock);
            lc.push({type:'sphere',x:wx,y:gy+sy*0.48,z:wz,r:Math.max(sx,sz)*0.9,topY:gy+sy*0.48+sy*0.85});
        }

        /* ── Fleurs ── */
        for(let i=0,n=25+(rng()*50|0);i<n;i++){
            const wx=oX+(rng()-0.5)*CHUNK_SIZE*0.9, wz=oZ+(rng()-0.5)*CHUNK_SIZE*0.9, gy=findY(wx,wz);
            const st=new THREE.Mesh(GEO.stem,MAT.stem); st.position.set(wx,gy+0.4,wz); grp.add(st);
            const hd=new THREE.Mesh(GEO.flower,flowerMat(FLOWER_COLORS[(rng()*FLOWER_COLORS.length)|0]));
            hd.position.set(wx,gy+0.9,wz); grp.add(hd);
        }

        /* ── Champignons ── */
        for(let i=0,n=1+(rng()*5|0);i<n;i++){
            const wx=oX+(rng()-0.5)*CHUNK_SIZE*0.88, wz=oZ+(rng()-0.5)*CHUNK_SIZE*0.88;
            buildMushroom(wx,wz,findY(wx,wz),rng,grp);
            if(rng()>0.5) for(let c=0,cn=2+(rng()*4|0);c<cn;c++){
                const ox=wx+(rng()-0.5)*2.5, oz=wz+(rng()-0.5)*2.5;
                buildMushroom(ox,oz,findY(ox,oz),rng,grp);
            }
        }

        /* ── Tour (une seule fois, chunk 0,0) ── */
        if(cx===0&&cz===0&&!towerBuilt){
            towerBuilt=true;
            const tx=oX+25, tz=oZ+20;
            buildTower(tx, tz, findY(tx,tz), globalColliders);
        }
    }

    /* ── Herbe ── */
    const gn = isFar ? 0 : 50+(rng()*50|0);
    if(gn>0){
        const gm=new THREE.InstancedMesh(GEO.grass,MAT.grass,gn);
        gm.frustumCulled=false;
        const dummy=new THREE.Object3D();
        for(let i=0;i<gn;i++){
            const wx=oX+(rng()-0.5)*CHUNK_SIZE, wz=oZ+(rng()-0.5)*CHUNK_SIZE;
            dummy.position.set(wx,findY(wx,wz)+0.25,wz);
            dummy.scale.setScalar(0.5+rng()*0.8);
            dummy.rotation.y=rng()*Math.PI;
            dummy.updateMatrix(); gm.setMatrixAt(i,dummy.matrix);
        }
        gm.instanceMatrix.needsUpdate=true; grp.add(gm);
    }

    /* ── Lucioles ── */
    if(!isFar){
        for(let i=0,n=2+(rng()*6|0);i<n;i++){
            const wx=oX+(rng()-0.5)*CHUNK_SIZE*0.88, wz=oZ+(rng()-0.5)*CHUNK_SIZE*0.88;
            const fy=findY(wx,wz)+2+rng()*4;
            const m=new THREE.Mesh(GEO.ff,MAT.ff);
            m.position.set(wx,fy,wz); grp.add(m);
            fireflyData.push({mesh:m,baseY:fy,phase:rng()*10});
        }
    }

    /* ── Fade-in ── */
    grp.traverse(obj=>{
        if(!obj.isMesh)return;
        const mats=Array.isArray(obj.material)?obj.material:[obj.material];
        const cl=mats.map(m=>{const c=m.clone();c._bOp=c.opacity??1;c.transparent=true;c.opacity=0;return c;});
        obj.material=Array.isArray(obj.material)?cl:cl[0];
    });

    globalColliders.push(...lc);
    scene.add(grp);
    loadedChunks.set(key,{group:grp,localColliders:lc});
    chunkFadeIn.set(key,{group:grp,alpha:0});
}

function unloadChunk(cx,cz){
    const key=cx+','+cz, data=loadedChunks.get(key);
    if(!data){loadedChunks.delete(key);return;}
    scene.remove(data.group);
    data.group.traverse(obj=>{
        if(!obj.isMesh)return;
        if(obj.geometry&&!Object.values(GEO).includes(obj.geometry))obj.geometry.dispose();
        const mats=Array.isArray(obj.material)?obj.material:[obj.material];
        mats.forEach(m=>{if(m._bOp!==undefined)m.dispose();});
    });
    for(const c of data.localColliders){const idx=globalColliders.indexOf(c);if(idx!==-1)globalColliders.splice(idx,1);}
    data.group.traverse(obj=>{
        const fi=fireflyData.findIndex(f=>f.mesh===obj);if(fi!==-1)fireflyData.splice(fi,1);
        const wi=windObjects.findIndex(w=>w.mesh===obj);if(wi!==-1)windObjects.splice(wi,1);
    });
    loadedChunks.delete(key); chunkFadeIn.delete(key);
}

let lastCX=Infinity, lastCZ=Infinity;
function updateChunks(px,pz){
    const cx=Math.round(px/CHUNK_SIZE), cz=Math.round(pz/CHUNK_SIZE);
    if(cx===lastCX&&cz===lastCZ)return;
    lastCX=cx; lastCZ=cz;
    for(let dx=-CHUNK_RADIUS;dx<=CHUNK_RADIUS;dx++)
        for(let dz=-CHUNK_RADIUS;dz<=CHUNK_RADIUS;dz++)
            generateChunk(cx+dx,cz+dz);
    for(const[key]of loadedChunks){
        const[kcx,kcz]=key.split(',').map(Number);
        if(Math.abs(kcx-cx)>CHUNK_RADIUS+1||Math.abs(kcz-cz)>CHUNK_RADIUS+1)
            unloadChunk(kcx,kcz);
    }
}

/* ═══════════════════════════════════════════════════════
   PHYSIQUE
═══════════════════════════════════════════════════════ */
const PLAYER_R=0.4, PLAYER_H=1.8;

function resolveColliders(nx,ny,nz){
    let onTop=false, surfY=-Infinity;

    for(const c of globalColliders){

        if(c.type==='cylinder'){
            const dx=nx-c.x, dz=nz-c.z;
            const dXZ=Math.sqrt(dx*dx+dz*dz), cTop=c.y+c.h, pBot=ny-PLAYER_H;
            if(dXZ<c.r+PLAYER_R&&ny>c.y&&pBot<cTop){
                if(pBot>=cTop-0.7){ny=cTop+PLAYER_H;onTop=true;surfY=Math.max(surfY,cTop);}
                else{const a=Math.atan2(dz,dx);nx=c.x+Math.cos(a)*(c.r+PLAYER_R);nz=c.z+Math.sin(a)*(c.r+PLAYER_R);}
            }

        }else if(c.type==='sphere'){
            const dx=nx-c.x, dz=nz-c.z;
            const dxz=Math.sqrt(dx*dx+dz*dz), pBot=ny-PLAYER_H;
            const dy=(ny-PLAYER_H*0.5)-c.y, dist3=Math.sqrt(dx*dx+dy*dy+dz*dz);
            if(dist3<c.r+PLAYER_R&&dist3>0.001){
                if(pBot>=c.topY-0.8&&dy>-0.2){ny=c.topY+PLAYER_H;onTop=true;surfY=Math.max(surfY,c.topY);}
                else if(dxz>0.01){const need=c.r+PLAYER_R*1.1;if(dxz<need){nx+=(dx/dxz)*(need-dxz);nz+=(dz/dxz)*(need-dxz);}}
            }

        }else if(c.type==='platform'){
            // Marches d'escalier et paliers
            const dx=nx-c.x, dz=nz-c.z;
            if(Math.abs(dx)>c.hw+PLAYER_R+0.1)continue;
            if(Math.abs(dz)>c.hd+PLAYER_R+0.1)continue;
            const pBot=ny-PLAYER_H;
            if(ny<c.y)continue;
            const LAND=1.0;
            if(pBot>=c.topY-LAND){
                const wantY=c.topY+PLAYER_H;
                if(ny<=wantY+0.05){ny=wantY;onTop=true;surfY=Math.max(surfY,c.topY);}
            }else{
                // Push latéral
                const olXp=(c.hw+PLAYER_R)-dx, olXn=dx+(c.hw+PLAYER_R);
                const olZp=(c.hd+PLAYER_R)-dz, olZn=dz+(c.hd+PLAYER_R);
                const mn=Math.min(olXp,olXn,olZp,olZn);
                if(mn===olXp&&olXp>0)nx=c.x+c.hw+PLAYER_R;
                else if(mn===olXn&&olXn>0)nx=c.x-c.hw-PLAYER_R;
                else if(mn===olZp&&olZp>0)nz=c.z+c.hd+PLAYER_R;
                else if(mn===olZn&&olZn>0)nz=c.z-c.hd-PLAYER_R;
            }

        }else if(c.type==='box'){
            // Murs et barrières
            const dx=nx-c.x, dz=nz-c.z;
            const pBot=ny-PLAYER_H;
            if(Math.abs(dx)>c.hw+PLAYER_R+0.1)continue;
            if(Math.abs(dz)>c.hd+PLAYER_R+0.1)continue;
            if(ny<c.y||pBot>c.topY+0.2)continue;
            const olXp=(c.hw+PLAYER_R)-dx, olXn=dx+(c.hw+PLAYER_R);
            const olZp=(c.hd+PLAYER_R)-dz, olZn=dz+(c.hd+PLAYER_R);
            const mn=Math.min(olXp,olXn,olZp,olZn);
            if(mn===olXp&&olXp>0)nx=c.x+c.hw+PLAYER_R;
            else if(mn===olXn&&olXn>0)nx=c.x-c.hw-PLAYER_R;
            else if(mn===olZp&&olZp>0)nz=c.z+c.hd+PLAYER_R;
            else if(mn===olZn&&olZn>0)nz=c.z-c.hd-PLAYER_R;
        }
    }
    return{x:nx,y:ny,z:nz,onTop,surfY};
}

/* ═══════════════════════════════════════════════════════
   CONTROLS & MOUVEMENT
═══════════════════════════════════════════════════════ */
const controls=new PointerLockControls(camera,document.body);
document.body.addEventListener('click',()=>controls.lock());
const velocity=new THREE.Vector3(), keys={z:false,s:false,q:false,d:false,shift:false};
let jumpVel=0, grounded=true, stamina=100, smoothGroundY=null;

addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();
    if(k in keys)keys[k]=true;
    if(e.shiftKey)keys.shift=true;
    if(e.code==='Space'&&grounded){grounded=false;jumpVel=0.32;}
});
addEventListener('keyup',e=>{
    const k=e.key.toLowerCase();
    if(k in keys)keys[k]=false;
    if(!e.shiftKey)keys.shift=false;
});

const _fwd=new THREE.Vector3(), _right=new THREE.Vector3();

function updateMovement(dt){
    const run=keys.shift&&stamina>0&&(keys.z||keys.s||keys.q||keys.d);
    stamina=run?Math.max(0,stamina-0.45):Math.min(100,stamina+0.2);
    document.getElementById('sp').style.width=stamina+'%';

    _fwd.set(0,0,-1).applyQuaternion(camera.quaternion);_fwd.y=0;_fwd.normalize();
    _right.set(1,0,0).applyQuaternion(camera.quaternion);_right.y=0;_right.normalize();

    const slope=1-Math.abs(terrainNormal(camera.position.x,camera.position.z).y);
    const accel=(run?0.055:0.028)*(1-slope*0.5);
    if(keys.z)velocity.addScaledVector(_fwd, accel);
    if(keys.s)velocity.addScaledVector(_fwd,-accel);
    if(keys.q)velocity.addScaledVector(_right,-accel);
    if(keys.d)velocity.addScaledVector(_right, accel);
    velocity.multiplyScalar(0.88);

    let nx=camera.position.x+velocity.x, ny=camera.position.y, nz=camera.position.z+velocity.z;
    jumpVel=Math.max(jumpVel-0.016,-1.2); ny+=jumpVel;

    const res=resolveColliders(nx,ny,nz);
    nx=res.x; ny=res.y; nz=res.z;

    const tgy=findY(nx,nz)+PLAYER_H;

    if(ny<=tgy){
        if(jumpVel<=0&&!res.onTop){
            if(smoothGroundY===null)smoothGroundY=ny;
            smoothGroundY+=(tgy-smoothGroundY)*Math.min(1,0.25+(1-slope)*0.25+dt*8);
            ny=Math.max(smoothGroundY,tgy-0.05);
        }else{ny=tgy;smoothGroundY=ny;}
        if(jumpVel<=0){jumpVel=0;grounded=true;}
    }else if(res.onTop){
        // Lissage sur plateforme/marche
        const tY=res.surfY+PLAYER_H;
        if(jumpVel<=0){
            if(smoothGroundY===null)smoothGroundY=ny;
            smoothGroundY+=(tY-smoothGroundY)*Math.min(1,0.4+dt*10);
            ny=Math.max(smoothGroundY,tY);
            jumpVel=0;grounded=true;
        }else{smoothGroundY=ny;}
    }else{
        smoothGroundY=null;grounded=false;
    }

    camera.position.set(nx,ny,nz);
}

/* ═══════════════════════════════════════════════════════
   BOUCLE
═══════════════════════════════════════════════════════ */
const clock=new THREE.Clock();
let elapsed=DAY_DURATION*0.25;
updateChunks(0,0);

function animate(){
    requestAnimationFrame(animate);
    const dt=Math.min(clock.getDelta(),0.05);
    elapsed+=dt;

    for(const w of windObjects) w.mesh.rotation.z=Math.sin(elapsed*w.speed+w.phase)*w.amp;
    for(const f of fireflyData){
        f.mesh.position.y=f.baseY+Math.sin(elapsed+f.phase)*0.5;
        f.mesh.position.x+=Math.cos(elapsed*0.3+f.phase)*0.008;
    }

    // Fade-in chunks
    for(const[key,fd]of chunkFadeIn){
        fd.alpha=Math.min(1,fd.alpha+dt*2.2);
        fd.group.traverse(obj=>{
            if(!obj.isMesh)return;
            const mats=Array.isArray(obj.material)?obj.material:[obj.material];
            for(const m of mats)if(m._bOp!==undefined)m.opacity=fd.alpha*m._bOp;
        });
        if(fd.alpha>=1){
            fd.group.traverse(obj=>{
                if(!obj.isMesh)return;
                const mats=Array.isArray(obj.material)?obj.material:[obj.material];
                for(const m of mats)if(m._bOp!==undefined){m.opacity=m._bOp;m.transparent=m._bOp<1;}
            });
            chunkFadeIn.delete(key);
        }
    }

    updateDayNight(elapsed);
    if(controls.isLocked)updateMovement(dt);
    updateChunks(camera.position.x,camera.position.z);
    renderer.render(scene,camera);
}
animate();

window.addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
});

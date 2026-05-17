import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';

/* ─── MOBILE ─────────────────────────────────────────── */
const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
              || ('ontouchstart' in window && navigator.maxTouchPoints > 1);
if (isMobile) {
    document.body.style.cssText = 'margin:0;background:#0a0f0a;display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden;';
    document.body.innerHTML = `<div style="text-align:center;color:#d4c9a8;font-family:'Cinzel',serif;padding:40px;max-width:340px;"><div style="font-size:64px;margin-bottom:24px;">🌲</div><div style="font-size:28px;font-weight:700;letter-spacing:4px;margin-bottom:20px;">UNE FORÊT</div><div style="font-size:14px;letter-spacing:2px;opacity:0.75;line-height:2;">NON DISPONIBLE<br>SUR MOBILE</div></div>`;
    throw new Error('mobile');
}

/* ─── RENDERER ───────────────────────────────────────── */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
document.body.appendChild(renderer.domElement);

/* ─── SCENE / CAMERA ─────────────────────────────────── */
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9bb4c7, 80, 320);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 2000);
camera.position.set(0, 10, 0);

/* ─── SKYBOX ─────────────────────────────────────────── */
const SKY_CANVAS = document.createElement('canvas');
SKY_CANVAS.width = 2; SKY_CANVAS.height = 512;
const SKY_CTX = SKY_CANVAS.getContext('2d');
const skyTex = new THREE.CanvasTexture(SKY_CANVAS);
scene.background = skyTex;
const SKY = {
    day:    { top:[0.10,0.44,0.83], hor:[0.55,0.80,0.95] },
    golden: { top:[0.18,0.10,0.35], hor:[1.00,0.55,0.05] },
    sunset: { top:[0.12,0.04,0.28], hor:[1.00,0.28,0.02] },
    night:  { top:[0.03,0.05,0.18], hor:[0.07,0.10,0.20] },
    dawn:   { top:[0.15,0.04,0.28], hor:[1.00,0.42,0.10] },
};
function lerp3(a,b,t){ return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]; }
function toCSS(rgb){ return `rgb(${rgb[0]*255|0},${rgb[1]*255|0},${rgb[2]*255|0})`; }
let _top=SKY.day.top.slice(), _hor=SKY.day.hor.slice();
function setSky(s){ _top=s.top.slice(); _hor=s.hor.slice(); }
function lerpSky(a,b,t){ _top=lerp3(a.top,b.top,t); _hor=lerp3(a.hor,b.hor,t); }
function drawSky(){
    const g=SKY_CTX.createLinearGradient(0,0,0,512);
    g.addColorStop(0,toCSS(_top));
    g.addColorStop(0.5,toCSS(lerp3(_top,_hor,0.4)));
    g.addColorStop(1,toCSS(_hor));
    SKY_CTX.fillStyle=g; SKY_CTX.fillRect(0,0,2,512); skyTex.needsUpdate=true;
}

/* ─── LUMIÈRES ───────────────────────────────────────── */
const hemi = new THREE.HemisphereLight(0xddeeff, 0x3d2f1b, 1.2);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff5e0, 3.0);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(1024);
sun.shadow.camera.left = sun.shadow.camera.bottom = -150;
sun.shadow.camera.right = sun.shadow.camera.top = 150;
sun.shadow.camera.far = 1500;
scene.add(sun);
const moonLight = new THREE.DirectionalLight(0x4466bb, 0.5); // nuit visible
scene.add(moonLight);
const warmFill = new THREE.DirectionalLight(0xff6600, 0); // lever/coucher
scene.add(warmFill);

/* ─── SPRITES SOLEIL & LUNE ──────────────────────────── */
function makeRadialSprite(stops, sz){
    const c=document.createElement('canvas'); c.width=c.height=256;
    const ctx=c.getContext('2d');
    const g=ctx.createRadialGradient(128,128,0,128,128,128);
    stops.forEach(([t,col])=>g.addColorStop(t,col));
    ctx.fillStyle=g; ctx.fillRect(0,0,256,256);
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
    sp.scale.setScalar(sz); return sp;
}
// Soleil plus grand et plus net
const sunCore  = makeRadialSprite([[0,'rgba(255,255,240,1)'],[0.18,'rgba(255,240,180,0.95)'],[0.35,'rgba(255,200,60,0.6)'],[0.7,'rgba(255,140,20,0.2)'],[1,'rgba(0,0,0,0)']],260);
const sunGlow  = makeRadialSprite([[0,'rgba(255,160,30,0.55)'],[0.5,'rgba(255,80,0,0.15)'],[1,'rgba(0,0,0,0)']],700);
const sunHalo  = makeRadialSprite([[0,'rgba(255,100,0,0.35)'],[1,'rgba(0,0,0,0)']],1600); // halo horizon lever/coucher
const moonCore = makeRadialSprite([[0,'rgba(230,240,255,1)'],[0.25,'rgba(200,215,245,0.9)'],[0.5,'rgba(150,170,220,0.5)'],[1,'rgba(0,0,0,0)']],170);
const moonGlow = makeRadialSprite([[0,'rgba(80,100,200,0.4)'],[1,'rgba(0,0,0,0)']],400);
scene.add(sunCore,sunGlow,sunHalo,moonCore,moonGlow);

/* ─── ÉTOILES ────────────────────────────────────────── */
const STAR_COUNT=1400;
const starPos=new Float32Array(STAR_COUNT*3), starSz=new Float32Array(STAR_COUNT);
for(let i=0;i<STAR_COUNT;i++){
    const th=2*Math.PI*Math.random(), ph=Math.acos(2*Math.random()-1), r=1600;
    starPos[i*3]=r*Math.sin(ph)*Math.cos(th); starPos[i*3+1]=Math.abs(r*Math.cos(ph))+80; starPos[i*3+2]=r*Math.sin(ph)*Math.sin(th);
    starSz[i]=1.5+Math.random()*4.0;
}
const starGeo=new THREE.BufferGeometry();
starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3));
starGeo.setAttribute('size',new THREE.BufferAttribute(starSz,1));
const starMat=new THREE.ShaderMaterial({
    uniforms:{uOp:{value:0},uT:{value:0}},
    vertexShader:`attribute float size;uniform float uT;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=size*(1.+0.25*sin(uT*1.8+size*13.7));gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float uOp;void main(){vec2 uv=gl_PointCoord-.5;float d=length(uv);if(d>.5)discard;float b=pow(1.-d*2.,1.5);gl_FragColor=vec4(1.,1.,.9,b*uOp);}`,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
});
const starsObj=new THREE.Points(starGeo,starMat);
scene.add(starsObj);

/* ─── CYCLE JOUR/NUIT ────────────────────────────────── */
const DAY_DURATION=1200, ORBIT_R=1400;
function updateDayNight(elapsed){
    const angle=((elapsed/DAY_DURATION)*Math.PI*2)%(Math.PI*2);
    const sinA=Math.sin(angle),sf=Math.max(0,sinA),sfS=sf*sf*(3-2*sf),mf=Math.max(0,-sinA),mfS=mf*mf*(3-2*mf);
    const horizF=Math.max(0,1-Math.abs(sinA)*3.5)*sf; // max au lever/coucher

    const sunX=Math.cos(angle)*ORBIT_R,sunY=Math.sin(angle)*ORBIT_R;
    sun.position.set(sunX,sunY,ORBIT_R*0.25);
    moonLight.position.set(-sunX,-sunY,ORBIT_R*0.25);
    warmFill.position.set(sunX,sunY*0.3,ORBIT_R*0.25);

    const cp=camera.position;
    const sd=new THREE.Vector3(sunX,sunY,ORBIT_R*0.25).normalize(),md=sd.clone().negate();
    const sdH=new THREE.Vector3(sunX,0,ORBIT_R*0.25).normalize();
    sunCore.position.copy(cp).addScaledVector(sd,1350);
    sunGlow.position.copy(cp).addScaledVector(sd,1340);
    sunHalo.position.copy(cp).addScaledVector(sdH,1200);
    moonCore.position.copy(cp).addScaledVector(md,1350);
    moonGlow.position.copy(cp).addScaledVector(md,1340);

    // Couleur soleil selon hauteur (blanc→orange→rouge)
    const sr=1.0, sg=Math.max(0.35,0.96-horizF*0.55), sb=Math.max(0.0,0.88-horizF*0.88);
    sun.color.setRGB(sr,sg,sb);
    sun.intensity=0.02+sfS*3.2;
    moonLight.intensity=0.45+mfS*0.4; // lune plus lumineuse → nuit visible
    hemi.intensity=0.35+sfS*0.85;     // ambiant minimum élevé
    warmFill.intensity=horizF*1.6;

    sunCore.material.opacity=Math.pow(sf,0.3);
    sunGlow.material.opacity=Math.pow(sf,0.4)*0.85;
    sunHalo.material.opacity=horizF*Math.pow(sf,0.2)*0.6;
    moonCore.material.opacity=Math.pow(mf,0.3);
    moonGlow.material.opacity=Math.pow(mf,0.45)*0.7;

    // Brouillard coloré
    const fogDay=new THREE.Color(0x9bb4c7),fogNight=new THREE.Color(0x080e1a),fogDusk=new THREE.Color(0xc04818);
    const fogC=new THREE.Color().lerpColors(fogNight,fogDay,sfS);
    fogC.lerp(fogDusk,horizF*0.7);
    scene.fog.color.copy(fogC);
    scene.fog.near=80; scene.fog.far=280+sfS*80;

    starMat.uniforms.uOp.value=Math.max(0,1-sfS*2.2)*0.95;
    starMat.uniforms.uT.value=elapsed;
    starsObj.position.copy(cp);

    const a=angle,PI=Math.PI;
    if(a<PI*0.08)       lerpSky(SKY.dawn,  SKY.golden, a/(PI*0.08));
    else if(a<PI*0.20)  lerpSky(SKY.golden,SKY.day,    (a-PI*0.08)/(PI*0.12));
    else if(a<PI*0.78)  setSky(SKY.day);
    else if(a<PI*0.98)  lerpSky(SKY.day,   SKY.golden, (a-PI*0.78)/(PI*0.20));
    else if(a<PI*1.12)  lerpSky(SKY.golden,SKY.sunset, (a-PI*0.98)/(PI*0.14));
    else if(a<PI*1.40)  lerpSky(SKY.sunset,SKY.night,  (a-PI*1.12)/(PI*0.28));
    else if(a<PI*1.75)  setSky(SKY.night);
    else                lerpSky(SKY.night, SKY.dawn,   (a-PI*1.75)/(PI*0.25));
    // Horizon skybox = couleur brouillard pour seamless
    _hor=[fogC.r,fogC.g,fogC.b];
    drawSky();
}

/* ─── MUSIQUE ────────────────────────────────────────── */
function initMusic(){
    const audio=new Audio('background_sound.mp3'); audio.volume=0.45;
    const play=()=>{ audio.currentTime=0; audio.play().catch(()=>{}); };
    audio.addEventListener('ended',()=>setTimeout(play,120000));
    let started=false;
    document.addEventListener('click',()=>{ if(started)return; started=true; play(); },{once:true});
}
initMusic();

/* ─── SIMPLEX NOISE ──────────────────────────────────── */
const SEED=Math.random()*2147483647|0;
document.getElementById('seed-display').textContent='seed : '+SEED;
function buildPerm(seed){
    const p=new Uint8Array(256); for(let i=0;i<256;i++)p[i]=i; let s=seed;
    for(let i=255;i>0;i--){ s=(s*1664525+1013904223)&0xffffffff; const j=(s>>>24)%(i+1); [p[i],p[j]]=[p[j],p[i]]; }
    const perm=new Uint8Array(512); for(let i=0;i<512;i++)perm[i]=p[i&255]; return perm;
}
const perm=buildPerm(SEED),GRAD=[[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
function simplex2(xin,yin){
    const F2=0.5*(Math.sqrt(3)-1),G2=(3-Math.sqrt(3))/6;
    const s=(xin+yin)*F2,i=Math.floor(xin+s)|0,j=Math.floor(yin+s)|0,t=(i+j)*G2;
    const x0=xin-(i-t),y0=yin-(j-t),i1=x0>y0?1:0,j1=x0>y0?0:1;
    const x1=x0-i1+G2,y1=y0-j1+G2,x2=x0-1+2*G2,y2=y0-1+2*G2;
    const ii=i&255,jj=j&255,g0=perm[ii+perm[jj]]%8,g1=perm[ii+i1+perm[jj+j1]]%8,g2=perm[ii+1+perm[jj+1]]%8;
    let n0=0,n1=0,n2=0;
    let t0=0.5-x0*x0-y0*y0; if(t0>=0){t0*=t0;n0=t0*t0*(GRAD[g0][0]*x0+GRAD[g0][1]*y0);}
    let t1=0.5-x1*x1-y1*y1; if(t1>=0){t1*=t1;n1=t1*t1*(GRAD[g1][0]*x1+GRAD[g1][1]*y1);}
    let t2=0.5-x2*x2-y2*y2; if(t2>=0){t2*=t2;n2=t2*t2*(GRAD[g2][0]*x2+GRAD[g2][1]*y2);}
    return 70*(n0+n1+n2);
}
function fbm(x,z){ return simplex2(x*0.002,z*0.002)*14+simplex2(x*0.008,z*0.008)*5+simplex2(x*0.025,z*0.025)*1.5; }

/* ─── HEIGHTMAP ──────────────────────────────────────── */
const HSTEP=0.5,hCache=new Map();
function heightAt(wx,wz){
    const kx=Math.round(wx/HSTEP)|0,kz=Math.round(wz/HSTEP)|0,key=kx*100003+kz;
    let h=hCache.get(key); if(h===undefined){h=fbm(wx,wz);hCache.set(key,h);} return h;
}
function findY(wx,wz){
    const x0=Math.floor(wx/HSTEP)*HSTEP,z0=Math.floor(wz/HSTEP)*HSTEP,fu=(wx-x0)/HSTEP,fv=(wz-z0)/HSTEP;
    return heightAt(x0,z0)*(1-fu)*(1-fv)+heightAt(x0+HSTEP,z0)*fu*(1-fv)+heightAt(x0,z0+HSTEP)*(1-fu)*fv+heightAt(x0+HSTEP,z0+HSTEP)*fu*fv;
}
function terrainNormal(wx,wz){
    const d=HSTEP;
    return new THREE.Vector3(findY(wx-d,wz)-findY(wx+d,wz),2*d,findY(wx,wz-d)-findY(wx,wz+d)).normalize();
}

/* ─── MATÉRIAUX ──────────────────────────────────────── */
const MAT={
    trunk:    new THREE.MeshStandardMaterial({color:0x2a1a0e}),
    cone0:    new THREE.MeshStandardMaterial({color:0x0f240f}),
    cone1:    new THREE.MeshStandardMaterial({color:0x163016}),
    cone2:    new THREE.MeshStandardMaterial({color:0x1c3d1c}),
    rock:     new THREE.MeshStandardMaterial({color:0x777777,roughness:1,flatShading:true}),
    ground:   new THREE.MeshStandardMaterial({color:0x243b1d,roughness:1}),
    stem:     new THREE.MeshStandardMaterial({color:0x2d4c1e}),
    grass:    new THREE.MeshStandardMaterial({color:0x3f6b2d}),
    ff:       new THREE.MeshBasicMaterial({color:0xffffaa}),
    mushCap:  new THREE.MeshStandardMaterial({color:0xcc3300}),
    mushCap2: new THREE.MeshStandardMaterial({color:0xaa2200}),
    mushSpot: new THREE.MeshStandardMaterial({color:0xffffff}),
    mushStem: new THREE.MeshStandardMaterial({color:0xe8dcc8}),
    towLog:   new THREE.MeshStandardMaterial({color:0x1e0f06,roughness:1.0}),
    towPlank: new THREE.MeshStandardMaterial({color:0x2c1a0a,roughness:0.95}),
    towRail:  new THREE.MeshStandardMaterial({color:0x170c04,roughness:1.0}),
    mtn:      new THREE.MeshStandardMaterial({color:0x4a5a3a,roughness:1,flatShading:true}),
    mtnSnow:  new THREE.MeshStandardMaterial({color:0xd8ddd0,roughness:0.8,flatShading:true}),
};
const CONE_MATS=[MAT.cone0,MAT.cone1,MAT.cone2];
const FLOWER_COLORS=[0xff4444,0x4444ff,0xffff55,0xffffff,0xff66cc];
const flowerCache={};
function flowerMat(hex){ if(!flowerCache[hex])flowerCache[hex]=new THREE.MeshStandardMaterial({color:hex,emissive:hex,emissiveIntensity:0.1}); return flowerCache[hex]; }

/* ─── GÉOMÉTRIES PARTAGÉES ───────────────────────────── */
const GEO={
    grass:    new THREE.CylinderGeometry(0.015,0.04,0.5,3),
    ff:       new THREE.SphereGeometry(0.07,4,4),
    stem:     new THREE.CylinderGeometry(0.025,0.035,0.8,5),
    flower:   new THREE.SphereGeometry(0.14,6,6),
    rock:     new THREE.DodecahedronGeometry(1,0),
    mushStem: new THREE.CylinderGeometry(0.1,0.12,0.4,6),
    mushCap:  new THREE.SphereGeometry(0.5,8,5,0,Math.PI*2,0,Math.PI*0.55),
    mushSpot: new THREE.SphereGeometry(0.07,4,4),
    towPlank: new THREE.BoxGeometry(1,0.18,0.65),
    towBarV:  new THREE.CylinderGeometry(0.05,0.05,1.15,5),
};

/* ─── GLOBAUX ────────────────────────────────────────── */
const windObjects=[], fireflyData=[], globalColliders=[];

/* ═══════════════════════════════════════════════════════
   MONTAGNES DÉCOR — lointaines, inatteignables
   Anneau de pics low-poly placés à ~500-900u du centre
═══════════════════════════════════════════════════════ */
function buildMountains(){
    const MTN_COUNT=18;
    const rng=()=>Math.random();
    for(let i=0;i<MTN_COUNT;i++){
        const angle=(i/MTN_COUNT)*Math.PI*2+(rng()-0.5)*0.3;
        const dist=500+rng()*400;
        const mx=Math.cos(angle)*dist, mz=Math.sin(angle)*dist;
        const baseY=findY(mx,mz);
        const H=80+rng()*120;   // hauteur 80-200u
        const R=40+rng()*60;    // rayon base 40-100u

        // Corps principal
        const body=new THREE.Mesh(new THREE.ConeGeometry(R,H,7,1),MAT.mtn);
        body.position.set(mx,baseY+H*0.5-8,mz);
        body.rotation.y=rng()*Math.PI;
        scene.add(body);

        // Calotte neigeuse (1/4 supérieur)
        const snowH=H*0.28, snowR=R*(snowH/H);
        const snow=new THREE.Mesh(new THREE.ConeGeometry(snowR,snowH,7,1),MAT.mtnSnow);
        snow.position.set(mx,baseY+H-snowH*0.5-8,mz);
        snow.rotation.y=body.rotation.y;
        scene.add(snow);
    }
}
buildMountains();

/* ═══════════════════════════════════════════════════════
   TOUR D'OBSERVATION — escalier hélicoïdal autour du pilier
   Structure carrée en bois, marches qui tournent autour
═══════════════════════════════════════════════════════ */
const TOWER_H=38, PLT_HALF=3.0;

function chunkHasTower(cx,cz){
    if(cx===0&&cz===0) return true;
    const cellX=Math.floor(cx/5),cellZ=Math.floor(cz/5);
    if(cellX===0&&cellZ===0) return false;
    let h=(cx*374761393+cz*668265263)^0xdeadbeef;
    h=Math.imul(h^(h>>>16),0x45d9f3b); h^=h>>>16;
    const val=(h>>>0)/0xffffffff;
    for(let dx=-4;dx<=4;dx++) for(let dz=-4;dz<=4;dz++){
        if(dx===0&&dz===0) continue;
        const nx=cx+dx,nz=cz+dz;
        if(Math.floor(nx/5)!==cellX||Math.floor(nz/5)!==cellZ) continue;
        let h2=(nx*374761393+nz*668265263)^0xdeadbeef;
        h2=Math.imul(h2^(h2>>>16),0x45d9f3b); h2^=h2>>>16;
        if((h2>>>0)/0xffffffff>val) return false;
    }
    return true;
}

function buildTower(wx,wz,grp,lc){
    const gy=findY(wx,wz);
    const tg=new THREE.Group();
    const pillarH=TOWER_H+5;

    // ── 4 PILIERS ───────────────────────────────────────
    const pDef=[
        {ox:-PLT_HALF,oz:-PLT_HALF,rb:0.70,rt:0.58},
        {ox: PLT_HALF,oz:-PLT_HALF,rb:0.66,rt:0.54},
        {ox: PLT_HALF,oz: PLT_HALF,rb:0.72,rt:0.60},
        {ox:-PLT_HALF,oz: PLT_HALF,rb:0.64,rt:0.52},
    ];
    for(const p of pDef){
        const mesh=new THREE.Mesh(new THREE.CylinderGeometry(p.rt,p.rb,pillarH,10),MAT.towLog);
        mesh.position.set(p.ox,pillarH/2-5,p.oz);
        mesh.castShadow=true; mesh.receiveShadow=true; tg.add(mesh);
    }

    // ── RENFORTS HORIZONTAUX ─────────────────────────────
    const beamLen=PLT_HALF*2+0.6;
    for(let y=5;y<TOWER_H-2;y+=6){
        for(const oz of [-PLT_HALF,PLT_HALF]){
            const b=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.18,beamLen,7),MAT.towLog);
            b.rotation.z=Math.PI/2; b.position.set(0,y,oz); b.castShadow=true; tg.add(b);
        }
        for(const ox of [-PLT_HALF,PLT_HALF]){
            const b=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,beamLen,7),MAT.towLog);
            b.rotation.x=Math.PI/2; b.position.set(ox,y+0.45,0); b.castShadow=true; tg.add(b);
        }
    }

    // ── ESCALIER HÉLICOÏDAL ──────────────────────────────
    // Les marches tournent autour de la tour (sur un rayon = PLT_HALF + 1.2)
    // 1 tour complet = TOWER_H de hauteur → 32 marches pour 1.25 tour
    const STEPS=40;                         // nombre de marches total
    const STAIR_R=PLT_HALF+1.1;            // rayon autour du pilier central
    const STEP_HEIGHT=TOWER_H/STEPS;        // ~0.95u par marche
    const ANGLE_STEP=(Math.PI*2.5)/STEPS;  // 1.25 tour total
    const STEP_W=1.5, STEP_D=0.7;

    for(let s=0;s<STEPS;s++){
        const a=s*ANGLE_STEP;
        const stepY=s*STEP_HEIGHT;
        const sx=Math.cos(a)*STAIR_R;
        const sz=Math.sin(a)*STAIR_R;

        const step=new THREE.Mesh(GEO.towPlank,MAT.towPlank);
        step.scale.set(STEP_W,1,STEP_D);
        step.position.set(sx,stepY,sz);
        step.rotation.y=-a; // orienter la marche tangentiellement
        step.castShadow=true;
        tg.add(step);

        // Collider de chaque marche (cylindre petit)
        lc.push({type:'cylinder',x:wx+sx,y:gy+stepY-0.06,z:wz+sz,r:STEP_W*0.6,h:0.28});

        // Barreau de garde-corps
        if(s%2===0){
            const bar=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,1.1,5),MAT.towRail);
            bar.position.set(sx*(1+0.18/STAIR_R),stepY+0.55,sz*(1+0.18/STAIR_R));
            tg.add(bar);
        }
    }

    // Rail garde-corps hélicoïdal (tube fin qui suit le chemin)
    const railPts=[];
    for(let s=0;s<=STEPS;s++){
        const a=s*ANGLE_STEP, y=s*STEP_HEIGHT+0.9;
        railPts.push(new THREE.Vector3(Math.cos(a)*(STAIR_R+0.22),y,Math.sin(a)*(STAIR_R+0.22)));
    }
    const railCurve=new THREE.CatmullRomCurve3(railPts);
    const railGeo=new THREE.TubeGeometry(railCurve,STEPS*2,0.055,5,false);
    const railMesh=new THREE.Mesh(railGeo,MAT.towRail);
    tg.add(railMesh);

    // ── PLANCHER PLATEFORME ───────────────────────────────
    const floorW=PLT_HALF*2+0.2;
    for(let i=0;i<10;i++){
        const t=i/9, pz=-PLT_HALF+t*PLT_HALF*2;
        const pl=new THREE.Mesh(GEO.towPlank,MAT.towPlank);
        pl.scale.set(floorW,1,1); pl.position.set(0,TOWER_H,pz);
        pl.receiveShadow=true; pl.castShadow=true; tg.add(pl);
    }
    lc.push({type:'cylinder',x:wx,y:gy+TOWER_H-0.1,z:wz,r:PLT_HALF+0.6,h:0.4});

    // Poutres soutien plancher
    for(const oz of [-PLT_HALF*0.5,PLT_HALF*0.5]){
        const sb=new THREE.Mesh(new THREE.CylinderGeometry(0.20,0.20,floorW+0.4,7),MAT.towLog);
        sb.rotation.z=Math.PI/2; sb.position.set(0,TOWER_H-0.3,oz); tg.add(sb);
    }

    // ── GARDE-CORPS PLATEFORME ────────────────────────────
    const railTop=TOWER_H+1.15,railMid=TOWER_H+0.58;
    const gcSides=[
        [0,PLT_HALF+0.1,0,floorW],
        [-PLT_HALF-0.1,0,Math.PI/2,floorW],
        [PLT_HALF+0.1,0,Math.PI/2,floorW],
        [0,-PLT_HALF-0.1,0,floorW],
    ];
    for(const[cx2,cz2,ry,len] of gcSides){
        for(const rh of[railMid,railTop]){
            const r=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,len,5),MAT.towRail);
            r.rotation.set(0,ry,Math.PI/2); r.position.set(cx2,rh,cz2); tg.add(r);
        }
        const nb=Math.ceil(len/0.65)+1;
        for(let i=0;i<=nb;i++){
            const t=(i/nb-0.5)*len;
            const bx=ry===0?cx2+t:cx2,bz2=ry===0?cz2:cz2+t;
            const bar=new THREE.Mesh(GEO.towBarV,MAT.towRail);
            bar.position.set(bx,TOWER_H+0.72,bz2); tg.add(bar);
        }
    }
    for(const[px,pz] of[[-PLT_HALF,-PLT_HALF],[PLT_HALF,-PLT_HALF],[PLT_HALF,PLT_HALF],[-PLT_HALF,PLT_HALF]]){
        const p=new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.10,railTop-TOWER_H+0.1,6),MAT.towRail);
        p.position.set(px,TOWER_H+(railTop-TOWER_H)/2,pz); tg.add(p);
    }

    // ── TOIT ─────────────────────────────────────────────
    const roof=new THREE.Mesh(new THREE.ConeGeometry(PLT_HALF+1.1,4.5,8),MAT.towLog);
    roof.position.set(0,railTop+2.3,0); roof.castShadow=true; tg.add(roof);

    tg.position.set(wx,gy,wz);
    grp.add(tg);
    return{wx,wz,clearR:PLT_HALF+STAIR_R+2};
}

/* ─── CHAMPIGNONS ────────────────────────────────────── */
function buildMushroom(wx,wz,gy,r,grp){
    const sc=0.12+r()*0.25,sH=0.45*sc,cR=0.5*sc;
    const sm=new THREE.Mesh(GEO.mushStem,MAT.mushStem);
    sm.scale.set(cR*0.6,sH*2.5,cR*0.6); sm.position.set(wx,gy+sH*0.5,wz); grp.add(sm);
    const cm=new THREE.Mesh(GEO.mushCap,r()>0.3?MAT.mushCap:MAT.mushCap2);
    cm.scale.setScalar(cR*2); cm.position.set(wx,gy+sH+cR*0.05,wz); grp.add(cm);
    for(let s=0,n=3+(r()*3|0);s<n;s++){
        const ang=r()*Math.PI*2,rad=cR*(0.2+r()*0.55);
        const spot=new THREE.Mesh(GEO.mushSpot,MAT.mushSpot);
        spot.scale.setScalar(cR*0.18);
        spot.position.set(wx+Math.cos(ang)*rad,gy+sH+Math.sqrt(Math.max(0,cR*cR-rad*rad))*0.9,wz+Math.sin(ang)*rad);
        grp.add(spot);
    }
}

/* ═══════════════════════════════════════════════════════
   CHUNKS — LOD 3 niveaux
   LOD 0 (dist≤1) : plein détail + colliders
   LOD 1 (dist=2) : arbres simplifiés, pas de déco sol, colliders réduits
   LOD 2 (dist=3) : silhouette seule, 0 collider
═══════════════════════════════════════════════════════ */
const CHUNK_SIZE=80, CHUNK_RADIUS=3;
const SEGS=[14,8,4]; // segments terrain par LOD
const loadedChunks=new Map(), chunkFadeIn=new Map();

function seededRng(seed){
    let s=(seed^0xdeadbeef)|0;
    return ()=>{ s=Math.imul(s^(s>>>16),0x45d9f3b); s=Math.imul(s^(s>>>16),0x45d9f3b); s^=s>>>16; return (s>>>0)/0xffffffff; };
}

function generateChunk(cx,cz,lod){
    const key=cx+','+cz;
    if(loadedChunks.has(key)) return;
    loadedChunks.set(key,null);
    // Échelonner la génération selon LOD
    let delay=lod;
    const tick=()=>{ if(--delay>0) requestAnimationFrame(tick); else _buildChunk(cx,cz,key,lod); };
    requestAnimationFrame(tick);
}

function _buildChunk(cx,cz,key,lod){
    if(!loadedChunks.has(key)) return;
    const oX=cx*CHUNK_SIZE,oZ=cz*CHUNK_SIZE;
    const r=seededRng(cx*73856093^cz*19349663);
    const grp=new THREE.Group(),lc=[];

    /* SOL */
    const segs=SEGS[lod];
    const tgeo=new THREE.PlaneGeometry(CHUNK_SIZE,CHUNK_SIZE,segs,segs);
    const vp=tgeo.attributes.position.array;
    for(let i=0;i<vp.length;i+=3) vp[i+2]=fbm(oX+vp[i],oZ-vp[i+1]);
    tgeo.computeVertexNormals();
    const terr=new THREE.Mesh(tgeo,MAT.ground);
    terr.rotation.x=-Math.PI/2; terr.position.set(oX,0,oZ); terr.receiveShadow=true;
    grp.add(terr);

    /* LOD 2 : silhouette arbres seulement */
    if(lod===2){
        const tn=4+(r()*4|0);
        for(let i=0;i<tn;i++){
            const wx=oX+(r()-0.5)*CHUNK_SIZE*0.85,wz=oZ+(r()-0.5)*CHUNK_SIZE*0.85;
            const gy=findY(wx,wz),h=30+r()*16,tr=1.5+r()*0.8;
            const tg2=new THREE.Group();
            const trunk=new THREE.Mesh(new THREE.CylinderGeometry(tr*0.5,tr*1.3,h*0.32+5,6),MAT.trunk);
            trunk.position.y=h*0.32/2-2.5; tg2.add(trunk);
            const cone=new THREE.Mesh(new THREE.ConeGeometry(tr*4.5+2,h*0.75,6),MAT.cone1);
            cone.position.y=h*0.32+h*0.75*0.42; tg2.add(cone);
            tg2.position.set(wx,gy,wz); grp.add(tg2);
        }
        scene.add(grp);
        loadedChunks.set(key,{group:grp,localColliders:[],lod});
        chunkFadeIn.set(key,{group:grp,alpha:0});
        return;
    }

    /* TOUR */
    let towerInfo=null;
    if(lod===0&&chunkHasTower(cx,cz)){
        let twx,twz;
        if(cx===0&&cz===0){ twx=22; twz=22; }
        else{ const r2=seededRng(cx*19349663^cz*73856093); twx=oX+(r2()-0.5)*CHUNK_SIZE*0.5; twz=oZ+(r2()-0.5)*CHUNK_SIZE*0.5; }
        towerInfo=buildTower(twx,twz,grp,lc);
    }

    /* POINTS OCCUPÉS */
    const occupied=[];
    if(towerInfo) occupied.push({x:towerInfo.wx,z:towerInfo.wz,r:towerInfo.clearR+4});
    function canPlace(wx,wz,minD){ return !occupied.some(o=>{ const dx=wx-o.x,dz=wz-o.z; return dx*dx+dz*dz<(minD+o.r)**2; }); }
    function occupy(wx,wz,rad){ occupied.push({x:wx,z:wz,r:rad}); }

    /* ARBRES */
    const treeN=lod===0?7+(r()*7|0):4+(r()*4|0);
    const tpts=[];
    for(let i=0;i<treeN;i++){
        let wx,wz,ok=false,tries=0;
        do{ wx=oX+(r()-0.5)*CHUNK_SIZE*0.85; wz=oZ+(r()-0.5)*CHUNK_SIZE*0.85;
            ok=canPlace(wx,wz,8)&&!tpts.some(p=>{ const dx=p[0]-wx,dz=p[1]-wz; return dx*dx+dz*dz<16*16; });
        } while(!ok&&++tries<20);
        if(tries>=20) continue;
        tpts.push([wx,wz]); occupy(wx,wz,8);
        const gy=findY(wx,wz),h=28+r()*18,tr=1.4+r()*1.0,trunkH=h*(0.28+r()*0.08);
        const tgr=new THREE.Group();
        const trunk=new THREE.Mesh(new THREE.CylinderGeometry(tr*0.55,tr*1.4,trunkH+6,9),MAT.trunk);
        trunk.position.y=trunkH/2-3; trunk.castShadow=true; tgr.add(trunk);
        const layers=lod===0?9+(r()*5|0):5+(r()*3|0), foliageH=h-trunkH;
        for(let li=0;li<layers;li++){
            const ratio=li/(layers-1),coneY=trunkH+ratio*foliageH*0.90;
            const radius=tr*4.5*(1-ratio*0.72)+1.5,coneH=(foliageH/layers)*2.2;
            const cone=new THREE.Mesh(new THREE.ConeGeometry(radius,coneH,8),CONE_MATS[(r()*3)|0]);
            cone.position.y=coneY;
            // Ombres feuilles activées
            cone.castShadow=true; cone.receiveShadow=true;
            tgr.add(cone);
            windObjects.push({mesh:cone,phase:r()*10,speed:0.5,amp:0.012});
        }
        tgr.position.set(wx,gy,wz); grp.add(tgr);
        if(lod===0) lc.push({type:'cylinder',x:wx,y:gy,z:wz,r:tr*1.7,h:trunkH+6});
    }

    if(lod===0){
        /* ROCHERS */
        for(let i=0,n=1+(r()*3|0);i<n;i++){
            let wx,wz,tries=0;
            do{ wx=oX+(r()-0.5)*CHUNK_SIZE*0.88; wz=oZ+(r()-0.5)*CHUNK_SIZE*0.88; } while(!canPlace(wx,wz,3)&&++tries<15);
            if(tries>=15) continue;
            const gy=findY(wx,wz),sx=1.0+r()*2.6,sy=sx*(0.5+r()*0.5),sz=1.0+r()*2.6;
            const rock=new THREE.Mesh(GEO.rock,MAT.rock);
            rock.scale.set(sx,sy,sz); rock.rotation.set((r()-0.5)*0.4,r()*Math.PI*2,(r()-0.5)*0.4);
            rock.position.set(wx,gy+sy*0.35,wz);
            rock.castShadow=rock.receiveShadow=true; grp.add(rock);
            lc.push({type:'sphere',x:wx,y:gy+sy*0.48,z:wz,r:Math.max(sx,sz)*0.9,topY:gy+sy*0.48+sy*0.85});
            occupy(wx,wz,Math.max(sx,sz)*1.2);
        }

        /* FLEURS */
        for(let i=0,n=25+(r()*50|0);i<n;i++){
            let wx,wz,tries=0;
            do{ wx=oX+(r()-0.5)*CHUNK_SIZE*0.9; wz=oZ+(r()-0.5)*CHUNK_SIZE*0.9; } while(!canPlace(wx,wz,1.5)&&++tries<10);
            if(tries>=10) continue;
            const gy=findY(wx,wz);
            const st=new THREE.Mesh(GEO.stem,MAT.stem); st.position.set(wx,gy+0.15,wz); grp.add(st);
            const hd=new THREE.Mesh(GEO.flower,flowerMat(FLOWER_COLORS[(r()*FLOWER_COLORS.length)|0]));
            hd.position.set(wx,gy+0.65,wz); grp.add(hd);
            occupy(wx,wz,0.8);
        }

        /* CHAMPIGNONS */
        for(let i=0,n=1+(r()*4|0);i<n;i++){
            let wx,wz,tries=0;
            do{ wx=oX+(r()-0.5)*CHUNK_SIZE*0.88; wz=oZ+(r()-0.5)*CHUNK_SIZE*0.88; } while(!canPlace(wx,wz,2)&&++tries<15);
            if(tries>=15) continue;
            buildMushroom(wx,wz,findY(wx,wz),r,grp); occupy(wx,wz,1.5);
            if(r()>0.5) for(let c=0,cn=2+(r()*3|0);c<cn;c++){
                const ox=wx+(r()-0.5)*2.5,oz=wz+(r()-0.5)*2.5;
                if(canPlace(ox,oz,1)){ buildMushroom(ox,oz,findY(ox,oz),r,grp); occupy(ox,oz,1); }
            }
        }

        /* LUCIOLES */
        for(let i=0,n=2+(r()*6|0);i<n;i++){
            const wx=oX+(r()-0.5)*CHUNK_SIZE*0.88,wz=oZ+(r()-0.5)*CHUNK_SIZE*0.88;
            const fy=findY(wx,wz)+2+r()*4;
            const m=new THREE.Mesh(GEO.ff,MAT.ff); m.position.set(wx,fy,wz); grp.add(m);
            fireflyData.push({mesh:m,baseY:fy,phase:r()*10});
        }
    }

    /* HERBE — LOD 0 et 1 */
    if(lod<2){
        const gn=lod===0?50+(r()*50|0):20+(r()*20|0);
        const gm=new THREE.InstancedMesh(GEO.grass,MAT.grass,gn);
        gm.frustumCulled=true;
        const dm=new THREE.Object3D();
        for(let i=0;i<gn;i++){
            const wx=oX+(r()-0.5)*CHUNK_SIZE,wz=oZ+(r()-0.5)*CHUNK_SIZE;
            dm.position.set(wx,findY(wx,wz),wz);
            dm.scale.setScalar(0.5+r()*0.8); dm.rotation.y=r()*Math.PI; dm.updateMatrix();
            gm.setMatrixAt(i,dm.matrix);
        }
        gm.instanceMatrix.needsUpdate=true; grp.add(gm);
    }

    /* FADE-IN */
    grp.traverse(obj=>{
        if(!obj.isMesh) return;
        const mats=Array.isArray(obj.material)?obj.material:[obj.material];
        const cl=mats.map(m=>{ const c=m.clone(); c._bOp=c.opacity??1; c.transparent=true; c.opacity=0; return c; });
        obj.material=Array.isArray(obj.material)?cl:cl[0];
    });

    globalColliders.push(...lc);
    scene.add(grp);
    loadedChunks.set(key,{group:grp,localColliders:lc,lod});
    chunkFadeIn.set(key,{group:grp,alpha:0});
}

function unloadChunk(cx,cz){
    const key=cx+','+cz,data=loadedChunks.get(key);
    if(!data){loadedChunks.delete(key);return;}
    scene.remove(data.group);
    const sharedGeos=Object.values(GEO);
    data.group.traverse(obj=>{
        if(!obj.isMesh) return;
        if(obj.geometry&&!sharedGeos.includes(obj.geometry)) obj.geometry.dispose();
        const mats=Array.isArray(obj.material)?obj.material:[obj.material];
        mats.forEach(m=>{ if(m._bOp!==undefined) m.dispose(); });
    });
    for(const c of data.localColliders){ const idx=globalColliders.indexOf(c); if(idx!==-1)globalColliders.splice(idx,1); }
    data.group.traverse(obj=>{
        const fi=fireflyData.findIndex(f=>f.mesh===obj); if(fi!==-1)fireflyData.splice(fi,1);
        const wi=windObjects.findIndex(w=>w.mesh===obj); if(wi!==-1)windObjects.splice(wi,1);
    });
    loadedChunks.delete(key); chunkFadeIn.delete(key);
}

let lastCX=Infinity,lastCZ=Infinity;
function updateChunks(px,pz){
    const cx=Math.round(px/CHUNK_SIZE),cz=Math.round(pz/CHUNK_SIZE);
    if(cx===lastCX&&cz===lastCZ) return;
    lastCX=cx; lastCZ=cz;
    for(let dx=-CHUNK_RADIUS;dx<=CHUNK_RADIUS;dx++)
        for(let dz=-CHUNK_RADIUS;dz<=CHUNK_RADIUS;dz++){
            const dist=Math.max(Math.abs(dx),Math.abs(dz));
            const lod=dist<=1?0:dist<=2?1:2;
            generateChunk(cx+dx,cz+dz,lod);
        }
    for(const[key]of loadedChunks){
        const[kcx,kcz]=key.split(',').map(Number);
        if(Math.abs(kcx-cx)>CHUNK_RADIUS+1||Math.abs(kcz-cz)>CHUNK_RADIUS+1) unloadChunk(kcx,kcz);
    }
}

/* ─── PHYSIQUE ───────────────────────────────────────── */
const PLAYER_R=0.4,PLAYER_H=1.8;
function resolveColliders(nx,ny,nz){
    let onTop=false;
    for(const c of globalColliders){
        if(c.type==='cylinder'){
            const dx=nx-c.x,dz=nz-c.z,dXZ=Math.sqrt(dx*dx+dz*dz),cTop=c.y+c.h,pBot=ny-PLAYER_H;
            if(dXZ<c.r+PLAYER_R&&ny>c.y&&pBot<cTop){
                if(pBot>=cTop-0.65){ny=cTop+PLAYER_H;onTop=true;}
                else{const a=Math.atan2(dz,dx);nx=c.x+Math.cos(a)*(c.r+PLAYER_R);nz=c.z+Math.sin(a)*(c.r+PLAYER_R);}
            }
        } else {
            const dx=nx-c.x,dz=nz-c.z,dxz=Math.sqrt(dx*dx+dz*dz),pBot=ny-PLAYER_H,dy=(ny-PLAYER_H*0.5)-c.y,dist3=Math.sqrt(dx*dx+dy*dy+dz*dz);
            if(dist3<c.r+PLAYER_R&&dist3>0.001){
                if(pBot>=c.topY-0.8&&dy>-0.2){ny=c.topY+PLAYER_H;onTop=true;}
                else if(dxz>0.01){const need=c.r+PLAYER_R*1.1;if(dxz<need){nx+=(dx/dxz)*(need-dxz);nz+=(dz/dxz)*(need-dxz);}}
            }
        }
    }
    return{x:nx,y:ny,z:nz,onTop};
}

/* ─── CONTROLS ───────────────────────────────────────── */
const controls=new PointerLockControls(camera,document.body);
document.body.addEventListener('click',()=>controls.lock());
const velocity=new THREE.Vector3(),keys={z:false,s:false,q:false,d:false,shift:false};
let jumpVel=0,grounded=true,smoothGroundY=null;
addEventListener('keydown',e=>{
    const k=e.key.toLowerCase(); if(k in keys)keys[k]=true;
    if(e.shiftKey)keys.shift=true;
    if(e.code==='Space'&&grounded){grounded=false;jumpVel=0.32;}
});
addEventListener('keyup',e=>{
    const k=e.key.toLowerCase(); if(k in keys)keys[k]=false;
    if(!e.shiftKey)keys.shift=false;
});
const _fwd=new THREE.Vector3(),_right=new THREE.Vector3();
function updateMovement(dt){
    const run=keys.shift&&(keys.z||keys.s||keys.q||keys.d);
    _fwd.set(0,0,-1).applyQuaternion(camera.quaternion); _fwd.y=0; _fwd.normalize();
    _right.set(1,0,0).applyQuaternion(camera.quaternion); _right.y=0; _right.normalize();
    const slope=1-Math.abs(terrainNormal(camera.position.x,camera.position.z).y);
    const accel=(run?0.065:0.032)*(1-slope*0.5);
    if(keys.z)velocity.addScaledVector(_fwd,accel);
    if(keys.s)velocity.addScaledVector(_fwd,-accel);
    if(keys.q)velocity.addScaledVector(_right,-accel);
    if(keys.d)velocity.addScaledVector(_right,accel);
    velocity.multiplyScalar(0.88);
    let nx=camera.position.x+velocity.x,ny=camera.position.y,nz=camera.position.z+velocity.z;
    jumpVel=Math.max(jumpVel-0.016,-1.2); ny+=jumpVel;
    const res=resolveColliders(nx,ny,nz); nx=res.x; ny=res.y; nz=res.z;
    const tgy=findY(nx,nz)+PLAYER_H;
    if(ny<=tgy){
        if(jumpVel<=0&&!res.onTop){
            if(smoothGroundY===null)smoothGroundY=ny;
            smoothGroundY+=(tgy-smoothGroundY)*Math.min(1,0.25+(1-slope)*0.25+dt*8);
            ny=Math.max(smoothGroundY,tgy-0.05);
        } else { ny=tgy; smoothGroundY=ny; }
        if(jumpVel<=0){jumpVel=0;grounded=true;}
    } else if(res.onTop){
        smoothGroundY=ny;
        if(jumpVel<=0){jumpVel=0;grounded=true;}
    } else { smoothGroundY=null; grounded=false; }
    camera.position.set(nx,ny,nz);
}

/* ─── BOUCLE ─────────────────────────────────────────── */
const clock=new THREE.Clock();
let elapsed=DAY_DURATION*0.25;
updateChunks(0,0);

const _tmp=new THREE.Vector3();
function animate(){
    requestAnimationFrame(animate);
    const dt=Math.min(clock.getDelta(),0.05);
    elapsed+=dt;
    // Vent seulement les cônes proches
    const cpx=camera.position.x,cpz=camera.position.z;
    for(const w of windObjects){
        w.mesh.getWorldPosition(_tmp);
        const dx=_tmp.x-cpx,dz=_tmp.z-cpz;
        if(dx*dx+dz*dz<5000) w.mesh.rotation.z=Math.sin(elapsed*w.speed+w.phase)*w.amp;
    }
    for(const f of fireflyData){
        f.mesh.position.y=f.baseY+Math.sin(elapsed+f.phase)*0.5;
        f.mesh.position.x+=Math.cos(elapsed*0.3+f.phase)*0.008;
    }
    for(const[key,fd]of chunkFadeIn){
        fd.alpha=Math.min(1,fd.alpha+dt*1.2);
        const vis=Math.max(0,fd.alpha);
        if(vis>0) fd.group.traverse(obj=>{
            if(!obj.isMesh)return;
            const mats=Array.isArray(obj.material)?obj.material:[obj.material];
            for(const m of mats)if(m._bOp!==undefined)m.opacity=vis*m._bOp;
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
    if(controls.isLocked) updateMovement(dt);
    updateChunks(camera.position.x,camera.position.z);
    renderer.render(scene,camera);
}
animate();

addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
});

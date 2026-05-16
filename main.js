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
renderer.toneMapping = THREE.ACESFilmicToneMapping; // Améliore le rendu des fortes lumières
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

/* ─── SCENE / CAMERA ─────────────────────────────────── */
const scene = new THREE.Scene();
// Brouillard étendu pour voir les décors lointains et les montagnes
scene.fog = new THREE.FogExp2(0x0a1424, 0.003);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 4000);
camera.position.set(0, 10, 0);

/* ─── SKYBOX ─────────────────────────────────────────── */
const SKY_CANVAS = document.createElement('canvas');
SKY_CANVAS.width = 2; SKY_CANVAS.height = 256;
const SKY_CTX = SKY_CANVAS.getContext('2d');
const skyTex = new THREE.CanvasTexture(SKY_CANVAS);
scene.background = skyTex;

const SKY = {
    day:    { top:[0.15,0.50,0.90], hor:[0.55,0.80,0.95] },
    sunset: { top:[0.20,0.08,0.40], hor:[0.95,0.35,0.10] },
    night:  { top:[0.02,0.05,0.15], hor:[0.05,0.10,0.25] }, // Ambiance bleu sombre lumineuse
    dawn:   { top:[0.20,0.08,0.40], hor:[0.90,0.45,0.20] },
};

function lerp3(a,b,t){ return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]; }
function toCSS(rgb){ return `rgb(${rgb[0]*255|0},${rgb[1]*255|0},${rgb[2]*255|0})`; }
let _top=SKY.day.top.slice(), _hor=SKY.day.hor.slice();
function setSky(s){ _top=s.top.slice(); _hor=s.hor.slice(); }
function lerpSky(a,b,t){ _top=lerp3(a.top,b.top,t); _hor=lerp3(a.hor,b.hor,t); }
function drawSky(){
    const g=SKY_CTX.createLinearGradient(0,0,0,256);
    g.addColorStop(0,toCSS(_top)); g.addColorStop(1,toCSS(_hor));
    SKY_CTX.fillStyle=g; SKY_CTX.fillRect(0,0,2,256); skyTex.needsUpdate=true;
}

/* ─── LUMIÈRES ───────────────────────────────────────── */
const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 1.0);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfffaed, 5.0); // Boosté pour plus de réalisme
sun.castShadow = true;
sun.shadow.mapSize.setScalar(2048); // Meilleure résolution d'ombre
sun.shadow.camera.left = sun.shadow.camera.bottom = -200;
sun.shadow.camera.right = sun.shadow.camera.top = 200;
sun.shadow.camera.far = 2000;
scene.add(sun);

// Lune beaucoup plus lumineuse pour la nuit
const moonLight = new THREE.DirectionalLight(0x5a88ff, 1.5); 
moonLight.castShadow = true;
moonLight.shadow.mapSize.setScalar(1024);
scene.add(moonLight);

/* ─── ASTRES & HALOS ─────────────────────────────────── */
function makeGlowSprite(color){
    const c=document.createElement('canvas'); c.width=c.height=256;
    const ctx=c.getContext('2d');
    const g=ctx.createRadialGradient(128,128,0,128,128,128);
    g.addColorStop(0,color); g.addColorStop(0.3,color.replace(/[\d.]+\)$/,'0.4)')); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,256,256);
    return new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
}

// Vrai corps sphérique pour le soleil + gros éclats
const sunSphere = new THREE.Mesh(new THREE.SphereGeometry(30, 16, 16), new THREE.MeshBasicMaterial({color: 0xffffff}));
const sunGlow = makeGlowSprite('rgba(255,210,130,0.8)');
sunGlow.scale.setScalar(800);
scene.add(sunSphere, sunGlow);

const moonSphere = new THREE.Mesh(new THREE.SphereGeometry(20, 16, 16), new THREE.MeshBasicMaterial({color: 0xddeeff}));
const moonGlow = makeGlowSprite('rgba(100,150,255,0.6)');
moonGlow.scale.setScalar(500);
scene.add(moonSphere, moonGlow);

/* ─── ÉTOILES ────────────────────────────────────────── */
const STAR_COUNT=2000;
const starPos=new Float32Array(STAR_COUNT*3), starSz=new Float32Array(STAR_COUNT);
for(let i=0;i<STAR_COUNT;i++){
    const th=2*Math.PI*Math.random(), ph=Math.acos(2*Math.random()-1), r=1800;
    starPos[i*3]=r*Math.sin(ph)*Math.cos(th); starPos[i*3+1]=Math.abs(r*Math.cos(ph))+80; starPos[i*3+2]=r*Math.sin(ph)*Math.sin(th);
    starSz[i]=2.0+Math.random()*4.0;
}
const starGeo=new THREE.BufferGeometry();
starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3));
starGeo.setAttribute('size',new THREE.BufferAttribute(starSz,1));
const starMat=new THREE.ShaderMaterial({
    uniforms:{uOp:{value:0},uT:{value:0}},
    vertexShader:`attribute float size;uniform float uT;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=size*(1.+0.3*sin(uT*2.+size*13.7));gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float uOp;void main(){vec2 uv=gl_PointCoord-.5;float d=length(uv);if(d>.5)discard;float b=pow(1.-d*2.,1.5);gl_FragColor=vec4(1.,1.,1.,b*uOp);}`,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
});
const starsObj=new THREE.Points(starGeo,starMat);
scene.add(starsObj);

/* ─── SIMPLEX NOISE ──────────────────────────────────── */
const SEED=Math.random()*2147483647|0;
const seedDisplay = document.getElementById('seed-display');
if(seedDisplay) seedDisplay.textContent='seed : '+SEED;

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

/* ─── MATÉRIAUX ──────────────────────────────────────── */
const MAT={
    trunk:    new THREE.MeshStandardMaterial({color:0x2a1a0e, roughness:0.9}),
    cone0:    new THREE.MeshStandardMaterial({color:0x0f240f, roughness:0.8}),
    cone1:    new THREE.MeshStandardMaterial({color:0x163016, roughness:0.8}),
    cone2:    new THREE.MeshStandardMaterial({color:0x1c3d1c, roughness:0.8}),
    rock:     new THREE.MeshStandardMaterial({color:0x555558,roughness:0.9,flatShading:true}),
    ground:   new THREE.MeshStandardMaterial({color:0x1b3014,roughness:1.0}),
    mountain: new THREE.MeshStandardMaterial({color:0x222830,roughness:1.0,flatShading:true}), // Pour le décor au loin
    stem:     new THREE.MeshStandardMaterial({color:0x2d4c1e}),
    grass:    new THREE.MeshStandardMaterial({color:0x3f6b2d}),
    ff:       new THREE.MeshBasicMaterial({color:0xffffaa}),
    mushCap:  new THREE.MeshStandardMaterial({color:0xcc3300}),
    mushCap2: new THREE.MeshStandardMaterial({color:0xaa2200}),
    mushSpot: new THREE.MeshStandardMaterial({color:0xffffff}),
    mushStem: new THREE.MeshStandardMaterial({color:0xe8dcc8}),
    towLog:   new THREE.MeshStandardMaterial({color:0x2c1d11,roughness:0.9}),
    towPlank: new THREE.MeshStandardMaterial({color:0x3a2818,roughness:0.8}),
    towRail:  new THREE.MeshStandardMaterial({color:0x1f130b,roughness:0.9}),
};
const CONE_MATS=[MAT.cone0,MAT.cone1,MAT.cone2];
const FLOWER_COLORS=[0xff4444,0x4444ff,0xffff55,0xffffff,0xff66cc];
const flowerCache={};
function flowerMat(hex){ if(!flowerCache[hex])flowerCache[hex]=new THREE.MeshStandardMaterial({color:hex,emissive:hex,emissiveIntensity:0.2}); return flowerCache[hex]; }

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
    towPlank: new THREE.BoxGeometry(1.6, 0.15, 0.5), // Marches d'escalier élargies
};

/* ─── MONTAGNES DE DÉCOR (INATTEIGNABLES) ─────────────── */
function createDistantMountains() {
    const mountainGroup = new THREE.Group();
    const totalMountains = 18;
    const radius = 1500; // Très loin derrière le brouillard

    for (let i = 0; i < totalMountains; i++) {
        const angle = (i / totalMountains) * Math.PI * 2 + Math.random() * 0.2;
        const width = 300 + Math.random() * 300;
        const height = 250 + Math.random() * 200;
        const depth = 300 + Math.random() * 200;

        const geo = new THREE.ConeGeometry(width / 2, height, 4); // Basse résolution (4 côtés = pyramide)
        const mesh = new THREE.Mesh(geo, MAT.mountain);
        
        const mX = Math.cos(angle) * radius;
        const mZ = Math.sin(angle) * radius;
        const mY = fbm(mX, mZ) - 20; // Ancré au sol de base

        mesh.position.set(mX, mY + height / 2, mZ);
        mesh.rotation.y = Math.random() * Math.PI;
        mountainGroup.add(mesh);
    }
    scene.add(mountainGroup);
}
createDistantMountains();

/* ─── GLOBAUX ────────────────────────────────────────── */
const windObjects=[], fireflyData=[], globalColliders=[];

/* ─── TOUR D'OBSERVATION CONFIGURÉE ──────────────────── */
const TOWER_H  = 30;  
const PLT_HALF = 3.5; // Elargie pour respirer

function chunkHasTower(cx,cz){
    if(cx===0&&cz===0) return true;
    const cellX=Math.floor(cx/5), cellZ=Math.floor(cz/5);
    if(cellX===0&&cellZ===0) return false;
    let h=(cx*374761393+cz*668265263)^0xdeadbeef;
    h=Math.imul(h^(h>>>16),0x45d9f3b); h^=h>>>16;
    const val=(h>>>0)/0xffffffff;
    for(let dx=-4;dx<=4;dx++){
        for(let dz=-4;dz<=4;dz++){
            if(dx===0&&dz===0) continue;
            const nx=cx+dx,nz=cz+dz;
            if(Math.floor(nx/5)!==cellX||Math.floor(nz/5)!==cellZ) continue;
            let h2=(nx*374761393+nz*668265263)^0xdeadbeef;
            h2=Math.imul(h2^(h2>>>16),0x45d9f3b); h2^=h2>>>16;
            if((h2>>>0)/0xffffffff>val) return false;
        }
    }
    return true;
}

function buildTower(wx,wz,grp,lc){
    const gy=findY(wx,wz);
    const tg=new THREE.Group();
    const pillarH = TOWER_H + 8;

    // Piliers principaux
    const pDef=[
        {ox:-PLT_HALF, oz:-PLT_HALF}, {ox: PLT_HALF, oz:-PLT_HALF},
        {ox: PLT_HALF, oz: PLT_HALF}, {ox:-PLT_HALF, oz: PLT_HALF}
    ];
    for(const p of pDef){
        const mesh=new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.8,pillarH,8),MAT.towLog);
        mesh.position.set(p.ox, pillarH/2 - 4, p.oz);
        mesh.castShadow=true; mesh.receiveShadow=true;
        tg.add(mesh);
        // AJOUT DES COLLIDERS AUX PILIERS DE LA TOUR au sol
        lc.push({type:'cylinder', x: wx + p.ox, y: gy, z: wz + p.oz, r: 0.9, h: TOWER_H});
    }

    // ESCALIER EN COLIMAÇON AUTOUR DE LA TOUR (Fluide et large)
    const stepsCount = 75;
    const radiusSpiral = PLT_HALF + 1.2; 
    for(let i=0; i<stepsCount; i++){
        const pct = i / stepsCount;
        const angle = pct * Math.PI * 4.5; // Fait un peu plus de 2 tours complets autour de la tour
        const stepY = pct * TOWER_H;

        const sx = Math.cos(angle) * radiusSpiral;
        const sz = Math.sin(angle) * radiusSpiral;

        const step = new THREE.Mesh(GEO.towPlank, MAT.towPlank);
        step.position.set(sx, stepY, sz);
        step.rotation.y = -angle + Math.PI/2;
        step.castShadow = true; step.receiveShadow = true;
        tg.add(step);

        // Collision douce individuelle pour chaque marche
        lc.push({type:'cylinder', x: wx + sx, y: gy + stepY, z: wz + sz, r: 1.0, h: 0.3});
    }

    // PLANCHER DE LA PLATEFORME SUPÉRIEURE
    const floorW = PLT_HALF * 2 + 1.5;
    const plGeo = new THREE.BoxGeometry(floorW, 0.2, floorW);
    const platformFloor = new THREE.Mesh(plGeo, MAT.towPlank);
    platformFloor.position.set(0, TOWER_H, 0);
    platformFloor.receiveShadow = true;
    tg.add(platformFloor);
    lc.push({type:'cylinder', x:wx, y:gy+TOWER_H, r: floorW*0.6, h:0.5});

    // GARDE CORPS HAUT
    const railGeo = new THREE.BoxGeometry(floorW, 1.1, 0.1);
    for(let r=0; r<4; r++) {
        if(r === 0) continue; // Laisse un côté ouvert pour l'arrivée de l'escalier en colimaçon !
        const rail = new THREE.Mesh(railGeo, MAT.towRail);
        rail.position.set(0, TOWER_H + 0.55, 0);
        if(r===1) { rail.position.z =  floorW/2; }
        if(r===2) { rail.position.z = -floorW/2; }
        if(r===3) { rail.position.x =  floorW/2; rail.rotation.y = Math.PI/2; }
        tg.add(rail);
    }

    // TOIT SURÉLEVÉ (Pour ne pas se cogner la tête !)
    const roofHeight = 6.0; 
    const roof = new THREE.Mesh(new THREE.ConeGeometry(floorW * 0.7, roofHeight, 4), MAT.towLog);
    roof.position.set(0, TOWER_H + 4.5, 0); // Remonté à +4.5 unités au dessus du plancher
    roof.rotation.y = Math.PI/4;
    roof.castShadow = true;
    tg.add(roof);

    tg.position.set(wx,gy,wz);
    grp.add(tg);
    return {wx,wz,clearR:PLT_HALF+6};
}

/* ─── CHUNKS ACTIFS & CHUNKS LOINTAINS (LOD POUR DÉCOR) ─── */
const CHUNK_SIZE=80, CHUNK_SEGS=16, CHUNK_RADIUS=3, MAX_RENDER_DIST=6;
const loadedChunks=new Map(), chunkFadeIn=new Map();
function seededRng(seed){
    let s=(seed^0xdeadbeef)|0;
    return ()=>{ s=Math.imul(s^(s>>>16),0x45d9f3b); s=Math.imul(s^(s>>>16),0x45d9f3b); s^=s>>>16; return (s>>>0)/0xffffffff; };
}

function generateChunk(cx,cz, isLowDetail=false){
    const key=cx+','+cz;
    if(loadedChunks.has(key)) {
        // Si le chunk existait en LOD et qu'on s'approche, on le recrée proprement
        if(!isLowDetail && loadedChunks.get(key)?.lod === true) {
            unloadChunk(cx,cz);
        } else { return; }
    }
    loadedChunks.set(key, {lod: isLowDetail});
    requestAnimationFrame(()=>_buildChunk(cx,cz,key, isLowDetail));
}

function _buildChunk(cx,cz,key, isLowDetail){
    if(!loadedChunks.has(key)) return;
    const oX=cx*CHUNK_SIZE,oZ=cz*CHUNK_SIZE;
    const r=seededRng(cx*73856093^cz*19349663);
    const grp=new THREE.Group(),lc=[];

    /* SOL (Résolution réduite si loin pour économiser les performances) */
    const segs = isLowDetail ? 4 : CHUNK_SEGS;
    const tgeo=new THREE.PlaneGeometry(CHUNK_SIZE,CHUNK_SIZE,segs,segs);
    const vp=tgeo.attributes.position.array;
    for(let i=0;i<vp.length;i+=3) vp[i+2]=fbm(oX+vp[i],oZ-vp[i+1]);
    tgeo.computeVertexNormals();
    const terr=new THREE.Mesh(tgeo,MAT.ground);
    terr.rotation.x=-Math.PI/2; terr.position.set(oX,0,oZ); terr.receiveShadow=true;
    grp.add(terr);

    // Si c'est un chunk lointain (LOD décor), on s'arrête ici : pas d'arbres, pas de physique !
    if (isLowDetail) {
        scene.add(grp);
        loadedChunks.set(key,{group:grp,localColliders:[], lod: true});
        return;
    }

    /* TOUR OBSERVATION */
    let towerInfo=null;
    if(chunkHasTower(cx,cz)){
        let twx,twz;
        if(cx===0&&cz===0){ twx=22; twz=22; }
        else {
            const rng2=seededRng(cx*19349663^cz*73856093);
            twx=oX+(rng2()-0.5)*CHUNK_SIZE*0.5;
            twz=oZ+(rng2()-0.5)*CHUNK_SIZE*0.5;
        }
        towerInfo=buildTower(twx,twz,grp,lc);
    }

    const occupied=[];
    if(towerInfo) occupied.push({x:towerInfo.wx,z:towerInfo.wz,r:towerInfo.clearR+5});
    function canPlace(wx,wz,minDist){
        return !occupied.some(o=>{ const dx=wx-o.x,dz=wz-o.z; return dx*dx+dz*dz<(minDist+o.r)*(minDist+o.r); });
    }
    function occupy(wx,wz,rad){ occupied.push({x:wx,z:wz,r:rad}); }

    /* ARBRES */
    const treeN=6+(r()*6|0),tpts=[];
    for(let i=0;i<treeN;i++){
        let wx,wz,ok=false,tries=0;
        do{
            wx=oX+(r()-0.5)*CHUNK_SIZE*0.85; wz=oZ+(r()-0.5)*CHUNK_SIZE*0.85;
            ok=canPlace(wx,wz,8)&&!tpts.some(p=>{const dx=p[0]-wx,dz=p[1]-wz;return dx*dx+dz*dz<16*16;});
        } while(!ok&&++tries<20);
        if(tries>=20) continue;
        tpts.push([wx,wz]); occupy(wx,wz,8);
        const gy=findY(wx,wz),h=28+r()*18,tr=1.4+r()*1.0,trunkH=h*(0.28+r()*0.08),tgr=new THREE.Group();
        const trunk=new THREE.Mesh(new THREE.CylinderGeometry(tr*0.55,tr*1.4,trunkH+6,8),MAT.trunk);
        trunk.position.y=trunkH/2-3; trunk.castShadow=true; tgr.add(trunk);
        const layers=8+(r()*4|0),foliageH=h-trunkH;
        for(let li=0;li<layers;li++){
            const ratio=li/(layers-1),coneY=trunkH+ratio*foliageH*0.90,radius=tr*4.5*(1-ratio*0.72)+1.5,coneH=(foliageH/layers)*2.2;
            const cone=new THREE.Mesh(new THREE.ConeGeometry(radius,coneH,7),CONE_MATS[(r()*3)|0]);
            cone.position.y=coneY; tgr.add(cone);
            windObjects.push({mesh:cone,phase:r()*10,speed:0.5,amp:0.012});
        }
        tgr.position.set(wx,gy,wz); grp.add(tgr);
        lc.push({type:'cylinder',x:wx,y:gy,z:wz,r:tr*1.5,h:trunkH+6});
    }

    /* ROCHERS */
    for(let i=0,n=1+(r()*2|0);i<n;i++){
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

    /* LUCIOLES */
    for(let i=0,n=2+(r()*4|0);i<n;i++){
        const wx=oX+(r()-0.5)*CHUNK_SIZE*0.88,wz=oZ+(r()-0.5)*CHUNK_SIZE*0.88;
        const fy=findY(wx,wz)+2+r()*4;
        const m=new THREE.Mesh(GEO.ff,MAT.ff); m.position.set(wx,fy,wz); grp.add(m);
        fireflyData.push({mesh:m,baseY:fy,phase:r()*10,ox:wx,oz:wz});
    }

    globalColliders.push(...lc);
    scene.add(grp);
    loadedChunks.set(key,{group:grp,localColliders:lc, lod: false});
}

function unloadChunk(cx,cz){
    const key=cx+','+cz,data=loadedChunks.get(key);
    if(!data || !data.group) { loadedChunks.delete(key); return; }
    scene.remove(data.group);
    data.group.traverse(obj=>{
        if(!obj.isMesh) return;
        if(obj.geometry && !Object.values(GEO).includes(obj.geometry)) obj.geometry.dispose();
    });
    if(data.localColliders) {
        for(const c of data.localColliders){ const idx=globalColliders.indexOf(c); if(idx!==-1)globalColliders.splice(idx,1); }
    }
    loadedChunks.delete(key);
}

let lastCX=Infinity,lastCZ=Infinity;
function updateChunks(px,pz){
    const cx=Math.round(px/CHUNK_SIZE),cz=Math.round(pz/CHUNK_SIZE);
    if(cx===lastCX&&cz===lastCZ) return;
    lastCX=cx; lastCZ=cz;

    // Chunks actifs proches (avec détails et physique)
    for(let dx=-CHUNK_RADIUS;dx<=CHUNK_RADIUS;dx++) {
        for(let dz=-CHUNK_RADIUS;dz<=CHUNK_RADIUS;dz++) {
            generateChunk(cx+dx, cz+dz, false);
        }
    }

    // Chunks lointains (LOD Décor visuel uniquement pour boucher le fond)
    for(let dx=-MAX_RENDER_DIST;dx<=MAX_RENDER_DIST;dx++) {
        for(let dz=-MAX_RENDER_DIST;dz<=MAX_RENDER_DIST;dz++) {
            if(Math.abs(dx) > CHUNK_RADIUS || Math.abs(dz) > CHUNK_RADIUS) {
                generateChunk(cx+dx, cz+dz, true);
            }
        }
    }

    // Unload ce qui est trop loin
    for(const[key]of loadedChunks){
        const[kcx,kcz]=key.split(',').map(Number);
        if(Math.abs(kcx-cx)>MAX_RENDER_DIST+1||Math.abs(kcz-cz)>MAX_RENDER_DIST+1) unloadChunk(kcx,kcz);
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
let jumpVel=0,grounded=true;

window.addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();
    if(k==='z'||k==='w')keys.z=true; if(k==='s')keys.s=true;
    if(k==='q'||k==='a')keys.q=true; if(k==='d')keys.d=true;
    if(e.key===' ')keys.space=true; if(e.key==='Shift')keys.shift=true;
});
window.addEventListener('keyup',e=>{
    const k=e.key.toLowerCase();
    if(k==='z'||k==='w')keys.z=false; if(k==='s')keys.s=false;
    if(k==='q'||k==='a')keys.q=false; if(k==='d')keys.d=false;
    if(e.key===' ')keys.space=false; if(e.key==='Shift')keys.shift=false;
});

/* ─── CYCLE JOUR/NUIT MIS À JOUR ─────────────────────── */
const DAY_DURATION=600, ORBIT_R=1400; // Un peu plus rapide pour en profiter
function updateDayNight(elapsed){
    const angle=((elapsed/DAY_DURATION)*Math.PI*2)%(Math.PI*2);
    const sinA=Math.sin(angle),sf=Math.max(0,sinA),sfS=sf*sf*(3-2*sf),mf=Math.max(0,-sinA),mfS=mf*mf*(3-2*mf);
    
    const sunX=Math.cos(angle)*ORBIT_R,sunY=Math.sin(angle)*ORBIT_R;
    sun.position.set(sunX,sunY,ORBIT_R*0.25);
    moonLight.position.set(-sunX,-sunY,ORBIT_R*0.25);
    
    const cp=camera.position;
    const sd=new THREE.Vector3(sunX,sunY,ORBIT_R*0.25).normalize(),md=sd.clone().negate();
    
    // Positionnement des vrais astres et de leurs éclats
    sunSphere.position.copy(cp).addScaledVector(sd,1300);
    sunGlow.position.copy(cp).addScaledVector(sd,1290);
    moonSphere.position.copy(cp).addScaledVector(md,1300);
    moonGlow.position.copy(cp).addScaledVector(md,1290);
    
    // Intensités ajustées (Nuit très claire et bleutée)
    sun.intensity = sfS * 6.0; 
    moonLight.intensity = mfS * 2.0; 
    hemi.intensity = 0.4 + sfS*1.0 + mfS*0.4;
    
    sunSphere.material.opacity=Math.pow(sf,0.2);
    sunGlow.material.opacity=Math.pow(sf,0.5);
    moonSphere.material.opacity=Math.pow(mf,0.2);
    moonGlow.material.opacity=Math.pow(mf,0.5);
    
    // Couleur du brouillard interpolée
    const targetFogColor = new THREE.Color();
    targetFogColor.lerpColors(new THREE.Color(0x050e22), new THREE.Color(0x3a5d7a), sfS);
    scene.fog.color.copy(targetFogColor);
    
    starMat.uniforms.uOp.value=Math.max(0,1-sfS*2.0)*0.95;
    starMat.uniforms.uT.value=elapsed;
    starsObj.position.copy(cp);
    
    const a=angle,PI=Math.PI;
    if(a<PI*0.20)      lerpSky(SKY.dawn,SKY.day,a/(PI*0.20));
    else if(a<PI*0.75) setSky(SKY.day);
    else if(a<PI*1.10) lerpSky(SKY.day,SKY.sunset,(a-PI*0.75)/(PI*0.35));
    else if(a<PI*1.40) lerpSky(SKY.sunset,SKY.night,(a-PI*1.10)/(PI*0.30));
    else if(a<PI*1.75) setSky(SKY.night);
    else               lerpSky(SKY.night,SKY.dawn,(a-PI*1.75)/(PI*0.25));
    drawSky();
}

/* ─── BOUCLE D'ANIMATION ─────────────────────────────── */
const clock=new THREE.Clock();
function animate(){
    requestAnimationFrame(animate);
    const dt=Math.min(clock.getDelta(),0.1), elapsed=clock.getElapsedTime();
    
    updateDayNight(elapsed);
    
    // Déplacements joueur
    if(controls.isLocked){
        const speed=keys.shift?24:11;
        const input=new THREE.Vector3();
        if(keys.z)input.z-=1; if(keys.s)input.z+=1;
        if(keys.q)input.x-=1; if(keys.d)input.x+=1;
        input.normalize();
        
        const camDir=new THREE.Vector3(); camera.getWorldDirection(camDir);
        const forward=new THREE.Vector3(camDir.x,0,camDir.z).normalize();
        const side=new THREE.Vector3().crossVectors(camera.up,forward).normalize();
        
        velocity.set(0,0,0);
        velocity.addScaledVector(forward,-input.z*speed);
        velocity.addScaledVector(side,input.x*speed);
        
        let nextX = camera.position.x + velocity.x*dt;
        let nextZ = camera.position.z + velocity.z*dt;
        let nextY = camera.position.y;
        
        if(!grounded) jumpVel-=32*dt;
        nextY += jumpVel*dt;
        
        const terrY = findY(nextX,nextZ) + PLAYER_H;
        if(nextY<=terrY){ nextY=terrY; jumpVel=0; grounded=true; }
        else { grounded=false; }
        
        if(keys.space && grounded){ jumpVel=13; grounded=false; }
        
        const res = resolveColliders(nextX,nextY,nextZ);
        camera.position.set(res.x,res.y,res.z);
        if(res.onTop){ jumpVel=0; grounded=true; }
    }
    
    // Animations environnement
    for(const w of windObjects) w.mesh.rotation.z = Math.sin(elapsed*w.speed + w.phase)*w.amp;
    for(const f of fireflyData){
        f.mesh.position.y = f.baseY + Math.sin(elapsed*1.5 + f.phase)*0.6;
        f.mesh.position.x = f.ox + Math.cos(elapsed*0.5 + f.phase)*1.2;
        f.mesh.position.z = f.oz + Math.sin(elapsed*0.5 + f.phase)*1.2;
    }
    
    updateChunks(camera.position.x, camera.position.z);
    renderer.render(scene,camera);
}

// Lancement
updateChunks(0,0);
drawSky();
animate();

window.addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
});

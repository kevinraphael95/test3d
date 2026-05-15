import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';

/* ───────────────────────────────────────────────────────
   RENDERER
─────────────────────────────────────────────────────── */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
document.body.appendChild(renderer.domElement);

/* ───────────────────────────────────────────────────────
   SCENE / CAMERA
─────────────────────────────────────────────────────── */
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x9bb4c7, 0.004);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 2000);
camera.position.set(0, 10, 0);

/* ───────────────────────────────────────────────────────
   SKYBOX canvas
─────────────────────────────────────────────────────── */
const SKY_CANVAS = document.createElement('canvas');
SKY_CANVAS.width = 2; SKY_CANVAS.height = 256;
const SKY_CTX = SKY_CANVAS.getContext('2d');
const skyTex = new THREE.CanvasTexture(SKY_CANVAS);
scene.background = skyTex;

const SKY = {
    day:    { top:[0.10,0.44,0.83], hor:[0.49,0.78,0.94] },
    sunset: { top:[0.23,0.06,0.38], hor:[1.00,0.27,0.00] },
    night:  { top:[0.04,0.08,0.21], hor:[0.09,0.13,0.25] },
    dawn:   { top:[0.23,0.06,0.38], hor:[1.00,0.40,0.13] },
};
function lerp3(a,b,t){return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
function toCSS(rgb){return`rgb(${(rgb[0]*255)|0},${(rgb[1]*255)|0},${(rgb[2]*255)|0})`;}
let _top=SKY.day.top.slice(),_hor=SKY.day.hor.slice();
function setSky(s){_top=s.top.slice();_hor=s.hor.slice();}
function lerpSky(a,b,t){_top=lerp3(a.top,b.top,t);_hor=lerp3(a.hor,b.hor,t);}
function drawSky(){
    const g=SKY_CTX.createLinearGradient(0,0,0,256);
    g.addColorStop(0,toCSS(_top));g.addColorStop(1,toCSS(_hor));
    SKY_CTX.fillStyle=g;SKY_CTX.fillRect(0,0,2,256);
    skyTex.needsUpdate=true;
}

/* ───────────────────────────────────────────────────────
   LUMIÈRES
─────────────────────────────────────────────────────── */
const hemi = new THREE.HemisphereLight(0xddeeff, 0x3d2f1b, 1.2);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff5e0, 3.0);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -200;
sun.shadow.camera.right = sun.shadow.camera.top = 200;
sun.shadow.camera.far = 1500;
scene.add(sun);
const moonLight = new THREE.DirectionalLight(0x4466bb, 0);
scene.add(moonLight);

/* ───────────────────────────────────────────────────────
   SPRITES SOLEIL & LUNE
─────────────────────────────────────────────────────── */
function makeCircleSprite(inner,outer,sz){
    const c=document.createElement('canvas');c.width=c.height=256;
    const ctx=c.getContext('2d'),g=ctx.createRadialGradient(128,128,0,128,128,128);
    g.addColorStop(0,inner);g.addColorStop(0.3,outer);
    g.addColorStop(0.7,outer.replace(/[\d.]+\)$/,'0.15)'));g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,256,256);
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
    sp.scale.setScalar(sz);return sp;
}
const sunSprite  = makeCircleSprite('rgba(255,255,220,1)','rgba(255,200,50,0.8)',200);
const sunGlow    = makeCircleSprite('rgba(255,160,30,0.6)','rgba(255,100,0,0.2)',500);
const moonSprite = makeCircleSprite('rgba(230,240,255,1)','rgba(150,170,220,0.7)',140);
const moonGlow   = makeCircleSprite('rgba(80,100,180,0.4)','rgba(40,60,140,0.1)',360);
scene.add(sunSprite,sunGlow,moonSprite,moonGlow);

/* ───────────────────────────────────────────────────────
   ÉTOILES
─────────────────────────────────────────────────────── */
const STAR_COUNT=1200;
const starPos=new Float32Array(STAR_COUNT*3),starSz=new Float32Array(STAR_COUNT);
for(let i=0;i<STAR_COUNT;i++){
    const th=2*Math.PI*Math.random(),ph=Math.acos(2*Math.random()-1),r=1600;
    starPos[i*3]=r*Math.sin(ph)*Math.cos(th);starPos[i*3+1]=Math.abs(r*Math.cos(ph))+80;starPos[i*3+2]=r*Math.sin(ph)*Math.sin(th);
    starSz[i]=1.5+Math.random()*3.5;
}
const starGeo=new THREE.BufferGeometry();
starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3));
starGeo.setAttribute('size',new THREE.BufferAttribute(starSz,1));
const starMat=new THREE.ShaderMaterial({
    uniforms:{uOp:{value:0},uT:{value:0}},
    vertexShader:`attribute float size;uniform float uT;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=size*(1.0+0.3*sin(uT*2.0+size*13.7));gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float uOp;void main(){vec2 uv=gl_PointCoord-0.5;float d=length(uv);if(d>0.5)discard;float b=pow(1.0-d*2.0,1.5);gl_FragColor=vec4(1.0,1.0,0.95,b*uOp);}`,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
});
scene.add(new THREE.Points(starGeo,starMat));

/* ───────────────────────────────────────────────────────
   CYCLE JOUR/NUIT
─────────────────────────────────────────────────────── */
const DAY_DURATION=1200,ORBIT_R=1400;
function updateDayNight(elapsed){
    const angle=((elapsed/DAY_DURATION)*Math.PI*2)%(Math.PI*2);
    const sinA=Math.sin(angle),sf=Math.max(0,sinA),sfS=sf*sf*(3-2*sf),mf=Math.max(0,-sinA),mfS=mf*mf*(3-2*mf);
    const sunX=Math.cos(angle)*ORBIT_R,sunY=Math.sin(angle)*ORBIT_R;
    sun.position.set(sunX,sunY,ORBIT_R*0.25);moonLight.position.set(-sunX,-sunY,ORBIT_R*0.25);
    const cp=camera.position,sd=new THREE.Vector3(sunX,sunY,ORBIT_R*0.25).normalize(),md=sd.clone().negate();
    sunSprite.position.copy(cp).addScaledVector(sd,1350);sunGlow.position.copy(cp).addScaledVector(sd,1340);
    moonSprite.position.copy(cp).addScaledVector(md,1350);moonGlow.position.copy(cp).addScaledVector(md,1340);
    sun.intensity=0.05+sfS*3.0;moonLight.intensity=0.20+mfS*0.5;hemi.intensity=0.30+sfS*0.9;
    sunSprite.material.opacity=Math.pow(sf,0.35);sunGlow.material.opacity=Math.pow(sf,0.5)*0.8;
    moonSprite.material.opacity=Math.pow(mf,0.35);moonGlow.material.opacity=Math.pow(mf,0.5)*0.7;
    scene.fog.color.lerpColors(new THREE.Color(0x04091f),new THREE.Color(0x9bb4c7),sfS);
    scene.fog.density=0.003+(1-sfS)*0.002;
    starMat.uniforms.uOp.value=Math.max(0,1-sfS*2.0)*0.95;starMat.uniforms.uT.value=elapsed;
    // skybox
    const a=angle;
    if(a<Math.PI*0.20)lerpSky(SKY.dawn,SKY.day,a/(Math.PI*0.20));
    else if(a<Math.PI*0.75)setSky(SKY.day);
    else if(a<Math.PI*1.10)lerpSky(SKY.day,SKY.sunset,(a-Math.PI*0.75)/(Math.PI*0.35));
    else if(a<Math.PI*1.40)lerpSky(SKY.sunset,SKY.night,(a-Math.PI*1.10)/(Math.PI*0.30));
    else if(a<Math.PI*1.75)setSky(SKY.night);
    else lerpSky(SKY.night,SKY.dawn,(a-Math.PI*1.75)/(Math.PI*0.25));
    drawSky();
}

/* ───────────────────────────────────────────────────────
   MUSIQUE
─────────────────────────────────────────────────────── */
function initMusic(){
    const audio=new Audio('background_sound.mp3');audio.volume=0.45;
    const play=()=>{audio.currentTime=0;audio.play().catch(()=>{});};
    audio.addEventListener('ended',()=>setTimeout(play,120000));
    let started=false;
    document.addEventListener('click',()=>{if(started)return;started=true;play();},{once:true});
}
initMusic();

/* ───────────────────────────────────────────────────────
   SIMPLEX NOISE — 2 seeds : terrain + biome
─────────────────────────────────────────────────────── */
const SEED=Math.random()*65536|0;
const SEED_BIOME=Math.random()*65536|0;
console.log('Seed:',SEED,'Biome seed:',SEED_BIOME);

function buildPerm(seed){
    const p=new Uint8Array(256);for(let i=0;i<256;i++)p[i]=i;let s=seed;
    for(let i=255;i>0;i--){s=(s*1664525+1013904223)&0xffffffff;const j=(s>>>24)%(i+1);[p[i],p[j]]=[p[j],p[i]];}
    const perm=new Uint8Array(512);for(let i=0;i<512;i++)perm[i]=p[i&255];return perm;
}
const perm=buildPerm(SEED),permB=buildPerm(SEED_BIOME);
const GRAD=[[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];

function _simplex2(xin,yin,pm){
    const F2=0.5*(Math.sqrt(3)-1),G2=(3-Math.sqrt(3))/6;
    const s=(xin+yin)*F2,i=Math.floor(xin+s)|0,j=Math.floor(yin+s)|0,t=(i+j)*G2;
    const x0=xin-(i-t),y0=yin-(j-t),i1=x0>y0?1:0,j1=x0>y0?0:1;
    const x1=x0-i1+G2,y1=y0-j1+G2,x2=x0-1+2*G2,y2=y0-1+2*G2;
    const ii=i&255,jj=j&255,g0=pm[ii+pm[jj]]%8,g1=pm[ii+i1+pm[jj+j1]]%8,g2=pm[ii+1+pm[jj+1]]%8;
    let n0=0,n1=0,n2=0;
    let t0=0.5-x0*x0-y0*y0;if(t0>=0){t0*=t0;n0=t0*t0*(GRAD[g0][0]*x0+GRAD[g0][1]*y0);}
    let t1=0.5-x1*x1-y1*y1;if(t1>=0){t1*=t1;n1=t1*t1*(GRAD[g1][0]*x1+GRAD[g1][1]*y1);}
    let t2=0.5-x2*x2-y2*y2;if(t2>=0){t2*=t2;n2=t2*t2*(GRAD[g2][0]*x2+GRAD[g2][1]*y2);}
    return 70*(n0+n1+n2);
}
function simplex2(x,z){return _simplex2(x,z,perm);}
function simplexB(x,z){return _simplex2(x,z,permB);}

function fbm(x,z){
    return simplex2(x*0.002,z*0.002)*14
         +simplex2(x*0.008,z*0.008)*5
         +simplex2(x*0.025,z*0.025)*1.5;
}

/* ───────────────────────────────────────────────────────
   BIOMES
   0 = Forêt dense (sapins)   — vert foncé
   1 = Plaine fleurie          — vert clair
   2 = Désert/rochers          — sable
   3 = Marécage sombre         — vert-brun
   4 = Forêt de bouleaux       — vert pâle
─────────────────────────────────────────────────────── */
const BIOME_NAMES=['forest','plain','desert','swamp','birch'];

// Retourne un objet { id, weights[5] } pour les transitions douces
function getBiomeWeights(wx,wz){
    // Deux couches de bruit à grande échelle pour placer les biomes
    const bx=wx*0.0008,bz=wz*0.0008;
    const n1=(simplexB(bx,bz)+1)*0.5;                      // 0..1
    const n2=(simplexB(bx+73.3,bz+41.7)+1)*0.5;            // 0..1
    const n3=(simplexB(bx*2.1+11,bz*1.8+7)+1)*0.5;         // finer
    // Combiner pour obtenir index 0..4
    const raw=(n1*2.5+n2*1.5+n3)*0.6; // 0..3
    const weights=[0,0,0,0,0];
    // Smooth remap : distribuer le poids entre les 2 biomes les plus proches
    const lo=Math.floor(raw)%5, hi=(lo+1)%5;
    const t=raw-Math.floor(raw);
    const tSmooth=t*t*(3-2*t);
    weights[lo]=1-tSmooth;
    weights[hi]=tSmooth;
    // Biome dominant
    const id=tSmooth>0.5?hi:lo;
    return{id,weights};
}

// Couleurs de sol par biome
const GROUND_COLORS=[
    0x243b1d, // forest — vert foncé
    0x3a5c20, // plain  — vert herbe
    0xc8a96e, // desert — sable
    0x1a2e18, // swamp  — vert sombre
    0x2e4a1a, // birch  — vert pâle
];

/* ───────────────────────────────────────────────────────
   HEIGHTMAP
─────────────────────────────────────────────────────── */
const HSTEP=0.5,hCache=new Map();
function heightAt(wx,wz){
    const kx=Math.round(wx/HSTEP)|0,kz=Math.round(wz/HSTEP)|0,key=kx*100003+kz;
    let h=hCache.get(key);if(h===undefined){h=fbm(wx,wz);hCache.set(key,h);}return h;
}
function findY(wx,wz){
    const x0=Math.floor(wx/HSTEP)*HSTEP,z0=Math.floor(wz/HSTEP)*HSTEP,fu=(wx-x0)/HSTEP,fv=(wz-z0)/HSTEP;
    return heightAt(x0,z0)*(1-fu)*(1-fv)+heightAt(x0+HSTEP,z0)*fu*(1-fv)+heightAt(x0,z0+HSTEP)*(1-fu)*fv+heightAt(x0+HSTEP,z0+HSTEP)*fu*fv;
}
function terrainNormal(wx,wz){const d=HSTEP;return new THREE.Vector3(findY(wx-d,wz)-findY(wx+d,wz),2*d,findY(wx,wz-d)-findY(wx,wz+d)).normalize();}

/* ───────────────────────────────────────────────────────
   MATÉRIAUX PARTAGÉS
─────────────────────────────────────────────────────── */
const MAT={
    // troncs
    trunkPine:  new THREE.MeshStandardMaterial({color:0x2a1a0e}),
    trunkBirch: new THREE.MeshStandardMaterial({color:0xd8d0c0}),
    trunkSwamp: new THREE.MeshStandardMaterial({color:0x1a1208}),
    // feuillages sapins
    cone0:new THREE.MeshStandardMaterial({color:0x0f240f}),
    cone1:new THREE.MeshStandardMaterial({color:0x163016}),
    cone2:new THREE.MeshStandardMaterial({color:0x1c3d1c}),
    // feuillages bouleaux (ronds, plus clairs)
    birchLeaf0:new THREE.MeshStandardMaterial({color:0x4a7c2f}),
    birchLeaf1:new THREE.MeshStandardMaterial({color:0x5a9035}),
    birchLeaf2:new THREE.MeshStandardMaterial({color:0x3d6626}),
    // feuillages marécage
    swampLeaf0:new THREE.MeshStandardMaterial({color:0x1a3010}),
    swampLeaf1:new THREE.MeshStandardMaterial({color:0x223818}),
    // sols
    rock:   new THREE.MeshStandardMaterial({color:0x888878,roughness:1}),
    rockDesert: new THREE.MeshStandardMaterial({color:0xb09060,roughness:1}),
    sand:   new THREE.MeshStandardMaterial({color:0xd4b483,roughness:1}),
    stem:   new THREE.MeshStandardMaterial({color:0x2d4c1e}),
    grass:  new THREE.MeshStandardMaterial({color:0x3f6b2d}),
    grassPlain:new THREE.MeshStandardMaterial({color:0x55882a}),
    ff:     new THREE.MeshBasicMaterial({color:0xffffaa}),
    // champignons
    mushCap: new THREE.MeshStandardMaterial({color:0xcc3300}),
    mushCap2:new THREE.MeshStandardMaterial({color:0xaa2200}),
    mushSpot:new THREE.MeshStandardMaterial({color:0xffffff}),
    mushStem:new THREE.MeshStandardMaterial({color:0xe8dcc8}),
    // cactus
    cactus:  new THREE.MeshStandardMaterial({color:0x4a7a2a}),
    // roseau marécage
    reed:    new THREE.MeshStandardMaterial({color:0x6b5a2a}),
    reedTop: new THREE.MeshStandardMaterial({color:0x8b6a30}),
    // mousse marécage
    moss:    new THREE.MeshStandardMaterial({color:0x1a3a10}),
};
const CONE_MATS=[MAT.cone0,MAT.cone1,MAT.cone2];
const BIRCH_MATS=[MAT.birchLeaf0,MAT.birchLeaf1,MAT.birchLeaf2];
const SWAMP_MATS=[MAT.swampLeaf0,MAT.swampLeaf1];
const FLOWER_COLORS=[0xff4444,0x4444ff,0xffff55,0xffffff,0xff66cc,0xff8800,0xcc44ff];
const flowerCache={};
function flowerMat(hex){if(!flowerCache[hex])flowerCache[hex]=new THREE.MeshStandardMaterial({color:hex,emissive:hex,emissiveIntensity:0.12});return flowerCache[hex];}

const GEO={
    grass:  new THREE.CylinderGeometry(0.015,0.04,0.5,3),
    ff:     new THREE.SphereGeometry(0.07,4,4),
    stem:   new THREE.CylinderGeometry(0.025,0.035,0.8,5),
    flower: new THREE.SphereGeometry(0.14,6,6),
    rock:   new THREE.DodecahedronGeometry(1,0),
    sphere: new THREE.SphereGeometry(1,7,5),
};

/* ───────────────────────────────────────────────────────
   GLOBAUX
─────────────────────────────────────────────────────── */
const windObjects=[],fireflyData=[],globalColliders=[];

/* ───────────────────────────────────────────────────────
   BUILDERS PAR BIOME
─────────────────────────────────────────────────────── */

// — Sapin (forêt dense)
function buildPine(wx,wz,gy,rng,grp,lc){
    const h=22+rng()*16,tr=1.2+rng()*0.8,trunkH=h*(0.28+rng()*0.08);
    const tg=new THREE.Group();
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(tr*0.5,tr*1.3,trunkH+6,8),MAT.trunkPine);
    trunk.position.y=trunkH/2-3;trunk.castShadow=true;tg.add(trunk);
    const layers=9+(rng()*5|0),fH=h-trunkH;
    for(let li=0;li<layers;li++){
        const ratio=li/(layers-1),coneY=trunkH+ratio*fH*0.90;
        const radius=tr*4.2*(1-ratio*0.72)+1.4,coneH=(fH/layers)*2.2;
        const cone=new THREE.Mesh(new THREE.ConeGeometry(radius,coneH,8),CONE_MATS[(rng()*3)|0]);
        cone.position.y=coneY;cone.castShadow=true;tg.add(cone);
        windObjects.push({mesh:cone,phase:rng()*10,speed:0.5,amp:0.012});
    }
    tg.position.set(wx,gy,wz);grp.add(tg);
    lc.push({type:'cylinder',x:wx,y:gy,z:wz,r:tr*1.6,h:trunkH+6});
}

// — Bouleau
function buildBirch(wx,wz,gy,rng,grp,lc){
    const h=14+rng()*10,tr=0.35+rng()*0.25,trunkH=h*0.65;
    const tg=new THREE.Group();
    // tronc blanc rayé
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(tr*0.6,tr*0.9,trunkH+4,7),MAT.trunkBirch);
    trunk.position.y=trunkH/2-2;trunk.castShadow=true;tg.add(trunk);
    // Feuillage : sphères/ellipsoïdes empilées
    const blobCount=4+(rng()*4|0);
    for(let bi=0;bi<blobCount;bi++){
        const by=trunkH*0.7+bi*(h-trunkH*0.7)/blobCount*(0.7+rng()*0.5);
        const br=1.8+rng()*1.4-(bi/(blobCount-1))*0.8;
        const blob=new THREE.Mesh(new THREE.SphereGeometry(br,7,5),BIRCH_MATS[(rng()*3)|0]);
        blob.scale.y=0.75+rng()*0.3;
        blob.position.set((rng()-0.5)*0.8,by,(rng()-0.5)*0.8);
        blob.castShadow=true;tg.add(blob);
        windObjects.push({mesh:blob,phase:rng()*10,speed:0.4,amp:0.01});
    }
    tg.position.set(wx,gy,wz);grp.add(tg);
    lc.push({type:'cylinder',x:wx,y:gy,z:wz,r:tr*2+1.5,h:trunkH+4});
}

// — Arbre marécage (tordu, sombre)
function buildSwampTree(wx,wz,gy,rng,grp,lc){
    const h=12+rng()*10,tr=0.5+rng()*0.4,trunkH=h*0.55;
    const tg=new THREE.Group();
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(tr*0.5,tr*1.2,trunkH+4,7),MAT.trunkSwamp);
    trunk.position.y=trunkH/2-2;trunk.rotation.z=(rng()-0.5)*0.18;trunk.castShadow=true;tg.add(trunk);
    // feuillage plat et sombre
    const layers=5+(rng()*3|0),fH=h-trunkH;
    for(let li=0;li<layers;li++){
        const ratio=li/(layers-1),coneY=trunkH+ratio*fH*0.85;
        const radius=tr*5*(1-ratio*0.65)+1.2,coneH=(fH/layers)*1.8;
        const cone=new THREE.Mesh(new THREE.ConeGeometry(radius,coneH,7),SWAMP_MATS[(rng()*2)|0]);
        cone.position.y=coneY;cone.rotation.y=rng()*Math.PI;cone.castShadow=true;tg.add(cone);
        windObjects.push({mesh:cone,phase:rng()*10,speed:0.3,amp:0.008});
    }
    tg.position.set(wx,gy,wz);grp.add(tg);
    lc.push({type:'cylinder',x:wx,y:gy,z:wz,r:tr*2,h:trunkH+4});
}

// — Cactus (désert)
function buildCactus(wx,wz,gy,rng,grp,lc){
    const h=1.5+rng()*2.5,r=0.18+rng()*0.12;
    const tg=new THREE.Group();
    const body=new THREE.Mesh(new THREE.CylinderGeometry(r*0.8,r,h,7),MAT.cactus);
    body.position.y=h/2;tg.add(body);
    // bras latéraux
    if(rng()>0.4){
        for(let arm=0;arm<1+(rng()*2|0);arm++){
            const armH=0.6+rng()*0.8,armR=r*0.55;
            const ah=new THREE.Mesh(new THREE.CylinderGeometry(armR*0.8,armR,armH,6),MAT.cactus);
            const side=new THREE.Mesh(new THREE.CylinderGeometry(armR*0.7,armR*0.8,h*0.4,6),MAT.cactus);
            const angle=(arm+rng())*Math.PI*(1+rng());
            const armY=h*(0.4+rng()*0.3);
            const armDist=r+armR;
            side.rotation.z=Math.PI/2;
            side.position.set(Math.cos(angle)*armDist*0.5,armY,Math.sin(angle)*armDist*0.5);
            ah.position.set(Math.cos(angle)*armDist,armY+armH/2,Math.sin(angle)*armDist);
            tg.add(side,ah);
        }
    }
    tg.position.set(wx,gy,wz);grp.add(tg);
    lc.push({type:'cylinder',x:wx,y:gy,z:wz,r:r*3,h:h});
}

// — Roseau marécage
function buildReed(wx,wz,gy,rng,grp){
    const h=1.2+rng()*0.8;
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.04,h,4),MAT.reed);
    stem.position.set(wx,gy+h/2,wz);grp.add(stem);
    const top=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.06,0.25,5),MAT.reedTop);
    top.position.set(wx,gy+h+0.12,wz);grp.add(top);
    windObjects.push({mesh:stem,phase:rng()*10,speed:1.2,amp:0.04});
}

// — Champignon (forêt/marécage)
function buildMushroom(wx,wz,gy,rng,grp){
    const sc=0.12+rng()*0.25,sH=0.45*sc,cR=0.5*sc;
    const sm=new THREE.Mesh(new THREE.CylinderGeometry(cR*0.28,cR*0.35,sH,6),MAT.mushStem);
    sm.position.set(wx,gy+sH*0.5,wz);grp.add(sm);
    const cm=new THREE.Mesh(new THREE.SphereGeometry(cR,8,5,0,Math.PI*2,0,Math.PI*0.55),rng()>0.3?MAT.mushCap:MAT.mushCap2);
    cm.position.set(wx,gy+sH+cR*0.05,wz);grp.add(cm);
    const sg=new THREE.SphereGeometry(cR*0.09,4,4);
    for(let s=0;s<3+(rng()*3|0);s++){
        const ang=rng()*Math.PI*2,rad=cR*(0.2+rng()*0.55);
        const spot=new THREE.Mesh(sg,MAT.mushSpot);
        spot.position.set(wx+Math.cos(ang)*rad,gy+sH+Math.sqrt(Math.max(0,cR*cR-rad*rad))*0.9,wz+Math.sin(ang)*rad);
        grp.add(spot);
    }
}

// — Pierre du désert (couleur sable/ocre)
function buildDesertRock(wx,wz,gy,rng,grp,lc){
    const sx=1.2+rng()*3,sy=sx*(0.3+rng()*0.4),sz=1.2+rng()*3;
    const rock=new THREE.Mesh(GEO.rock,MAT.rockDesert);
    rock.scale.set(sx,sy,sz);
    rock.rotation.set((rng()-0.5)*0.3,rng()*Math.PI*2,(rng()-0.5)*0.3);
    rock.position.set(wx,gy+sy*0.48,wz);
    rock.castShadow=rock.receiveShadow=true;grp.add(rock);
    lc.push({type:'sphere',x:wx,y:gy+sy*0.48,z:wz,r:Math.max(sx,sz)*0.85,topY:gy+sy*0.96});
}

/* ───────────────────────────────────────────────────────
   CHUNKS
─────────────────────────────────────────────────────── */
const CHUNK_SIZE=80,CHUNK_SEGS=18,CHUNK_RADIUS=2;
const loadedChunks=new Map(),chunkFadeIn=new Map();
function seededRng(seed){let s=(seed^0xdeadbeef)|0;return()=>{s=Math.imul(s^(s>>>16),0x45d9f3b);s=Math.imul(s^(s>>>16),0x45d9f3b);s^=s>>>16;return(s>>>0)/0xffffffff;};}

function generateChunk(cx,cz){
    const key=cx+','+cz;
    if(loadedChunks.has(key))return;
    loadedChunks.set(key,null);
    requestAnimationFrame(()=>_buildChunk(cx,cz,key));
}

function _buildChunk(cx,cz,key){
    if(!loadedChunks.has(key))return;
    const oX=cx*CHUNK_SIZE,oZ=cz*CHUNK_SIZE;
    const rng=seededRng(cx*73856093^cz*19349663);
    const grp=new THREE.Group(),lc=[];

    // Biome du centre du chunk
    const {id:biomeId,weights}=getBiomeWeights(oX,oZ);
    const biomeName=BIOME_NAMES[biomeId];

    // Sol coloré selon biome
    const groundColor=GROUND_COLORS[biomeId];
    const groundMat=new THREE.MeshStandardMaterial({color:groundColor,roughness:1});

    /* Terrain */
    const tgeo=new THREE.PlaneGeometry(CHUNK_SIZE,CHUNK_SIZE,CHUNK_SEGS,CHUNK_SEGS);
    const vp=tgeo.attributes.position.array;
    // Le désert est plus plat
    const heightScale=biomeName==='desert'?0.45:biomeName==='plain'?0.7:1.0;
    for(let i=0;i<vp.length;i+=3)vp[i+2]=fbm(oX+vp[i],oZ-vp[i+1])*heightScale;
    tgeo.computeVertexNormals();
    const terr=new THREE.Mesh(tgeo,groundMat);
    terr.rotation.x=-Math.PI/2;terr.position.set(oX,0,oZ);terr.receiveShadow=true;grp.add(terr);

    /* Contenu selon biome */
    if(biomeName==='forest'){
        // Sapins denses
        const n=10+(rng()*6|0),tpts=[];
        for(let i=0;i<n;i++){
            let wx,wz,ok=false,tries=0;
            do{wx=oX+(rng()-0.5)*CHUNK_SIZE*0.85;wz=oZ+(rng()-0.5)*CHUNK_SIZE*0.85;
               ok=!tpts.some(p=>{const dx=p[0]-wx,dz=p[1]-wz;return dx*dx+dz*dz<64;});}
            while(!ok&&++tries<15);
            tpts.push([wx,wz]);buildPine(wx,wz,findY(wx,wz),rng,grp,lc);
        }
        // Champignons
        for(let i=0,n2=2+(rng()*6|0);i<n2;i++){
            const wx=oX+(rng()-0.5)*CHUNK_SIZE*0.88,wz=oZ+(rng()-0.5)*CHUNK_SIZE*0.88;
            buildMushroom(wx,wz,findY(wx,wz),rng,grp);
            if(rng()>0.5)for(let c=0,cn=2+(rng()*4|0);c<cn;c++){
                const ox=wx+(rng()-0.5)*2.5,oz=wz+(rng()-0.5)*2.5;
                buildMushroom(ox,oz,findY(ox,oz),rng,grp);
            }
        }
        // Quelques rochers
        for(let i=0,n2=2+(rng()*4|0);i<n2;i++){
            const wx=oX+(rng()-0.5)*CHUNK_SIZE*0.88,wz=oZ+(rng()-0.5)*CHUNK_SIZE*0.88;
            const gy=findY(wx,wz),sx=0.8+rng()*1.4,sy=sx*0.6,sz=0.8+rng()*1.4;
            const rock=new THREE.Mesh(GEO.rock,MAT.rock);
            rock.scale.set(sx,sy,sz);rock.rotation.set((rng()-0.5)*0.4,rng()*Math.PI*2,(rng()-0.5)*0.4);
            rock.position.set(wx,gy+sy*0.48,wz);rock.castShadow=rock.receiveShadow=true;grp.add(rock);
            lc.push({type:'sphere',x:wx,y:gy+sy*0.48,z:wz,r:Math.max(sx,sz)*0.85,topY:gy+sy*0.96});
        }

    } else if(biomeName==='plain'){
        // Quelques arbres épars
        for(let i=0,n=3+(rng()*4|0);i<n;i++){
            const wx=oX+(rng()-0.5)*CHUNK_SIZE*0.85,wz=oZ+(rng()-0.5)*CHUNK_SIZE*0.85;
            buildPine(wx,wz,findY(wx,wz),rng,grp,lc);
        }
        // Beaucoup de fleurs
        for(let i=0,n=60+(rng()*60|0);i<n;i++){
            const wx=oX+(rng()-0.5)*CHUNK_SIZE*0.9,wz=oZ+(rng()-0.5)*CHUNK_SIZE*0.9,gy=findY(wx,wz);
            const st=new THREE.Mesh(GEO.stem,MAT.stem);st.position.set(wx,gy+0.4,wz);grp.add(st);
            const hd=new THREE.Mesh(GEO.flower,flowerMat(FLOWER_COLORS[(rng()*FLOWER_COLORS.length)|0]));
            hd.position.set(wx,gy+0.9,wz);grp.add(hd);
        }
        // Herbe plus dense
        const gn=100+(rng()*60|0),gm=new THREE.InstancedMesh(GEO.grass,MAT.grassPlain,gn);
        gm.frustumCulled=false;
        const dummy=new THREE.Object3D();
        for(let i=0;i<gn;i++){
            const wx=oX+(rng()-0.5)*CHUNK_SIZE,wz=oZ+(rng()-0.5)*CHUNK_SIZE;
            dummy.position.set(wx,findY(wx,wz)+0.25,wz);dummy.scale.setScalar(0.6+rng()*0.9);
            dummy.rotation.y=rng()*Math.PI;dummy.updateMatrix();gm.setMatrixAt(i,dummy.matrix);
        }
        gm.instanceMatrix.needsUpdate=true;grp.add(gm);

    } else if(biomeName==='desert'){
        // Rochers désertiques nombreux
        for(let i=0,n=6+(rng()*8|0);i<n;i++){
            const wx=oX+(rng()-0.5)*CHUNK_SIZE*0.88,wz=oZ+(rng()-0.5)*CHUNK_SIZE*0.88;
            buildDesertRock(wx,wz,findY(wx,wz),rng,grp,lc);
        }
        // Cactus
        for(let i=0,n=4+(rng()*6|0);i<n;i++){
            const wx=oX+(rng()-0.5)*CHUNK_SIZE*0.85,wz=oZ+(rng()-0.5)*CHUNK_SIZE*0.85;
            buildCactus(wx,wz,findY(wx,wz),rng,grp,lc);
        }
        // Sol sableux — quelques touffes d'herbe sèche rare
        const gn=10+(rng()*15|0),gmD=new THREE.InstancedMesh(GEO.grass,MAT.reed,gn);
        gmD.frustumCulled=false;
        const dummyD=new THREE.Object3D();
        for(let i=0;i<gn;i++){
            const wx=oX+(rng()-0.5)*CHUNK_SIZE,wz=oZ+(rng()-0.5)*CHUNK_SIZE;
            dummyD.position.set(wx,findY(wx,wz)+0.25,wz);dummyD.scale.setScalar(0.4+rng()*0.5);
            dummyD.rotation.y=rng()*Math.PI;dummyD.updateMatrix();gmD.setMatrixAt(i,dummyD.matrix);
        }
        gmD.instanceMatrix.needsUpdate=true;grp.add(gmD);

    } else if(biomeName==='swamp'){
        // Arbres marécage
        for(let i=0,n=6+(rng()*6|0);i<n;i++){
            const wx=oX+(rng()-0.5)*CHUNK_SIZE*0.85,wz=oZ+(rng()-0.5)*CHUNK_SIZE*0.85;
            buildSwampTree(wx,wz,findY(wx,wz),rng,grp,lc);
        }
        // Roseaux
        for(let i=0,n=20+(rng()*30|0);i<n;i++){
            const wx=oX+(rng()-0.5)*CHUNK_SIZE*0.9,wz=oZ+(rng()-0.5)*CHUNK_SIZE*0.9;
            buildReed(wx,wz,findY(wx,wz),rng,grp);
        }
        // Champignons nombreux
        for(let i=0,n=5+(rng()*8|0);i<n;i++){
            const wx=oX+(rng()-0.5)*CHUNK_SIZE*0.88,wz=oZ+(rng()-0.5)*CHUNK_SIZE*0.88;
            buildMushroom(wx,wz,findY(wx,wz),rng,grp);
        }
        // Lucioles nombreuses la nuit
        for(let i=0,n=6+(rng()*8|0);i<n;i++){
            const wx=oX+(rng()-0.5)*CHUNK_SIZE*0.88,wz=oZ+(rng()-0.5)*CHUNK_SIZE*0.88;
            const fy=findY(wx,wz)+1.5+rng()*3;
            const m=new THREE.Mesh(GEO.ff,MAT.ff);m.position.set(wx,fy,wz);grp.add(m);
            fireflyData.push({mesh:m,baseY:fy,phase:rng()*10});
        }

    } else { // birch
        // Bouleaux
        const n=8+(rng()*6|0),tpts=[];
        for(let i=0;i<n;i++){
            let wx,wz,ok=false,tries=0;
            do{wx=oX+(rng()-0.5)*CHUNK_SIZE*0.85;wz=oZ+(rng()-0.5)*CHUNK_SIZE*0.85;
               ok=!tpts.some(p=>{const dx=p[0]-wx,dz=p[1]-wz;return dx*dx+dz*dz<36;});}
            while(!ok&&++tries<15);
            tpts.push([wx,wz]);buildBirch(wx,wz,findY(wx,wz),rng,grp,lc);
        }
        // Fleurs légères
        for(let i=0,n2=20+(rng()*30|0);i<n2;i++){
            const wx=oX+(rng()-0.5)*CHUNK_SIZE*0.9,wz=oZ+(rng()-0.5)*CHUNK_SIZE*0.9,gy=findY(wx,wz);
            const st=new THREE.Mesh(GEO.stem,MAT.stem);st.position.set(wx,gy+0.4,wz);grp.add(st);
            const hd=new THREE.Mesh(GEO.flower,flowerMat(FLOWER_COLORS[(rng()*FLOWER_COLORS.length)|0]));
            hd.position.set(wx,gy+0.9,wz);grp.add(hd);
        }
        // Quelques rochers
        for(let i=0,n2=2+(rng()*4|0);i<n2;i++){
            const wx=oX+(rng()-0.5)*CHUNK_SIZE*0.88,wz=oZ+(rng()-0.5)*CHUNK_SIZE*0.88;
            const gy=findY(wx,wz),sx=0.7+rng()*1.2,sy=sx*0.6,sz=0.7+rng()*1.2;
            const rock=new THREE.Mesh(GEO.rock,MAT.rock);
            rock.scale.set(sx,sy,sz);rock.rotation.set((rng()-0.5)*0.4,rng()*Math.PI*2,(rng()-0.5)*0.4);
            rock.position.set(wx,gy+sy*0.48,wz);rock.castShadow=rock.receiveShadow=true;grp.add(rock);
            lc.push({type:'sphere',x:wx,y:gy+sy*0.48,z:wz,r:Math.max(sx,sz)*0.85,topY:gy+sy*0.96});
        }
    }

    // Herbe de base pour tous les biomes sauf désert
    if(biomeName!=='desert'&&biomeName!=='plain'){
        const gn=40+(rng()*40|0),gm=new THREE.InstancedMesh(GEO.grass,MAT.grass,gn);
        gm.frustumCulled=false;
        const dummy=new THREE.Object3D();
        for(let i=0;i<gn;i++){
            const wx=oX+(rng()-0.5)*CHUNK_SIZE,wz=oZ+(rng()-0.5)*CHUNK_SIZE;
            dummy.position.set(wx,findY(wx,wz)+0.25,wz);dummy.scale.setScalar(0.5+rng()*0.7);
            dummy.rotation.y=rng()*Math.PI;dummy.updateMatrix();gm.setMatrixAt(i,dummy.matrix);
        }
        gm.instanceMatrix.needsUpdate=true;grp.add(gm);
    }

    // Lucioles par défaut (pas désert)
    if(biomeName!=='desert'&&biomeName!=='swamp'){
        for(let i=0,n=2+(rng()*5|0);i<n;i++){
            const wx=oX+(rng()-0.5)*CHUNK_SIZE*0.88,wz=oZ+(rng()-0.5)*CHUNK_SIZE*0.88;
            const fy=findY(wx,wz)+2+rng()*4;
            const m=new THREE.Mesh(GEO.ff,MAT.ff);m.position.set(wx,fy,wz);grp.add(m);
            fireflyData.push({mesh:m,baseY:fy,phase:rng()*10});
        }
    }

    /* Fade-in ultra-smooth — opacity démarre à 0, monte sur ~1.5s */
    grp.traverse(obj=>{
        if(!obj.isMesh)return;
        const mats=Array.isArray(obj.material)?obj.material:[obj.material];
        const cl=mats.map(m=>{const c=m.clone();c._bOp=c.opacity??1;c.transparent=true;c.opacity=0;return c;});
        obj.material=Array.isArray(obj.material)?cl:cl[0];
    });

    globalColliders.push(...lc);
    scene.add(grp);
    loadedChunks.set(key,{group:grp,localColliders:lc});
    // alpha démarre négatif pour un délai avant apparition → évite le pop immédiat
    chunkFadeIn.set(key,{group:grp,alpha:-0.3});
}

function unloadChunk(cx,cz){
    const key=cx+','+cz,data=loadedChunks.get(key);
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
    loadedChunks.delete(key);chunkFadeIn.delete(key);
}

let lastCX=Infinity,lastCZ=Infinity;
function updateChunks(px,pz){
    const cx=Math.round(px/CHUNK_SIZE),cz=Math.round(pz/CHUNK_SIZE);
    if(cx===lastCX&&cz===lastCZ)return;
    lastCX=cx;lastCZ=cz;
    for(let dx=-CHUNK_RADIUS;dx<=CHUNK_RADIUS;dx++)
        for(let dz=-CHUNK_RADIUS;dz<=CHUNK_RADIUS;dz++)
            generateChunk(cx+dx,cz+dz);
    for(const[key]of loadedChunks){
        const[kcx,kcz]=key.split(',').map(Number);
        if(Math.abs(kcx-cx)>CHUNK_RADIUS+1||Math.abs(kcz-cz)>CHUNK_RADIUS+1)unloadChunk(kcx,kcz);
    }
}

/* ───────────────────────────────────────────────────────
   PHYSIQUE
─────────────────────────────────────────────────────── */
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
        }else{
            const dx=nx-c.x,dz=nz-c.z,dxz=Math.sqrt(dx*dx+dz*dz),pBot=ny-PLAYER_H,dy=(ny-PLAYER_H*0.5)-c.y,dist3=Math.sqrt(dx*dx+dy*dy+dz*dz);
            if(dist3<c.r+PLAYER_R&&dist3>0.001){
                if(pBot>=c.topY-0.8&&dy>-0.2){ny=c.topY+PLAYER_H;onTop=true;}
                else if(dxz>0.01){const need=c.r+PLAYER_R*1.1;if(dxz<need){nx+=(dx/dxz)*(need-dxz);nz+=(dz/dxz)*(need-dxz);}}
            }
        }
    }
    return{x:nx,y:ny,z:nz,onTop};
}

/* ───────────────────────────────────────────────────────
   CONTROLS & MOUVEMENT
─────────────────────────────────────────────────────── */
const controls=new PointerLockControls(camera,document.body);
document.body.addEventListener('click',()=>controls.lock());
const velocity=new THREE.Vector3(),keys={z:false,s:false,q:false,d:false,shift:false};
let jumpVel=0,grounded=true,stamina=100,smoothGroundY=null;
addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(k in keys)keys[k]=true;if(e.shiftKey)keys.shift=true;if(e.code==='Space'&&grounded){grounded=false;jumpVel=0.32;}});
addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(k in keys)keys[k]=false;if(!e.shiftKey)keys.shift=false;});
const _fwd=new THREE.Vector3(),_right=new THREE.Vector3();

function updateMovement(dt){
    const run=keys.shift&&stamina>0&&(keys.z||keys.s||keys.q||keys.d);
    stamina=run?Math.max(0,stamina-0.45):Math.min(100,stamina+0.2);
    document.getElementById('sp').style.width=stamina+'%';
    _fwd.set(0,0,-1).applyQuaternion(camera.quaternion);_fwd.y=0;_fwd.normalize();
    _right.set(1,0,0).applyQuaternion(camera.quaternion);_right.y=0;_right.normalize();
    const slope=1-Math.abs(terrainNormal(camera.position.x,camera.position.z).y);
    const accel=(run?0.055:0.028)*(1-slope*0.5);
    if(keys.z)velocity.addScaledVector(_fwd,accel);if(keys.s)velocity.addScaledVector(_fwd,-accel);
    if(keys.q)velocity.addScaledVector(_right,-accel);if(keys.d)velocity.addScaledVector(_right,accel);
    velocity.multiplyScalar(0.88);
    let nx=camera.position.x+velocity.x,ny=camera.position.y,nz=camera.position.z+velocity.z;
    jumpVel=Math.max(jumpVel-0.016,-1.2);ny+=jumpVel;
    const res=resolveColliders(nx,ny,nz);nx=res.x;ny=res.y;nz=res.z;
    const tgy=findY(nx,nz)+PLAYER_H;
    if(ny<=tgy){
        if(jumpVel<=0&&!res.onTop){
            if(smoothGroundY===null)smoothGroundY=ny;
            smoothGroundY+=(tgy-smoothGroundY)*Math.min(1,0.25+(1-slope)*0.25+dt*8);
            ny=Math.max(smoothGroundY,tgy-0.05);
        }else{ny=tgy;smoothGroundY=ny;}
        if(jumpVel<=0){jumpVel=0;grounded=true;}
    }else if(res.onTop){smoothGroundY=ny;if(jumpVel<=0){jumpVel=0;grounded=true;}}
    else{smoothGroundY=null;grounded=false;}
    camera.position.set(nx,ny,nz);
}

/* ───────────────────────────────────────────────────────
   BOUCLE
─────────────────────────────────────────────────────── */
const clock=new THREE.Clock();
let elapsed=DAY_DURATION*0.25;
updateChunks(0,0);

function animate(){
    requestAnimationFrame(animate);
    const dt=Math.min(clock.getDelta(),0.05);
    elapsed+=dt;
    for(const w of windObjects)w.mesh.rotation.z=Math.sin(elapsed*w.speed+w.phase)*w.amp;
    for(const f of fireflyData){f.mesh.position.y=f.baseY+Math.sin(elapsed+f.phase)*0.5;f.mesh.position.x+=Math.cos(elapsed*0.3+f.phase)*0.008;}

    // Fade-in smooth — alpha négatif = délai, 0..1 = fondu
    for(const[key,fd]of chunkFadeIn){
        fd.alpha=Math.min(1,fd.alpha+dt*1.2); // ~1.2s pour monter de 0 à 1
        const vis=Math.max(0,fd.alpha);
        if(vis>0){
            fd.group.traverse(obj=>{
                if(!obj.isMesh)return;
                const mats=Array.isArray(obj.material)?obj.material:[obj.material];
                for(const m of mats)if(m._bOp!==undefined)m.opacity=vis*m._bOp;
            });
        }
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

window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

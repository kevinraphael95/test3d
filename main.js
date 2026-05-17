import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';

/* ═══════════════════════════════════════════════════════
   RENDERER — optimisé au max
═══════════════════════════════════════════════════════ */
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' }); // antialias OFF = gros gain
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1)); // jamais plus de 1x
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap; // le moins cher
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
document.body.appendChild(renderer.domElement);

/* ═══════════════════════════════════════════════════════
   SCENE / CAMERA
═══════════════════════════════════════════════════════ */
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9bb4c7, 120, 480);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1200);
camera.position.set(0, 10, 0);

/* ═══════════════════════════════════════════════════════
   SKYBOX canvas 2D
═══════════════════════════════════════════════════════ */
const SKY_C = document.createElement('canvas'); SKY_C.width=2; SKY_C.height=128;
const SKY_X = SKY_C.getContext('2d');
const skyTex = new THREE.CanvasTexture(SKY_C);
scene.background = skyTex;

const SKY = {
    day:    { top:[0.08,0.38,0.80], hor:[0.42,0.72,0.92] },
    sunset: { top:[0.20,0.05,0.35], hor:[1.00,0.28,0.00] },
    night:  { top:[0.01,0.02,0.08], hor:[0.04,0.07,0.16] },
    dawn:   { top:[0.18,0.05,0.30], hor:[1.00,0.42,0.10] },
};
function l3(a,b,t){return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
function css(c){return`rgb(${c[0]*255|0},${c[1]*255|0},${c[2]*255|0})`;}
let _top=SKY.day.top.slice(),_hor=SKY.day.hor.slice();
function setSky(s){_top=s.top.slice();_hor=s.hor.slice();}
function lerpSky(a,b,t){_top=l3(a.top,b.top,t);_hor=l3(a.hor,b.hor,t);}
function drawSky(){
    const g=SKY_X.createLinearGradient(0,0,0,128);
    g.addColorStop(0,css(_top));g.addColorStop(1,css(_hor));
    SKY_X.fillStyle=g;SKY_X.fillRect(0,0,2,128);skyTex.needsUpdate=true;
}

/* ═══════════════════════════════════════════════════════
   LUMIÈRES — une seule source d'ombre, shadow map petite
═══════════════════════════════════════════════════════ */
const hemi = new THREE.HemisphereLight(0xddeeff, 0x3d2f1b, 1.2);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff5e0, 3.0);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(512); // 512 au lieu de 2048 = 16× moins cher
sun.shadow.camera.left = sun.shadow.camera.bottom = -120;
sun.shadow.camera.right = sun.shadow.camera.top = 120;
sun.shadow.camera.far = 400;
sun.shadow.bias = -0.001;
scene.add(sun);

const nightAmb = new THREE.AmbientLight(0x1a2a4a, 0.0);
scene.add(nightAmb);
const moonLight = new THREE.DirectionalLight(0x4466bb, 0);
scene.add(moonLight);

/* ═══════════════════════════════════════════════════════
   SPRITES SOLEIL & LUNE
═══════════════════════════════════════════════════════ */
function makeDisc(inner, outer, glow, size){
    const c=document.createElement('canvas'); c.width=c.height=256;
    const ctx=c.getContext('2d');
    const g=ctx.createRadialGradient(128,128,0,128,128,128);
    g.addColorStop(0,inner); g.addColorStop(0.18,inner);
    g.addColorStop(0.22,outer); g.addColorStop(0.50,glow);
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,256,256);
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
    sp.scale.setScalar(size); return sp;
}
const sunSprite  = makeDisc('rgba(255,255,220,1)','rgba(255,210,80,0.8)','rgba(255,140,20,0.0)',340);
const moonSprite = makeDisc('rgba(240,248,255,1)','rgba(180,210,255,0.7)','rgba(80,110,200,0.0)',180);
scene.add(sunSprite,moonSprite);

/* ═══════════════════════════════════════════════════════
   ÉTOILES
═══════════════════════════════════════════════════════ */
const SC=800, sPos=new Float32Array(SC*3), sSz=new Float32Array(SC);
for(let i=0;i<SC;i++){
    const th=Math.random()*Math.PI*2,ph=Math.acos(2*Math.random()-1),r=1800;
    sPos[i*3]=r*Math.sin(ph)*Math.cos(th); sPos[i*3+1]=Math.abs(r*Math.cos(ph))+80; sPos[i*3+2]=r*Math.sin(ph)*Math.sin(th);
    sSz[i]=2+Math.random()*4;
}
const sGeo=new THREE.BufferGeometry();
sGeo.setAttribute('position',new THREE.BufferAttribute(sPos,3));
sGeo.setAttribute('size',new THREE.BufferAttribute(sSz,1));
const sMat=new THREE.ShaderMaterial({
    uniforms:{uOp:{value:0},uT:{value:0}},
    vertexShader:`attribute float size;uniform float uT;void main(){gl_PointSize=size*(1.0+0.25*sin(uT+size*7.0));gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform float uOp;void main(){float d=length(gl_PointCoord-0.5);if(d>0.5)discard;gl_FragColor=vec4(1.0,1.0,0.95,(1.0-d*2.0)*uOp);}`,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
});
const stars=new THREE.Points(sGeo,sMat); scene.add(stars);

/* ═══════════════════════════════════════════════════════
   MONTAGNES LOINTAINES — mesh unique, très bas poly
═══════════════════════════════════════════════════════ */
function buildMountains(){
    // Un seul BufferGeometry pour toutes les montagnes = 1 draw call
    const positions=[], indices=[], colors=[];
    const N=22, R=900;
    let vi=0;
    for(let i=0;i<N;i++){
        const a=(i/N)*Math.PI*2+(Math.random()-0.5)*0.5;
        const cx=Math.cos(a)*R, cz=Math.sin(a)*R;
        const h=100+Math.random()*180, br=60+Math.random()*80;
        const segs=6;
        const hasSnow = h>160;
        // Couleur selon hauteur
        const cr=0.28+Math.random()*0.08, cg=0.33+Math.random()*0.08, cb=0.38+Math.random()*0.10;
        const sr=0.85, sg=0.90, sb=0.95; // neige

        // Sommet
        const tipIdx=vi;
        positions.push(cx,h-8,cz); colors.push(hasSnow?sr:cr,hasSnow?sg:cg,hasSnow?sb:cb); vi++;
        // Base
        for(let s=0;s<segs;s++){
            const ba=(s/segs)*Math.PI*2;
            const bx=cx+Math.cos(ba)*br*(0.8+Math.random()*0.4);
            const bz=cz+Math.sin(ba)*br*(0.8+Math.random()*0.4);
            positions.push(bx,-8,bz); colors.push(cr*0.6,cg*0.6,cb*0.6); vi++;
            const next=(s+1)%segs;
            indices.push(tipIdx, tipIdx+1+s, tipIdx+1+next);
        }
        // Calotte neigeuse
        if(hasSnow){
            const snowH=h*0.28, snowBase=h*0.60;
            const snowTip=vi;
            positions.push(cx,h-8,cz); colors.push(sr,sg,sb); vi++;
            for(let s=0;s<segs;s++){
                const ba=(s/segs)*Math.PI*2;
                const sr2=br*0.28;
                positions.push(cx+Math.cos(ba)*sr2,snowBase-8,cz+Math.sin(ba)*sr2);
                colors.push(sr,sg,sb); vi++;
                const next=(s+1)%segs;
                indices.push(snowTip, snowTip+1+s, snowTip+1+next);
            }
        }
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(positions),3));
    geo.setAttribute('color',new THREE.BufferAttribute(new Float32Array(colors),3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mat=new THREE.MeshLambertMaterial({vertexColors:true,fog:true});
    const mesh=new THREE.Mesh(geo,mat);
    mesh.castShadow=false; mesh.receiveShadow=false;
    scene.add(mesh); return mesh;
}
const mtnMesh=buildMountains();

/* ═══════════════════════════════════════════════════════
   CYCLE JOUR / NUIT
═══════════════════════════════════════════════════════ */
const DAY_DUR=1200, ORB=1400;
const _sd=new THREE.Vector3(), _md=new THREE.Vector3();
const _fc=new THREE.Color(), _nc=new THREE.Color(0x04091f), _dc=new THREE.Color(0x9bb4c7);

function updateDayNight(elapsed){
    const a=((elapsed/DAY_DUR)*Math.PI*2)%(Math.PI*2);
    const sinA=Math.sin(a), sf=Math.max(0,sinA), sfS=sf*sf*(3-2*sf), mf=Math.max(0,-sinA), mfS=mf*mf*(3-2*mf);
    const sx=Math.cos(a)*ORB, sy=Math.sin(a)*ORB;
    sun.position.set(sx,sy,ORB*0.25); moonLight.position.set(-sx,-sy,ORB*0.25);
    const cp=camera.position;
    _sd.set(sx,sy,ORB*0.25).normalize(); _md.copy(_sd).negate();
    sunSprite.position.copy(cp).addScaledVector(_sd,1350);
    moonSprite.position.copy(cp).addScaledVector(_md,1350);
    sun.intensity=0.05+sfS*3.0; moonLight.intensity=0.10+mfS*0.40;
    hemi.intensity=0.25+sfS*0.95; nightAmb.intensity=0.35*mfS;
    sunSprite.material.opacity=Math.pow(sf,0.30);
    moonSprite.material.opacity=Math.pow(mf,0.30);
    _fc.lerpColors(_nc,_dc,sfS);
    scene.fog.color.copy(_fc);
    scene.fog.near=100+sfS*20; scene.fog.far=350+sfS*130;
    sMat.uniforms.uOp.value=Math.max(0,1-sfS*2.0)*0.92;
    sMat.uniforms.uT.value=elapsed;
    stars.position.copy(cp);
    if(a<Math.PI*0.20)       lerpSky(SKY.dawn,  SKY.day,   a/(Math.PI*0.20));
    else if(a<Math.PI*0.75)  setSky(SKY.day);
    else if(a<Math.PI*1.10)  lerpSky(SKY.day,   SKY.sunset,(a-Math.PI*0.75)/(Math.PI*0.35));
    else if(a<Math.PI*1.40)  lerpSky(SKY.sunset,SKY.night, (a-Math.PI*1.10)/(Math.PI*0.30));
    else if(a<Math.PI*1.75)  setSky(SKY.night);
    else                      lerpSky(SKY.night, SKY.dawn,  (a-Math.PI*1.75)/(Math.PI*0.25));
    drawSky();
}

/* ═══════════════════════════════════════════════════════
   MUSIQUE
═══════════════════════════════════════════════════════ */
function initMusic(){
    const a=new Audio('background_sound.mp3'); a.volume=0.45;
    const play=()=>{a.currentTime=0;a.play().catch(()=>{});};
    a.addEventListener('ended',()=>setTimeout(play,120000));
    document.addEventListener('click',()=>play(),{once:true});
}
initMusic();

/* ═══════════════════════════════════════════════════════
   NOISE
═══════════════════════════════════════════════════════ */
const SEED=Math.random()*65536|0;
function buildPerm(seed){const p=new Uint8Array(256);for(let i=0;i<256;i++)p[i]=i;let s=seed;for(let i=255;i>0;i--){s=(s*1664525+1013904223)&0xffffffff;const j=(s>>>24)%(i+1);[p[i],p[j]]=[p[j],p[i]];}const pm=new Uint8Array(512);for(let i=0;i<512;i++)pm[i]=p[i&255];return pm;}
const perm=buildPerm(SEED),GRAD=[[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
function simplex2(xin,yin){const F2=0.5*(Math.sqrt(3)-1),G2=(3-Math.sqrt(3))/6,s=(xin+yin)*F2,i=Math.floor(xin+s)|0,j=Math.floor(yin+s)|0,t=(i+j)*G2,x0=xin-(i-t),y0=yin-(j-t),i1=x0>y0?1:0,j1=x0>y0?0:1,x1=x0-i1+G2,y1=y0-j1+G2,x2=x0-1+2*G2,y2=y0-1+2*G2,ii=i&255,jj=j&255,g0=perm[ii+perm[jj]]%8,g1=perm[ii+i1+perm[jj+j1]]%8,g2=perm[ii+1+perm[jj+1]]%8;let n0=0,n1=0,n2=0;let t0=0.5-x0*x0-y0*y0;if(t0>=0){t0*=t0;n0=t0*t0*(GRAD[g0][0]*x0+GRAD[g0][1]*y0);}let t1=0.5-x1*x1-y1*y1;if(t1>=0){t1*=t1;n1=t1*t1*(GRAD[g1][0]*x1+GRAD[g1][1]*y1);}let t2=0.5-x2*x2-y2*y2;if(t2>=0){t2*=t2;n2=t2*t2*(GRAD[g2][0]*x2+GRAD[g2][1]*y2);}return 70*(n0+n1+n2);}
function fbm(x,z){return simplex2(x*0.002,z*0.002)*14+simplex2(x*0.008,z*0.008)*5+simplex2(x*0.025,z*0.025)*1.5;}

/* ═══════════════════════════════════════════════════════
   HEIGHTMAP
═══════════════════════════════════════════════════════ */
const HSTEP=0.5,hCa=new Map();
function heightAt(wx,wz){const kx=Math.round(wx/HSTEP)|0,kz=Math.round(wz/HSTEP)|0,k=kx*100003+kz;let h=hCa.get(k);if(h===undefined){h=fbm(wx,wz);hCa.set(k,h);}return h;}
function findY(wx,wz){const x0=Math.floor(wx/HSTEP)*HSTEP,z0=Math.floor(wz/HSTEP)*HSTEP,fu=(wx-x0)/HSTEP,fv=(wz-z0)/HSTEP;return heightAt(x0,z0)*(1-fu)*(1-fv)+heightAt(x0+HSTEP,z0)*fu*(1-fv)+heightAt(x0,z0+HSTEP)*(1-fu)*fv+heightAt(x0+HSTEP,z0+HSTEP)*fu*fv;}
function tNorm(wx,wz){const d=HSTEP;return new THREE.Vector3(findY(wx-d,wz)-findY(wx+d,wz),2*d,findY(wx,wz-d)-findY(wx,wz+d)).normalize();}

/* ═══════════════════════════════════════════════════════
   MATÉRIAUX PARTAGÉS (Lambert = moins cher que Standard)
═══════════════════════════════════════════════════════ */
const MAT={
    trunk: new THREE.MeshLambertMaterial({color:0x3a2010}),
    cone0: new THREE.MeshLambertMaterial({color:0x0e220e}),
    cone1: new THREE.MeshLambertMaterial({color:0x152d15}),
    cone2: new THREE.MeshLambertMaterial({color:0x1a3a1a}),
    rock:  new THREE.MeshLambertMaterial({color:0x777777}),
    ground:new THREE.MeshLambertMaterial({color:0x243b1d}),
    stem:  new THREE.MeshLambertMaterial({color:0x2d4c1e}),
    grass: new THREE.MeshLambertMaterial({color:0x3f6b2d}),
    ff:    new THREE.MeshBasicMaterial({color:0xffffaa}),
    stone: new THREE.MeshLambertMaterial({color:0x888070}),
    stoneD:new THREE.MeshLambertMaterial({color:0x665a4a}),
    mushC: new THREE.MeshLambertMaterial({color:0xcc3300}),
    mushC2:new THREE.MeshLambertMaterial({color:0xaa2200}),
    mushS: new THREE.MeshLambertMaterial({color:0xffffff}),
    mushSt:new THREE.MeshLambertMaterial({color:0xe8dcc8}),
};
const CMATS=[MAT.cone0,MAT.cone1,MAT.cone2];
const FCOLS=[0xff4444,0x4444ff,0xffff55,0xffffff,0xff66cc];
const fcache={};
function fMat(h){if(!fcache[h])fcache[h]=new THREE.MeshLambertMaterial({color:h,emissive:h,emissiveIntensity:0.15});return fcache[h];}
const GEO={
    grass:new THREE.CylinderGeometry(0.015,0.04,0.5,3),
    ff:   new THREE.SphereGeometry(0.07,4,4),
    stem: new THREE.CylinderGeometry(0.025,0.035,0.8,5),
    flow: new THREE.SphereGeometry(0.14,5,4),
    rock: new THREE.DodecahedronGeometry(1,0),
};

/* ═══════════════════════════════════════════════════════
   TOUR CARRÉE
   Escalier = 4 rampes inclinées (une par face)
   Chaque rampe = 1 seul mesh incliné + 1 collider platform
   Pas de zigzag, large, réaliste
═══════════════════════════════════════════════════════ */
let towerBuilt=false;

function buildTower(wx,wz,gy,colliders){
    const grp=new THREE.Group();
    const BASE=8, WH=36, WT=1.8, RH=22;

    /* Murs */
    const wFBg=new THREE.BoxGeometry(BASE*2,WH,WT);
    const wLRg=new THREE.BoxGeometry(WT,WH,BASE*2);
    [-1,1].forEach(s=>{
        const mf=new THREE.Mesh(wFBg,MAT.stone); mf.position.set(0,WH/2,s*BASE); mf.castShadow=true; grp.add(mf);
        colliders.push({type:'box',x:wx,z:wz+s*BASE,y:gy,topY:gy+WH,hw:BASE,hd:WT/2+0.3});
        const ml=new THREE.Mesh(wLRg,MAT.stone); ml.position.set(s*BASE,WH/2,0); ml.castShadow=true; grp.add(ml);
        colliders.push({type:'box',x:wx+s*BASE,z:wz,y:gy,topY:gy+WH,hw:WT/2+0.3,hd:BASE});
    });

    /* Piliers d'angle */
    const pGeo=new THREE.CylinderGeometry(1.6,1.9,WH+4,7);
    [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([sx,sz])=>{
        const p=new THREE.Mesh(pGeo,MAT.stoneD); p.position.set(sx*BASE,WH/2+2,sz*BASE); p.castShadow=true; grp.add(p);
        colliders.push({type:'cyl',x:wx+sx*BASE,y:gy,z:wz+sz*BASE,r:2.1,h:WH+5});
    });

    /* Sol intérieur */
    const fl=new THREE.Mesh(new THREE.BoxGeometry(BASE*2-WT*2,0.5,BASE*2-WT*2),MAT.stoneD);
    fl.position.set(0,0.25,0); grp.add(fl);

    /* Créneaux — 4 coins + milieu de chaque face */
    const mGeo=new THREE.BoxGeometry(2.2,2.5,1.6);
    [[-5,1],[0,1],[5,1],[-5,-1],[0,-1],[5,-1]].forEach(([ox,side])=>{
        const m=new THREE.Mesh(mGeo,MAT.stone); m.position.set(ox,WH+1.25,side*(BASE+0.9)); grp.add(m);
    });
    const mGeo2=new THREE.BoxGeometry(1.6,2.5,2.2);
    [[-5,1],[0,1],[5,1],[-5,-1],[0,-1],[5,-1]].forEach(([oz,side])=>{
        const m=new THREE.Mesh(mGeo2,MAT.stone); m.position.set(side*(BASE+0.9),WH+1.25,oz); grp.add(m);
    });

    /* Toit */
    const roofGeo=new THREE.ConeGeometry(BASE*1.44,RH,4);
    roofGeo.rotateY(Math.PI/4);
    const roof=new THREE.Mesh(roofGeo,MAT.stoneD); roof.position.set(0,WH+2.5+RH/2,0); roof.castShadow=true; grp.add(roof);

    /* Palier sommet */
    const palGeo=new THREE.BoxGeometry(BASE*2+4,0.5,BASE*2+4);
    const pal=new THREE.Mesh(palGeo,MAT.stone); pal.position.set(0,WH+0.25,0); grp.add(pal);
    colliders.push({type:'plat',x:wx,z:wz,y:gy+WH,topY:gy+WH+0.5,hw:BASE+2.2,hd:BASE+2.2});

    /* Barrières sommet — 4 barreaux */
    const bH=1.4, bOuter=BASE+2;
    [[0,+bOuter,bOuter*2+0.6,bH,0.4,bOuter],[0,-bOuter,bOuter*2+0.6,bH,0.4,bOuter],
     [+bOuter,0,0.4,bH,bOuter*2,bOuter],[- bOuter,0,0.4,bH,bOuter*2,bOuter]].forEach(([px,pz,gx,gy2,gz,hd_])=>{
        const b=new THREE.Mesh(new THREE.BoxGeometry(gx,gy2,gz),MAT.stoneD);
        b.position.set(px,WH+0.5+bH/2,pz); grp.add(b);
        colliders.push({type:'box',x:wx+px,z:wz+pz,y:gy+WH+0.5,topY:gy+WH+0.5+bH,hw:gx/2+0.2,hd:gz/2+0.2});
    });

    /* ── ESCALIER : 4 rampes, une par face, qui font le tour
       Chaque rampe = plan incliné unique (BoxGeometry rotationné)
       + 2 murs latéraux fins pour le guardrail
       Rampe 1 : face +Z, monte de sol→WH/4
       Rampe 2 : face +X, monte de WH/4→WH/2
       Rampe 3 : face -Z, monte de WH/2→3WH/4
       Rampe 4 : face -X, monte de 3WH/4→WH
    ── */
    const RAMP_W = 3.5;   // largeur de la rampe
    const RAMP_D = 1.4;   // épaisseur du plancher de rampe
    const faceLen = BASE*2; // longueur de la rampe le long de la face
    const rampH   = WH/4;   // hauteur gagnée par rampe

    // angle d'inclinaison
    const rampAngle = Math.atan2(rampH, faceLen);
    // longueur diagonale
    const rampLen   = Math.sqrt(faceLen*faceLen + rampH*rampH);

    const ramps = [
        // [position centre, rotation Y, sens montée, heightStart]
        { cx:0,      cz:BASE+RAMP_D/2+RAMP_W*0.05, ry:0,           hs:0        }, // face +Z
        { cx:BASE+RAMP_D/2+RAMP_W*0.05, cz:0,       ry:Math.PI/2,  hs:rampH    }, // face +X
        { cx:0,      cz:-(BASE+RAMP_D/2+RAMP_W*0.05),ry:Math.PI,   hs:rampH*2  }, // face -Z
        { cx:-(BASE+RAMP_D/2+RAMP_W*0.05),cz:0,     ry:-Math.PI/2, hs:rampH*3  }, // face -X
    ];

    ramps.forEach(r=>{
        const midH = r.hs + rampH/2;
        // Mesh rampe = boîte longue, inclinée
        const rGeo = new THREE.BoxGeometry(RAMP_W, RAMP_D, rampLen);
        const rMesh = new THREE.Mesh(rGeo, MAT.stone);
        rMesh.castShadow = true;
        // inclinaison selon le bon axe
        rMesh.rotation.y = r.ry;
        rMesh.rotation.x = -rampAngle; // penche vers le haut
        rMesh.position.set(r.cx, midH, r.cz);
        grp.add(rMesh);

        // Collider platform couvrant toute la rampe (légèrement surélevé)
        // On met 3 platforms le long de la rampe pour une montée fluide
        const steps = 4;
        for(let si=0;si<steps;si++){
            const t = (si+0.5)/steps;
            // position locale le long de la rampe (axe Z local)
            const localZ = (t-0.5)*faceLen;
            const localY = r.hs + t*rampH;
            // convertir en world selon rotation Y
            const cosR=Math.cos(r.ry), sinR=Math.sin(r.ry);
            const wlx = cosR*0 - sinR*localZ;
            const wlz = sinR*0 + cosR*localZ;
            colliders.push({type:'plat',
                x:wx+r.cx+wlx, z:wz+r.cz+wlz,
                y:gy+localY-0.5,
                topY:gy+localY+RAMP_D/2+0.05,
                hw:RAMP_W/2+0.15, hd:faceLen/steps/2+0.3,
                ry:r.ry
            });
        }

        // Garde-corps légers (2 poteaux + barre)
        const railMat = MAT.stoneD;
        [-1,1].forEach(side=>{
            // Poteau bas
            const pBot=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.8,0.2),railMat);
            pBot.rotation.y=r.ry;
            const cosR=Math.cos(r.ry),sinR=Math.sin(r.ry);
            const offX=cosR*(side*RAMP_W/2)*0.9-sinR*(-faceLen/2*0.85);
            const offZ=sinR*(side*RAMP_W/2)*0.9+cosR*(-faceLen/2*0.85);
            pBot.position.set(r.cx+offX,r.hs+0.4,r.cz+offZ); grp.add(pBot);
            // Poteau haut
            const pTop=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.8,0.2),railMat);
            pTop.rotation.y=r.ry;
            const offX2=cosR*(side*RAMP_W/2)*0.9-sinR*(faceLen/2*0.85);
            const offZ2=sinR*(side*RAMP_W/2)*0.9+cosR*(faceLen/2*0.85);
            pTop.position.set(r.cx+offX2,r.hs+rampH+0.4,r.cz+offZ2); grp.add(pTop);
        });

        // Palier intermédiaire au pied + haut de chaque rampe
        const pliGeo=new THREE.BoxGeometry(RAMP_W,0.4,RAMP_W);
        const pliBot=new THREE.Mesh(pliGeo,MAT.stone);
        const cosR=Math.cos(r.ry),sinR=Math.sin(r.ry);
        const botOffZ=-faceLen/2, topOffZ=faceLen/2;
        const bx=cosR*0-sinR*botOffZ, bz=sinR*0+cosR*botOffZ;
        pliBot.position.set(r.cx+bx, r.hs+0.2, r.cz+bz); grp.add(pliBot);
        colliders.push({type:'plat',x:wx+r.cx+bx,z:wz+r.cz+bz,y:gy+r.hs,topY:gy+r.hs+0.4,hw:RAMP_W/2+0.1,hd:RAMP_W/2+0.1});
        const tx=cosR*0-sinR*topOffZ, tz=sinR*0+cosR*topOffZ;
        const pliTop=new THREE.Mesh(pliGeo,MAT.stone);
        pliTop.position.set(r.cx+tx, r.hs+rampH+0.2, r.cz+tz); grp.add(pliTop);
        colliders.push({type:'plat',x:wx+r.cx+tx,z:wz+r.cz+tz,y:gy+r.hs+rampH,topY:gy+r.hs+rampH+0.4,hw:RAMP_W/2+0.1,hd:RAMP_W/2+0.1});
    });

    grp.position.set(wx,gy,wz);
    scene.add(grp);
}

/* ═══════════════════════════════════════════════════════
   CHAMPIGNONS
═══════════════════════════════════════════════════════ */
function buildMush(wx,wz,gy,rng,grp){
    const sc=0.12+rng()*0.22,sH=0.4*sc,cR=0.45*sc;
    const sm=new THREE.Mesh(new THREE.CylinderGeometry(cR*0.28,cR*0.33,sH,5),MAT.mushSt);sm.position.set(wx,gy+sH/2,wz);grp.add(sm);
    const cm=new THREE.Mesh(new THREE.SphereGeometry(cR,7,4,0,Math.PI*2,0,Math.PI*0.55),rng()>0.3?MAT.mushC:MAT.mushC2);cm.position.set(wx,gy+sH+cR*0.05,wz);grp.add(cm);
}

/* ═══════════════════════════════════════════════════════
   CHUNKS
═══════════════════════════════════════════════════════ */
const CS=80, CSEGS=14, CSEGS_FAR=5, CRAD=2;
const loadedChunks=new Map(), chunkFade=new Map();
let lCX=Infinity,lCZ=Infinity;

function seededRng(seed){let s=(seed^0xdeadbeef)|0;return()=>{s=Math.imul(s^(s>>>16),0x45d9f3b);s=Math.imul(s^(s>>>16),0x45d9f3b);s^=s>>>16;return(s>>>0)/0xffffffff;};}
function generateChunk(cx,cz){const key=cx+','+cz;if(loadedChunks.has(key))return;loadedChunks.set(key,null);requestAnimationFrame(()=>buildChunk(cx,cz,key));}

function buildChunk(cx,cz,key){
    if(!loadedChunks.has(key))return;
    const oX=cx*CS,oZ=cz*CS,rng=seededRng(cx*73856093^cz*19349663);
    const grp=new THREE.Group(),lc=[];
    const dist=Math.max(Math.abs(cx-lCX),Math.abs(cz-lCZ));
    const far=dist>=2;

    /* Terrain */
    const segs=far?CSEGS_FAR:CSEGS;
    const tgeo=new THREE.PlaneGeometry(CS,CS,segs,segs);
    const vp=tgeo.attributes.position.array;
    for(let i=0;i<vp.length;i+=3)vp[i+2]=fbm(oX+vp[i],oZ-vp[i+1]);
    tgeo.computeVertexNormals();
    const terr=new THREE.Mesh(tgeo,MAT.ground);
    terr.rotation.x=-Math.PI/2;terr.position.set(oX,0,oZ);
    terr.receiveShadow=!far;grp.add(terr);

    /* Arbres */
    const tN=far?3+(rng()*3|0):6+(rng()*5|0);
    const tpts=[];
    for(let i=0;i<tN;i++){
        let wx,wz,ok=false,tries=0;
        do{wx=oX+(rng()-0.5)*CS*0.85;wz=oZ+(rng()-0.5)*CS*0.85;ok=!tpts.some(p=>{const dx=p[0]-wx,dz=p[1]-wz;return dx*dx+dz*dz<196;});}while(!ok&&++tries<10);
        tpts.push([wx,wz]);
        const gy=findY(wx,wz),h=28+rng()*18,tr=1.4+rng()*1.0,trH=h*(0.28+rng()*0.08);
        const tg=new THREE.Group();
        // Tronc — ombre seulement sur les proches
        const trunk=new THREE.Mesh(new THREE.CylinderGeometry(tr*0.55,tr*1.4,trH+6,far?5:8),MAT.trunk);
        trunk.position.y=trH/2-3;
        trunk.castShadow=!far; trunk.receiveShadow=!far;
        tg.add(trunk);
        // Feuillage
        const layers=far?3+(rng()*2|0):8+(rng()*4|0),fH=h-trH;
        for(let li=0;li<layers;li++){
            const ratio=li/(layers-1),cy=trH+ratio*fH*0.90,rad=tr*4.5*(1-ratio*0.72)+1.5,ch=(fH/layers)*2.2;
            const cone=new THREE.Mesh(new THREE.ConeGeometry(rad,ch,far?5:7),CMATS[(rng()*3)|0]);
            cone.position.y=cy;
            // Ombre simple sur les feuilles proches
            cone.castShadow=!far;
            tg.add(cone);
            if(!far)windObjects.push({mesh:cone,phase:rng()*10,speed:0.5,amp:0.012});
        }
        tg.position.set(wx,gy,wz);grp.add(tg);
        if(!far)lc.push({type:'cyl',x:wx,y:gy,z:wz,r:tr*1.7,h:trH+6});
    }

    if(!far){
        /* Rochers */
        for(let i=0,n=3+(rng()*6|0);i<n;i++){
            const wx=oX+(rng()-0.5)*CS*0.88,wz=oZ+(rng()-0.5)*CS*0.88,gy=findY(wx,wz);
            const sx=1.0+rng()*2.4,sy=sx*(0.5+rng()*0.45),sz=1.0+rng()*2.4;
            const r=new THREE.Mesh(GEO.rock,MAT.rock);
            r.scale.set(sx,sy,sz);r.rotation.set((rng()-0.5)*0.4,rng()*Math.PI*2,(rng()-0.5)*0.4);
            r.position.set(wx,gy+sy*0.48,wz);r.castShadow=r.receiveShadow=true;grp.add(r);
            lc.push({type:'sphere',x:wx,y:gy+sy*0.48,z:wz,r:Math.max(sx,sz)*0.88,topY:gy+sy*0.48+sy*0.82});
        }
        /* Fleurs */
        for(let i=0,n=20+(rng()*40|0);i<n;i++){
            const wx=oX+(rng()-0.5)*CS*0.9,wz=oZ+(rng()-0.5)*CS*0.9,gy=findY(wx,wz);
            const st=new THREE.Mesh(GEO.stem,MAT.stem);st.position.set(wx,gy+0.4,wz);grp.add(st);
            const hd=new THREE.Mesh(GEO.flow,fMat(FCOLS[(rng()*FCOLS.length)|0]));hd.position.set(wx,gy+0.9,wz);grp.add(hd);
        }
        /* Champignons */
        for(let i=0,n=1+(rng()*4|0);i<n;i++){
            const wx=oX+(rng()-0.5)*CS*0.88,wz=oZ+(rng()-0.5)*CS*0.88;
            buildMush(wx,wz,findY(wx,wz),rng,grp);
        }
        /* Tour */
        if(cx===0&&cz===0&&!towerBuilt){
            towerBuilt=true;
            const tx=oX+22,tz=oZ+18;
            buildTower(tx,tz,findY(tx,tz),globalColliders);
        }
    }

    /* Herbe instanciée — seulement proche */
    if(!far){
        const gn=40+(rng()*40|0);
        const gm=new THREE.InstancedMesh(GEO.grass,MAT.grass,gn);gm.frustumCulled=false;
        const dm=new THREE.Object3D();
        for(let i=0;i<gn;i++){const wx=oX+(rng()-0.5)*CS,wz=oZ+(rng()-0.5)*CS;dm.position.set(wx,findY(wx,wz)+0.25,wz);dm.scale.setScalar(0.5+rng()*0.8);dm.rotation.y=rng()*Math.PI;dm.updateMatrix();gm.setMatrixAt(i,dm.matrix);}
        gm.instanceMatrix.needsUpdate=true;grp.add(gm);
    }

    /* Lucioles */
    if(!far){for(let i=0,n=2+(rng()*5|0);i<n;i++){const wx=oX+(rng()-0.5)*CS*0.88,wz=oZ+(rng()-0.5)*CS*0.88,fy=findY(wx,wz)+2+rng()*4;const m=new THREE.Mesh(GEO.ff,MAT.ff);m.position.set(wx,fy,wz);grp.add(m);fireflyData.push({mesh:m,baseY:fy,phase:rng()*10});}}

    /* Fade-in */
    grp.traverse(obj=>{if(!obj.isMesh)return;const ms=Array.isArray(obj.material)?obj.material:[obj.material];const cl=ms.map(m=>{const c=m.clone();c._bOp=c.opacity??1;c.transparent=true;c.opacity=0;return c;});obj.material=Array.isArray(obj.material)?cl:cl[0];});

    globalColliders.push(...lc);scene.add(grp);loadedChunks.set(key,{group:grp,localColliders:lc});chunkFade.set(key,{group:grp,alpha:0});
}

const windObjects=[],fireflyData=[],globalColliders=[];

function unloadChunk(cx,cz){
    const key=cx+','+cz,data=loadedChunks.get(key);if(!data){loadedChunks.delete(key);return;}
    scene.remove(data.group);
    data.group.traverse(obj=>{if(!obj.isMesh)return;if(obj.geometry&&!Object.values(GEO).includes(obj.geometry))obj.geometry.dispose();const ms=Array.isArray(obj.material)?obj.material:[obj.material];ms.forEach(m=>{if(m._bOp!==undefined)m.dispose();});});
    for(const c of data.localColliders){const idx=globalColliders.indexOf(c);if(idx!==-1)globalColliders.splice(idx,1);}
    data.group.traverse(obj=>{const fi=fireflyData.findIndex(f=>f.mesh===obj);if(fi!==-1)fireflyData.splice(fi,1);const wi=windObjects.findIndex(w=>w.mesh===obj);if(wi!==-1)windObjects.splice(wi,1);});
    loadedChunks.delete(key);chunkFade.delete(key);
}

function updateChunks(px,pz){
    const cx=Math.round(px/CS),cz=Math.round(pz/CS);
    if(cx===lCX&&cz===lCZ)return;lCX=cx;lCZ=cz;
    for(let dx=-CRAD;dx<=CRAD;dx++)for(let dz=-CRAD;dz<=CRAD;dz++)generateChunk(cx+dx,cz+dz);
    for(const[key]of loadedChunks){const[kcx,kcz]=key.split(',').map(Number);if(Math.abs(kcx-cx)>CRAD+1||Math.abs(kcz-cz)>CRAD+1)unloadChunk(kcx,kcz);}
}

/* ═══════════════════════════════════════════════════════
   PHYSIQUE
═══════════════════════════════════════════════════════ */
const PR=0.4,PH=1.8;
function resolveColliders(nx,ny,nz){
    let onTop=false,surfY=-Infinity;
    for(const c of globalColliders){
        if(c.type==='cyl'){
            const dx=nx-c.x,dz=nz-c.z,d=Math.sqrt(dx*dx+dz*dz),cT=c.y+c.h,pB=ny-PH;
            if(d<c.r+PR&&ny>c.y&&pB<cT){if(pB>=cT-0.7){ny=cT+PH;onTop=true;surfY=Math.max(surfY,cT);}else{const a=Math.atan2(dz,dx);nx=c.x+Math.cos(a)*(c.r+PR);nz=c.z+Math.sin(a)*(c.r+PR);}}
        }else if(c.type==='sphere'){
            const dx=nx-c.x,dz=nz-c.z,dxz=Math.sqrt(dx*dx+dz*dz),dy=(ny-PH*0.5)-c.y,d3=Math.sqrt(dx*dx+dy*dy+dz*dz);
            if(d3<c.r+PR&&d3>0.001){if((ny-PH)>=c.topY-0.8&&dy>-0.2){ny=c.topY+PH;onTop=true;surfY=Math.max(surfY,c.topY);}else if(dxz>0.01){const need=c.r+PR*1.1;if(dxz<need){nx+=(dx/dxz)*(need-dxz);nz+=(dz/dxz)*(need-dxz);}}}
        }else if(c.type==='plat'){
            const dx=nx-c.x,dz=nz-c.z;
            if(Math.abs(dx)>c.hw+PR+0.05)continue;if(Math.abs(dz)>c.hd+PR+0.05)continue;
            if(ny<c.y)continue;
            const pB=ny-PH;
            if(pB>=c.topY-1.1){const wY=c.topY+PH;if(ny<=wY+0.05){ny=wY;onTop=true;surfY=Math.max(surfY,c.topY);}}
            else{const olXp=(c.hw+PR)-dx,olXn=dx+(c.hw+PR),olZp=(c.hd+PR)-dz,olZn=dz+(c.hd+PR),mn=Math.min(olXp,olXn,olZp,olZn);if(mn===olXp&&olXp>0)nx=c.x+c.hw+PR;else if(mn===olXn&&olXn>0)nx=c.x-c.hw-PR;else if(mn===olZp&&olZp>0)nz=c.z+c.hd+PR;else if(mn===olZn&&olZn>0)nz=c.z-c.hd-PR;}
        }else if(c.type==='box'){
            const dx=nx-c.x,dz=nz-c.z,pB=ny-PH;
            if(Math.abs(dx)>c.hw+PR+0.05)continue;if(Math.abs(dz)>c.hd+PR+0.05)continue;
            if(ny<c.y||pB>c.topY+0.2)continue;
            const olXp=(c.hw+PR)-dx,olXn=dx+(c.hw+PR),olZp=(c.hd+PR)-dz,olZn=dz+(c.hd+PR),mn=Math.min(olXp,olXn,olZp,olZn);
            if(mn===olXp&&olXp>0)nx=c.x+c.hw+PR;else if(mn===olXn&&olXn>0)nx=c.x-c.hw-PR;else if(mn===olZp&&olZp>0)nz=c.z+c.hd+PR;else if(mn===olZn&&olZn>0)nz=c.z-c.hd-PR;
        }
    }
    return{x:nx,y:ny,z:nz,onTop,surfY};
}

/* ═══════════════════════════════════════════════════════
   CONTROLS
═══════════════════════════════════════════════════════ */
const controls=new PointerLockControls(camera,document.body);
document.body.addEventListener('click',()=>controls.lock());
const vel=new THREE.Vector3(),keys={z:false,s:false,q:false,d:false,shift:false};
let jumpVel=0,grounded=true,stamina=100,sGroundY=null;
addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(k in keys)keys[k]=true;if(e.shiftKey)keys.shift=true;if(e.code==='Space'&&grounded){grounded=false;jumpVel=0.32;}});
addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(k in keys)keys[k]=false;if(!e.shiftKey)keys.shift=false;});
const _f=new THREE.Vector3(),_r=new THREE.Vector3();

function updateMovement(dt){
    const run=keys.shift&&stamina>0&&(keys.z||keys.s||keys.q||keys.d);
    stamina=run?Math.max(0,stamina-0.45):Math.min(100,stamina+0.2);
    document.getElementById('sp').style.width=stamina+'%';
    _f.set(0,0,-1).applyQuaternion(camera.quaternion);_f.y=0;_f.normalize();
    _r.set(1,0,0).applyQuaternion(camera.quaternion);_r.y=0;_r.normalize();
    const slope=1-Math.abs(tNorm(camera.position.x,camera.position.z).y);
    const acc=(run?0.055:0.028)*(1-slope*0.5);
    if(keys.z)vel.addScaledVector(_f,acc);if(keys.s)vel.addScaledVector(_f,-acc);
    if(keys.q)vel.addScaledVector(_r,-acc);if(keys.d)vel.addScaledVector(_r,acc);
    vel.multiplyScalar(0.88);
    let nx=camera.position.x+vel.x,ny=camera.position.y,nz=camera.position.z+vel.z;
    jumpVel=Math.max(jumpVel-0.016,-1.2);ny+=jumpVel;
    const res=resolveColliders(nx,ny,nz);nx=res.x;ny=res.y;nz=res.z;
    const tgy=findY(nx,nz)+PH;
    if(ny<=tgy){
        if(jumpVel<=0&&!res.onTop){if(sGroundY===null)sGroundY=ny;sGroundY+=(tgy-sGroundY)*Math.min(1,0.3+dt*9);ny=Math.max(sGroundY,tgy-0.05);}else{ny=tgy;sGroundY=ny;}
        if(jumpVel<=0){jumpVel=0;grounded=true;}
    }else if(res.onTop){
        const tY=res.surfY+PH;
        if(jumpVel<=0){if(sGroundY===null)sGroundY=ny;sGroundY+=(tY-sGroundY)*Math.min(1,0.45+dt*12);ny=Math.max(sGroundY,tY);jumpVel=0;grounded=true;}
        else sGroundY=ny;
    }else{sGroundY=null;grounded=false;}
    camera.position.set(nx,ny,nz);
}

/* ═══════════════════════════════════════════════════════
   BOUCLE
═══════════════════════════════════════════════════════ */
const clock=new THREE.Clock();
let elapsed=DAY_DUR*0.25;
updateChunks(0,0);

function animate(){
    requestAnimationFrame(animate);
    const dt=Math.min(clock.getDelta(),0.05);
    elapsed+=dt;
    for(const w of windObjects)w.mesh.rotation.z=Math.sin(elapsed*w.speed+w.phase)*w.amp;
    for(const f of fireflyData){f.mesh.position.y=f.baseY+Math.sin(elapsed+f.phase)*0.5;f.mesh.position.x+=Math.cos(elapsed*0.3+f.phase)*0.008;}
    for(const[key,fd]of chunkFade){
        fd.alpha=Math.min(1,fd.alpha+dt*2.5);
        fd.group.traverse(obj=>{if(!obj.isMesh)return;const ms=Array.isArray(obj.material)?obj.material:[obj.material];for(const m of ms)if(m._bOp!==undefined)m.opacity=fd.alpha*m._bOp;});
        if(fd.alpha>=1){fd.group.traverse(obj=>{if(!obj.isMesh)return;const ms=Array.isArray(obj.material)?obj.material:[obj.material];for(const m of ms)if(m._bOp!==undefined){m.opacity=m._bOp;m.transparent=m._bOp<1;}});chunkFade.delete(key);}
    }
    updateDayNight(elapsed);
    if(controls.isLocked)updateMovement(dt);
    updateChunks(camera.position.x,camera.position.z);
    renderer.render(scene,camera);
}
animate();

window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

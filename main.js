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
   SKYBOX — canvas 2D dégradé, 100% garanti visible
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

let _top=SKY.day.top.slice(), _hor=SKY.day.hor.slice();
function setSky(s){_top=s.top.slice();_hor=s.hor.slice();}
function lerpSky(a,b,t){_top=lerp3(a.top,b.top,t);_hor=lerp3(a.hor,b.hor,t);}
function drawSky(){
    const g=SKY_CTX.createLinearGradient(0,0,0,256);
    g.addColorStop(0,toCSS(_top)); g.addColorStop(1,toCSS(_hor));
    SKY_CTX.fillStyle=g; SKY_CTX.fillRect(0,0,2,256);
    skyTex.needsUpdate=true;
}

/* ───────────────────────────────────────────────────────
   LUMIERES
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
function makeCircleSprite(inner, outer) {
    const c=document.createElement('canvas'); c.width=c.height=256;
    const ctx=c.getContext('2d');
    const g=ctx.createRadialGradient(128,128,0,128,128,128);
    g.addColorStop(0,inner); g.addColorStop(0.3,outer);
    g.addColorStop(0.7,outer.replace(/[\d.]+\)$/,'0.15)')); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,256,256);
    return new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
}
function makeGlowSprite(color) {
    const c=document.createElement('canvas'); c.width=c.height=256;
    const ctx=c.getContext('2d');
    const g=ctx.createRadialGradient(128,128,0,128,128,128);
    g.addColorStop(0,color); g.addColorStop(0.4,color.replace(/[\d.]+\)$/,'0.3)')); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,256,256);
    return new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
}

const sunSprite  = makeCircleSprite('rgba(255,255,220,1)','rgba(255,200,50,0.8)');
const sunGlow    = makeGlowSprite('rgba(255,160,30,0.6)');
const moonSprite = makeCircleSprite('rgba(230,240,255,1)','rgba(150,170,220,0.7)');
const moonGlow   = makeGlowSprite('rgba(80,100,180,0.4)');
sunSprite.scale.setScalar(200); sunGlow.scale.setScalar(500);
moonSprite.scale.setScalar(140); moonGlow.scale.setScalar(360);
scene.add(sunSprite,sunGlow,moonSprite,moonGlow);

/* ───────────────────────────────────────────────────────
   ÉTOILES
─────────────────────────────────────────────────────── */
const STAR_COUNT=1200;
const starPos=new Float32Array(STAR_COUNT*3), starSz=new Float32Array(STAR_COUNT);
for(let i=0;i<STAR_COUNT;i++){
    const th=2*Math.PI*Math.random(),ph=Math.acos(2*Math.random()-1),r=1600;
    starPos[i*3]=r*Math.sin(ph)*Math.cos(th); starPos[i*3+1]=Math.abs(r*Math.cos(ph))+80; starPos[i*3+2]=r*Math.sin(ph)*Math.sin(th);
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
const stars=new THREE.Points(starGeo,starMat);
scene.add(stars);

/* ───────────────────────────────────────────────────────
   CYCLE JOUR / NUIT
─────────────────────────────────────────────────────── */
const DAY_DURATION=1200, ORBIT_R=1400;

function updateDayNight(elapsed){
    const angle=((elapsed/DAY_DURATION)*Math.PI*2)%(Math.PI*2);
    const sinA=Math.sin(angle), sf=Math.max(0,sinA), sfS=sf*sf*(3-2*sf), mf=Math.max(0,-sinA), mfS=mf*mf*(3-2*mf);
    const sunX=Math.cos(angle)*ORBIT_R, sunY=Math.sin(angle)*ORBIT_R;
    sun.position.set(sunX,sunY,ORBIT_R*0.25); moonLight.position.set(-sunX,-sunY,ORBIT_R*0.25);
    const cp=camera.position, sd=new THREE.Vector3(sunX,sunY,ORBIT_R*0.25).normalize(), md=sd.clone().negate();
    sunSprite.position.copy(cp).addScaledVector(sd,1350); sunGlow.position.copy(cp).addScaledVector(sd,1340);
    moonSprite.position.copy(cp).addScaledVector(md,1350); moonGlow.position.copy(cp).addScaledVector(md,1340);
    sun.intensity=0.05+sfS*3.0; moonLight.intensity=0.20+mfS*0.5; hemi.intensity=0.30+sfS*0.9;
    sunSprite.material.opacity=Math.pow(sf,0.35); sunGlow.material.opacity=Math.pow(sf,0.5)*0.8;
    moonSprite.material.opacity=Math.pow(mf,0.35); moonGlow.material.opacity=Math.pow(mf,0.5)*0.7;
    scene.fog.color.lerpColors(new THREE.Color(0x04091f),new THREE.Color(0x9bb4c7),sfS);
    scene.fog.density=0.003+(1-sfS)*0.002;
    starMat.uniforms.uOp.value=Math.max(0,1-sfS*2.0)*0.95; starMat.uniforms.uT.value=elapsed;
    stars.position.copy(cp);
    const PI=Math.PI, a=angle;
    if     (a<PI*0.20) lerpSky(SKY.dawn,  SKY.day,   a/(PI*0.20));
    else if(a<PI*0.75) setSky(SKY.day);
    else if(a<PI*1.10) lerpSky(SKY.day,   SKY.sunset,(a-PI*0.75)/(PI*0.35));
    else if(a<PI*1.40) lerpSky(SKY.sunset,SKY.night, (a-PI*1.10)/(PI*0.30));
    else if(a<PI*1.75) setSky(SKY.night);
    else               lerpSky(SKY.night, SKY.dawn,  (a-PI*1.75)/(PI*0.25));
    drawSky();
}

/* ───────────────────────────────────────────────────────
   MUSIQUE
─────────────────────────────────────────────────────── */
function initMusic(){
    const audio=new Audio('background_sound.mp3'); audio.volume=0.45;
    const play=()=>{audio.currentTime=0;audio.play().catch(()=>{});};
    audio.addEventListener('ended',()=>setTimeout(play,120000));
    let started=false;
    const start=()=>{if(started)return;started=true;play();document.removeEventListener('click',start);};
    document.addEventListener('click',start);
}
initMusic();

/* ───────────────────────────────────────────────────────
   SIMPLEX NOISE
─────────────────────────────────────────────────────── */
const SEED=Math.random()*65536|0; console.log('Seed:',SEED);
function buildPerm(seed){
    const p=new Uint8Array(256);for(let i=0;i<256;i++)p[i]=i;let s=seed;
    for(let i=255;i>0;i--){s=(s*1664525+1013904223)&0xffffffff;const j=(s>>>24)%(i+1);[p[i],p[j]]=[p[j],p[i]];}
    const perm=new Uint8Array(512);for(let i=0;i<512;i++)perm[i]=p[i&255];return perm;
}
const perm=buildPerm(SEED), GRAD=[[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
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

/* ───────────────────────────────────────────────────────
   HEIGHTMAP
─────────────────────────────────────────────────────── */
const HSTEP=0.5,hCache=new Map();
function heightAt(wx,wz){const kx=Math.round(wx/HSTEP)|0,kz=Math.round(wz/HSTEP)|0,key=kx*100003+kz;let h=hCache.get(key);if(h===undefined){h=fbm(wx,wz);hCache.set(key,h);}return h;}
function findY(wx,wz){const x0=Math.floor(wx/HSTEP)*HSTEP,z0=Math.floor(wz/HSTEP)*HSTEP,fu=(wx-x0)/HSTEP,fv=(wz-z0)/HSTEP;return heightAt(x0,z0)*(1-fu)*(1-fv)+heightAt(x0+HSTEP,z0)*fu*(1-fv)+heightAt(x0,z0+HSTEP)*(1-fu)*fv+heightAt(x0+HSTEP,z0+HSTEP)*fu*fv;}
function terrainNormal(wx,wz){const d=HSTEP;return new THREE.Vector3(findY(wx-d,wz)-findY(wx+d,wz),2*d,findY(wx,wz-d)-findY(wx,wz+d)).normalize();}

/* ───────────────────────────────────────────────────────
   MATÉRIAUX
─────────────────────────────────────────────────────── */
const MAT={
    trunk:new THREE.MeshStandardMaterial({color:0x2a1a0e}),
    cone0:new THREE.MeshStandardMaterial({color:0x0f240f}),cone1:new THREE.MeshStandardMaterial({color:0x163016}),cone2:new THREE.MeshStandardMaterial({color:0x1c3d1c}),
    rock:new THREE.MeshStandardMaterial({color:0x777777,roughness:1}),ground:new THREE.MeshStandardMaterial({color:0x243b1d,roughness:1}),
    stem:new THREE.MeshStandardMaterial({color:0x2d4c1e}),grass:new THREE.MeshStandardMaterial({color:0x3f6b2d}),
    ff:new THREE.MeshBasicMaterial({color:0xffffaa}),
    mushCap:new THREE.MeshStandardMaterial({color:0xcc3300}),mushCap2:new THREE.MeshStandardMaterial({color:0xaa2200}),
    mushSpot:new THREE.MeshStandardMaterial({color:0xffffff}),mushStem:new THREE.MeshStandardMaterial({color:0xe8dcc8}),
};
const CONE_MATS=[MAT.cone0,MAT.cone1,MAT.cone2];
const FLOWER_COLORS=[0xff4444,0x4444ff,0xffff55,0xffffff,0xff66cc];
const flowerCache={};
function flowerMat(hex){if(!flowerCache[hex])flowerCache[hex]=new THREE.MeshStandardMaterial({color:hex,emissive:hex,emissiveIntensity:0.1});return flowerCache[hex];}
const GEO={grass:new THREE.CylinderGeometry(0.015,0.04,0.5,3),ff:new THREE.SphereGeometry(0.07,4,4),stem:new THREE.CylinderGeometry(0.025,0.035,0.8,5),flower:new THREE.SphereGeometry(0.14,6,6),rock:new THREE.DodecahedronGeometry(1,0)};

/* ───────────────────────────────────────────────────────
   GLOBAUX
─────────────────────────────────────────────────────── */
const windObjects=[],fireflyData=[],globalColliders=[];

/* ───────────────────────────────────────────────────────
   CHUNKS
─────────────────────────────────────────────────────── */
const CHUNK_SIZE=80,CHUNK_SEGS=18,CHUNK_RADIUS=2;
const loadedChunks=new Map(),chunkFadeIn=new Map();
function seededRng(seed){let s=(seed^0xdeadbeef)|0;return()=>{s=Math.imul(s^(s>>>16),0x45d9f3b);s=Math.imul(s^(s>>>16),0x45d9f3b);s^=s>>>16;return(s>>>0)/0xffffffff;};}

function buildMushroom(wx,wz,gy,rng,grp){
    const sc=0.12+rng()*0.25,sH=0.45*sc,cR=0.5*sc;
    const sm=new THREE.Mesh(new THREE.CylinderGeometry(cR*0.28,cR*0.35,sH,6),MAT.mushStem);sm.position.set(wx,gy+sH*0.5,wz);grp.add(sm);
    const cm=new THREE.Mesh(new THREE.SphereGeometry(cR,8,5,0,Math.PI*2,0,Math.PI*0.55),rng()>0.3?MAT.mushCap:MAT.mushCap2);cm.position.set(wx,gy+sH+cR*0.05,wz);grp.add(cm);
    const sg=new THREE.SphereGeometry(cR*0.09,4,4);
    for(let s=0;s<3+(rng()*3|0);s++){const ang=rng()*Math.PI*2,rad=cR*(0.2+rng()*0.55);const spot=new THREE.Mesh(sg,MAT.mushSpot);spot.position.set(wx+Math.cos(ang)*rad,gy+sH+Math.sqrt(Math.max(0,cR*cR-rad*rad))*0.9,wz+Math.sin(ang)*rad);grp.add(spot);}
}

function generateChunk(cx,cz){const key=cx+','+cz;if(loadedChunks.has(key))return;loadedChunks.set(key,null);requestAnimationFrame(()=>_buildChunk(cx,cz,key));}

function _buildChunk(cx,cz,key){
    if(!loadedChunks.has(key))return;
    const oX=cx*CHUNK_SIZE,oZ=cz*CHUNK_SIZE,rng=seededRng(cx*73856093^cz*19349663),grp=new THREE.Group(),lc=[];
    const tg=new THREE.PlaneGeometry(CHUNK_SIZE,CHUNK_SIZE,CHUNK_SEGS,CHUNK_SEGS),vp=tg.attributes.position.array;
    for(let i=0;i<vp.length;i+=3)vp[i+2]=fbm(oX+vp[i],oZ-vp[i+1]);
    tg.computeVertexNormals();
    const terr=new THREE.Mesh(tg,MAT.ground);terr.rotation.x=-Math.PI/2;terr.position.set(oX,0,oZ);terr.receiveShadow=true;grp.add(terr);
    const treeN=7+(rng()*7|0),tpts=[];
    for(let i=0;i<treeN;i++){
        let wx,wz,ok=false,tries=0;
        do{wx=oX+(rng()-0.5)*CHUNK_SIZE*0.85;wz=oZ+(rng()-0.5)*CHUNK_SIZE*0.85;ok=!tpts.some(p=>{const dx=p[0]-wx,dz=p[1]-wz;return dx*dx+dz*dz<16*16;});}while(!ok&&++tries<15);
        tpts.push([wx,wz]);
        const gy=findY(wx,wz),h=28+rng()*18,tr=1.4+rng()*1.0,trunkH=h*(0.28+rng()*0.08),tgr=new THREE.Group();
        const trunk=new THREE.Mesh(new THREE.CylinderGeometry(tr*0.55,tr*1.4,trunkH+6,9),MAT.trunk);trunk.position.y=trunkH/2-3;trunk.castShadow=true;tgr.add(trunk);
        const layers=9+(rng()*5|0),foliageH=h-trunkH;
        for(let li=0;li<layers;li++){const ratio=li/(layers-1),coneY=trunkH+ratio*foliageH*0.90,radius=tr*4.5*(1-ratio*0.72)+1.5,coneH=(foliageH/layers)*2.2;const cone=new THREE.Mesh(new THREE.ConeGeometry(radius,coneH,8),CONE_MATS[(rng()*3)|0]);cone.position.y=coneY;cone.castShadow=true;tgr.add(cone);windObjects.push({mesh:cone,phase:rng()*10,speed:0.5,amp:0.012});}
        tgr.position.set(wx,gy,wz);grp.add(tgr);lc.push({type:'cylinder',x:wx,y:gy,z:wz,r:tr*1.7,h:trunkH+6});
    }
    for(let i=0,n=3+(rng()*7|0);i<n;i++){
        const wx=oX+(rng()-0.5)*CHUNK_SIZE*0.88,wz=oZ+(rng()-0.5)*CHUNK_SIZE*0.88,gy=findY(wx,wz),sx=1.0+rng()*2.6,sy=sx*(0.5+rng()*0.5),sz=1.0+rng()*2.6;
        const rock=new THREE.Mesh(GEO.rock,MAT.rock);rock.scale.set(sx,sy,sz);rock.rotation.set((rng()-0.5)*0.4,rng()*Math.PI*2,(rng()-0.5)*0.4);rock.position.set(wx,gy+sy*0.48,wz);rock.castShadow=rock.receiveShadow=true;grp.add(rock);
        lc.push({type:'sphere',x:wx,y:gy+sy*0.48,z:wz,r:Math.max(sx,sz)*0.9,topY:gy+sy*0.48+sy*0.85});
    }
    for(let i=0,n=25+(rng()*50|0);i<n;i++){
        const wx=oX+(rng()-0.5)*CHUNK_SIZE*0.9,wz=oZ+(rng()-0.5)*CHUNK_SIZE*0.9,gy=findY(wx,wz);
        const st=new THREE.Mesh(GEO.stem,MAT.stem);st.position.set(wx,gy+0.4,wz);grp.add(st);
        const hd=new THREE.Mesh(GEO.flower,flowerMat(FLOWER_COLORS[(rng()*FLOWER_COLORS.length)|0]));hd.position.set(wx,gy+0.9,wz);grp.add(hd);
    }
    for(let i=0,n=1+(rng()*5|0);i<n;i++){
        const wx=oX+(rng()-0.5)*CHUNK_SIZE*0.88,wz=oZ+(rng()-0.5)*CHUNK_SIZE*0.88;
        buildMushroom(wx,wz,findY(wx,wz),rng,grp);
        if(rng()>0.5)for(let c=0,cn=2+(rng()*4|0);c<cn;c++){const ox=wx+(rng()-0.5)*2.5,oz=wz+(rng()-0.5)*2.5;buildMushroom(ox,oz,findY(ox,oz),rng,grp);}
    }
    const gn=50+(rng()*50|0),gm=new THREE.InstancedMesh(GEO.grass,MAT.grass,gn);gm.frustumCulled=false;
    const dummy=new THREE.Object3D();
    for(let i=0;i<gn;i++){const wx=oX+(rng()-0.5)*CHUNK_SIZE,wz=oZ+(rng()-0.5)*CHUNK_SIZE;dummy.position.set(wx,findY(wx,wz)+0.25,wz);dummy.scale.setScalar(0.5+rng()*0.8);dummy.rotation.y=rng()*Math.PI;dummy.updateMatrix();gm.setMatrixAt(i,dummy.matrix);}
    gm.instanceMatrix.needsUpdate=true;grp.add(gm);
    for(let i=0,n=2+(rng()*6|0);i<n;i++){const wx=oX+(rng()-0.5)*CHUNK_SIZE*0.88,wz=oZ+(rng()-0.5)*CHUNK_SIZE*0.88,fy=findY(wx,wz)+2+rng()*4;const m=new THREE.Mesh(GEO.ff,MAT.ff);m.position.set(wx,fy,wz);grp.add(m);fireflyData.push({mesh:m,baseY:fy,phase:rng()*10});}
    grp.traverse(obj=>{if(!obj.isMesh)return;const mats=Array.isArray(obj.material)?obj.material:[obj.material];const cl=mats.map(m=>{const c=m.clone();c._bOp=c.opacity??1;c.transparent=true;c.opacity=0;return c;});obj.material=Array.isArray(obj.material)?cl:cl[0];});
    globalColliders.push(...lc);scene.add(grp);loadedChunks.set(key,{group:grp,localColliders:lc});chunkFadeIn.set(key,{group:grp,alpha:0});
}

function unloadChunk(cx,cz){
    const key=cx+','+cz,data=loadedChunks.get(key);if(!data){loadedChunks.delete(key);return;}
    scene.remove(data.group);
    data.group.traverse(obj=>{if(!obj.isMesh)return;if(obj.geometry&&!Object.values(GEO).includes(obj.geometry))obj.geometry.dispose();const mats=Array.isArray(obj.material)?obj.material:[obj.material];mats.forEach(m=>{if(m._bOp!==undefined)m.dispose();});});
    for(const c of data.localColliders){const idx=globalColliders.indexOf(c);if(idx!==-1)globalColliders.splice(idx,1);}
    data.group.traverse(obj=>{const fi=fireflyData.findIndex(f=>f.mesh===obj);if(fi!==-1)fireflyData.splice(fi,1);const wi=windObjects.findIndex(w=>w.mesh===obj);if(wi!==-1)windObjects.splice(wi,1);});
    loadedChunks.delete(key);chunkFadeIn.delete(key);
}

let lastCX=Infinity,lastCZ=Infinity;
function updateChunks(px,pz){
    const cx=Math.round(px/CHUNK_SIZE),cz=Math.round(pz/CHUNK_SIZE);
    if(cx===lastCX&&cz===lastCZ)return;lastCX=cx;lastCZ=cz;
    for(let dx=-CHUNK_RADIUS;dx<=CHUNK_RADIUS;dx++)for(let dz=-CHUNK_RADIUS;dz<=CHUNK_RADIUS;dz++)generateChunk(cx+dx,cz+dz);
    for(const[key]of loadedChunks){const[kcx,kcz]=key.split(',').map(Number);if(Math.abs(kcx-cx)>CHUNK_RADIUS+1||Math.abs(kcz-cz)>CHUNK_RADIUS+1)unloadChunk(kcx,kcz);}
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
            if(dXZ<c.r+PLAYER_R&&ny>c.y&&pBot<cTop){if(pBot>=cTop-0.65){ny=cTop+PLAYER_H;onTop=true;}else{const a=Math.atan2(dz,dx);nx=c.x+Math.cos(a)*(c.r+PLAYER_R);nz=c.z+Math.sin(a)*(c.r+PLAYER_R);}}
        }else{
            const dx=nx-c.x,dz=nz-c.z,dxz=Math.sqrt(dx*dx+dz*dz),pBot=ny-PLAYER_H,dy=(ny-PLAYER_H*0.5)-c.y,dist3=Math.sqrt(dx*dx+dy*dy+dz*dz);
            if(dist3<c.r+PLAYER_R&&dist3>0.001){if(pBot>=c.topY-0.8&&dy>-0.2){ny=c.topY+PLAYER_H;onTop=true;}else if(dxz>0.01){const need=c.r+PLAYER_R*1.1;if(dxz<need){nx+=(dx/dxz)*(need-dxz);nz+=(dz/dxz)*(need-dxz);}}}
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
    _fwd.set(0,0,-1).applyQuaternion(camera.quaternion);_fwd.y=0;_fwd.normalize();
    _right.set(1,0,0).applyQuaternion(camera.quaternion);_right.y=0;_right.normalize();
    const slope=1-Math.abs(terrainNormal(camera.position.x,camera.position.z).y),accel=(run?0.055:0.028)*(1-slope*0.5);
    if(keys.z)velocity.addScaledVector(_fwd,accel);if(keys.s)velocity.addScaledVector(_fwd,-accel);
    if(keys.q)velocity.addScaledVector(_right,-accel);if(keys.d)velocity.addScaledVector(_right,accel);
    velocity.multiplyScalar(0.88);
    let nx=camera.position.x+velocity.x,ny=camera.position.y,nz=camera.position.z+velocity.z;
    jumpVel=Math.max(jumpVel-0.016,-1.2);ny+=jumpVel;
    const res=resolveColliders(nx,ny,nz);nx=res.x;ny=res.y;nz=res.z;
    const tgy=findY(nx,nz)+PLAYER_H;
    if(ny<=tgy){if(jumpVel<=0&&!res.onTop){if(smoothGroundY===null)smoothGroundY=ny;smoothGroundY+=(tgy-smoothGroundY)*Math.min(1,0.25+(1-slope)*0.25+dt*8);ny=Math.max(smoothGroundY,tgy-0.05);}else{ny=tgy;smoothGroundY=ny;}if(jumpVel<=0){jumpVel=0;grounded=true;}}
    else if(res.onTop){smoothGroundY=ny;if(jumpVel<=0){jumpVel=0;grounded=true;}}else{smoothGroundY=null;grounded=false;}
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
    for(const[key,fd]of chunkFadeIn){
        fd.alpha=Math.min(1,fd.alpha+dt*2.2);
        fd.group.traverse(obj=>{if(!obj.isMesh)return;const mats=Array.isArray(obj.material)?obj.material:[obj.material];for(const m of mats)if(m._bOp!==undefined)m.opacity=fd.alpha*m._bOp;});
        if(fd.alpha>=1){fd.group.traverse(obj=>{if(!obj.isMesh)return;const mats=Array.isArray(obj.material)?obj.material:[obj.material];for(const m of mats)if(m._bOp!==undefined){m.opacity=m._bOp;m.transparent=m._bOp<1;}});chunkFadeIn.delete(key);}
    }
    updateDayNight(elapsed);
    if(controls.isLocked)updateMovement(dt);
    updateChunks(camera.position.x,camera.position.z);
    renderer.render(scene,camera);
}
animate();

window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

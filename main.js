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
    topColor:     { value: new THREE.Color(0x1a3a6e) },
    horizonColor: { value: new THREE.Color(0x87bcd4) },
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
/* LUMIERES                                               */
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

const moonLight = new THREE.DirectionalLight(0x3355aa, 0.0);
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

const sunSprite  = makeCircleSprite('rgba(255,255,220,1)', 'rgba(255,200,50,0.8)',  200);
const sunGlow    = makeCircleSprite('rgba(255,160,30,0.6)','rgba(255,100,0,0.2)',   500);
const moonSprite = makeCircleSprite('rgba(230,240,255,1)', 'rgba(150,170,220,0.7)', 140);
const moonGlow   = makeCircleSprite('rgba(80,100,180,0.4)','rgba(40,60,140,0.1)',   360);
scene.add(sunSprite, sunGlow, moonSprite, moonGlow);

/* ===================================================== */
/* ETOILES                                                */
/* ===================================================== */

const STAR_COUNT = 1000;
const starPositions = new Float32Array(STAR_COUNT * 3);
const starSizes     = new Float32Array(STAR_COUNT);
for (let i = 0; i < STAR_COUNT; i++) {
    const theta = 2 * Math.PI * Math.random();
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = 1600;
    starPositions[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i*3+1] = Math.abs(r * Math.cos(phi)) + 80;
    starPositions[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
    starSizes[i] = 1.5 + Math.random() * 3.5;
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
            vec4 mv = modelViewMatrix * vec4(position,1.0);
            gl_PointSize = size * (1.0 + 0.3*sin(uTime*2.0+size*13.7));
            gl_Position  = projectionMatrix * mv;
        }`,
    fragmentShader: `
        uniform float uOpacity;
        void main() {
            float d = length(gl_PointCoord - 0.5);
            if (d > 0.5) discard;
            float b = pow(1.0 - d*2.0, 1.5);
            gl_FragColor = vec4(1.0,1.0,0.95, b*uOpacity);
        }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

/* ===================================================== */
/* CYCLE JOUR/NUIT — 10 min jour, 3 min nuit             */
/* ===================================================== */

const DAY_SEC   = 600;  // 10 min
const NIGHT_SEC = 180;  // 3 min
const TOTAL_SEC = DAY_SEC + NIGHT_SEC; // 780 s

// Angle en [0, 2PI] : [0,PI] = jour (soleil monte/descend), [PI,2PI] = nuit
function getDayAngle(elapsed) {
    const t = elapsed % TOTAL_SEC;
    return t < DAY_SEC
        ? (t / DAY_SEC) * Math.PI
        : Math.PI + ((t - DAY_SEC) / NIGHT_SEC) * Math.PI;
}

const ORBIT_R = 1400;

const SKY = {
    day:    { top:new THREE.Color(0x1a3a6e), horizon:new THREE.Color(0x87bcd4), bottom:new THREE.Color(0x3d5a2a) },
    sunset: { top:new THREE.Color(0x1a1a3a), horizon:new THREE.Color(0xff7030), bottom:new THREE.Color(0x3d2a1a) },
    night:  { top:new THREE.Color(0x050812), horizon:new THREE.Color(0x0d1a2e), bottom:new THREE.Color(0x0a0f08) },
    dawn:   { top:new THREE.Color(0x1a1a3a), horizon:new THREE.Color(0xff9060), bottom:new THREE.Color(0x2a2218) },
};

function lerpSky(a, b, t) {
    skyUniforms.topColor.value.copy(a.top).lerp(b.top, t);
    skyUniforms.horizonColor.value.copy(a.horizon).lerp(b.horizon, t);
    skyUniforms.bottomColor.value.copy(a.bottom).lerp(b.bottom, t);
}

function updateDayNight(elapsed) {
    const dayAngle = getDayAngle(elapsed);
    const sinA = Math.sin(dayAngle);
    const sf  = Math.max(0, sinA);
    const mf  = Math.max(0, -sinA);
    const sfS = sf*sf*(3-2*sf);
    const mfS = mf*mf*(3-2*mf);

    const sunX = Math.cos(dayAngle)*ORBIT_R, sunY = Math.sin(dayAngle)*ORBIT_R;
    const mnX = -sunX, mnY = -sunY;
    sun.position.set(sunX, sunY, ORBIT_R*0.3);
    moonLight.position.set(mnX, mnY, ORBIT_R*0.3);

    const cp = camera.position;
    const sd = new THREE.Vector3(sunX, sunY, ORBIT_R*0.3).normalize();
    const md = new THREE.Vector3(mnX,  mnY,  ORBIT_R*0.3).normalize();
    sunSprite.position.copy(cp).addScaledVector(sd, 1350);
    sunGlow.position.copy(cp).addScaledVector(sd, 1340);
    moonSprite.position.copy(cp).addScaledVector(md, 1350);
    moonGlow.position.copy(cp).addScaledVector(md, 1340);

    sun.intensity       = sfS * 2.8;
    moonLight.intensity = 0.08 + mfS * 0.5;
    hemi.intensity      = 0.25 + sfS * 0.75;

    sunSprite.material.opacity  = Math.pow(sf, 0.4);
    sunGlow.material.opacity    = Math.pow(sf, 0.6) * 0.8;
    moonSprite.material.opacity = Math.pow(mf, 0.4);
    moonGlow.material.opacity   = Math.pow(mf, 0.6) * 0.7;

    renderer.toneMappingExposure = 0.9 + sfS * 0.5;
    scene.fog.color.lerpColors(new THREE.Color(0x030609), new THREE.Color(0x9bb4c7), sfS);

    starMat.uniforms.uOpacity.value = Math.max(0, 1 - sfS * 2.5) * 0.95;
    stars.position.copy(cp);

    // Phases ciel proportionnelles à l'angle
    const a = dayAngle; // [0, 2PI]
    if      (a < Math.PI * 0.08)  lerpSky(SKY.night,  SKY.dawn,   a / (Math.PI * 0.08));
    else if (a < Math.PI * 0.85)  lerpSky(SKY.dawn,   SKY.day,    Math.min((a - Math.PI*0.08) / (Math.PI*0.77), 1));
    else if (a < Math.PI)         lerpSky(SKY.day,    SKY.sunset, (a - Math.PI*0.85) / (Math.PI*0.15));
    else if (a < Math.PI * 1.15)  lerpSky(SKY.sunset, SKY.night,  (a - Math.PI)      / (Math.PI*0.15));
    else {
        skyUniforms.topColor.value.copy(SKY.night.top);
        skyUniforms.horizonColor.value.copy(SKY.night.horizon);
        skyUniforms.bottomColor.value.copy(SKY.night.bottom);
    }
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
        s = (s*1664525+1013904223)&0xffffffff;
        const j=(s>>>24)%(i+1); [p[i],p[j]]=[p[j],p[i]];
    }
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i]=p[i&255];
    return perm;
}
const perm = buildPerm(SEED);
const GRAD = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];

function simplex2(xin,yin) {
    const F2=0.5*(Math.sqrt(3)-1), G2=(3-Math.sqrt(3))/6;
    const s=(xin+yin)*F2, i=Math.floor(xin+s)|0, j=Math.floor(yin+s)|0;
    const t=(i+j)*G2, x0=xin-(i-t), y0=yin-(j-t);
    const i1=x0>y0?1:0, j1=x0>y0?0:1;
    const x1=x0-i1+G2, y1=y0-j1+G2, x2=x0-1+2*G2, y2=y0-1+2*G2;
    const ii=i&255, jj=j&255;
    const g0=perm[ii+perm[jj]]%8, g1=perm[ii+i1+perm[jj+j1]]%8, g2=perm[ii+1+perm[jj+1]]%8;
    let n0=0,n1=0,n2=0;
    let t0=0.5-x0*x0-y0*y0; if(t0>=0){t0*=t0;n0=t0*t0*(GRAD[g0][0]*x0+GRAD[g0][1]*y0);}
    let t1=0.5-x1*x1-y1*y1; if(t1>=0){t1*=t1;n1=t1*t1*(GRAD[g1][0]*x1+GRAD[g1][1]*y1);}
    let t2=0.5-x2*x2-y2*y2; if(t2>=0){t2*=t2;n2=t2*t2*(GRAD[g2][0]*x2+GRAD[g2][1]*y2);}
    return 70*(n0+n1+n2);
}

function fbm(x,z) {
    return simplex2(x*0.002,z*0.002)*14
         + simplex2(x*0.008,z*0.008)*5
         + simplex2(x*0.025,z*0.025)*1.5;
}

/* ===================================================== */
/* HEIGHTMAP                                              */
/* ===================================================== */

const HSTEP = 0.5;
const hCache = new Map();

function heightAt(wx,wz) {
    const kx=Math.round(wx/HSTEP)|0, kz=Math.round(wz/HSTEP)|0;
    const key=kx*100003+kz;
    let h=hCache.get(key);
    if(h===undefined){h=fbm(wx,wz);hCache.set(key,h);}
    return h;
}

function findY(wx,wz) {
    const x0=Math.floor(wx/HSTEP)*HSTEP, z0=Math.floor(wz/HSTEP)*HSTEP;
    const fu=(wx-x0)/HSTEP, fv=(wz-z0)/HSTEP;
    return heightAt(x0,z0)*(1-fu)*(1-fv)
         + heightAt(x0+HSTEP,z0)*fu*(1-fv)
         + heightAt(x0,z0+HSTEP)*(1-fu)*fv
         + heightAt(x0+HSTEP,z0+HSTEP)*fu*fv;
}

/* ===================================================== */
/* MATERIAUX & GEOMETRIES PARTAGES                        */
/* ===================================================== */

const MAT = {
    trunk:  new THREE.MeshStandardMaterial({color:0x2a1a0e}),
    cone0:  new THREE.MeshStandardMaterial({color:0x0f240f}),
    cone1:  new THREE.MeshStandardMaterial({color:0x163016}),
    cone2:  new THREE.MeshStandardMaterial({color:0x1c3d1c}),
    rock:   new THREE.MeshStandardMaterial({color:0x666666,roughness:1}),
    ground: new THREE.MeshStandardMaterial({color:0x243b1d,roughness:1}),
    stem:   new THREE.MeshStandardMaterial({color:0x2d4c1e}),
    grass:  new THREE.MeshStandardMaterial({color:0x3f6b2d}),
    ff:     new THREE.MeshBasicMaterial({color:0xffffaa}),
};
const CONE_MATS     = [MAT.cone0,MAT.cone1,MAT.cone2];
const FLOWER_COLORS = [0xff4444,0x4444ff,0xffff55,0xffffff,0xff66cc];
const flowerMatsCache = {};
function flowerMat(hex) {
    if(!flowerMatsCache[hex])
        flowerMatsCache[hex]=new THREE.MeshStandardMaterial({color:hex,emissive:hex,emissiveIntensity:0.1});
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
    let s=(seed^0xdeadbeef)|0;
    return ()=>{
        s=Math.imul(s^(s>>>16),0x45d9f3b);
        s=Math.imul(s^(s>>>16),0x45d9f3b);
        s^=s>>>16;
        return(s>>>0)/0xffffffff;
    };
}

function generateChunk(cx,cz) {
    const key=cx+','+cz;
    if(loadedChunks.has(key)) return;
    loadedChunks.set(key,null);
    requestAnimationFrame(()=>_buildChunk(cx,cz,key));
}

function _buildChunk(cx,cz,key) {
    if(!loadedChunks.has(key)) return;

    const originX=cx*CHUNK_SIZE, originZ=cz*CHUNK_SIZE;
    const rng=seededRng(cx*73856093^cz*19349663);
    const group=new THREE.Group();
    const localColliders=[];

    /* Terrain */
    const geo=new THREE.PlaneGeometry(CHUNK_SIZE,CHUNK_SIZE,CHUNK_SEGS,CHUNK_SEGS);
    const vp=geo.attributes.position.array;
    for(let i=0;i<vp.length;i+=3) vp[i+2]=fbm(originX+vp[i],originZ-vp[i+1]);
    geo.computeVertexNormals();
    const terrain=new THREE.Mesh(geo,MAT.ground);
    terrain.rotation.x=-Math.PI/2;
    terrain.position.set(originX,0,originZ);
    terrain.receiveShadow=true;
    group.add(terrain);

    /* ----------------------------------------------- */
    /* ARBRES — taille realiste, feuillage haut          */
    /* Tronc visible sur ~60%, feuillage demarre a 65%  */
    /* du tronc = bien au-dessus du sol                 */
    /* ----------------------------------------------- */
    const treeCount=4+(rng()*6|0);
    for(let i=0;i<treeCount;i++) {
        const wx=originX+(rng()-0.5)*CHUNK_SIZE*0.88;
        const wz=originZ+(rng()-0.5)*CHUNK_SIZE*0.88;
        const gy=findY(wx,wz);

        const h       = 32 + rng()*24;     // 32-56 unites de haut
        const tr      = 0.45 + rng()*0.45; // rayon tronc
        const trunkH  = h * 0.60;          // tronc = 60% hauteur totale
        // Feuillage demarre a 65% du tronc (bien visible au-dessus du sol)
        const foliageStart = trunkH * 0.65;

        const tg=new THREE.Group();

        /* Tronc fin et haut */
        const trunk=new THREE.Mesh(
            new THREE.CylinderGeometry(tr*0.3, tr*0.9, trunkH, 7),
            MAT.trunk
        );
        trunk.position.y = trunkH / 2;
        trunk.castShadow = true;
        tg.add(trunk);

        /* Cônes — uniquement dans la moitie haute */
        const layers = 8 + (rng()*5|0);
        const foliageH = h - foliageStart;
        for(let li=0;li<layers;li++) {
            const ratio  = li / (layers-1);
            const coneY  = foliageStart + ratio * foliageH;
            const radius = tr * 8.5 * (1 - ratio * 0.80) + 1.5;
            const coneH  = (foliageH / layers) * 2.2;
            const cone   = new THREE.Mesh(
                new THREE.ConeGeometry(radius, coneH, 8),
                CONE_MATS[(rng()*3)|0]
            );
            cone.position.y = coneY;
            cone.castShadow = true;
            tg.add(cone);
            windObjects.push({mesh:cone, phase:rng()*10, speed:0.4+rng()*0.3, amp:0.010});
        }

        tg.position.set(wx, gy, wz);
        group.add(tg);
        localColliders.push({type:'cylinder', x:wx, y:gy, z:wz, r:tr*1.3, h:trunkH});
    }

    /* ----------------------------------------------- */
    /* ROCHERS — collider precis pour marcher dessus    */
    /* ----------------------------------------------- */
    const rockCount=2+(rng()*5|0);
    for(let i=0;i<rockCount;i++) {
        const wx=originX+(rng()-0.5)*CHUNK_SIZE*0.88;
        const wz=originZ+(rng()-0.5)*CHUNK_SIZE*0.88;
        const gy=findY(wx,wz);
        const sx=0.9+rng()*2.2, sy=sx*(0.55+rng()*0.30), sz=0.9+rng()*2.2;

        const rock=new THREE.Mesh(GEO.rock,MAT.rock);
        rock.scale.set(sx,sy,sz);
        rock.rotation.set(rng()*Math.PI,rng()*Math.PI,rng()*Math.PI);
        const centerY = gy + sy * 0.5;
        rock.position.set(wx, centerY, wz);
        rock.castShadow = rock.receiveShadow = true;
        group.add(rock);

        // Stocker toutes les dimensions utiles pour la collision
        localColliders.push({
            type:  'rock',
            x: wx, z: wz,
            baseY: gy,
            topY:  gy + sy,      // surface marchable = haut du rocher
            hw:    sx * 0.78,    // demi-largeur (un peu plus petit que la geo)
            hd:    sz * 0.78,
            rx:    sx * 0.82,    // rayon ellipse XZ pour detection laterale
            rz:    sz * 0.82,
        });
    }

    /* Fleurs */
    const flowerCount=20+(rng()*40|0);
    for(let i=0;i<flowerCount;i++) {
        const wx=originX+(rng()-0.5)*CHUNK_SIZE*0.9;
        const wz=originZ+(rng()-0.5)*CHUNK_SIZE*0.9;
        const gy=findY(wx,wz);
        const stem=new THREE.Mesh(GEO.stem,MAT.stem);
        stem.position.set(wx,gy+0.4,wz);
        group.add(stem);
        const fc=FLOWER_COLORS[(rng()*FLOWER_COLORS.length)|0];
        const head=new THREE.Mesh(GEO.flower,flowerMat(fc));
        head.position.set(wx,gy+0.9,wz);
        group.add(head);
    }

    /* Herbe */
    const grassCount=40+(rng()*50|0);
    const gMesh=new THREE.InstancedMesh(GEO.grass,MAT.grass,grassCount);
    gMesh.frustumCulled=false;
    const dummy=new THREE.Object3D();
    for(let i=0;i<grassCount;i++) {
        const wx2=originX+(rng()-0.5)*CHUNK_SIZE;
        const wz2=originZ+(rng()-0.5)*CHUNK_SIZE;
        dummy.position.set(wx2,findY(wx2,wz2)+0.25,wz2);
        dummy.scale.setScalar(0.5+rng()*0.8);
        dummy.rotation.y=rng()*Math.PI;
        dummy.updateMatrix();
        gMesh.setMatrixAt(i,dummy.matrix);
    }
    gMesh.instanceMatrix.needsUpdate=true;
    group.add(gMesh);

    /* Lucioles */
    const ffCount=2+(rng()*5|0);
    for(let i=0;i<ffCount;i++) {
        const wx2=originX+(rng()-0.5)*CHUNK_SIZE*0.88;
        const wz2=originZ+(rng()-0.5)*CHUNK_SIZE*0.88;
        const fy=findY(wx2,wz2)+2+rng()*4;
        const m=new THREE.Mesh(GEO.ff,MAT.ff);
        m.position.set(wx2,fy,wz2);
        group.add(m);
        fireflyData.push({mesh:m,baseY:fy,phase:rng()*10});
    }

    /* Fade-in */
    group.traverse(obj=>{
        if(!obj.isMesh) return;
        const mats=Array.isArray(obj.material)?obj.material:[obj.material];
        const cloned=mats.map(m=>{
            const c=m.clone();
            c._baseOpacity=c.opacity??1;
            c.transparent=true; c.opacity=0;
            return c;
        });
        obj.material=Array.isArray(obj.material)?cloned:cloned[0];
    });

    globalColliders.push(...localColliders);
    scene.add(group);
    loadedChunks.set(key,{group,localColliders});
    chunkFadeIn.set(key,{group,alpha:0});
}

function unloadChunk(cx,cz) {
    const key=cx+','+cz;
    const data=loadedChunks.get(key);
    if(!data){loadedChunks.delete(key);return;}

    scene.remove(data.group);
    data.group.traverse(obj=>{
        if(!obj.isMesh) return;
        if(obj.geometry&&obj.geometry!==GEO.grass&&obj.geometry!==GEO.ff&&
           obj.geometry!==GEO.stem&&obj.geometry!==GEO.flower&&obj.geometry!==GEO.rock)
            obj.geometry.dispose();
        if(obj.material?._baseOpacity!==undefined){
            const mats=Array.isArray(obj.material)?obj.material:[obj.material];
            mats.forEach(m=>m.dispose());
        }
    });
    for(const c of data.localColliders){
        const idx=globalColliders.indexOf(c);
        if(idx!==-1) globalColliders.splice(idx,1);
    }
    data.group.traverse(obj=>{
        let fi=fireflyData.findIndex(f=>f.mesh===obj); if(fi!==-1) fireflyData.splice(fi,1);
        let wi=windObjects.findIndex(w=>w.mesh===obj); if(wi!==-1) windObjects.splice(wi,1);
    });
    loadedChunks.delete(key);
    chunkFadeIn.delete(key);
}

let lastCX=Infinity, lastCZ=Infinity;

function updateChunks(px,pz) {
    const cx=Math.round(px/CHUNK_SIZE), cz=Math.round(pz/CHUNK_SIZE);
    if(cx===lastCX&&cz===lastCZ) return;
    lastCX=cx; lastCZ=cz;
    for(let dx=-CHUNK_RADIUS;dx<=CHUNK_RADIUS;dx++)
        for(let dz=-CHUNK_RADIUS;dz<=CHUNK_RADIUS;dz++)
            generateChunk(cx+dx,cz+dz);
    for(const [key] of loadedChunks){
        const [kcx,kcz]=key.split(',').map(Number);
        if(Math.abs(kcx-cx)>CHUNK_RADIUS+1||Math.abs(kcz-cz)>CHUNK_RADIUS+1)
            unloadChunk(kcx,kcz);
    }
}

/* ===================================================== */
/* PHYSIQUE — rochers : sauter dessus et rester          */
/* ===================================================== */

const PLAYER_R = 0.4;
const PLAYER_H = 1.8;

function resolveColliders(nx, ny, nz) {
    let onTop    = false;
    let surfaceY = -Infinity;

    for(const c of globalColliders) {

        /* ---- CYLINDRE (troncs) ---- */
        if(c.type==='cylinder') {
            const dx=nx-c.x, dz=nz-c.z;
            const dXZ=Math.sqrt(dx*dx+dz*dz);
            const cTop=c.y+c.h, pBot=ny-PLAYER_H;
            if(dXZ < c.r+PLAYER_R && ny > c.y && pBot < cTop) {
                if(pBot >= cTop-0.7) {
                    ny=cTop+PLAYER_H; onTop=true;
                    surfaceY=Math.max(surfaceY,cTop);
                } else {
                    const a=Math.atan2(dz,dx);
                    nx=c.x+Math.cos(a)*(c.r+PLAYER_R);
                    nz=c.z+Math.sin(a)*(c.r+PLAYER_R);
                }
            }

        /* ---- ROCHER ---- */
        } else if(c.type==='rock') {
            const dx = nx - c.x;
            const dz = nz - c.z;

            // Rejet rapide AABB elargie
            if(Math.abs(dx) > c.hw + PLAYER_R + 0.3) continue;
            if(Math.abs(dz) > c.hd + PLAYER_R + 0.3) continue;

            const pBot = ny - PLAYER_H;

            // Test ellipse XZ : le joueur est-il dans l'emprise horizontale ?
            const ex = dx / (c.rx + PLAYER_R);
            const ez = dz / (c.rz + PLAYER_R);
            const inXZ = (ex*ex + ez*ez) < 1.0;

            if(!inXZ) continue;

            // Joueur sous le sol du rocher → on ignore
            if(ny < c.baseY - PLAYER_H) continue;

            // Atterrissage sur le dessus : pBot proche ou au-dessus du topY
            const LAND_MARGIN = 1.1; // tolerance en unites world
            if(pBot >= c.topY - LAND_MARGIN) {
                // Le joueur vient d'en haut → poser sur le dessus
                const desiredY = c.topY + PLAYER_H;
                if(ny <= desiredY + 0.1) {
                    ny       = desiredY;
                    onTop    = true;
                    surfaceY = Math.max(surfaceY, c.topY);
                }
            } else {
                // Collision laterale : push minimal XZ
                // Calculer l'overlap de chaque cote de la AABB
                const olXpos = (c.hw + PLAYER_R) - dx;
                const olXneg = dx + (c.hw + PLAYER_R);
                const olZpos = (c.hd + PLAYER_R) - dz;
                const olZneg = dz + (c.hd + PLAYER_R);
                const minOl  = Math.min(olXpos, olXneg, olZpos, olZneg);

                if     (minOl === olXpos && olXpos > 0) nx = c.x + c.hw + PLAYER_R;
                else if(minOl === olXneg && olXneg > 0) nx = c.x - c.hw - PLAYER_R;
                else if(minOl === olZpos && olZpos > 0) nz = c.z + c.hd + PLAYER_R;
                else if(minOl === olZneg && olZneg > 0) nz = c.z - c.hd - PLAYER_R;
            }
        }
    }

    return {x:nx, y:ny, z:nz, onTop, surfaceY};
}

/* ===================================================== */
/* CONTROLS                                               */
/* ===================================================== */

const controls=new PointerLockControls(camera,document.body);
document.body.addEventListener('click',()=>controls.lock());

const velocity=new THREE.Vector3();
const keys={z:false,s:false,q:false,d:false,shift:false};
let jumpVel=0, grounded=true, stamina=100;
let camY=10;

addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();
    if(k in keys) keys[k]=true;
    if(e.shiftKey) keys.shift=true;
    if(e.code==='Space'&&grounded){grounded=false;jumpVel=0.30;}
});
addEventListener('keyup',e=>{
    const k=e.key.toLowerCase();
    if(k in keys) keys[k]=false;
    if(!e.shiftKey) keys.shift=false;
});

/* ===================================================== */
/* MOUVEMENT                                              */
/* ===================================================== */

const _fwd=new THREE.Vector3(), _right=new THREE.Vector3();

function updateMovement(dt) {
    const moving=keys.z||keys.s||keys.q||keys.d;
    const running=keys.shift&&stamina>0&&moving;
    stamina=running?Math.max(0,stamina-0.45):Math.min(100,stamina+0.2);
    document.getElementById('sp').style.width=stamina+'%';

    _fwd.set(0,0,-1).applyQuaternion(camera.quaternion);
    _right.set(1,0,0).applyQuaternion(camera.quaternion);
    _fwd.y=0; _right.y=0; _fwd.normalize(); _right.normalize();

    const accel=running?0.055:0.028;
    if(keys.z) velocity.addScaledVector(_fwd,    accel);
    if(keys.s) velocity.addScaledVector(_fwd,   -accel);
    if(keys.q) velocity.addScaledVector(_right, -accel);
    if(keys.d) velocity.addScaledVector(_right,  accel);
    velocity.multiplyScalar(0.88);

    let nx=camera.position.x+velocity.x;
    let nz=camera.position.z+velocity.z;

    // Gravite
    jumpVel=Math.max(jumpVel-0.016,-1.2);
    let ny=camera.position.y+jumpVel;

    // Colliders
    const res=resolveColliders(nx, ny, nz);
    nx=res.x; ny=res.y; nz=res.z;

    // Sol terrain
    const terrainY=findY(nx,nz)+PLAYER_H;

    if(res.onTop) {
        // Sur un rocher/tronc
        const tY = res.surfaceY + PLAYER_H;
        if(jumpVel <= 0) {
            // Lissage Y pour eviter snap brutal
            const diff = tY - camY;
            const speed = diff < 0 ? 20 : 12;
            camY += Math.sign(diff) * Math.min(Math.abs(diff), speed*dt);
            ny = Math.max(camY, tY);
            camY = ny;
            jumpVel = 0; grounded = true;
        } else {
            camY = ny; // en l'air au-dessus → ne pas corriger
        }
    } else if(ny <= terrainY) {
        // Sol terrain
        if(jumpVel <= 0) {
            const diff = terrainY - camY;
            const speed = diff < 0 ? 20 : 12;
            camY += Math.sign(diff) * Math.min(Math.abs(diff), speed*dt);
            ny = Math.max(camY, terrainY);
            camY = ny;
            jumpVel = 0; grounded = true;
        } else {
            ny = terrainY; camY = ny; jumpVel = 0; grounded = true;
        }
    } else {
        // En l'air
        camY = ny;
        grounded = false;
    }

    camera.position.set(nx, ny, nz);
    skyMesh.position.copy(camera.position);
}

/* ===================================================== */
/* BOUCLE PRINCIPALE                                      */
/* ===================================================== */

const clock=new THREE.Clock();
// Commence en matin (quart du jour = dayAngle~PI/4, soleil qui monte)
let elapsed = DAY_SEC * 0.15;

camY = findY(0,0) + PLAYER_H;
camera.position.y = camY;

updateChunks(0,0);

function animate() {
    requestAnimationFrame(animate);
    const dt=Math.min(clock.getDelta(),0.05);
    elapsed+=dt;

    const t=elapsed;
    for(const w of windObjects) w.mesh.rotation.z=Math.sin(t*w.speed+w.phase)*w.amp;
    for(const f of fireflyData){
        f.mesh.position.y=f.baseY+Math.sin(t+f.phase)*0.5;
        f.mesh.position.x+=Math.cos(t*0.3+f.phase)*0.008;
    }

    starMat.uniforms.uTime.value=elapsed;

    for(const [key,fd] of chunkFadeIn) {
        fd.alpha=Math.min(1,fd.alpha+dt*2.2);
        fd.group.traverse(obj=>{
            if(!obj.isMesh) return;
            const mats=Array.isArray(obj.material)?obj.material:[obj.material];
            for(const m of mats) if(m._baseOpacity!==undefined) m.opacity=fd.alpha*m._baseOpacity;
        });
        if(fd.alpha>=1){
            fd.group.traverse(obj=>{
                if(!obj.isMesh) return;
                const mats=Array.isArray(obj.material)?obj.material:[obj.material];
                for(const m of mats) if(m._baseOpacity!==undefined){m.opacity=m._baseOpacity;m.transparent=m._baseOpacity<1;}
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

window.addEventListener('resize',()=>{
    camera.aspect=window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth,window.innerHeight);
});

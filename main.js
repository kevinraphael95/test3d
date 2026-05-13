import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';
import { mergeGeometries } from 'https://unpkg.com/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js';

/* ===================================================== */
/* HEIGHTMAP — formule directe, zéro raycast             */
/* ===================================================== */

function findY(x, z) {
    return Math.sin(x * 0.025) * 8
         + Math.cos(z * 0.020) * 6
         + Math.sin((x + z) * 0.01) * 12;
}

/* ===================================================== */
/* SCENE                                                  */
/* ===================================================== */

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xc8d8e8, 0.003);

/* ===================================================== */
/* SKYBOX shader Skyrim                                   */
/* ===================================================== */

const SUN_DIR = new THREE.Vector3(0.45, 0.35, -0.82).normalize();

scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(2400, 20, 12),
    new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
            sunDir:    { value: SUN_DIR },
            sunColor:  { value: new THREE.Color(0xfffbe0) },
        },
        vertexShader: `
            varying vec3 vDir;
            void main(){
                vDir = normalize((modelMatrix * vec4(position,1.0)).xyz);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 sunDir, sunColor;
            varying vec3 vDir;
            void main(){
                float h = vDir.y;
                vec3 top  = vec3(0.10,0.24,0.44);
                vec3 mid  = vec3(0.42,0.68,0.84);
                vec3 horiz= vec3(0.83,0.91,0.96);
                vec3 sky  = mix(horiz, mid,  smoothstep(0.0,0.22,h));
                sky       = mix(sky,   top,  smoothstep(0.18,0.75,h));
                sky       = mix(vec3(0.07,0.05,0.03), sky, smoothstep(-0.04,0.01,h));
                float d   = dot(normalize(vDir), normalize(sunDir));
                sky += sunColor * smoothstep(0.9992,1.00,d);
                sky += sunColor * smoothstep(0.994,0.999,d)*0.45;
                sky += sunColor * smoothstep(0.97,0.994,d)*0.08;
                gl_FragColor = vec4(sky,1.0);
            }
        `
    })
));

/* ===================================================== */
/* CAMERA                                                 */
/* ===================================================== */

const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 1400);
camera.position.set(0, findY(0,0)+1.8, 0);

/* ===================================================== */
/* RENDERER                                               */
/* ===================================================== */

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

/* ===================================================== */
/* LUMIERES                                               */
/* ===================================================== */

scene.add(new THREE.HemisphereLight(0xc8ddf5, 0x2a3d1a, 1.3));
const sun = new THREE.DirectionalLight(0xfff5d0, 2.0);
sun.position.copy(SUN_DIR).multiplyScalar(300);
scene.add(sun);

/* ===================================================== */
/* TERRAIN                                                */
/* ===================================================== */

const groundGeo = new THREE.PlaneGeometry(1200, 1200, 80, 80);
const gpos = groundGeo.attributes.position.array;
for (let i = 0; i < gpos.length; i += 3) {
    gpos[i+2] = findY(gpos[i], gpos[i+1]);
}
groundGeo.computeVertexNormals();
const ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshLambertMaterial({ color: 0x243b1d })
);
ground.rotation.x = -Math.PI/2;
scene.add(ground);

/* ===================================================== */
/* PHYSIQUE 3D — capsule + sphères statiques + grid       */
/* ===================================================== */

const PLAYER_R = 0.5, PLAYER_H = 1.8;
const GRAVITY = -18, JUMP_VEL = 7;
const playerVel = new THREE.Vector3();
let grounded = false;

const staticSpheres = [];
const CELL = 20;
const grid = new Map();

function gkey(x, z) { return `${Math.floor(x/CELL)},${Math.floor(z/CELL)}`; }

function addSphere(cx, cy, cz, r) {
    const idx = staticSpheres.length;
    staticSpheres.push({cx,cy,cz,r});
    const cells = new Set();
    for(let a=-1;a<=1;a++) for(let b=-1;b<=1;b++) cells.add(gkey(cx+a*r,cz+b*r));
    for(const k of cells){ if(!grid.has(k)) grid.set(k,[]); grid.get(k).push(idx); }
}

function resolveVsSphere(s) {
    const cy_lo = camera.position.y - PLAYER_H + PLAYER_R;
    const cy_hi = camera.position.y - PLAYER_R;
    const ccy   = Math.max(cy_lo, Math.min(cy_hi, s.cy));
    const dx=camera.position.x-s.cx, dy=camera.position.y-ccy, dz=camera.position.z-s.cz;
    const d2=dx*dx+dy*dy+dz*dz, mn=s.r+PLAYER_R;
    if(d2>=mn*mn) return;
    const d=Math.sqrt(d2)||0.001, pen=mn-d;
    camera.position.x+=dx/d*pen; camera.position.z+=dz/d*pen;
    const vd=playerVel.x*(dx/d)+playerVel.z*(dz/d);
    if(vd<0){ playerVel.x-=vd*(dx/d); playerVel.z-=vd*(dz/d); }
}

/* ===================================================== */
/* GRASS — instanced                                      */
/* ===================================================== */

const GRASS_N = 1500;
const gMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.02,0.05,1.0,3,1),
    new THREE.MeshLambertMaterial({color:0x3f6b2d}),
    GRASS_N
);
scene.add(gMesh);
{
    const d=new THREE.Object3D();
    for(let i=0;i<GRASS_N;i++){
        const gx=(Math.random()-.5)*800, gz=(Math.random()-.5)*800;
        d.position.set(gx, findY(gx,gz)+0.4, gz);
        d.scale.setScalar(0.5+Math.random()*1.4);
        d.rotation.y=Math.random()*Math.PI;
        d.updateMatrix();
        gMesh.setMatrixAt(i,d.matrix);
    }
    gMesh.instanceMatrix.needsUpdate=true;
}

/* ===================================================== */
/* FLEURS — instanced heads + merged stems + scent lines  */
/* ===================================================== */

const FCOLS = [0xff4444,0x4466ff,0xffff55,0xdddddd,0xff66cc];
const FLOWER_N = 350;
const SEG = 6;
const WIND = new THREE.Vector2(1.0,0.3).normalize().multiplyScalar(1.2);

// Instanced mesh par couleur
const fMeshes = FCOLS.map(c => {
    const m = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.12,5,4),
        new THREE.MeshLambertMaterial({color:c,emissive:c,emissiveIntensity:0.15}),
        Math.ceil(FLOWER_N/FCOLS.length)+2
    );
    m.frustumCulled=true;
    scene.add(m);
    return m;
});

const scentLines = [];
const stemGeos   = [];
const stemMat    = new THREE.MeshLambertMaterial({color:0x2d4c1e});
const fcounters  = new Array(FCOLS.length).fill(0);
const fDummy     = new THREE.Object3D();

for(let i=0;i<FLOWER_N;i++){
    const fx=(Math.random()-.5)*700, fz=(Math.random()-.5)*700;
    const fy=findY(fx,fz);
    const ci=Math.random()*FCOLS.length|0;

    // Tête
    fDummy.position.set(fx, fy+0.8, fz); fDummy.updateMatrix();
    fMeshes[ci].setMatrixAt(fcounters[ci]++, fDummy.matrix);

    // Tige (merge plus tard)
    const sg=new THREE.CylinderGeometry(0.02,0.03,0.7,4,1);
    sg.translate(fx,fy+0.35,fz);
    stemGeos.push(sg);

    // 1 ligne d'odeur par fleur
    const pts=[]; for(let s=0;s<=SEG;s++) pts.push(new THREE.Vector3());
    const geo=new THREE.BufferGeometry().setFromPoints(pts);
    const line=new THREE.Line(geo, new THREE.LineBasicMaterial({
        color:FCOLS[ci], transparent:true, opacity:0.0,
        depthWrite:false, blending:THREE.AdditiveBlending
    }));
    scene.add(line);
    scentLines.push({
        line, geo,
        bx:fx, by:fy+0.85, bz:fz,
        phase:Math.random()*Math.PI*2,
        speed:0.3+Math.random()*0.5,
        dx:(Math.random()-.5)*0.9,
        dz:(Math.random()-.5)*0.3,
        off:Math.random()*3
    });
}

fMeshes.forEach((m,i)=>{ m.count=fcounters[i]; m.instanceMatrix.needsUpdate=true; });

// Merge tiges
const mergedStems = mergeGeometries(stemGeos, false);
if(mergedStems) scene.add(new THREE.Mesh(mergedStems, stemMat));
stemGeos.forEach(g=>g.dispose());

/* ===================================================== */
/* ROCHERS — instanced                                    */
/* ===================================================== */

const ROCK_N = 80;
const rMesh = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1,0),
    new THREE.MeshLambertMaterial({color:0x666666}),
    ROCK_N
);
rMesh.frustumCulled=true;
scene.add(rMesh);
{
    const d=new THREE.Object3D();
    for(let i=0;i<ROCK_N;i++){
        const rx=(Math.random()-.5)*800, rz=(Math.random()-.5)*800;
        const ry=findY(rx,rz);
        const s=0.8+Math.random()*1.8;
        d.position.set(rx,ry+s*0.3,rz);
        d.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
        d.scale.set(s,s*0.6,s);
        d.updateMatrix();
        rMesh.setMatrixAt(i,d.matrix);
        addSphere(rx,ry+s*0.3,rz,s*0.9);
    }
    rMesh.instanceMatrix.needsUpdate=true;
}

/* ===================================================== */
/* ARBRES — tout merged (1 draw call par matière)         */
/* ===================================================== */

const TREE_N   = 100;
const trunkGs  = [], rootGs = [], leafGs = [[],[],[]];

for(let i=0;i<TREE_N;i++){
    const tx=(Math.random()-.5)*900, tz=(Math.random()-.5)*900;
    const ty=findY(tx,tz);
    const h=18+Math.random()*18, tr=1+Math.random()*0.6;

    // Tronc prolongé -10 sous le sol
    const tg=new THREE.CylinderGeometry(tr*0.55,tr*1.1,h+10,6,1);
    tg.translate(tx, ty+h/2-5, tz);
    trunkGs.push(tg);

    // Racines — pivotent de la base vers le bas
    for(let r=0;r<5;r++){
        const ang=(Math.PI*2/5)*r;
        const rLen=2.0+Math.random()*1.2, rT=0.10+Math.random()*0.07;
        const rg=new THREE.CylinderGeometry(rT*0.3,rT,rLen,4,1);
        // Incline vers le bas (>PI/2 = sous horizontal)
        rg.rotateX(0);
        rg.rotateZ(Math.PI/2 + 0.85 + Math.random()*0.3);
        rg.rotateY(ang);
        // Translation au pied du tronc + décalage vers bas
        rg.translate(
            tx + Math.cos(ang)*tr*0.8,
            ty - rLen*0.5 + 0.2,
            tz + Math.sin(ang)*tr*0.8
        );
        rootGs.push(rg);
    }

    // Feuillage
    const layers=5+(Math.random()*3|0);
    for(let l=0;l<layers;l++){
        const ratio=l/layers;
        const size=(1-ratio)*(tr*6)+1.5;
        const ci=Math.random()*3|0;
        const cg=new THREE.ConeGeometry(size,6,7,1);
        cg.translate(tx, ty+h*0.28+ratio*h*0.75, tz);
        leafGs[ci].push(cg);
    }

    addSphere(tx,ty+5, tz,tr+1.0);
    addSphere(tx,ty+13,tz,tr+0.7);
}

const tMat  = new THREE.MeshLambertMaterial({color:0x1a0f0a});
const rMat  = new THREE.MeshLambertMaterial({color:0x22150f});
const lMats = [0x0f240f,0x163016,0x1c3d1c].map(c=>new THREE.MeshLambertMaterial({color:c}));

function mergeAdd(geos,mat){
    if(!geos.length) return;
    const m=mergeGeometries(geos,false);
    if(m) scene.add(new THREE.Mesh(m,mat));
    geos.forEach(g=>g.dispose());
}
mergeAdd(trunkGs, tMat);
mergeAdd(rootGs,  rMat);
for(let i=0;i<3;i++) mergeAdd(leafGs[i], lMats[i]);

/* ===================================================== */
/* LUCIOLES — 20 max                                     */
/* ===================================================== */

const fireflies=[];
for(let i=0;i<20;i++){
    const light=new THREE.PointLight(0xffffaa,0.5,10);
    const fx=(Math.random()-.5)*600, fz=(Math.random()-.5)*600;
    const fy=findY(fx,fz)+2+Math.random()*4;
    light.position.set(fx,fy,fz);
    scene.add(light);
    fireflies.push({light,bx:fx,bz:fz,by:fy,phase:Math.random()*10});
}

/* ===================================================== */
/* CONTROLS                                               */
/* ===================================================== */

const controls=new PointerLockControls(camera,document.body);
document.body.addEventListener('click',()=>controls.lock());

const keys={z:false,s:false,q:false,d:false,shift:false};
let stamina=100;

addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();
    if(k in keys) keys[k]=true;
    if(e.shiftKey) keys.shift=true;
    if(e.code==='Space'&&grounded){ playerVel.y=JUMP_VEL; grounded=false; }
});
addEventListener('keyup',e=>{
    const k=e.key.toLowerCase();
    if(k in keys) keys[k]=false;
    if(!e.shiftKey) keys.shift=false;
});

/* ===================================================== */
/* PHYSIQUE                                               */
/* ===================================================== */

const _fwd=new THREE.Vector3(), _right=new THREE.Vector3();
const ACCEL=28, DRAG=8;
let lastTime=performance.now();

function physicsStep(dt){
    const run=keys.shift&&stamina>0&&keys.z;
    stamina=run?Math.max(0,stamina-45*dt):Math.min(100,stamina+20*dt);
    document.getElementById('sp').style.width=stamina+'%';

    _fwd.set(0,0,-1).applyQuaternion(camera.quaternion); _fwd.y=0; _fwd.normalize();
    _right.set(1,0,0).applyQuaternion(camera.quaternion); _right.y=0; _right.normalize();

    const spd=ACCEL*(run?1.8:1);
    if(keys.z){playerVel.x+=_fwd.x*spd*dt; playerVel.z+=_fwd.z*spd*dt;}
    if(keys.s){playerVel.x-=_fwd.x*spd*dt; playerVel.z-=_fwd.z*spd*dt;}
    if(keys.q){playerVel.x-=_right.x*spd*dt; playerVel.z-=_right.z*spd*dt;}
    if(keys.d){playerVel.x+=_right.x*spd*dt; playerVel.z+=_right.z*spd*dt;}

    playerVel.x*=Math.exp(-DRAG*dt);
    playerVel.z*=Math.exp(-DRAG*dt);
    if(!grounded) playerVel.y+=GRAVITY*dt;

    camera.position.addScaledVector(playerVel,dt);

    const near=grid.get(gkey(camera.position.x,camera.position.z))||[];
    for(const idx of near) resolveVsSphere(staticSpheres[idx]);

    const gy=findY(camera.position.x,camera.position.z)+PLAYER_H;
    if(camera.position.y<=gy){
        camera.position.y=gy;
        if(playerVel.y<0) playerVel.y=0;
        grounded=true;
    } else { grounded=false; }
}

/* ===================================================== */
/* SCENT LINES                                            */
/* ===================================================== */

function updateScent(t){
    for(const s of scentLines){
        const pts=s.geo.attributes.position;
        const age=t*s.speed+s.off;
        for(let i=0;i<=SEG;i++){
            const r=i/SEG;
            pts.setXYZ(i,
                s.bx + WIND.x*r*2.0 + s.dx*r + Math.sin(age+r*2.8)*0.22,
                s.by + r*1.8        + Math.sin(age*1.1+r*1.6)*0.13,
                s.bz + WIND.y*r*2.0 + s.dz*r + Math.cos(age*0.85+r*2.2)*0.18
            );
        }
        pts.needsUpdate=true;
        const cycle=((age)%(Math.PI*2))/(Math.PI*2);
        s.line.material.opacity=(0.08+Math.sin(t*0.6+s.phase)*0.04)*Math.max(0,Math.sin(cycle*Math.PI));
    }
}

/* ===================================================== */
/* BOUCLE                                                 */
/* ===================================================== */

function animate(now){
    requestAnimationFrame(animate);
    const dt=Math.min((now-lastTime)/1000,0.05);
    lastTime=now;
    const t=now*0.001;

    for(const f of fireflies){
        f.light.position.y=f.by+Math.sin(t+f.phase)*0.6;
        f.light.position.x=f.bx+Math.cos(t*0.2+f.phase)*1.5;
        f.light.position.z=f.bz+Math.sin(t*0.18+f.phase)*1.5;
    }

    updateScent(t);
    if(controls.isLocked) physicsStep(dt);
    renderer.render(scene,camera);
}

animate(performance.now());

addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
});

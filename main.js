import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';

/* ===================================================== */
/* PERLIN NOISE 2D (classique, stable)                    */
/* ===================================================== */

const _p = (() => {
    const b = Array.from({length:256},(_,i)=>i);
    for(let i=255;i>0;i--){ const j=Math.random()*(i+1)|0; [b[i],b[j]]=[b[j],b[i]]; }
    return new Uint8Array([...b,...b]);
})();

function _fade(t){ return t*t*t*(t*(t*6-15)+10); }
function _lerp(a,b,t){ return a+(b-a)*t; }
function _g(h,x,y){ const v=h&3; return(v===0?x+y:v===1?-x+y:v===2?x-y:-x-y); }

function perlin(x,y){
    const X=Math.floor(x)&255, Y=Math.floor(y)&255;
    x-=Math.floor(x); y-=Math.floor(y);
    const u=_fade(x), v=_fade(y);
    const a=_p[X]+Y, b=_p[X+1]+Y;
    return _lerp(
        _lerp(_g(_p[a],x,y),   _g(_p[b],x-1,y),   u),
        _lerp(_g(_p[a+1],x,y-1),_g(_p[b+1],x-1,y-1),u),
        v
    );
}

// FBM — source unique de hauteur, valable partout en world-space
function getHeight(wx, wz) {
    const s = 0.004;
    let h = 0;
    h += perlin(wx*s,       wz*s      ) * 20;
    h += perlin(wx*s*2,     wz*s*2    ) * 10;
    h += perlin(wx*s*4,     wz*s*4    ) *  5;
    h += perlin(wx*s*8,     wz*s*8    ) *  2.5;
    return h;
}

/* ===================================================== */
/* SCENE + FOG + SKY                                      */
/* ===================================================== */

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x9bb4c7, 0.0020);

// Sky gradient simple et fiable (pas de SphereGeometry qui dépasse le far)
const skyGeo = new THREE.SphereGeometry(3000, 16, 8);
const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
        top:   { value: new THREE.Color(0x1a3d6e) },
        mid:   { value: new THREE.Color(0x6aaed6) },
        horiz: { value: new THREE.Color(0xd4eaf8) },
    },
    vertexShader:`
        varying float vy;
        void main(){ vy=normalize(position).y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }
    `,
    fragmentShader:`
        uniform vec3 top,mid,horiz;
        varying float vy;
        void main(){
            vec3 c=mix(horiz,mid,smoothstep(0.,.2,vy));
            c=mix(c,top,smoothstep(.15,.8,vy));
            gl_FragColor=vec4(c,1.);
        }
    `
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

/* ===================================================== */
/* CAMERA + RENDERER                                      */
/* ===================================================== */

const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.15, 3000);
camera.position.set(0, getHeight(0,0)+1.8, 0);

const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

/* ===================================================== */
/* LUMIERES                                               */
/* ===================================================== */

scene.add(new THREE.HemisphereLight(0xc8ddf5, 0x2a3d1a, 0.9));
const sun = new THREE.DirectionalLight(0xfff5d0, 2.5);
sun.position.set(300, 500, 200);
sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -300;
sun.shadow.camera.right = sun.shadow.camera.top   =  300;
sun.shadow.bias = -0.0003;
scene.add(sun);

/* ===================================================== */
/* MATERIAUX PARTAGES                                     */
/* ===================================================== */

const M = {
    ground: new THREE.MeshStandardMaterial({ color:0x2d4a1e, roughness:1 }),
    trunk:  new THREE.MeshStandardMaterial({ color:0x1a0f0a }),
    root:   new THREE.MeshStandardMaterial({ color:0x22150f }),
    leaf0:  new THREE.MeshStandardMaterial({ color:0x0f240f }),
    leaf1:  new THREE.MeshStandardMaterial({ color:0x163016 }),
    leaf2:  new THREE.MeshStandardMaterial({ color:0x1c3d1c }),
    stem:   new THREE.MeshStandardMaterial({ color:0x2d4c1e }),
    rock:   new THREE.MeshStandardMaterial({ color:0x666666, roughness:1 }),
    grass:  new THREE.MeshStandardMaterial({ color:0x3a6020 }),
};
const LEAFMATS = [M.leaf0, M.leaf1, M.leaf2];
const SHARED   = new Set(Object.values(M));
const FCOLS    = [0xff4444, 0x4488ff, 0xffee44, 0xffffff, 0xff66cc];

/* ===================================================== */
/* CHUNK SYSTEM                                           */
/* ===================================================== */

const CHUNK  = 100;   // taille world d'un chunk
const SEGS   = 40;    // segments par chunk (40x40 quads)
const LOAD_R = 3;
const DROP_R = 5;

const chunks  = new Map();  // key → { group, cx, cz }
const chCols  = new Map();  // key → [{cx,cy,cz,r}]
const windArr = [];
const ffArr   = [];
const scentArr= [];

function ckey(cx,cz){ return `${cx},${cz}`; }

/* ===================================================== */
/* TERRAIN : BufferGeometry directement en world-space    */
/* Aucune rotation, aucun position offset.                */
/* Les vertices sont posés aux coordonnées world exactes. */
/* => getHeight(vx,vz) correspond EXACTEMENT au mesh.    */
/* ===================================================== */

function buildTerrain(cx, cz){
    const ox = cx*CHUNK - CHUNK/2;   // coin SW en X
    const oz = cz*CHUNK - CHUNK/2;   // coin SW en Z
    const W  = SEGS+1;               // nb de points par côté
    const N  = W*W;

    const pos  = new Float32Array(N*3);
    const norm = new Float32Array(N*3);
    const uv   = new Float32Array(N*2);

    for(let iz=0; iz<W; iz++){
        for(let ix=0; ix<W; ix++){
            const wx = ox + (ix/SEGS)*CHUNK;
            const wz = oz + (iz/SEGS)*CHUNK;
            const wy = getHeight(wx, wz);
            const idx = iz*W+ix;
            pos [idx*3  ] = wx;
            pos [idx*3+1] = wy;
            pos [idx*3+2] = wz;
            uv  [idx*2  ] = ix/SEGS;
            uv  [idx*2+1] = iz/SEGS;
        }
    }

    // Indices
    const idxArr = new Uint32Array(SEGS*SEGS*6);
    let k=0;
    for(let iz=0; iz<SEGS; iz++){
        for(let ix=0; ix<SEGS; ix++){
            const a=iz*W+ix, b=a+1, c=a+W, d=c+1;
            idxArr[k++]=a; idxArr[k++]=c; idxArr[k++]=b;
            idxArr[k++]=b; idxArr[k++]=c; idxArr[k++]=d;
        }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal',   new THREE.BufferAttribute(norm,3));
    geo.setAttribute('uv',       new THREE.BufferAttribute(uv,  2));
    geo.setIndex(new THREE.BufferAttribute(idxArr,1));
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, M.ground);
    mesh.receiveShadow = true;
    // Pas de rotation, pas de position — les verts sont déjà en world-space
    return mesh;
}

/* ===================================================== */
/* SEEDED RNG par chunk                                   */
/* ===================================================== */

function rngFor(cx,cz){
    let s = (Math.imul(cx,73856093) ^ Math.imul(cz,19349663)) >>> 0;
    if(!s) s=1;
    return ()=>{
        s = Math.imul(s^(s>>>16), 0x45d9f3b)>>>0;
        s = Math.imul(s^(s>>>16), 0x45d9f3b)>>>0;
        return (s^(s>>>16))>>>0 / 0x100000000;
    };
}

/* ===================================================== */
/* OBJETS PAR CHUNK                                       */
/* ===================================================== */

function buildObjects(cx, cz, group){
    const rng  = rngFor(cx, cz);
    const ox   = cx*CHUNK;
    const oz   = cz*CHUNK;
    const cols = [];

    // Position aléatoire dans le chunk, hauteur exacte
    const rp = ()=>{
        const x = ox + (rng()-0.5)*CHUNK;
        const z = oz + (rng()-0.5)*CHUNK;
        return { x, y:getHeight(x,z), z };
    };

    /* — ARBRES — */
    const nt = 4+(rng()*7|0);
    for(let i=0;i<nt;i++){
        const {x,y,z} = rp();
        const h  = 12+rng()*16;
        const tr = 0.8+rng()*0.7;
        const tree = new THREE.Group();

        // Tronc — départ depuis le sol, descend 3u sous terre pour masquer gaps
        const tH = h+3;
        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(tr*0.5, tr, tH, 7),
            M.trunk
        );
        trunk.position.y = tH/2 - 3;   // base à y=0 (sol local), pointe vers y=h
        trunk.castShadow = true;
        tree.add(trunk);

        // Racines : 4 cylindres inclinés sortant de la base du tronc
        for(let r=0;r<4;r++){
            const angle = (Math.PI*2/4)*r + rng()*0.4;
            const rLen  = 1.8+rng();
            const root  = new THREE.Mesh(
                new THREE.CylinderGeometry(0.05, tr*0.18, rLen, 5),
                M.root
            );
            // On positionne le pivot à la base du tronc, on incline vers l'extérieur+bas
            root.position.set(
                Math.cos(angle)*(tr*0.7 + rLen*0.4),
                -rLen*0.3,
                Math.sin(angle)*(tr*0.7 + rLen*0.4)
            );
            // Rotation pour pointer vers le sol : tilt ~60° vers l'extérieur
            root.rotation.z =  Math.PI/2 - 0.6;
            root.rotation.y = -angle;
            tree.add(root);
        }

        // Feuillage cones
        const layers = 5+(rng()*4|0);
        for(let l=0;l<layers;l++){
            const t  = l/layers;
            const sz = (1-t)*(tr*5)+1.5;
            const cone = new THREE.Mesh(
                new THREE.ConeGeometry(sz, 6, 7),
                LEAFMATS[rng()*3|0]
            );
            cone.position.y = h*0.3 + t*h*0.7;
            cone.castShadow = true;
            tree.add(cone);
            windArr.push({mesh:cone, phase:rng()*10, speed:0.4+rng()*0.3, amp:0.012});
        }

        tree.position.set(x, y, z);
        group.add(tree);
        cols.push({cx:x, cy:y+3,  cz:z, r:tr+0.8});
        cols.push({cx:x, cy:y+10, cz:z, r:tr+0.5});
    }

    /* — ROCHERS — */
    const nr = 2+(rng()*5|0);
    for(let i=0;i<nr;i++){
        const {x,y,z} = rp();
        const sz  = 0.8+rng()*1.8;
        const rock = new THREE.Mesh(
            new THREE.DodecahedronGeometry(sz,0),
            M.rock
        );
        // On enfonce le rocher de moitié dans le sol
        rock.position.set(x, y + sz*0.3, z);
        rock.rotation.set(rng()*Math.PI, rng()*Math.PI, rng()*Math.PI);
        rock.scale.y = 0.65;
        rock.castShadow = rock.receiveShadow = true;
        group.add(rock);
        cols.push({cx:x, cy:y+sz*0.3, cz:z, r:sz*0.85});
    }

    /* — FLEURS — */
    const nf = 8+(rng()*20|0);
    for(let i=0;i<nf;i++){
        const {x,y,z} = rp();
        const col = FCOLS[rng()*FCOLS.length|0];
        const g   = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.03,0.65,5), M.stem);
        stem.position.y = 0.32;
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.11,6,6),
            new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:0.12})
        );
        head.position.y = 0.7;
        g.add(stem,head);
        g.position.set(x,y,z);
        group.add(g);
        windArr.push({mesh:g, phase:rng()*5, speed:1.5+rng(), amp:0.04});

        // Lignes d'odeur
        const nLines = 1+(rng()*2|0);
        for(let t=0;t<nLines;t++){
            const SEG=7;
            const pts=[]; for(let s=0;s<=SEG;s++) pts.push(new THREE.Vector3());
            const lg = new THREE.BufferGeometry().setFromPoints(pts);
            const lm = new THREE.LineBasicMaterial({
                color:col, transparent:true, opacity:0.18,
                depthWrite:false, blending:THREE.AdditiveBlending
            });
            const line = new THREE.Line(lg,lm);
            group.add(line);
            scentArr.push({
                line, geo:lg, SEG,
                bx:x, by:y+0.7, bz:z,
                phase:rng()*Math.PI*2,
                speed:0.5+rng()*0.5,
                dx:(rng()-.5)*1.2, dz:(rng()-.5)*0.5,
                off:rng()*3
            });
        }
    }

    /* — HERBE instanciée — */
    const ng = 80+(rng()*100|0);
    const gm = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.02,0.05,1.0,3),
        M.grass, ng
    );
    const d = new THREE.Object3D();
    for(let i=0;i<ng;i++){
        const {x,y,z} = rp();
        d.position.set(x, y+0.45, z);
        d.scale.setScalar(0.6+rng()*1.6);
        d.rotation.y = rng()*Math.PI;
        d.updateMatrix();
        gm.setMatrixAt(i, d.matrix);
    }
    group.add(gm);

    /* — LUCIOLES — */
    const nl = 1+(rng()*3|0);
    for(let i=0;i<nl;i++){
        const {x,y,z} = rp();
        const fy = y+2+rng()*3;
        const light = new THREE.PointLight(0xffffaa, 0.6, 8);
        light.position.set(x,fy,z);
        group.add(light);
        ffArr.push({light, bx:x, by:fy, bz:z, phase:rng()*10});
    }

    return cols;
}

/* ===================================================== */
/* LOAD / UNLOAD                                          */
/* ===================================================== */

function loadChunk(cx,cz){
    const k = ckey(cx,cz);
    if(chunks.has(k)) return;
    const group = new THREE.Group();
    group.add(buildTerrain(cx,cz));
    const cols = buildObjects(cx,cz,group);
    scene.add(group);
    chunks.set(k,{group,cx,cz});
    chCols.set(k,cols);
}

function unloadChunk(k){
    const c = chunks.get(k);
    if(!c) return;
    const mbrs = new Set();
    c.group.traverse(o=>mbrs.add(o));
    for(let i=windArr.length-1;i>=0;i--) if(mbrs.has(windArr[i].mesh))  windArr.splice(i,1);
    for(let i=ffArr.length-1;i>=0;i--)  if(mbrs.has(ffArr[i].light))   ffArr.splice(i,1);
    for(let i=scentArr.length-1;i>=0;i--) if(mbrs.has(scentArr[i].line)) scentArr.splice(i,1);
    scene.remove(c.group);
    c.group.traverse(o=>{
        if(o.geometry) o.geometry.dispose();
        if(o.material && !SHARED.has(o.material)){
            if(Array.isArray(o.material)) o.material.forEach(m=>m.dispose());
            else o.material.dispose();
        }
    });
    chunks.delete(k);
    chCols.delete(k);
}

let lastChunkTick = 0;
function updateChunks(){
    const px = Math.round(camera.position.x/CHUNK);
    const pz = Math.round(camera.position.z/CHUNK);
    for(let dz=-LOAD_R;dz<=LOAD_R;dz++)
    for(let dx=-LOAD_R;dx<=LOAD_R;dx++)
        if(Math.hypot(dx,dz)<=LOAD_R) loadChunk(px+dx,pz+dz);
    for(const [k,c] of chunks)
        if(Math.hypot(c.cx-px,c.cz-pz)>DROP_R) unloadChunk(k);
}

/* ===================================================== */
/* PHYSIQUE CAPSULE                                       */
/* ===================================================== */

const PH = 1.8, PR = 0.5, GRAV = -18, JV = 7, ACCEL = 26, DRAG = 8;
const vel = new THREE.Vector3();
let grounded = false, stamina = 100;
const fwd = new THREE.Vector3(), rgt = new THREE.Vector3(), UP = new THREE.Vector3(0,1,0);

function resolveCol(s){
    const lo = camera.position.y-PH+PR, hi = camera.position.y-PR;
    const cy = Math.max(lo,Math.min(hi,s.cy));
    const dx=camera.position.x-s.cx, dy=camera.position.y-cy, dz=camera.position.z-s.cz;
    const d2=dx*dx+dy*dy+dz*dz, md=s.r+PR;
    if(d2>=md*md) return;
    const d=Math.sqrt(d2)||.001, pen=md-d;
    camera.position.x+=(dx/d)*pen; camera.position.z+=(dz/d)*pen;
    const vd=vel.x*(dx/d)+vel.z*(dz/d);
    if(vd<0){vel.x-=vd*(dx/d); vel.z-=vd*(dz/d);}
}

function physStep(dt){
    const run = keys.shift && stamina>0 && keys.z;
    stamina = run ? Math.max(0,stamina-40*dt) : Math.min(100,stamina+18*dt);
    document.getElementById('sp').style.width = stamina+'%';

    camera.getWorldDirection(fwd); fwd.y=0; fwd.normalize();
    rgt.crossVectors(fwd,UP).negate().normalize();

    const sp = ACCEL*(run?1.8:1);
    if(keys.z){vel.x+=fwd.x*sp*dt; vel.z+=fwd.z*sp*dt;}
    if(keys.s){vel.x-=fwd.x*sp*dt; vel.z-=fwd.z*sp*dt;}
    if(keys.q){vel.x-=rgt.x*sp*dt; vel.z-=rgt.z*sp*dt;}
    if(keys.d){vel.x+=rgt.x*sp*dt; vel.z+=rgt.z*sp*dt;}

    const dr = Math.exp(-DRAG*dt);
    vel.x*=dr; vel.z*=dr;
    if(!grounded) vel.y+=GRAV*dt;
    camera.position.x+=vel.x*dt;
    camera.position.y+=vel.y*dt;
    camera.position.z+=vel.z*dt;

    const px=Math.round(camera.position.x/CHUNK), pz=Math.round(camera.position.z/CHUNK);
    for(let dz=-1;dz<=1;dz++) for(let dx=-1;dx<=1;dx++){
        const c=chCols.get(ckey(px+dx,pz+dz));
        if(c) for(const s of c) resolveCol(s);
    }

    const gy = getHeight(camera.position.x,camera.position.z)+PH;
    if(camera.position.y<=gy){ camera.position.y=gy; if(vel.y<0)vel.y=0; grounded=true; }
    else grounded=false;
}

/* ===================================================== */
/* CONTROLS                                               */
/* ===================================================== */

const controls = new PointerLockControls(camera,document.body);
document.body.addEventListener('click',()=>controls.lock());
const keys={z:false,s:false,q:false,d:false,shift:false};
addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();
    if(k in keys)keys[k]=true;
    if(e.shiftKey)keys.shift=true;
    if(e.code==='Space'&&grounded){vel.y=JV;grounded=false;}
});
addEventListener('keyup',e=>{
    const k=e.key.toLowerCase();
    if(k in keys)keys[k]=false;
    if(!e.shiftKey)keys.shift=false;
});

/* ===================================================== */
/* SCENT LINES UPDATE                                     */
/* ===================================================== */

const WD = new THREE.Vector2(1,.3).normalize().multiplyScalar(1.4);
function updateScent(t){
    for(const s of scentArr){
        const p=s.geo.attributes.position, age=t*s.speed+s.off;
        for(let i=0;i<=s.SEG;i++){
            const r=i/s.SEG;
            p.setXYZ(i,
                s.bx+WD.x*r*2+s.dx*r+Math.sin(age+r*3)*.28,
                s.by+r*2+Math.sin(age*1.2+r*2)*.15,
                s.bz+WD.y*r*2+s.dz*r+Math.cos(age*.9+r*2.5)*.2
            );
        }
        p.needsUpdate=true;
        const cy=((t*s.speed+s.off)%(Math.PI*2))/(Math.PI*2);
        s.line.material.opacity=(0.08+Math.sin(t*.7+s.phase)*.05)*Math.sin(cy*Math.PI);
    }
}

/* ===================================================== */
/* BOUCLE                                                 */
/* ===================================================== */

let last=performance.now();
function animate(now){
    requestAnimationFrame(animate);
    const dt=Math.min((now-last)/1000,.05); last=now;
    const t=now*.001;

    if(now-lastChunkTick>250){ updateChunks(); lastChunkTick=now; }

    for(const w of windArr) w.mesh.rotation.z=Math.sin(t*w.speed+w.phase)*w.amp;
    for(const f of ffArr){
        f.light.position.set(
            f.bx+Math.cos(t*.25+f.phase)*1.8,
            f.by+Math.sin(t+f.phase)*.5,
            f.bz+Math.sin(t*.2+f.phase)*1.8
        );
        f.light.intensity=.4+Math.sin(t*3+f.phase)*.22;
    }
    updateScent(t);

    if(controls.isLocked) physStep(dt);
    renderer.render(scene,camera);
}
animate(performance.now());

addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
});

import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';

/* ===================================================== */
/* SCENE */
/* ===================================================== */

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x87a7c4);
scene.fog = new THREE.FogExp2(0x9bb4c7, 0.0028);

/* ===================================================== */
/* CAMERA */
/* ===================================================== */

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    4000
);

camera.position.set(0, 10, 0);

/* ===================================================== */
/* RENDERER */
/* ===================================================== */

const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

document.body.appendChild(renderer.domElement);

/* ===================================================== */
/* LIGHT */
/* ===================================================== */

scene.add(new THREE.HemisphereLight(0xddeeff, 0x3d2f1b, 1));

const sun = new THREE.DirectionalLight(0xfff2d6, 2.5);
sun.position.set(200, 300, 100);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.left = -300;
sun.shadow.camera.right = 300;
sun.shadow.camera.top = 300;
sun.shadow.camera.bottom = -300;
scene.add(sun);

/* ===================================================== */
/* TERRAIN */
/* ===================================================== */

const groundGeo = new THREE.PlaneGeometry(1200, 1200, 140, 140);

const p = groundGeo.attributes.position.array;

for (let i = 0; i < p.length; i += 3) {
    const x = p[i];
    const z = p[i + 1];
    p[i + 2] =
        Math.sin(x * 0.025) * 8 +
        Math.cos(z * 0.02) * 6 +
        Math.sin((x + z) * 0.01) * 12;
}

groundGeo.computeVertexNormals();

const groundMat = new THREE.MeshStandardMaterial({
    color: 0x243b1d,
    roughness: 1
});

const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
ground.updateMatrixWorld();

/* ===================================================== */
/* HEIGHT */
/* ===================================================== */

const raycaster = new THREE.Raycaster();

function findY(x, z) {
    raycaster.ray.origin.set(x, 300, z);
    raycaster.ray.direction.set(0, -1, 0);
    const hit = raycaster.intersectObject(ground);
    return hit.length ? hit[0].point.y : 0;
}

/* ===================================================== */
/* SYSTEMS */
/* ===================================================== */

const windObjects = [];
const colliders = [];
const fireflies = [];
const scentParticles = []; // odeur des fleurs

/* ===================================================== */
/* GRASS */
/* ===================================================== */

const grassGeo = new THREE.CylinderGeometry(0.02, 0.05, 1.2, 3);
const grassMat = new THREE.MeshStandardMaterial({ color: 0x3f6b2d });
const grassCount = 2500;
const grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
scene.add(grassMesh);

const dummy = new THREE.Object3D();

for (let i = 0; i < grassCount; i++) {
    const x = (Math.random() - 0.5) * 900;
    const z = (Math.random() - 0.5) * 900;
    const y = findY(x, z);
    dummy.position.set(x, y + 0.5, z);
    dummy.scale.setScalar(0.7 + Math.random() * 1.8);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.updateMatrix();
    grassMesh.setMatrixAt(i, dummy.matrix);
}

/* ===================================================== */
/* FLOWERS + SCENT PARTICLES */
/* ===================================================== */

const FLOWER_COLORS = [0xff4444, 0x4444ff, 0xffff55, 0xffffff, 0xff66cc];

function spawnFlower(x, z) {
    const y = findY(x, z);
    const g = new THREE.Group();

    const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.03, 0.7),
        new THREE.MeshStandardMaterial({ color: 0x2d4c1e })
    );
    stem.position.y = 0.35;

    const flowerColor = FLOWER_COLORS[Math.random() * 5 | 0];

    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 6),
        new THREE.MeshStandardMaterial({
            color: flowerColor,
            emissive: flowerColor,
            emissiveIntensity: 0.1
        })
    );
    head.position.y = 0.8;

    g.add(stem, head);
    g.position.set(x, y, z);
    scene.add(g);

    windObjects.push({
        mesh: g,
        phase: Math.random() * 5,
        speed: 2,
        amp: 0.04
    });

    // Scent particles — quelques traînées légères
    const particleCount = 4 + Math.random() * 4 | 0;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3]     = x + (Math.random() - 0.5) * 0.6;
        positions[i * 3 + 1] = y + 0.8 + Math.random() * 1.5;
        positions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.6;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
        color: flowerColor,
        size: 0.06 + Math.random() * 0.06,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);

    // Stocker les données pour animation
    const phases = Array.from({ length: particleCount }, () => Math.random() * Math.PI * 2);
    scentParticles.push({
        points,
        positions,
        baseX: x,
        baseY: y + 0.8,
        baseZ: z,
        color: flowerColor,
        phases
    });
}

/* ===================================================== */
/* ROCKS */
/* ===================================================== */

function spawnRock(x, z) {
    const y = findY(x, z);
    const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1 + Math.random() * 2, 0),
        new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 1 })
    );
    rock.position.set(x, y + 0.5, z);
    rock.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
    );
    rock.scale.y = 0.6;
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
    colliders.push({ x, z, r: 2 });
}

/* ===================================================== */
/* TREES */
/* ===================================================== */

function spawnTree(x, z) {
    const y = findY(x, z);
    const tree = new THREE.Group();

    const height = 18 + Math.random() * 18;
    const trunkRadius = 1 + Math.random() * 0.6;

    // Tronc allongé vers le bas pour couvrir le terrain irrégulier
    const trunkExtend = 8; // prolongement sous le sol
    const trunkTotal = height + trunkExtend;

    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(
            trunkRadius * 0.55,
            trunkRadius * 1.1,
            trunkTotal,
            8
        ),
        new THREE.MeshStandardMaterial({ color: 0x1a0f0a })
    );

    // Centre du cylindre décalé vers le haut pour que le prolongement soit sous terre
    trunk.position.y = height / 2 - trunkExtend / 2;
    trunk.castShadow = true;
    tree.add(trunk);

    // RACINES — orientées vers le bas
    for (let i = 0; i < 5; i++) {
        const root = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.25, 3.5, 5),
            new THREE.MeshStandardMaterial({ color: 0x22150f })
        );

        const angle = (Math.PI * 2 / 5) * i;
        const spread = trunkRadius + 0.8;

        // Inclinaison vers le bas et vers l'extérieur
        root.position.set(
            Math.cos(angle) * spread,
            -1.2, // sous la base
            Math.sin(angle) * spread
        );

        // Rotation : pointe vers le sol, légèrement évasée
        root.rotation.z = Math.PI / 2 - 0.5;
        root.rotation.y = angle;

        // Incliner le cylindre vers le bas (rotation locale)
        root.rotateOnAxis(new THREE.Vector3(0, 1, 0), 0); // déjà géré par rotation.y

        // On tourne autour de l'axe local X pour faire aller la racine vers le bas
        const rootGroup = new THREE.Group();
        rootGroup.position.set(
            Math.cos(angle) * (trunkRadius * 0.8),
            0.3,
            Math.sin(angle) * (trunkRadius * 0.8)
        );
        rootGroup.rotation.y = angle;
        // Incliner vers le bas : -Math.PI/2 + angle_spread
        rootGroup.rotation.z = -(Math.PI / 2 - 0.7); // pointe vers le sol

        const rootMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.28, 3.5, 5),
            new THREE.MeshStandardMaterial({ color: 0x22150f })
        );
        rootMesh.position.y = -1.2; // centre du cylindre en bas
        rootGroup.add(rootMesh);
        tree.add(rootGroup);
    }

    // FEUILLAGE style RPG
    const layers = 7 + (Math.random() * 4 | 0);

    for (let i = 0; i < layers; i++) {
        const ratio = i / layers;
        const size = (1 - ratio) * (trunkRadius * 7) + 2;

        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(size, 7, 8),
            new THREE.MeshStandardMaterial({
                color: [0x0f240f, 0x163016, 0x1c3d1c][Math.random() * 3 | 0]
            })
        );

        cone.position.y = height * 0.3 + ratio * height * 0.75;
        cone.castShadow = true;
        tree.add(cone);

        windObjects.push({
            mesh: cone,
            phase: Math.random() * 10,
            speed: 0.5,
            amp: 0.015
        });
    }

    tree.position.set(x, y, z);
    scene.add(tree);

    colliders.push({ x, z, r: trunkRadius + 1.2 });
}

/* ===================================================== */
/* FIREFLIES */
/* ===================================================== */

function spawnFirefly() {
    const light = new THREE.PointLight(0xffffaa, 0.7, 8);
    const x = (Math.random() - 0.5) * 800;
    const z = (Math.random() - 0.5) * 800;
    const y = findY(x, z) + 2 + Math.random() * 4;
    light.position.set(x, y, z);
    scene.add(light);
    fireflies.push({ light, baseY: y, phase: Math.random() * 10 });
}

/* ===================================================== */
/* WORLD */
/* ===================================================== */

for (let i = 0; i < 170; i++)
    spawnTree((Math.random() - 0.5) * 900, (Math.random() - 0.5) * 900);

for (let i = 0; i < 700; i++)
    spawnFlower((Math.random() - 0.5) * 700, (Math.random() - 0.5) * 700);

for (let i = 0; i < 120; i++)
    spawnRock((Math.random() - 0.5) * 800, (Math.random() - 0.5) * 800);

for (let i = 0; i < 90; i++)
    spawnFirefly();

/* ===================================================== */
/* CONTROLS */
/* ===================================================== */

const controls = new PointerLockControls(camera, document.body);
document.body.addEventListener('click', () => controls.lock());

const velocity = new THREE.Vector3();
const keys = { z: false, s: false, q: false, d: false, shift: false };
let jumpVel = 0;
let grounded = true;
let stamina = 100;

addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = true;
    if (e.shiftKey) keys.shift = true;
    if (e.code === "Space" && grounded) {
        grounded = false;
        jumpVel = 0.28;
    }
});

addEventListener("keyup", e => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = false;
    if (!e.shiftKey) keys.shift = false;
});

/* ===================================================== */
/* MOVEMENT */
/* ===================================================== */

function updateMovement() {
    const running = keys.shift && stamina > 0 && keys.z;
    const accel = running ? 0.05 : 0.025;

    stamina = running ? stamina - 0.45 : Math.min(100, stamina + 0.2);
    document.getElementById('sp').style.width = stamina + "%";

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    forward.y = 0; right.y = 0;
    forward.normalize(); right.normalize();

    if (keys.z) velocity.add(forward.multiplyScalar(accel));
    if (keys.s) velocity.sub(forward.multiplyScalar(accel));
    if (keys.q) velocity.sub(right.multiplyScalar(accel));
    if (keys.d) velocity.add(right.multiplyScalar(accel));

    velocity.multiplyScalar(0.9);

    let nx = camera.position.x + velocity.x;
    let nz = camera.position.z + velocity.z;

    for (const c of colliders) {
        const dx = nx - c.x;
        const dz = nz - c.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < c.r) {
            const angle = Math.atan2(dz, dx);
            nx = c.x + Math.cos(angle) * c.r;
            nz = c.z + Math.sin(angle) * c.r;
            velocity.multiplyScalar(0.6);
        }
    }

    camera.position.x = nx;
    camera.position.z = nz;

    const groundY = findY(nx, nz) + 1.8;
    jumpVel -= 0.012;
    camera.position.y += jumpVel;

    if (camera.position.y < groundY) {
        camera.position.y = groundY;
        grounded = true;
        jumpVel = 0;
    }
}

/* ===================================================== */
/* ANIMATION */
/* ===================================================== */

function animate(t) {
    requestAnimationFrame(animate);
    t *= 0.001;

    // Vent
    for (const w of windObjects) {
        w.mesh.rotation.z = Math.sin(t * w.speed + w.phase) * w.amp;
    }

    // Lucioles
    for (const f of fireflies) {
        f.light.position.y = f.baseY + Math.sin(t + f.phase) * 0.5;
        f.light.position.x += Math.cos(t * 0.3 + f.phase) * 0.01;
    }

    // Particules d'odeur — flottent vers le haut doucement
    for (const s of scentParticles) {
        const pos = s.positions;
        const n = pos.length / 3;
        for (let i = 0; i < n; i++) {
            // montée lente + oscillation légère
            pos[i * 3 + 1] += 0.003;
            pos[i * 3]     += Math.sin(t * 0.8 + s.phases[i]) * 0.001;
            // reset si trop haut
            if (pos[i * 3 + 1] > s.baseY + 3.5) {
                pos[i * 3]     = s.baseX + (Math.random() - 0.5) * 0.6;
                pos[i * 3 + 1] = s.baseY;
                pos[i * 3 + 2] = s.baseZ + (Math.random() - 0.5) * 0.6;
            }
        }
        s.points.geometry.attributes.position.needsUpdate = true;
        // opacité pulsante très légère
        s.points.material.opacity = 0.12 + Math.sin(t * 1.2 + s.phases[0]) * 0.08;
    }

    if (controls.isLocked) updateMovement();

    renderer.render(scene, camera);
}

animate();

/* ===================================================== */
/* RESIZE */
/* ===================================================== */

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

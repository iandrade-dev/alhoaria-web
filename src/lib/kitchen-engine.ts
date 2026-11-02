import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export const names = [
  'stage_bread',
  'stage_garlic',
  'filling_costela',
  'filling_frango',
  'filling_alcatra',
  'filling_brocolis',
  'filling_pork',
  'stage_cream',
  'stage_gratin',
];

interface RigidBodyEntry {
  object: THREE.Object3D;
  body: RAPIER.RigidBody;
  floor: RAPIER.RigidBody;
  parent: THREE.Object3D;
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
}

export type CameraPreset = 'bancada' | 'macro' | 'topo';

export class KitchenEngine {
  mount: HTMLElement;
  status: (s: string) => void;
  environmentMap!: THREE.WebGLRenderTarget;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  world!: RAPIER.World;
  root!: THREE.Group;
  hand!: THREE.Group;
  handMesh?: THREE.Mesh;
  draco: DRACOLoader;
  bodies: Map<string, RigidBodyEntry[]>;
  selected: Set<string>;
  queue: string[];
  active: {
    name: string;
    time: number;
    released: number;
    parts: THREE.Object3D[];
  } | null;
  handAnchor: THREE.Vector3;
  held?: {
    object: THREE.Object3D;
    origin: THREE.Vector3;
    anchor: THREE.Vector3;
  };
  firstFrame: boolean;
  disposed: boolean;
  visible: boolean;
  last: number;
  accumulator: number;
  reduced: boolean;
  ro: ResizeObserver;
  io: IntersectionObserver;

  // Visual FX: Maçarico & Vapor
  torchLight!: THREE.PointLight;
  torchCoreLight!: THREE.PointLight;
  torchTimer: number = 0;
  torchDuration: number = 2.2;
  torchSparks!: THREE.Points;
  torchSparksGeo!: THREE.BufferGeometry;
  torchSparksPositions!: Float32Array;
  torchSparksVelocities!: Float32Array;

  steamParticles!: THREE.Points;
  steamGeo!: THREE.BufferGeometry;
  steamPositions!: Float32Array;
  steamAlphas!: Float32Array;

  // Smooth Camera transition
  cameraTargetPos: THREE.Vector3 | null = null;
  cameraTargetLook: THREE.Vector3 | null = null;
  boardCenter: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  constructor(mount: HTMLElement, status: (s: string) => void) {
    this.mount = mount;
    this.status = status;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.001, 30);
    this.draco = new DRACOLoader();
    this.bodies = new Map();
    this.selected = new Set();
    this.queue = [];
    this.active = null;
    this.handAnchor = new THREE.Vector3(0, 0.18, 0);
    this.firstFrame = false;
    this.disposed = false;
    this.visible = true;
    this.last = 0;
    this.accumulator = 0;
    this.reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(
      Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 1.8)
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    const studio = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environmentMap = pmrem.fromScene(studio, 0.04);
    this.scene.environment = this.environmentMap.texture;
    this.scene.environmentIntensity = 0.55;
    studio.dispose();
    pmrem.dispose();

    mount.append(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minPolarAngle = 0.15;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
    this.controls.minDistance = 0.28;
    this.controls.maxDistance = 1.8;

    // Atmospheric warm lighting (dark kitchen + warm embers)
    this.scene.add(new THREE.HemisphereLight(0xffe8cc, 0x4a3424, 2.2));

    // Key light (warm lamp above cutting board)
    const keyLight = new THREE.DirectionalLight(0xffdfb8, 3.2);
    keyLight.position.set(-0.7, 1.4, 0.9);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -0.55;
    keyLight.shadow.camera.right = 0.55;
    keyLight.shadow.camera.top = 0.55;
    keyLight.shadow.camera.bottom = -0.55;
    keyLight.shadow.normalBias = 0.0003;
    this.scene.add(keyLight);

    // Warm back/rim light
    const rimLight = new THREE.DirectionalLight(0xff9944, 1.6);
    rimLight.position.set(0.8, 0.6, -0.8);
    this.scene.add(rimLight);

    // Dynamic Maçarico Lights
    this.torchLight = new THREE.PointLight(0xff5500, 0, 1.4, 2);
    this.torchLight.position.set(-0.15, 0.22, 0.1);
    this.scene.add(this.torchLight);

    this.torchCoreLight = new THREE.PointLight(0x38bdf8, 0, 0.6, 2);
    this.torchCoreLight.position.set(-0.12, 0.2, 0.08);
    this.scene.add(this.torchCoreLight);

    // Setup FX systems
    this.initSparks();
    this.initSteam();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(mount);
    this.io = new IntersectionObserver((e) => {
      this.visible = e[0]?.isIntersecting ?? true;
    });
    this.io.observe(mount);
    this.resize();
  }

  private initSparks() {
    const count = 48;
    this.torchSparksGeo = new THREE.BufferGeometry();
    this.torchSparksPositions = new Float32Array(count * 3);
    this.torchSparksVelocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      this.torchSparksPositions[i * 3 + 0] = 0;
      this.torchSparksPositions[i * 3 + 1] = -10; // offscreen
      this.torchSparksPositions[i * 3 + 2] = 0;
    }

    this.torchSparksGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.torchSparksPositions, 3)
    );

    const mat = new THREE.PointsMaterial({
      color: 0xffaa33,
      size: 0.012,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.torchSparks = new THREE.Points(this.torchSparksGeo, mat);
    this.scene.add(this.torchSparks);
  }

  private initSteam() {
    const count = 36;
    this.steamGeo = new THREE.BufferGeometry();
    this.steamPositions = new Float32Array(count * 3);
    this.steamAlphas = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      this.resetSteamParticle(i, Math.random() * 0.15);
    }

    this.steamGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.steamPositions, 3)
    );

    const mat = new THREE.PointsMaterial({
      color: 0xffeedd,
      size: 0.038,
      transparent: true,
      opacity: 0.18,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });

    this.steamParticles = new THREE.Points(this.steamGeo, mat);
    this.scene.add(this.steamParticles);
  }

  private resetSteamParticle(i: number, yOffset = 0) {
    this.steamPositions[i * 3 + 0] = (Math.random() - 0.5) * 0.14;
    this.steamPositions[i * 3 + 1] = 0.05 + yOffset;
    this.steamPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.12;
    this.steamAlphas[i] = Math.random();
  }

  triggerTorch() {
    this.torchTimer = this.torchDuration;
    this.status('Maçarico ligado! Gratinando queijo na sua frente 🔥');

    // Trigger cheese glow
    const gratin = this.root?.getObjectByName('stage_gratin');
    if (gratin) {
      gratin.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (m instanceof THREE.MeshStandardMaterial) {
              m.emissive = new THREE.Color(0xff4400);
              m.emissiveIntensity = 1.2;
            }
          }
        }
      });
    }

    // Spawn initial spark burst
    const count = this.torchSparksPositions.length / 3;
    for (let i = 0; i < count; i++) {
      this.torchSparksPositions[i * 3 + 0] = (Math.random() - 0.5) * 0.08;
      this.torchSparksPositions[i * 3 + 1] = 0.08 + Math.random() * 0.04;
      this.torchSparksPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.08;

      this.torchSparksVelocities[i * 3 + 0] = (Math.random() - 0.5) * 0.4;
      this.torchSparksVelocities[i * 3 + 1] = 0.2 + Math.random() * 0.5;
      this.torchSparksVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    }
    this.torchSparksGeo.attributes.position.needsUpdate = true;
  }

  setCameraPreset(preset: CameraPreset) {
    const target = this.boardCenter.clone().add(new THREE.Vector3(0, 0.06, 0));
    this.cameraTargetLook = target;

    if (preset === 'bancada') {
      const d = this.camera.aspect < 1 ? 0.55 : 0.46;
      this.cameraTargetPos = target.clone().add(new THREE.Vector3(d * 0.45, d * 0.65, d * 0.95));
    } else if (preset === 'macro') {
      // Extreme appetizing close-up on the meat and cheese
      this.cameraTargetPos = target.clone().add(new THREE.Vector3(0.08, 0.12, 0.22));
    } else if (preset === 'topo') {
      // Overhead tabletop view
      this.cameraTargetPos = target.clone().add(new THREE.Vector3(0.01, 0.58, 0.05));
    }
  }

  frame = (now: number) => {
    if (this.disposed) return;
    const dt = this.last ? Math.min((now - this.last) / 1000, 0.05) : 0;
    this.last = now;
    if (!this.visible || document.hidden) return;

    // Handle Smooth Camera Lerp
    if (this.cameraTargetPos && this.cameraTargetLook) {
      this.camera.position.lerp(this.cameraTargetPos, dt * 4.5);
      this.controls.target.lerp(this.cameraTargetLook, dt * 4.5);
      if (this.camera.position.distanceTo(this.cameraTargetPos) < 0.005) {
        this.cameraTargetPos = null;
        this.cameraTargetLook = null;
      }
    }

    // Process Hand Assembly Queue
    if (!this.active && this.queue.length) {
      const name = this.queue.shift()!;
      const root = this.root.getObjectByName(name)!;
      root.visible = true;
      const parts = name.startsWith('filling_')
        ? root.children.filter((o) => o instanceof THREE.Mesh)
        : [root];
      parts.forEach((p) => (p.visible = false));
      this.active = {
        name,
        time: 0,
        released: 0,
        parts,
      };
      this.hand.visible = true;
      const part = parts[0];
      if (part) {
        part.updateWorldMatrix(true, true);
        const origin = part.getWorldPosition(new THREE.Vector3());
        const q = part.getWorldQuaternion(new THREE.Quaternion());
        const anchor = new THREE.Box3()
          .setFromObject(part)
          .getCenter(new THREE.Vector3())
          .add(new THREE.Vector3(0, 0.105, 0));
        this.handAnchor.copy(anchor);
        const visual = part.clone(true);
        visual.visible = true;
        visual.position.copy(origin).add(new THREE.Vector3(0, 0.105, 0));
        visual.quaternion.copy(q);
        this.scene.add(visual);
        this.held = {
          object: visual,
          origin: visual.position.clone(),
          anchor,
        };
      }
      this.status(
        name === 'stage_bread'
          ? 'Colocando o pão crocante…'
          : name === 'stage_garlic'
          ? 'Espalhando a pasta de alho…'
          : name.startsWith('filling_')
          ? 'Acomodando o recheio suculento…'
          : 'Cobringo com queijo artesanal…'
      );
    }

    if (this.active) {
      const a = this.active;
      a.time += dt;
      while (
        a.released < a.parts.length &&
        a.time >= 0.65 + a.released * 0.045
      ) {
        const p = a.parts[a.released++];
        if (a.released === 1) this.clearHeld();
        p.visible = true;
        this.release(a.name, p);
      }
      const t = Math.min(1, a.time / 0.65);
      const back = Math.max(
        0,
        Math.min(1, (a.time - Math.max(1, 0.65 + a.parts.length * 0.045)) / 0.5)
      );
      const ease = (x: number) => x * x * (3 - 2 * x);
      const travel = new THREE.Vector3(
        0.4 * (1 - ease(t)) + 0.4 * ease(back),
        0.2 * (1 - ease(t)) + 0.2 * ease(back),
        0.04 * (1 - ease(t))
      );
      this.hand.rotation.set(0, 1, 0);
      const pinch = new THREE.Vector3(-0.0335, -0.0515, -0.125).applyQuaternion(
        this.hand.quaternion
      );
      const anchor = this.handAnchor;
      this.hand.position.copy(anchor).add(travel).sub(pinch);
      if (this.held) {
        this.held.object.position.copy(this.held.origin).add(travel);
      }
      if (this.handMesh?.morphTargetInfluences) {
        const idx = this.handMesh.morphTargetDictionary?.release ?? 0;
        this.handMesh.morphTargetInfluences[idx] =
          a.time < 0.65 ? 0 : Math.min(1, (a.time - 0.65) / 0.25);
      }
      if (back >= 1) {
        this.hand.visible = false;
        this.active = null;
        if (!this.queue.length) {
          this.status(
            this.selected.size > 2
              ? 'Sanduíche pronto na bancada. Dê um toque no maçarico!'
              : 'Escolha o recheio. O chef monta na sua frente.'
          );
        }
      }
    }

    // Torch Flame & Sizzle FX Animation
    if (this.torchTimer > 0) {
      this.torchTimer -= dt;
      const progress = 1 - Math.max(0, this.torchTimer) / this.torchDuration;
      // Flame flicker
      const flicker = 0.85 + Math.sin(now * 0.03) * 0.15 + (Math.random() - 0.5) * 0.2;
      const intensity = Math.sin(progress * Math.PI) * 4.5 * flicker;
      this.torchLight.intensity = Math.max(0, intensity);
      this.torchCoreLight.intensity = Math.max(0, intensity * 0.4);

      // Move torch light smoothly across the bread
      this.torchLight.position.x = -0.12 + Math.sin(progress * Math.PI * 1.5) * 0.18;
      this.torchCoreLight.position.x = this.torchLight.position.x + 0.02;

      // Animate sparks
      const mat = this.torchSparks.material as THREE.PointsMaterial;
      mat.opacity = Math.sin(progress * Math.PI) * 0.9;
      const count = this.torchSparksPositions.length / 3;
      for (let i = 0; i < count; i++) {
        this.torchSparksPositions[i * 3 + 0] += this.torchSparksVelocities[i * 3 + 0] * dt;
        this.torchSparksPositions[i * 3 + 1] += this.torchSparksVelocities[i * 3 + 1] * dt;
        this.torchSparksPositions[i * 3 + 2] += this.torchSparksVelocities[i * 3 + 2] * dt;
        this.torchSparksVelocities[i * 3 + 1] -= 9.8 * 0.08 * dt; // gravity
      }
      this.torchSparksGeo.attributes.position.needsUpdate = true;

      // Cool down cheese glow
      const gratin = this.root?.getObjectByName('stage_gratin');
      if (gratin) {
        gratin.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of mats) {
              if (m instanceof THREE.MeshStandardMaterial) {
                m.emissiveIntensity = Math.max(0, (1 - progress) * 1.1);
              }
            }
          }
        });
      }
    } else {
      this.torchLight.intensity = 0;
      this.torchCoreLight.intensity = 0;
      (this.torchSparks.material as THREE.PointsMaterial).opacity = 0;
    }

    // Animate Steam
    const steamCount = this.steamPositions.length / 3;
    for (let i = 0; i < steamCount; i++) {
      this.steamPositions[i * 3 + 1] += dt * 0.06; // rise
      this.steamPositions[i * 3 + 0] += Math.sin(now * 0.002 + i) * dt * 0.01;
      if (this.steamPositions[i * 3 + 1] > 0.28) {
        this.resetSteamParticle(i);
      }
    }
    this.steamGeo.attributes.position.needsUpdate = true;

    // Physics step
    this.accumulator = Math.min(this.accumulator + dt, 0.1);
    while (this.accumulator >= 1 / 120) {
      this.world?.step();
      this.accumulator -= 1 / 120;
    }

    for (const entries of this.bodies.values()) {
      for (const { object, body } of entries) {
        const p = body.translation();
        const q = body.rotation();
        object.position.set(p.x, p.y, p.z);
        object.quaternion.set(q.x, q.y, q.z, q.w);
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    if (!this.firstFrame) {
      this.firstFrame = true;
      this.status('ready');
    }
  };

  async init() {
    await RAPIER.init();
    if (this.disposed) return;

    this.world = new RAPIER.World({
      x: 0,
      y: -9.81,
      z: 0,
    });
    this.world.timestep = 1 / 120;

    this.draco.setDecoderPath('/draco/');
    const loader = new GLTFLoader().setDRACOLoader(this.draco);

    const [food, hand] = await Promise.all([
      loader.loadAsync('/assets/models/alhoaria-ingredientes.glb'),
      loader.loadAsync('/assets/models/alhoaria-mao-chef.glb'),
    ]);

    if (this.disposed) return;

    this.root = food.scene;
    this.hand = hand.scene;
    this.scene.add(this.root, this.hand);
    this.hand.visible = false;

    this.hand.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        if (o.name === 'chef_hand') this.handMesh = o;
      }
    });

    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    for (const name of names) {
      const o = this.root.getObjectByName(name);
      if (o) o.visible = false;
    }

    for (const partName of [
      'stage_bread',
      'stage_garlic',
      'stage_cream',
      'stage_gratin',
    ]) {
      this.root.getObjectByName(partName)?.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (m instanceof THREE.MeshStandardMaterial) {
              m.normalScale.set(0.18, 0.18);
              m.aoMapIntensity = 0.45;
              if (partName === 'stage_bread') m.roughness = 0.76;
            }
          }
        }
      });
    }

    const board = this.root.getObjectByName('stage_board');
    if (board) board.visible = true;

    this.root.updateMatrixWorld(true);
    if (board) {
      const center = new THREE.Box3()
        .setFromObject(board)
        .getCenter(new THREE.Vector3());
      this.boardCenter.copy(center);
      this.controls.target.copy(center).add(new THREE.Vector3(0, 0.06, 0));
    }
    this.resetCamera();
    this.renderer.setAnimationLoop(this.frame);
  }

  setSelection(values: string[]) {
    const next = new Set(values.filter((n) => names.includes(n)));
    for (const old of this.selected) {
      if (!next.has(old)) this.remove(old);
    }
    this.selected = next;
    this.queue = this.queue.filter((n) => next.has(n));

    if (this.active && !next.has(this.active.name)) {
      this.active = null;
      this.clearHeld();
      this.hand.visible = false;
    }

    for (const n of names) {
      if (
        next.has(n) &&
        !this.bodies.has(n) &&
        !this.queue.includes(n) &&
        this.active?.name !== n
      ) {
        if (this.reduced) {
          const instant = this.root.getObjectByName(n);
          if (instant) {
            instant.visible = true;
            instant.traverse((o) => (o.visible = true));
          }
          this.bodies.set(n, []);
        } else {
          this.queue.push(n);
        }
      }
    }
  }

  replay() {
    const copy = [...this.selected];
    for (const n of copy) this.remove(n);
    this.queue = [];
    this.active = null;
    this.clearHeld();
    this.hand.visible = false;
    this.selected.clear();
    this.setSelection(copy);
  }

  remove(name: string) {
    for (const b of this.bodies.get(name) || []) {
      this.world.removeRigidBody(b.body);
      this.world.removeRigidBody(b.floor);
      b.parent.add(b.object);
      b.object.position.copy(b.position);
      b.object.quaternion.copy(b.rotation);
    }
    this.bodies.delete(name);
    const node = this.root?.getObjectByName(name);
    if (node) node.visible = false;
  }

  release(name: string, object: THREE.Object3D) {
    const parent = object.parent || this.scene;
    const position = object.position.clone();
    const rotation = object.quaternion.clone();

    object.updateWorldMatrix(true, true);
    const pos = object.getWorldPosition(new THREE.Vector3());
    const q = object.getWorldQuaternion(new THREE.Quaternion());
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());

    this.scene.attach(object);

    const group = 1 << names.indexOf(name);
    const groups = (group << 16) | group;
    const center = box.getCenter(new THREE.Vector3());
    const offset = center.clone().sub(pos).applyQuaternion(q.clone().invert());

    const floor = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, box.min.y - 0.004, pos.z)
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        Math.max(0.003, size.x * 0.38),
        0.004,
        Math.max(0.003, size.z * 0.38)
      )
        .setFriction(0.9)
        .setCollisionGroups(groups),
      floor
    );

    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(pos.x, pos.y + 0.105, pos.z)
        .setRotation(q)
        .setLinearDamping(0.5)
        .setAngularDamping(2)
        .setCcdEnabled(true)
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        Math.max(0.002, size.x * 0.5),
        Math.max(0.002, size.y * 0.5),
        Math.max(0.002, size.z * 0.5)
      )
        .setTranslation(offset.x, offset.y, offset.z)
        .setFriction(0.85)
        .setRestitution(0.02)
        .setDensity(500)
        .setCollisionGroups(groups),
      body
    );

    const list = this.bodies.get(name) || [];
    list.push({
      object,
      body,
      floor,
      parent,
      position,
      rotation,
    });
    this.bodies.set(name, list);
  }

  clearHeld() {
    if (this.held) {
      this.scene.remove(this.held.object);
      this.held = undefined;
    }
  }

  resize() {
    const { width, height } = this.mount.getBoundingClientRect();
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  resetCamera() {
    const d = this.camera.aspect < 1 ? 0.55 : 0.48;
    this.camera.position
      .copy(this.controls.target)
      .add(new THREE.Vector3(d * 0.5, d * 0.62, d));
    this.controls.update();
  }

  rotate(a: number) {
    const p = this.camera.position
      .clone()
      .sub(this.controls.target)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
    this.camera.position.copy(this.controls.target).add(p);
    this.controls.update();
  }

  zoom(f: number) {
    const v = this.camera.position.clone().sub(this.controls.target);
    v.setLength(
      THREE.MathUtils.clamp(
        v.length() * f,
        this.controls.minDistance,
        this.controls.maxDistance
      )
    );
    this.camera.position.copy(this.controls.target).add(v);
    this.controls.update();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clearHeld();
    this.renderer.setAnimationLoop(null);
    this.ro.disconnect();
    this.io.disconnect();
    this.controls.dispose();
    this.draco.dispose();
    this.torchSparksGeo?.dispose();
    (this.torchSparks?.material as THREE.Material)?.dispose();
    this.steamGeo?.dispose();
    (this.steamParticles?.material as THREE.Material)?.dispose();

    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          for (const v of Object.values(m)) {
            if (v instanceof THREE.Texture) v.dispose();
          }
          m.dispose();
        }
      }
    });
    this.world?.free();
    this.environmentMap?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Flame, RotateCcw, Sparkles } from "lucide-react";

export default function Hero3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [torchActive, setTorchActive] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a0a, 0.12);

    // Camera
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 1.4, 3.6);
    camera.lookAt(0, 0.1, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);

    // Lighting (Warm artisan kitchen: 3200K key light + orange rim torch light + dark fill)
    const ambientLight = new THREE.AmbientLight(0x221a14, 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.SpotLight(0xffecd0, 6.5);
    keyLight.position.set(2.5, 4.5, 3.0);
    keyLight.angle = Math.PI / 4;
    keyLight.penumbra = 0.6;
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    // Torch Rim Light (Maçarico laranja intenso)
    const torchLight = new THREE.PointLight(0xff6a1a, 8.0, 5.0);
    torchLight.position.set(-2.2, 1.2, -1.2);
    scene.add(torchLight);

    const fillLight = new THREE.PointLight(0xf0c75e, 2.5, 4.0);
    fillLight.position.set(1.5, -0.2, 1.8);
    scene.add(fillLight);

    // Main Group (Burger / Pão de Alho + Rustic Board)
    const foodGroup = new THREE.Group();
    scene.add(foodGroup);

    // 1. Rustic Wooden Board (Tábua de corte rústica)
    const boardGeo = new THREE.CylinderGeometry(1.65, 1.7, 0.14, 48);
    const boardMat = new THREE.MeshStandardMaterial({
      color: 0x3d271d,
      roughness: 0.85,
      metalness: 0.05,
    });
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.y = -0.07;
    board.receiveShadow = true;
    foodGroup.add(board);

    // 2. Bottom Bun (Pão de alho base crocante)
    const bunBottomGeo = new THREE.CylinderGeometry(1.05, 0.95, 0.32, 36);
    const bunMat = new THREE.MeshStandardMaterial({
      color: 0xd49b4b,
      roughness: 0.65,
      metalness: 0.05,
    });
    const bunBottom = new THREE.Mesh(bunBottomGeo, bunMat);
    bunBottom.position.y = 0.16;
    bunBottom.castShadow = true;
    bunBottom.receiveShadow = true;
    foodGroup.add(bunBottom);

    // 3. Garlic Butter Glaze rim (Creme de alho artesanal)
    const garlicCreamGeo = new THREE.TorusGeometry(1.02, 0.06, 16, 40);
    const garlicCreamMat = new THREE.MeshStandardMaterial({
      color: 0xfff3d6,
      roughness: 0.3,
      metalness: 0.1,
    });
    const garlicCream = new THREE.Mesh(garlicCreamGeo, garlicCreamMat);
    garlicCream.rotation.x = Math.PI / 2;
    garlicCream.position.y = 0.32;
    foodGroup.add(garlicCream);

    // 4. Slow-cooked Ribs / Juicy Meat Blend (Costela desfiada 6h)
    const meatGeo = new THREE.CylinderGeometry(1.08, 1.05, 0.38, 32);
    const meatMat = new THREE.MeshStandardMaterial({
      color: 0x2b140d,
      roughness: 0.8,
      metalness: 0.15,
    });
    const meat = new THREE.Mesh(meatGeo, meatMat);
    meat.position.y = 0.48;
    meat.castShadow = true;
    foodGroup.add(meat);

    // Meat texture chunks (Costela suculenta desfiada)
    const chunkMat = new THREE.MeshStandardMaterial({
      color: 0x3a1b12,
      roughness: 0.75,
    });
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const r = 1.05 + Math.random() * 0.08;
      const chunkGeo = new THREE.SphereGeometry(0.08 + Math.random() * 0.05, 8, 8);
      const chunk = new THREE.Mesh(chunkGeo, chunkMat);
      chunk.position.set(Math.cos(angle) * r, 0.46 + (Math.random() - 0.5) * 0.1, Math.sin(angle) * r);
      chunk.scale.set(1.4, 0.8, 1.2);
      foodGroup.add(chunk);
    }

    // 5. Melted Artisan Cheese Layer (Queijo gratinado no maçarico)
    const cheeseMat = new THREE.MeshStandardMaterial({
      color: 0xf5bb3d,
      roughness: 0.38,
      metalness: 0.08,
      emissive: 0x241002,
      emissiveIntensity: 0.2,
    });

    // Main cheese blanket
    const cheeseGeo = new THREE.CylinderGeometry(1.15, 1.18, 0.12, 32);
    const cheese = new THREE.Mesh(cheeseGeo, cheeseMat);
    cheese.position.y = 0.7;
    cheese.castShadow = true;
    foodGroup.add(cheese);

    // Melty Cheese Drips (Queijo escorrendo pelas laterais)
    const dripsGroup = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2 + Math.random() * 0.3;
      const dripLength = 0.25 + Math.random() * 0.28;
      const dripGeo = new THREE.ConeGeometry(0.12, dripLength, 12);
      const drip = new THREE.Mesh(dripGeo, cheeseMat);
      drip.rotation.x = Math.PI;
      const r = 1.12;
      drip.position.set(
        Math.cos(angle) * r,
        0.66 - dripLength / 2,
        Math.sin(angle) * r
      );
      dripsGroup.add(drip);
    }
    foodGroup.add(dripsGroup);

    // Charred spots on cheese (Pontos dourados tostados pelo fogo do maçarico)
    const charMat = new THREE.MeshStandardMaterial({
      color: 0x1f0e05,
      roughness: 0.9,
    });
    for (let i = 0; i < 14; i++) {
      const spotAngle = Math.random() * Math.PI * 2;
      const spotR = Math.random() * 0.9;
      const spotGeo = new THREE.CircleGeometry(0.06 + Math.random() * 0.06, 8);
      const spot = new THREE.Mesh(spotGeo, charMat);
      spot.rotation.x = -Math.PI / 2;
      spot.position.set(
        Math.cos(spotAngle) * spotR,
        0.761,
        Math.sin(spotAngle) * spotR
      );
      foodGroup.add(spot);
    }

    // 6. Top Artisan Bun (Pão de alho dourado abaulado)
    const bunTopGeo = new THREE.SphereGeometry(1.08, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.44);
    const bunTop = new THREE.Mesh(bunTopGeo, bunMat);
    bunTop.position.y = 0.74;
    bunTop.castShadow = true;
    foodGroup.add(bunTop);

    // Sesame Seeds / Ervas finas no topo do pão
    const seedGeo = new THREE.SphereGeometry(0.024, 6, 6);
    const seedMat = new THREE.MeshStandardMaterial({
      color: 0xf5eedc,
      roughness: 0.5,
    });
    for (let i = 0; i < 75; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * (Math.PI * 0.38);
      const r = 1.08;
      const seed = new THREE.Mesh(seedGeo, seedMat);
      seed.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        0.74 + r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
      seed.scale.set(1.4, 0.6, 2.0);
      seed.lookAt(seed.position.clone().multiplyScalar(1.5));
      foodGroup.add(seed);
    }

    // 7. Subtle Steam Particles (Fumaça leve de lanche quentinho)
    const steamCount = 35;
    const steamGeo = new THREE.BufferGeometry();
    const steamPositions = new Float32Array(steamCount * 3);
    const steamSpeeds = new Float32Array(steamCount);

    for (let i = 0; i < steamCount; i++) {
      steamPositions[i * 3] = (Math.random() - 0.5) * 0.8;
      steamPositions[i * 3 + 1] = 0.9 + Math.random() * 1.2;
      steamPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
      steamSpeeds[i] = 0.005 + Math.random() * 0.008;
    }
    steamGeo.setAttribute("position", new THREE.BufferAttribute(steamPositions, 3));

    const steamMat = new THREE.PointsMaterial({
      color: 0xffe8d1,
      size: 0.12,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
    });
    const steamParticles = new THREE.Points(steamGeo, steamMat);
    foodGroup.add(steamParticles);

    // Initial tilt for beautiful perspective
    foodGroup.rotation.x = 0.28;
    foodGroup.rotation.y = -0.4;

    // Interaction & Animation loop
    let isDragging = false;
    let prevMouseX = 0;
    let targetRotationY = -0.4;
    let currentRotationY = -0.4;
    let torchTimer = 0;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      isDragging = true;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      prevMouseX = clientX;
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const deltaX = clientX - prevMouseX;
      targetRotationY += deltaX * 0.009;
      prevMouseX = clientX;
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener("mousedown", onPointerDown);
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);

    dom.addEventListener("touchstart", onPointerDown, { passive: true });
    window.addEventListener("touchmove", onPointerMove, { passive: true });
    window.addEventListener("touchend", onPointerUp);

    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Smooth auto-rotation when user is not dragging
      if (!isDragging) {
        targetRotationY += 0.0028; // ~16 deg/s
      }

      currentRotationY += (targetRotationY - currentRotationY) * 0.07;
      foodGroup.rotation.y = currentRotationY;

      // Floating breath
      foodGroup.position.y = Math.sin(Date.now() * 0.0018) * 0.04;

      // Animate Steam
      const pos = steamGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < steamCount; i++) {
        pos[i * 3 + 1] += steamSpeeds[i];
        pos[i * 3] += Math.sin(Date.now() * 0.002 + i) * 0.0015;
        if (pos[i * 3 + 1] > 2.2) {
          pos[i * 3 + 1] = 0.85;
          pos[i * 3] = (Math.random() - 0.5) * 0.7;
          pos[i * 3 + 2] = (Math.random() - 0.5) * 0.7;
        }
      }
      steamGeo.attributes.position.needsUpdate = true;

      // Torch flame wave effect during load
      torchTimer += 0.02;
      if (torchTimer < 3.0) {
        const torchGlow = Math.sin(torchTimer * 2.5) * 4.0 + 7.0;
        torchLight.intensity = Math.max(2.0, torchGlow);
        cheeseMat.emissive.setHex(0x552200);
        cheeseMat.emissiveIntensity = Math.abs(Math.sin(torchTimer * 3)) * 0.45;
      } else {
        cheeseMat.emissiveIntensity = 0.12;
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      dom.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      dom.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("touchmove", onPointerMove);
      window.removeEventListener("touchend", onPointerUp);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      className="relative w-full h-[480px] sm:h-[560px] lg:h-[620px] rounded-3xl overflow-hidden bg-gradient-to-b from-[#120e0b] via-[#0d0a08] to-carvao border border-carvao-borda shadow-2xl flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 3D Canvas Mount */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* Floating Badges & Interactions */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-macarico bg-macarico/10 border border-macarico/30 rounded-full flex items-center gap-1.5 backdrop-blur-md">
          <Flame className="w-3.5 h-3.5 animate-pulse" />
          Gratinado no Maçarico
        </span>
        <span className="hidden sm:inline-flex px-3 py-1 text-xs font-medium text-osso-muted bg-carvao/80 border border-carvao-borda rounded-full backdrop-blur-md">
          Costela 6 Horas
        </span>
      </div>

      {/* Bottom Hint */}
      <div className="absolute bottom-4 inset-x-0 mx-auto w-fit z-10 flex items-center gap-2 px-4 py-1.5 bg-carvao/85 border border-white/10 rounded-full text-xs text-osso-muted backdrop-blur-md shadow-lg pointer-events-none transition-opacity duration-300">
        <RotateCcw className="w-3.5 h-3.5 text-ouro animate-spin" style={{ animationDuration: "8s" }} />
        <span>Arraste para girar em 360°</span>
      </div>

      {/* Warm Ambient Glow Backdrops */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-macarico/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-queijo/10 rounded-full blur-3xl pointer-events-none" />
    </div>
  );
}

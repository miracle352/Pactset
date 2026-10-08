"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type SceneMode = "loading" | "interactive" | "fallback";

export function PavilionScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<SceneMode>("loading");

  useEffect(() => {
    const canvas = canvasRef.current;
    const reduced = globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = globalThis.matchMedia("(pointer: coarse)").matches;
    const saveData = "connection" in navigator && Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
    if (!canvas || reduced || saveData) {
      setMode("fallback");
      return;
    }
    const surface = canvas;

    let disposed = false;
    let frame = 0;
    let visible = true;
    let pointerX = 0;
    let pointerY = 0;
    let storyStage = 0;

    async function start() {
      try {
        const THREE = await import("three");
        const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
        if (disposed) return;

        const renderer = new THREE.WebGLRenderer({ canvas: surface, antialias: !coarse, alpha: false, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, coarse ? 1 : 1.5));
        renderer.shadowMap.enabled = !coarse;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.04;
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        const scene = new THREE.Scene();
        scene.fog = new THREE.Fog(0x05070a, 18, 38);
        const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
        camera.position.set(8.8, 4.6, 17.8);

        const pmrem = new THREE.PMREMGenerator(renderer);
        const room = new RoomEnvironment();
        const environment = pmrem.fromScene(room, 0.035);
        scene.environment = environment.texture;
        room.dispose();
        pmrem.dispose();

        const pavilion = new THREE.Group();
        pavilion.rotation.y = -0.12;
        scene.add(pavilion);

        const foundation = new THREE.MeshStandardMaterial({ color: 0x15191f, metalness: 0.42, roughness: 0.42 });
        const deck = new THREE.MeshStandardMaterial({ color: 0x303139, metalness: 0.18, roughness: 0.46 });
        const steel = new THREE.MeshStandardMaterial({ color: 0x9aa2ad, metalness: 0.92, roughness: 0.2 });
        const blackSteel = new THREE.MeshStandardMaterial({ color: 0x20242b, metalness: 0.86, roughness: 0.28 });
        const furnishing = new THREE.MeshStandardMaterial({ color: 0x4b4d56, metalness: 0.22, roughness: 0.5 });
        const fabric = new THREE.MeshStandardMaterial({ color: 0x777ca6, metalness: 0.08, roughness: 0.74 });
        const roofGlass = new THREE.MeshPhysicalMaterial({ color: 0xcbd5e5, transparent: true, opacity: 0.38, transmission: 0.66, roughness: 0.16, metalness: 0.03, thickness: 0.24, envMapIntensity: 1.45, side: THREE.DoubleSide, depthWrite: false });
        const wallGlass = new THREE.MeshPhysicalMaterial({ color: 0xb9c6d8, transparent: true, opacity: 0.24, transmission: 0.72, roughness: 0.12, metalness: 0.02, thickness: 0.16, envMapIntensity: 1.3, side: THREE.DoubleSide, depthWrite: false });
        const warmSurface = new THREE.MeshStandardMaterial({ color: 0xb96f3d, emissive: 0xff8a43, emissiveIntensity: 0.18, metalness: 0.12, roughness: 0.56 });
        const equipment = new THREE.MeshStandardMaterial({ color: 0x333944, metalness: 0.68, roughness: 0.35 });

        const assembly: Array<{
          object: import("three").Object3D;
          start: import("three").Vector3;
          target: import("three").Vector3;
          startScale: import("three").Vector3;
          targetScale: import("three").Vector3;
          delay: number;
        }> = [];

        function register(object: import("three").Object3D, delay: number, offset: [number, number, number], startScale: [number, number, number] = [1, 0.04, 1]) {
          const target = object.position.clone();
          const start = target.clone().add(new THREE.Vector3(...offset));
          const targetScale = object.scale.clone();
          object.position.copy(start);
          object.scale.set(...startScale);
          assembly.push({ object, start, target, startScale: object.scale.clone(), targetScale, delay });
        }

        function addBox(size: [number, number, number], position: [number, number, number], material: import("three").Material, delay: number, offset: [number, number, number] = [0, -1, 0], startScale?: [number, number, number]) {
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
          mesh.position.set(...position);
          mesh.castShadow = material !== wallGlass && material !== roofGlass;
          mesh.receiveShadow = true;
          pavilion.add(mesh);
          register(mesh, delay, offset, startScale);
          return mesh;
        }

        addBox([12.6, 0.42, 7.8], [0, -1.55, 0], foundation, 0, [0, -0.8, 0], [0.72, 0.2, 0.72]);
        addBox([11.6, 0.12, 6.8], [0, -1.27, 0], deck, 0.05, [0, -0.65, 0], [0.76, 0.2, 0.76]);

        const postPositions = [-5.4, -2.7, 0, 2.7, 5.4];
        for (const z of [-3.18, 3.18]) {
          for (const x of postPositions) addBox([0.12, 4.05, 0.12], [x, 0.76, z], steel, 0.16 + (Math.abs(x) / 5.4) * 0.05, [0, -2, 0], [1, 0.02, 1]);
          addBox([11.05, 0.14, 0.14], [0, 2.79, z], steel, 0.25, [0, -0.5, 0], [0.05, 1, 1]);
        }
        for (const x of [-5.4, 5.4]) addBox([0.12, 4.05, 6.25], [x, 0.76, 0], steel, 0.21, [0, -1.7, 0], [1, 0.05, 0.08]);

        const glassPanelX = [-4.05, -1.35, 1.35, 4.05];
        for (const z of [-3.12, 3.12]) {
          for (const x of glassPanelX) {
            if (z > 0 && Math.abs(x) < 2) continue;
            addBox([2.48, 3.72, 0.045], [x, 0.73, z], wallGlass, 0.34, [0, 0.55, 0], [0.96, 0.08, 0.96]);
          }
        }
        for (const x of [-5.34, 5.34]) {
          for (const z of [-1.55, 1.55]) addBox([0.045, 3.72, 2.88], [x, 0.73, z], wallGlass, 0.36, [0, 0.5, 0], [0.96, 0.08, 0.96]);
        }

        const leftRoof = addBox([11.35, 0.09, 3.75], [0, 3.34, -1.62], roofGlass, 0.42, [0, 2.2, -0.2], [0.9, 0.2, 0.9]);
        leftRoof.rotation.x = -0.33;
        const rightRoof = addBox([11.35, 0.09, 3.75], [0, 3.34, 1.62], roofGlass, 0.46, [0, 2.2, 0.2], [0.9, 0.2, 0.9]);
        rightRoof.rotation.x = 0.33;
        addBox([11.5, 0.13, 0.13], [0, 3.94, 0], steel, 0.5, [0, 1.2, 0], [0.08, 1, 1]);
        for (const x of postPositions) {
          const rafterA = addBox([0.08, 0.09, 3.72], [x, 3.34, -1.62], steel, 0.48, [0, 1.1, 0], [1, 1, 0.08]);
          rafterA.rotation.x = -0.33;
          const rafterB = addBox([0.08, 0.09, 3.72], [x, 3.34, 1.62], steel, 0.48, [0, 1.1, 0], [1, 1, 0.08]);
          rafterB.rotation.x = 0.33;
        }

        addBox([4.6, 0.24, 1.9], [2.42, -1.05, -1.92], blackSteel, 0.56, [0, -0.45, 0], [0.5, 0.2, 0.5]);
        addBox([4.25, 2.05, 0.13], [2.42, 0.08, -2.78], warmSurface, 0.6, [0, 0.45, 0], [0.82, 0.08, 0.82]);
        addBox([3.6, 0.09, 0.55], [2.42, 0.58, -2.47], blackSteel, 0.64, [0, -0.2, 0], [0.7, 0.3, 0.7]);

        for (const [x, z] of [[-3.45, -1.15], [-1.5, -1.15], [-3.45, 1.15], [-1.5, 1.15]] as Array<[number, number]>) {
          const table = new THREE.Group();
          const top = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.72, 0.1, 32), furnishing);
          top.position.y = 0.7;
          const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.68, 16), blackSteel);
          stem.position.y = 0.32;
          top.castShadow = stem.castShadow = true;
          table.add(top, stem);
          table.position.set(x, -1.18, z);
          pavilion.add(table);
          register(table, 0.64, [0, -0.4, 0], [0.78, 0.06, 0.78]);
        }

        for (const [x, z, rotation] of [[-4.35, -1.15, Math.PI / 2], [-2.55, -1.15, -Math.PI / 2], [-4.35, 1.15, Math.PI / 2], [-2.55, 1.15, -Math.PI / 2]] as Array<[number, number, number]>) {
          const chair = new THREE.Group();
          const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.42), fabric);
          seat.position.y = 0.42;
          const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.08), fabric);
          back.position.set(0, 0.66, -0.18);
          chair.add(seat, back);
          chair.position.set(x, -1.2, z);
          chair.rotation.y = rotation;
          pavilion.add(chair);
          register(chair, 0.7, [0, -0.28, 0], [0.82, 0.08, 0.82]);
        }

        for (const [x, z] of [[4.35, 1.65], [3.55, 1.7], [4.45, 0.82]] as Array<[number, number]>) {
          const flightCase = addBox([0.72, 0.58, 0.58], [x, -0.92, z], equipment, 0.69, [0.8, 0, 0], [0.72, 0.72, 0.72]);
          const trim = new THREE.LineSegments(new THREE.EdgesGeometry(flightCase.geometry), new THREE.LineBasicMaterial({ color: 0x9da7b4, transparent: true, opacity: 0.7 }));
          flightCase.add(trim);
        }

        const crewMaterial = new THREE.MeshStandardMaterial({ color: 0x6972a4, metalness: 0.08, roughness: 0.72 });
        for (const [x, z] of [[0.2, 1.7], [1.05, 1.2], [0.55, 0.55]] as Array<[number, number]>) {
          const person = new THREE.Group();
          const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.5, 5, 10), crewMaterial);
          body.position.y = 0.58;
          const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), crewMaterial);
          head.position.y = 1.04;
          body.castShadow = head.castShadow = true;
          person.add(body, head);
          person.position.set(x, -1.18, z);
          pavilion.add(person);
          register(person, 0.75, [0, -0.32, 0], [0.78, 0.08, 0.78]);
        }

        const floorMaterial = new THREE.MeshPhysicalMaterial({ color: 0x090b0e, metalness: 0.42, roughness: 0.28, clearcoat: 0.72, clearcoatRoughness: 0.3, envMapIntensity: 0.95 });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(62, 48), floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -1.78;
        floor.receiveShadow = true;
        scene.add(floor);

        const keyLight = new THREE.DirectionalLight(0xc6d0ea, 3.2);
        keyLight.position.set(-7, 10, 7);
        keyLight.castShadow = !coarse;
        keyLight.shadow.mapSize.set(coarse ? 512 : 1024, coarse ? 512 : 1024);
        keyLight.shadow.camera.left = -10;
        keyLight.shadow.camera.right = 10;
        keyLight.shadow.camera.top = 10;
        keyLight.shadow.camera.bottom = -7;
        keyLight.shadow.bias = -0.0008;
        scene.add(keyLight);
        const ambient = new THREE.HemisphereLight(0xdce5fa, 0x17191d, 0.72);
        scene.add(ambient);
        const interiorLight = new THREE.RectAreaLight(0xffa15f, 48, 7.4, 4.5);
        interiorLight.position.set(0.4, 1.5, -2.45);
        interiorLight.lookAt(0.4, 0.2, 1.8);
        scene.add(interiorLight);
        const warmSpill = new THREE.SpotLight(0xff9b55, 76, 30, Math.PI / 5.2, 0.7, 1.45);
        warmSpill.position.set(1.4, 4.8, -1.5);
        warmSpill.target.position.set(1.1, -1.7, 5.6);
        warmSpill.castShadow = !coarse;
        scene.add(warmSpill, warmSpill.target);
        const stageLight = new THREE.PointLight(0xffb16f, 36, 13, 1.55);
        stageLight.position.set(2.4, 1.25, -1.35);
        scene.add(stageLight);

        function resize() {
          const width = Math.max(1, surface.clientWidth);
          const height = Math.max(1, surface.clientHeight);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        }
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(surface);
        resize();

        const wrapper = surface.closest(".pavilion-narrative") ?? document.body;
        const stageObserver = new IntersectionObserver((entries) => {
          for (const entry of entries) if (entry.isIntersecting) storyStage = Number((entry.target as HTMLElement).dataset.sceneStage ?? 0);
        }, { rootMargin: "-45% 0px -45%", threshold: 0 });
        wrapper.querySelectorAll("[data-scene-stage]").forEach((item) => {
          stageObserver.observe(item);
        });
        const visibilityObserver = new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          if (visible && !frame) frame = requestAnimationFrame(render);
        }, { rootMargin: "140px" });
        visibilityObserver.observe(wrapper);

        const onPointer = (event: PointerEvent) => {
          if (coarse) return;
          pointerX = (event.clientX / globalThis.innerWidth - 0.5) * 2;
          pointerY = (event.clientY / globalThis.innerHeight - 0.5) * 2;
        };
        globalThis.addEventListener("pointermove", onPointer, { passive: true });

        const darkMode = () => document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
        const startTime = performance.now();
        const lookAt = new THREE.Vector3();
        const backgroundTarget = new THREE.Color();
        const floorTarget = new THREE.Color();
        const fogTarget = new THREE.Color();
        const glassTarget = new THREE.Color();
        const clamp = (value: number) => Math.max(0, Math.min(1, value));
        const ease = (value: number) => 1 - (1 - value) ** 3;

        function render(now = performance.now()) {
          frame = 0;
          if (disposed || !visible) return;
          const elapsed = Math.max(0, (now - startTime) / 1000);
          const portrait = surface.clientWidth < 720;
          const stageShift = Math.min(3, storyStage) * 0.18;
          const cameraX = portrait ? 7.8 - stageShift : 9.25 - stageShift * 1.25;
          const cameraY = portrait ? 5.25 : 4.65;
          const cameraZ = portrait ? 20.8 - stageShift : 18.3 - stageShift;
          camera.position.x += (cameraX + pointerX * (portrait ? 0.08 : 0.24) - camera.position.x) * 0.045;
          camera.position.y += (cameraY - pointerY * (portrait ? 0.06 : 0.13) - camera.position.y) * 0.045;
          camera.position.z += (cameraZ - camera.position.z) * 0.045;
          pavilion.position.x += ((portrait ? 0 : 2.25) - pavilion.position.x) * 0.05;
          pavilion.position.y += ((portrait ? -0.48 : -0.1) - pavilion.position.y) * 0.05;
          pavilion.scale.setScalar(portrait ? 0.82 : 1);
          lookAt.set(portrait ? 0 : 2.15, portrait ? -0.15 : 0.35, 0);
          camera.lookAt(lookAt);

          const assemblyTime = clamp(elapsed / 2.75);
          for (const item of assembly) {
            const progress = ease(clamp((assemblyTime - item.delay) / Math.max(0.06, 1 - item.delay)));
            item.object.position.lerpVectors(item.start, item.target, progress);
            item.object.scale.lerpVectors(item.startScale, item.targetScale, progress);
          }

          const dark = darkMode();
          backgroundTarget.setHex(dark ? 0x030508 : 0xe9ebef);
          fogTarget.setHex(dark ? 0x07090d : 0xd9dde5);
          floorTarget.setHex(dark ? 0x090b0e : 0xa8afb9);
          glassTarget.setHex(dark ? 0xb5c3dc : 0xc1cbd9);
          if (scene.fog) scene.fog.color.lerp(fogTarget, 0.045);
          floorMaterial.color.lerp(floorTarget, 0.045);
          roofGlass.color.lerp(glassTarget, 0.045);
          wallGlass.color.lerp(glassTarget, 0.045);
          renderer.setClearColor(backgroundTarget, 1);
          renderer.toneMappingExposure += ((dark ? 1.04 : 0.84) - renderer.toneMappingExposure) * 0.04;
          keyLight.intensity += ((dark ? 2.8 : 3.15) - keyLight.intensity) * 0.04;
          ambient.intensity += ((dark ? 0.62 : 0.88) - ambient.intensity) * 0.04;
          interiorLight.intensity += ((dark ? 52 : 24) + storyStage * 2 - interiorLight.intensity) * 0.04;
          warmSpill.intensity += ((dark ? 82 : 34) + storyStage * 3 - warmSpill.intensity) * 0.04;
          stageLight.intensity += ((dark ? 42 : 18) + storyStage * 2 - stageLight.intensity) * 0.04;
          warmSurface.emissiveIntensity += ((dark ? 0.22 : 0.08) - warmSurface.emissiveIntensity) * 0.04;

          renderer.render(scene, camera);
          frame = requestAnimationFrame(render);
        }

        setMode("interactive");
        frame = requestAnimationFrame(render);
        return () => {
          cancelAnimationFrame(frame);
          resizeObserver.disconnect();
          stageObserver.disconnect();
          visibilityObserver.disconnect();
          globalThis.removeEventListener("pointermove", onPointer);
          environment.dispose();
          renderer.dispose();
          scene.traverse((object) => {
            const mesh = object as import("three").Mesh;
            mesh.geometry?.dispose();
            if (mesh.material) {
              (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => {
                material.dispose();
              });
            }
          });
        };
      } catch (error) {
        console.warn("Pactset pavilion is using its static fallback.", error);
        if (!disposed) setMode("fallback");
      }
    }

    let cleanup: undefined | (() => void);
    start().then((value) => { cleanup = value; });
    return () => { disposed = true; cleanup?.(); };
  }, []);

  return (
    <figure className={`pavilion-scene is-${mode}`} aria-label={mode === "interactive" ? "Interactive glass-and-metal event pavilion assembling into a prepared venue" : "Static glass event pavilion fallback"}>
      <canvas ref={canvasRef} className="pavilion-canvas" />
      <div className="pavilion-fallback" aria-hidden="true">
        <div className="pavilion-media pavilion-light"><Image src="/images/pavilion-light.webp" alt="" fill priority sizes="100vw" /></div>
        <div className="pavilion-media pavilion-dark"><Image src="/images/pavilion-dark.webp" alt="" fill priority sizes="100vw" /></div>
      </div>
      <div className="scene-treatment" aria-hidden="true" />
    </figure>
  );
}

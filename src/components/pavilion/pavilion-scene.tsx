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
    let stage = 0;

    async function start() {
      try {
        const THREE = await import("three");
        if (disposed) return;

        const renderer = new THREE.WebGLRenderer({ canvas: surface, antialias: !coarse, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, coarse ? 1 : 1.45));
        renderer.shadowMap.enabled = !coarse;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x050608, 0.038);
        const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
        const venue = new THREE.Group();
        venue.position.y = -0.4;
        venue.scale.setScalar(0.92);
        scene.add(venue);

        const floorMaterial = new THREE.MeshPhysicalMaterial({ color: 0x090b0f, metalness: 0.58, roughness: 0.24, clearcoat: 0.75, clearcoatRoughness: 0.28 });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -1.72;
        floor.receiveShadow = true;
        scene.add(floor);

        const metal = new THREE.MeshStandardMaterial({ color: 0x727984, metalness: 0.94, roughness: 0.18 });
        const darkMetal = new THREE.MeshStandardMaterial({ color: 0x20242b, metalness: 0.88, roughness: 0.27 });
        const glass = new THREE.MeshPhysicalMaterial({ color: 0xb8c0d4, transparent: true, opacity: 0.23, transmission: 0.72, roughness: 0.12, metalness: 0.04, thickness: 0.34, side: THREE.DoubleSide });
        const warmGlass = new THREE.MeshPhysicalMaterial({ color: 0xffb36d, transparent: true, opacity: 0.56, emissive: 0xff6b24, emissiveIntensity: 0.34, roughness: 0.3 });

        const plinth = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.26, 7.4), darkMetal);
        plinth.position.y = -1.54;
        plinth.castShadow = true;
        plinth.receiveShadow = true;
        venue.add(plinth);

        const interior = new THREE.Mesh(new THREE.BoxGeometry(8.5, 2.8, 0.14), warmGlass);
        interior.position.set(0.35, -0.05, -2.72);
        venue.add(interior);

        const roof = new THREE.Mesh(new THREE.CylinderGeometry(5.25, 5.25, 6.8, 48, 1, true, 0, Math.PI), glass);
        roof.rotation.x = Math.PI / 2;
        roof.position.y = 2.95;
        venue.add(roof);

        const archCurve = (z: number) => new THREE.CatmullRomCurve3([
          new THREE.Vector3(-5.15, -1.35, z), new THREE.Vector3(-5.05, 1.5, z),
          new THREE.Vector3(-3.35, 3.55, z), new THREE.Vector3(0, 4.35, z),
          new THREE.Vector3(3.35, 3.55, z), new THREE.Vector3(5.05, 1.5, z),
          new THREE.Vector3(5.15, -1.35, z),
        ], false, "catmullrom", 0.38);

        for (const z of [-3.25, -2.15, -1.05, 0.05, 1.15, 2.25, 3.25]) {
          const arch = new THREE.Mesh(new THREE.TubeGeometry(archCurve(z), 72, 0.075, 8, false), metal);
          arch.castShadow = true;
          venue.add(arch);
        }
        for (const x of [-4.9, -2.45, 0, 2.45, 4.9]) {
          const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.065, 3.15, 6.55), metal);
          mullion.position.set(x, 0.18, 0);
          mullion.castShadow = true;
          venue.add(mullion);
        }
        const endGlass = new THREE.Mesh(new THREE.BoxGeometry(10.05, 3.05, 0.08), glass);
        endGlass.position.set(0, 0.16, 3.22);
        venue.add(endGlass);

        const stagePlatform = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.22, 2), darkMetal);
        stagePlatform.position.set(1.8, -1.19, -1.25);
        stagePlatform.castShadow = true;
        venue.add(stagePlatform);
        const tableMaterial = new THREE.MeshStandardMaterial({ color: 0x3c3f48, metalness: 0.3, roughness: 0.42 });
        for (let row = 0; row < 2; row += 1) {
          for (let column = 0; column < 4; column += 1) {
            const table = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.5, 0.08, 20), tableMaterial);
            table.position.set(-3.2 + column * 1.45, -0.58, 0.45 + row * 1.15);
            venue.add(table);
          }
        }

        const dependencyGroup = new THREE.Group();
        venue.add(dependencyGroup);
        const dependencyMaterials = [
          new THREE.MeshStandardMaterial({ color: 0x8e98ff, emissive: 0x4650e8, emissiveIntensity: 0.18, metalness: 0.45, roughness: 0.34 }),
          new THREE.MeshStandardMaterial({ color: 0xc9a06b, emissive: 0xff8b36, emissiveIntensity: 0.12, metalness: 0.38, roughness: 0.38 }),
          new THREE.MeshStandardMaterial({ color: 0x8ba9a4, emissive: 0x53b8a2, emissiveIntensity: 0.1, metalness: 0.4, roughness: 0.36 }),
        ];
        const origins = [[-8.3, -1.05, 2.7], [-7.4, -1.05, 0.4], [-6.8, -1.05, -2.5], [8.2, -1.05, 2.6], [7.35, -1.05, 0.2], [6.9, -1.05, -2.4]];
        const targets = [[-3.8, -1.05, 2.25], [-2.2, -1.05, 2.25], [-0.6, -1.05, 2.25], [3.8, -1.05, 1.65], [3.8, -1.05, 0.25], [3.8, -1.05, -1.15]];
        origins.forEach((origin, index) => {
          const item = new THREE.Mesh(new THREE.BoxGeometry(index < 3 ? 0.9 : 0.62, index < 3 ? 0.62 : 1.2, index < 3 ? 0.72 : 0.32), dependencyMaterials[index % dependencyMaterials.length]);
          item.position.set(origin[0], origin[1], origin[2]);
          item.userData.origin = new THREE.Vector3(origin[0], origin[1], origin[2]);
          item.userData.target = new THREE.Vector3(targets[index][0], targets[index][1], targets[index][2]);
          item.scale.setScalar(0.001);
          item.castShadow = true;
          dependencyGroup.add(item);
        });

        const paymentPath = new THREE.Mesh(new THREE.TorusGeometry(4.8, 0.025, 8, 120, Math.PI * 1.32), new THREE.MeshBasicMaterial({ color: 0xa9afff, transparent: true, opacity: 0 }));
        paymentPath.rotation.set(Math.PI / 2, 0.18, -0.5);
        paymentPath.position.y = -1.48;
        venue.add(paymentPath);

        const warm = new THREE.PointLight(0xff8c3c, 92, 24, 1.6);
        warm.position.set(0.2, 1.4, 0);
        warm.castShadow = !coarse;
        scene.add(warm);
        const spill = new THREE.SpotLight(0xffa35a, 105, 32, Math.PI / 4.5, 0.6, 1.35);
        spill.position.set(0, 4.4, -0.4);
        spill.target.position.set(0, -1.7, 8);
        scene.add(spill, spill.target);
        const daylight = new THREE.HemisphereLight(0xe8edff, 0x12141a, 0.6);
        scene.add(daylight);
        const edge = new THREE.DirectionalLight(0xb8c2ff, 2.8);
        edge.position.set(-7, 7, 6);
        scene.add(edge);

        function resize() {
          const { clientWidth: width, clientHeight: height } = surface;
          renderer.setSize(width, height, false);
          camera.aspect = width / Math.max(1, height);
          camera.updateProjectionMatrix();
        }
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(surface);
        resize();

        const wrapper = surface.closest(".pavilion-narrative") ?? document.body;
        const stageObserver = new IntersectionObserver((entries) => {
          for (const entry of entries) if (entry.isIntersecting) stage = Number((entry.target as HTMLElement).dataset.sceneStage ?? 0);
        }, { rootMargin: "-42% 0px -46%", threshold: 0 });
        wrapper.querySelectorAll("[data-scene-stage]").forEach((item) => {
          stageObserver.observe(item);
        });
        const visibilityObserver = new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          if (visible && !frame) frame = requestAnimationFrame(render);
        }, { rootMargin: "160px" });
        visibilityObserver.observe(wrapper);
        const onPointer = (event: PointerEvent) => {
          if (coarse) return;
          pointerX = (event.clientX / innerWidth - 0.5) * 2;
          pointerY = (event.clientY / innerHeight - 0.5) * 2;
        };
        globalThis.addEventListener("pointermove", onPointer, { passive: true });
        const darkMode = () => document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
        const startTime = performance.now();
        const scaleVector = new THREE.Vector3();
        const background = new THREE.Color();
        const floorColor = new THREE.Color();

        function render(now = performance.now()) {
          frame = 0;
          if (disposed || !visible) return;
          const elapsed = Math.max(0, (now - startTime) / 1000);
          const entrance = 1 - (1 - Math.min(1, elapsed / 1.35)) ** 3;
          const portrait = surface.clientWidth < 720;
          const cameraTargets = portrait
            ? [[0.35, 0.45, 19.5], [0.8, 0.2, 18.6], [-0.5, 0.1, 18.1], [0.2, 0.05, 17.7]]
            : [[2.2, 0.85, 20.4], [1.35, 0.55, 18.9], [0.15, 0.35, 18.3], [-0.9, 0.25, 17.8]];
          const cameraTarget = cameraTargets[Math.min(3, stage)];
          camera.position.x += (cameraTarget[0] + pointerX * (portrait ? 0.1 : 0.26) - camera.position.x) * 0.035;
          camera.position.y += (cameraTarget[1] - pointerY * (portrait ? 0.08 : 0.15) - camera.position.y) * 0.035;
          camera.position.z += (cameraTarget[2] - camera.position.z) * 0.035;
          camera.lookAt(0, 0.5, 0);
          venue.scale.setScalar(0.92 + entrance * 0.08);
          venue.position.y += ((stage === 0 ? -0.08 : 0) - venue.position.y) * 0.035;
          venue.rotation.y += ((stage * -0.035) + pointerX * 0.018 - venue.rotation.y) * 0.03;
          dependencyGroup.children.forEach((object) => {
            const item = object as import("three").Mesh;
            const targetScale = stage >= 1 ? 1 : 0.001;
            const nextPosition = stage >= 2 ? item.userData.target : item.userData.origin;
            scaleVector.set(targetScale, targetScale, targetScale);
            item.scale.lerp(scaleVector, 0.045);
            item.position.lerp(nextPosition, 0.035);
          });
          const paymentMaterial = paymentPath.material as import("three").MeshBasicMaterial;
          paymentMaterial.opacity += ((stage >= 3 ? 0.82 : 0) - paymentMaterial.opacity) * 0.045;
          paymentPath.rotation.z = -0.5 + Math.sin(elapsed * 0.35) * 0.012;
          const dark = darkMode();
          warmGlass.opacity += ((dark ? 0.56 : 0.32) - warmGlass.opacity) * 0.03;
          warmGlass.emissiveIntensity += ((dark ? 0.34 : 0.18) - warmGlass.emissiveIntensity) * 0.03;
          warm.intensity += ((dark ? 98 : 56) - warm.intensity) * 0.025;
          spill.intensity += ((dark ? 112 : 52) - spill.intensity) * 0.025;
          daylight.intensity += ((dark ? 0.42 : 1.8) - daylight.intensity) * 0.025;
          edge.intensity += ((dark ? 2.6 : 1.7) - edge.intensity) * 0.025;
          background.setHex(dark ? 0x030405 : 0xe8ebf2);
          floorColor.setHex(dark ? 0x090b0f : 0xcbd0da);
          scene.fog?.color.lerp(background, 0.03);
          floorMaterial.color.lerp(floorColor, 0.03);
          renderer.setClearColor(background, 1);
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
    <figure className={`pavilion-scene is-${mode}`} aria-label={mode === "interactive" ? "Interactive glass-and-metal event pavilion responding to the Pactset story" : "Static glass event pavilion fallback"}>
      <canvas ref={canvasRef} className="pavilion-canvas" />
      <div className="pavilion-fallback" aria-hidden="true">
        <div className="pavilion-media pavilion-light"><Image src="/images/pavilion-light.webp" alt="" fill priority sizes="100vw" /></div>
        <div className="pavilion-media pavilion-dark"><Image src="/images/pavilion-dark.webp" alt="" fill priority sizes="100vw" /></div>
      </div>
      <div className="scene-treatment" aria-hidden="true" />
      <figcaption className="scene-status">{mode === "interactive" ? "Interactive venue" : mode === "fallback" ? "Still venue · reduced motion" : "Preparing venue"}</figcaption>
    </figure>
  );
}

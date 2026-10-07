"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export function PavilionScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<"loading" | "interactive" | "fallback">("loading");

  useEffect(() => {
    const canvas = canvasRef.current;
    const reduced = globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = globalThis.matchMedia("(pointer: coarse)").matches;
    if (!canvas || reduced) { setMode("fallback"); return; }
    const surface = canvas;
    let disposed = false;
    let frame = 0;
    let visible = true;
    let pointerX = 0; let pointerY = 0; let stage = 0;

    async function start() {
      try {
        const THREE = await import("three");
        if (disposed) return;
        const renderer = new THREE.WebGLRenderer({ canvas: surface, antialias: !coarse, alpha: true, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, coarse ? 1.15 : 1.5));
        renderer.shadowMap.enabled = !coarse;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x05070c, 0.045);
        const camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
        const pavilion = new THREE.Group(); scene.add(pavilion);

        const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshPhysicalMaterial({ color: 0x080b12, metalness: .62, roughness: .23, clearcoat: .8, clearcoatRoughness: .25 }));
        floor.rotation.x = -Math.PI / 2; floor.position.y = -1.46; floor.receiveShadow = true; scene.add(floor);

        const metal = new THREE.MeshStandardMaterial({ color: 0x606a80, metalness: .94, roughness: .2 });
        const glass = new THREE.MeshPhysicalMaterial({ color: 0x9eaee8, transparent: true, opacity: .18, transmission: .82, roughness: .12, metalness: .04, thickness: .3, side: THREE.DoubleSide });
        const warmGlass = new THREE.MeshPhysicalMaterial({ color: 0xffae5d, transparent: true, opacity: .25, emissive: 0xff6b18, emissiveIntensity: .32, transmission: .38, roughness: .24 });
        const slab = new THREE.Mesh(new THREE.BoxGeometry(9.5, .25, 5.8), metal); slab.position.y = -1.28; slab.castShadow = true; pavilion.add(slab);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(10.2, .22, 6.3), metal); roof.position.y = 3.25; roof.castShadow = true; pavilion.add(roof);
        const glassShell = new THREE.Mesh(new THREE.BoxGeometry(9.3, 4.35, 5.4), glass); glassShell.position.y = .95; pavilion.add(glassShell);
        const interior = new THREE.Mesh(new THREE.BoxGeometry(7.1, 3.2, 3.5), warmGlass); interior.position.set(.35, .65, -.18); pavilion.add(interior);
        for (const x of [-4.55, -1.5, 1.5, 4.55]) for (const z of [-2.65, 2.65]) { const beam = new THREE.Mesh(new THREE.BoxGeometry(.12, 4.55, .12), metal); beam.position.set(x, .98, z); beam.castShadow = true; pavilion.add(beam); }
        for (const z of [-2.65, 2.65]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(9.4, .1, .12), metal); rail.position.set(0, .75, z); pavilion.add(rail); }

        const tableMaterial = new THREE.MeshStandardMaterial({ color: 0x25283a, metalness: .35, roughness: .36 });
        for (let i = 0; i < 4; i++) { const table = new THREE.Mesh(new THREE.CylinderGeometry(.55, .65, .09, 20), tableMaterial); table.position.set(-2.6 + i * 1.8, -.2, -.05 + (i % 2) * 1.1); pavilion.add(table); }

        const warm = new THREE.PointLight(0xff8b36, 74, 22, 1.75); warm.position.set(.4, 1.5, 0); warm.castShadow = !coarse; scene.add(warm);
        const spill = new THREE.SpotLight(0xff9c48, 65, 28, Math.PI / 4.2, .55, 1.45); spill.position.set(0, 4, 1); spill.target.position.set(0, -1.5, 6); scene.add(spill, spill.target);
        const daylight = new THREE.HemisphereLight(0xdce7ff, 0x101626, 1.1); scene.add(daylight);
        const edge = new THREE.DirectionalLight(0x889dff, 2.4); edge.position.set(-6, 7, 4); scene.add(edge);

        const dependencyGroup = new THREE.Group(); pavilion.add(dependencyGroup);
        const colors = [0x8e9bff, 0xffbb69, 0x70d8c1];
        for (let i = 0; i < 9; i++) { const node = new THREE.Mesh(new THREE.IcosahedronGeometry(.1 + (i % 3) * .025, 1), new THREE.MeshStandardMaterial({ color: colors[i % 3], emissive: colors[i % 3], emissiveIntensity: .65 })); const a = i / 9 * Math.PI * 2; node.position.set(Math.cos(a) * 6.2, -.85 + (i % 3) * .65, Math.sin(a) * 4.2); dependencyGroup.add(node); }
        dependencyGroup.visible = false;

        const paymentLine = new THREE.Mesh(new THREE.TorusGeometry(4.9, .035, 8, 100, Math.PI * 1.45), new THREE.MeshBasicMaterial({ color: 0x9da7ff, transparent: true, opacity: .85 }));
        paymentLine.rotation.set(Math.PI / 2, .2, -.55); paymentLine.position.y = -1.16; paymentLine.visible = false; pavilion.add(paymentLine);

        function resize() { const { clientWidth: width, clientHeight: height } = surface; renderer.setSize(width, height, false); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); }
        const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(surface); resize();
        const wrapper = surface.closest(".cinematic-landing") ?? document.body;
        const stageObserver = new IntersectionObserver((entries) => { for (const entry of entries) if (entry.isIntersecting) stage = Number((entry.target as HTMLElement).dataset.sceneStage ?? 0); }, { rootMargin: "-35% 0px -45%", threshold: 0 });
        wrapper.querySelectorAll("[data-scene-stage]").forEach((item) => { stageObserver.observe(item); });
        const visibilityObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible && !frame) frame = requestAnimationFrame(render); }, { rootMargin: "120px" }); visibilityObserver.observe(surface);
        const onPointer = (event: PointerEvent) => { if (coarse) return; pointerX = (event.clientX / innerWidth - .5) * 2; pointerY = (event.clientY / innerHeight - .5) * 2; };
        globalThis.addEventListener("pointermove", onPointer, { passive: true });
        const darkMode = () => document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
        const themeObserver = new MutationObserver(() => undefined); themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        let clock = 0;
        function render() {
          frame = 0; if (disposed || !visible) return;
          clock += .012;
          const portrait = surface.clientWidth < 700;
          const targets = portrait ? [[0, 1.0, 14.8], [1.2, .5, 14.1], [-.7, .5, 13.7], [0, .3, 13.2]] : [[2.2, .7, 15.6], [1.5, .5, 14.8], [.4, .3, 14.1], [-.6, .15, 13.8]];
          const target = targets[Math.min(3, stage)];
          camera.position.x += (target[0] + pointerX * .28 - camera.position.x) * .035;
          camera.position.y += (target[1] - pointerY * .16 - camera.position.y) * .035;
          camera.position.z += (target[2] - camera.position.z) * .035;
          camera.lookAt(0, .55, 0);
          pavilion.rotation.y += ((stage * -.055) + pointerX * .025 - pavilion.rotation.y) * .028;
          pavilion.position.y += ((stage === 0 ? .08 : 0) - pavilion.position.y) * .04;
          dependencyGroup.visible = stage >= 1; paymentLine.visible = stage >= 3;
          const assemble = stage >= 2 ? .52 : 1;
          dependencyGroup.children.forEach((node, index) => { const mesh = node as import("three").Mesh; mesh.scale.setScalar(stage >= 1 ? Math.min(1, mesh.scale.x + .04) : .01); if (stage >= 2) { mesh.position.x *= .996; mesh.position.z *= .996; } else { const a = index / 9 * Math.PI * 2; mesh.position.x += (Math.cos(a) * 6.2 * assemble - mesh.position.x) * .02; mesh.position.z += (Math.sin(a) * 4.2 * assemble - mesh.position.z) * .02; } });
          paymentLine.rotation.z = -.55 + Math.sin(clock) * .035;
          const dark = darkMode(); warm.intensity += ((dark ? 92 : 46) - warm.intensity) * .035; spill.intensity += ((dark ? 78 : 34) - spill.intensity) * .035; daylight.intensity += ((dark ? .42 : 1.75) - daylight.intensity) * .035; scene.fog?.color.lerp(new THREE.Color(dark ? 0x030408 : 0xdfe6f5), .035); renderer.setClearColor(dark ? 0x030408 : 0xdfe6f5, 1);
          renderer.render(scene, camera); frame = requestAnimationFrame(render);
        }
        setMode("interactive"); frame = requestAnimationFrame(render);
        return () => { cancelAnimationFrame(frame); resizeObserver.disconnect(); stageObserver.disconnect(); visibilityObserver.disconnect(); themeObserver.disconnect(); globalThis.removeEventListener("pointermove", onPointer); renderer.dispose(); scene.traverse((object) => { const mesh = object as import("three").Mesh; mesh.geometry?.dispose(); if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => { material.dispose(); }); }); };
      } catch (error) { console.warn("Pactset pavilion is using its static fallback.", error); if (!disposed) setMode("fallback"); }
    }
    let cleanup: undefined | (() => void); start().then((value) => { cleanup = value; });
    return () => { disposed = true; cleanup?.(); };
  }, []);

  return <figure className={`pavilion-scene is-${mode}`} aria-label={mode === "interactive" ? "Interactive glass-and-metal event pavilion responding to the Pactset story" : "Static glass event pavilion fallback"}>
    <canvas ref={canvasRef} className="pavilion-canvas" />
    <div className="pavilion-fallback" aria-hidden="true"><div className="pavilion-media pavilion-light"><Image src="/images/pavilion-light.webp" alt="" fill priority sizes="100vw" /></div><div className="pavilion-media pavilion-dark"><Image src="/images/pavilion-dark.webp" alt="" fill priority sizes="100vw" /></div></div>
    <div className="scene-treatment" aria-hidden="true" />
    <figcaption className="scene-status">{mode === "interactive" ? "Interactive pavilion scene" : mode === "fallback" ? "Reduced-motion pavilion image" : "Preparing pavilion scene"}</figcaption>
  </figure>;
}

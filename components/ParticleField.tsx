"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Cold air, drawn from tonight's forecast: the colder the low, the more
 * particles and the faster they fall. At 50°F+ it is a slow, sparse drift.
 * Purely decorative; aria-hidden and skipped under reduced motion.
 */
export default function ParticleField({ lowF }: { lowF: number | null }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cold = Math.min(1, Math.max(0, (55 - (lowF ?? 55)) / 35)); // 0 at 55°F, 1 at 20°F
    const COUNT = Math.round(900 + cold * 2100);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.z = 14;

    const pos = new Float32Array(COUNT * 3);
    const speed = new Float32Array(COUNT);
    const phase = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 34;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 16;
      speed[i] = 0.004 + Math.random() * 0.012 * (0.5 + cold * 1.6);
      phase[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));

    // Soft round sprite drawn once on a canvas, so there is no image to load.
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const sprite = new THREE.CanvasTexture(c);

    const mat = new THREE.PointsMaterial({
      size: 0.16,
      map: sprite,
      color: new THREE.Color("#7fa6d6"),
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    const mouse = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onMove);

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let raf = 0;
    let t = 0;
    const tick = () => {
      t += 1;
      const a = geo.attributes.position.array as Float32Array;
      for (let i = 0; i < COUNT; i++) {
        a[i * 3 + 1] -= speed[i];
        a[i * 3] += Math.sin(t * 0.01 + phase[i]) * 0.004 + cold * 0.003; // wind from the northwest
        if (a[i * 3 + 1] < -10) { a[i * 3 + 1] = 10; a[i * 3] = (Math.random() - 0.5) * 34; }
        if (a[i * 3] > 17) a[i * 3] = -17;
      }
      geo.attributes.position.needsUpdate = true;
      camera.position.x += (mouse.x * 1.2 - camera.position.x) * 0.03;
      camera.position.y += (-mouse.y * 0.8 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    if (reduce) renderer.render(scene, camera);
    else tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      geo.dispose(); mat.dispose(); sprite.dispose(); renderer.dispose();
      renderer.domElement.remove();
    };
  }, [lowF]);

  return <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0" />;
}

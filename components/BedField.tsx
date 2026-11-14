"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Firehouse's 100 beds as a 10 × 10 floor, seen in 3D. Beds fill one by one to
 * tonight's predicted occupancy (accent), the 80% band shows as pale beds, and
 * predicted spill stacks up outside the floor in red. Same numbers as the bar.
 */
export default function BedField({ predicted, high, spill }: { predicted: number; high: number; spill: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-8, 8, 8, -8, 0.1, 100);
    camera.position.set(12, 13, 12);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.HemisphereLight("#ffffff", "#c9d6e6", 2.2));
    const sun = new THREE.DirectionalLight("#ffffff", 1.4);
    sun.position.set(6, 12, 4);
    scene.add(sun);

    const group = new THREE.Group();
    scene.add(group);

    // Floor tile, one tone step from the page.
    const floor = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.12, 11.2), new THREE.MeshLambertMaterial({ color: "#e6edf5" }));
    floor.position.y = -0.1;
    group.add(floor);

    const N = 100;
    const spillN = Math.min(30, Math.round(spill));
    const bed = new THREE.BoxGeometry(0.78, 0.34, 0.5);
    const mat = new THREE.MeshLambertMaterial({ color: "#ffffff" });
    const beds = new THREE.InstancedMesh(bed, mat, N + spillN);
    const colEmpty = new THREE.Color("#ffffff");
    const colFull = new THREE.Color("#1f5fae");
    const colBand = new THREE.Color("#a9c4e6");
    const colSpill = new THREE.Color("#c2373c");
    const m = new THREE.Matrix4();
    const full = Math.round(predicted);
    const band = Math.round(high);

    const target: { x: number; z: number; y: number; color: THREE.Color }[] = [];
    for (let i = 0; i < N; i++) {
      const row = Math.floor(i / 10), col = i % 10;
      target.push({
        x: (col - 4.5) * 1.05,
        z: (row - 4.5) * 1.05,
        y: 0.17,
        color: i < full ? colFull : i < band ? colBand : colEmpty,
      });
    }
    // Spill: a stack beside the floor, two wide, rising.
    for (let j = 0; j < spillN; j++) {
      target.push({ x: 6.6 + (j % 2) * 0.86, z: 4.2 - Math.floor(j / 2) % 8 * 0.6, y: 0.17 + Math.floor(j / 16) * 0.38, color: colSpill });
    }
    target.forEach((t, i) => beds.setColorAt(i, colEmpty));
    group.add(beds);

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      const aspect = w / Math.max(1, h);
      const s = 7.2;
      camera.left = -s * aspect; camera.right = s * aspect; camera.top = s; camera.bottom = -s;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = reduce ? 1e6 : now - start;
      target.forEach((t, i) => {
        // Each bed drops in on its own beat, 12ms apart.
        const k = Math.min(1, Math.max(0, (elapsed - i * 12) / 500));
        const e = 1 - Math.pow(1 - k, 3);
        m.makeTranslation(t.x, t.y + (1 - e) * 4, t.z);
        beds.setMatrixAt(i, m);
        if (k > 0.4) beds.setColorAt(i, t.color);
      });
      beds.instanceMatrix.needsUpdate = true;
      if (beds.instanceColor) beds.instanceColor.needsUpdate = true;
      group.rotation.y = reduce ? 0 : Math.sin(elapsed / 5200) * 0.22;
      renderer.render(scene, camera);
      if (!reduce) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      bed.dispose(); mat.dispose(); beds.dispose(); renderer.dispose();
      renderer.domElement.remove();
    };
  }, [predicted, high, spill]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label={`Firehouse floor: ${Math.round(predicted)} of 100 beds predicted full tonight${spill > 0 ? `, about ${Math.round(spill)} more people than beds` : ""}.`}
      className="h-full w-full"
    />
  );
}

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export default function NeuralScene({ compact = false }) {
  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return undefined;

    let renderer;
    let animationFrame;
    let resizeObserver;
    let isDisposed = false;

    try {
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x0a1420, 0.045);
      const width = Math.max(host.clientWidth, 280);
      const height = Math.max(host.clientHeight, compact ? 220 : 320);
      const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
      camera.position.set(0, 0, compact ? 7.8 : 8.8);

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
      renderer.setSize(width, height);
      renderer.setClearColor(0x000000, 0);
      host.appendChild(renderer.domElement);

      const group = new THREE.Group();
      scene.add(group);
      scene.add(new THREE.AmbientLight(0xa5fff2, 1.65));
      const keyLight = new THREE.PointLight(0x23e1c2, 15, 18);
      keyLight.position.set(-2, 3, 5);
      scene.add(keyLight);
      const violetLight = new THREE.PointLight(0x9380ff, 10, 20);
      violetLight.position.set(3, -3, 2);
      scene.add(violetLight);

      const count = compact ? 68 : 110;
      const points = [];
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < count; i += 1) {
        const y = 1 - (i / Math.max(count - 1, 1)) * 2;
        const radius = Math.sqrt(1 - y * y);
        const theta = goldenAngle * i;
        const wobble = 0.92 + 0.13 * Math.sin(i * 2.21);
        points.push(new THREE.Vector3(
          Math.cos(theta) * radius * 2.45 * wobble,
          y * 2.45 * wobble,
          Math.sin(theta) * radius * 2.1 * wobble,
        ));
      }

      const nodeGeometry = new THREE.SphereGeometry(0.035, 9, 9);
      const nodeMaterials = [
        new THREE.MeshStandardMaterial({ color: 0x50f0d8, emissive: 0x0a534b, emissiveIntensity: 1.7, roughness: 0.3 }),
        new THREE.MeshStandardMaterial({ color: 0xb2a5ff, emissive: 0x32246c, emissiveIntensity: 1.25, roughness: 0.3 }),
        new THREE.MeshStandardMaterial({ color: 0xf6a48c, emissive: 0x652d25, emissiveIntensity: 0.85, roughness: 0.35 }),
      ];
      const nodes = [];
      const positionArray = [];
      points.forEach((point, index) => {
        const scale = index % 13 === 0 ? 1.9 : index % 5 === 0 ? 1.35 : 0.8 + (index % 3) * 0.12;
        const mesh = new THREE.Mesh(nodeGeometry, nodeMaterials[index % nodeMaterials.length]);
        mesh.position.copy(point);
        mesh.scale.setScalar(scale);
        group.add(mesh);
        nodes.push(mesh);
        positionArray.push(point.x, point.y, point.z);
      });

      const linePositions = [];
      const lineColors = [];
      const maxDistance = compact ? 1.0 : 0.94;
      for (let i = 0; i < points.length; i += 1) {
        const distances = [];
        for (let j = i + 1; j < points.length; j += 1) {
          const d = points[i].distanceTo(points[j]);
          if (d < maxDistance) distances.push({ j, d });
        }
        distances.sort((a, b) => a.d - b.d).slice(0, 3).forEach(({ j, d }) => {
          linePositions.push(
            points[i].x, points[i].y, points[i].z,
            points[j].x, points[j].y, points[j].z,
          );
          const intensity = 0.34 + (1 - d / maxDistance) * 0.45;
          const tint = i % 4 === 0 ? new THREE.Color(0x9287ff) : new THREE.Color(0x27ddbf);
          lineColors.push(tint.r * intensity, tint.g * intensity, tint.b * intensity);
          lineColors.push(tint.r * intensity, tint.g * intensity, tint.b * intensity);
        });
      }
      const lineGeometry = new THREE.BufferGeometry();
      lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
      lineGeometry.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
      const lineMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.62, depthWrite: false });
      group.add(new THREE.LineSegments(lineGeometry, lineMaterial));

      // Two low-opacity orbital rings add dimensional depth without competing with the content.
      const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x35d9c1, transparent: true, opacity: 0.12, side: THREE.DoubleSide });
      const ringOne = new THREE.Mesh(new THREE.TorusGeometry(2.95, 0.004, 4, 140), ringMaterial);
      ringOne.rotation.set(0.82, 0.3, 0.35);
      group.add(ringOne);
      const ringTwo = new THREE.Mesh(new THREE.TorusGeometry(2.65, 0.003, 4, 140), new THREE.MeshBasicMaterial({ color: 0x988bff, transparent: true, opacity: 0.11, side: THREE.DoubleSide }));
      ringTwo.rotation.set(1.24, -0.72, 0.2);
      group.add(ringTwo);

      const particleGeo = new THREE.BufferGeometry();
      const particleCount = 180;
      const particlePositions = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount; i += 1) {
        const r = 3.1 + Math.random() * 1.6;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        particlePositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        particlePositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        particlePositions[i * 3 + 2] = r * Math.cos(phi);
      }
      particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      const particles = new THREE.Points(particleGeo, new THREE.PointsMaterial({ color: 0x8aece0, size: 0.012, transparent: true, opacity: 0.45, sizeAttenuation: true }));
      scene.add(particles);

      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
      const onPointerMove = (event) => {
        const rect = host.getBoundingClientRect();
        pointer.tx = ((event.clientX - rect.left) / rect.width - 0.5) * 0.34;
        pointer.ty = ((event.clientY - rect.top) / rect.height - 0.5) * 0.24;
      };
      host.addEventListener('pointermove', onPointerMove, { passive: true });

      const clock = new THREE.Clock();
      const renderFrame = () => {
        if (isDisposed) return;
        const t = clock.getElapsedTime();
        pointer.x += (pointer.tx - pointer.x) * 0.035;
        pointer.y += (pointer.ty - pointer.y) * 0.035;
        if (!reduceMotion) {
          group.rotation.y = t * 0.055 + pointer.x;
          group.rotation.x = Math.sin(t * 0.11) * 0.06 + pointer.y;
          ringOne.rotation.z += 0.0006;
          ringTwo.rotation.y += 0.0005;
          particles.rotation.y = -t * 0.012;
          nodes.forEach((node, i) => {
            node.scale.setScalar((i % 13 === 0 ? 1.9 : i % 5 === 0 ? 1.35 : 0.85) * (1 + Math.sin(t * 1.25 + i) * 0.07));
          });
        }
        renderer.render(scene, camera);
        animationFrame = window.requestAnimationFrame(renderFrame);
      };
      renderFrame();

      resizeObserver = new ResizeObserver(() => {
        if (!renderer || !host) return;
        const nextWidth = Math.max(host.clientWidth, 280);
        const nextHeight = Math.max(host.clientHeight, compact ? 220 : 320);
        camera.aspect = nextWidth / nextHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(nextWidth, nextHeight, false);
      });
      resizeObserver.observe(host);

      return () => {
        isDisposed = true;
        window.cancelAnimationFrame(animationFrame);
        resizeObserver?.disconnect();
        host.removeEventListener('pointermove', onPointerMove);
        scene.traverse((object) => {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((material) => material.dispose());
          }
        });
        renderer?.dispose();
        if (renderer?.domElement?.parentNode === host) host.removeChild(renderer.domElement);
      };
    } catch (error) {
      console.warn('Three.js scene unavailable; using visual fallback.', error);
      setFailed(true);
      renderer?.dispose();
      return undefined;
    }
  }, [compact]);

  return (
    <div className={`neural-scene ${compact ? 'neural-scene--compact' : ''}`} ref={mountRef} aria-label="Animated abstract network of connected patient nodes" role="img">
      {failed && <div className="neural-fallback"><div className="fallback-orbit orbit-a" /><div className="fallback-orbit orbit-b" /><div className="fallback-core"><span /></div></div>}
    </div>
  );
}

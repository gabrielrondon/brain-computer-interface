import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CognitiveMetrics, RelativeBandPowers } from '@cortex-bci/core';

interface CorticalMeshProps {
  cognitive: CognitiveMetrics;
  relativeBands?: RelativeBandPowers;
  wireframe?: boolean;
}

export const CorticalMesh: React.FC<CorticalMeshProps> = ({
  cognitive,
  relativeBands,
  wireframe = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    brainMesh: THREE.Mesh;
    electrodeMeshes: THREE.Mesh[];
    material: THREE.ShaderMaterial;
    isDragging: boolean;
    prevMouseX: number;
    prevMouseY: number;
    rotX: number;
    rotY: number;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 2.5, 4.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Custom GLSL Shader for procedural cortical surface with regional activation
    const vertexShader = `
      varying vec3 vNormal;
      varying vec3 vPosition;
      uniform float uTime;
      uniform float uBeta;
      uniform float uAlpha;
      uniform float uTheta;

      void main() {
        vNormal = normal;
        vPosition = position;

        // Procedural gyri and sulci displacement
        float displacement = sin(position.x * 6.0 + uTime * 0.5) * 
                             cos(position.y * 6.0) * 
                             sin(position.z * 6.0) * 0.08;

        // Frontal lobe activation pulse (z > 0.3)
        if (position.z > 0.2) {
          displacement += sin(uTime * 4.0 + position.y * 5.0) * 0.03 * uBeta;
        }

        // Occipital lobe activation pulse (z < -0.3)
        if (position.z < -0.2) {
          displacement += sin(uTime * 2.5 + position.x * 4.0) * 0.03 * uAlpha;
        }

        vec3 newPos = position + normal * displacement;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
      }
    `;

    const fragmentShader = `
      varying vec3 vNormal;
      varying vec3 vPosition;
      uniform float uTime;
      uniform float uBeta;
      uniform float uAlpha;
      uniform float uTheta;
      uniform float uWireframe;

      void main() {
        vec3 norm = normalize(vNormal);
        vec3 lightDir = normalize(vec3(0.5, 1.0, 1.0));
        float diff = max(dot(norm, lightDir), 0.2);

        // Baseline dark obsidian cortex
        vec3 baseColor = vec3(0.06, 0.08, 0.12);

        // Regional neural activation:
        // Frontal lobes (Z > 0.2): Neon Cyan (Beta / Focus)
        float frontalFactor = smoothstep(0.1, 0.8, vPosition.z) * uBeta;
        vec3 frontalColor = vec3(0.0, 0.95, 1.0) * frontalFactor * 1.5;

        // Occipital lobe (Z < -0.2): Warm Amber (Alpha / Calm)
        float occipitalFactor = smoothstep(-0.1, -0.8, vPosition.z) * uAlpha;
        vec3 occipitalColor = vec3(1.0, 0.65, 0.1) * occipitalFactor * 1.4;

        // Temporal lobes (|X| > 0.7): Emerald / Theta
        float temporalFactor = smoothstep(0.5, 1.1, abs(vPosition.x)) * uTheta;
        vec3 temporalColor = vec3(0.1, 0.8, 0.4) * temporalFactor * 1.2;

        // Rim/Fresnel glow
        float fresnel = pow(1.0 - max(dot(norm, vec3(0.0, 0.0, 1.0)), 0.0), 2.5);
        vec3 rimColor = vec3(0.2, 0.5, 0.9) * fresnel * 0.7;

        vec3 finalColor = baseColor * diff + frontalColor + occipitalColor + temporalColor + rimColor;
        gl_FragColor = vec4(finalColor, 0.95);
      }
    `;

    const uniforms = {
      uTime: { value: 0 },
      uBeta: { value: 0.5 },
      uAlpha: { value: 0.5 },
      uTheta: { value: 0.5 },
      uWireframe: { value: wireframe ? 1.0 : 0.0 },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      wireframe,
      transparent: true,
    });

    // Anatomical approximation geometry (Ellipsoid with longitudinal fissure)
    const geometry = new THREE.SphereGeometry(1.2, 64, 48);
    // Deform into brain proportions: elongated anteroposteriorly
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      // Elongate along Z (front-to-back)
      z *= 1.35;
      // Flatten bottom (temporal/cerebellum base)
      if (y < 0.0) y *= 0.75;
      // Indent longitudinal cerebral fissure between left and right hemispheres
      if (Math.abs(x) < 0.25 && y > 0.1) {
        y -= (0.25 - Math.abs(x)) * 0.4;
      }

      pos.setXYZ(i, x, y, z);
    }
    geometry.computeVertexNormals();

    const brainMesh = new THREE.Mesh(geometry, material);
    scene.add(brainMesh);

    // Standard 10-20 Electrode Markers: TP9, AF7, AF8, TP10
    const electrodePositions = [
      { name: 'TP9', pos: new THREE.Vector3(-1.15, -0.15, -0.3) },
      { name: 'AF7', pos: new THREE.Vector3(-0.65, 0.45, 1.15) },
      { name: 'AF8', pos: new THREE.Vector3(0.65, 0.45, 1.15) },
      { name: 'TP10', pos: new THREE.Vector3(1.15, -0.15, -0.3) },
    ];

    const electrodeMeshes: THREE.Mesh[] = [];
    const sphereGeo = new THREE.SphereGeometry(0.07, 16, 16);

    for (const el of electrodePositions) {
      const elMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
      const elMesh = new THREE.Mesh(sphereGeo, elMat);
      elMesh.position.copy(el.pos);
      brainMesh.add(elMesh);
      electrodeMeshes.push(elMesh);
    }

    const state = {
      scene,
      camera,
      renderer,
      brainMesh,
      electrodeMeshes,
      material,
      isDragging: false,
      prevMouseX: 0,
      prevMouseY: 0,
      rotX: 0.2,
      rotY: -0.4,
    };
    sceneRef.current = state;

    // Mouse drag interaction
    const onMouseDown = (e: MouseEvent) => {
      state.isDragging = true;
      state.prevMouseX = e.clientX;
      state.prevMouseY = e.clientY;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!state.isDragging) return;
      const dx = e.clientX - state.prevMouseX;
      const dy = e.clientY - state.prevMouseY;
      state.rotY += dx * 0.007;
      state.rotX += dy * 0.007;
      state.rotX = Math.max(-1.0, Math.min(1.0, state.rotX));
      state.prevMouseX = e.clientX;
      state.prevMouseY = e.clientY;
    };
    const onMouseUp = () => {
      state.isDragging = false;
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    // Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      state.material.uniforms.uTime.value = elapsed;

      // Gentle auto-rotation when not dragging
      if (!state.isDragging) {
        state.rotY += 0.002;
      }
      state.brainMesh.rotation.y = state.rotY;
      state.brainMesh.rotation.x = state.rotX;

      // Pulse electrode markers
      const pulse = 1.0 + 0.2 * Math.sin(elapsed * 6.0);
      for (const el of state.electrodeMeshes) {
        el.scale.set(pulse, pulse, pulse);
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update dynamic shader uniforms based on real incoming telemetry
  useEffect(() => {
    if (!sceneRef.current) return;
    const { uniforms } = sceneRef.current.material;
    uniforms.uBeta.value = relativeBands?.beta ? relativeBands.beta * 2.5 : cognitive.focus_index;
    uniforms.uAlpha.value = relativeBands?.alpha ? relativeBands.alpha * 2.5 : cognitive.calm_index;
    uniforms.uTheta.value = relativeBands?.theta ? relativeBands.theta * 2.0 : cognitive.cognitive_workload * 0.5;
    sceneRef.current.material.wireframe = wireframe;
  }, [cognitive, relativeBands, wireframe]);

  return (
    <div className="relative w-full h-full min-h-[360px] flex items-center justify-center overflow-hidden rounded-xl bg-card border border-card-border/60">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="absolute top-3 left-4 pointer-events-none flex flex-col gap-1">
        <span className="text-[11px] font-mono tracking-wider text-zinc-400 uppercase">
          Cortical Topography (3D WebGL)
        </span>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="inline-block w-2 h-2 rounded-full bg-neon-cyan animate-pulse" />
          <span className="text-zinc-300">Anterior: Beta/Focus (AF7/8)</span>
          <span className="inline-block w-2 h-2 rounded-full bg-neon-amber ml-2" />
          <span className="text-zinc-300">Posterior: Alpha/Calm (TP9/10)</span>
        </div>
      </div>
      <div className="absolute bottom-3 right-4 pointer-events-none text-[10px] font-mono text-zinc-500">
        Click & Drag to Inspect Orbit
      </div>
    </div>
  );
};

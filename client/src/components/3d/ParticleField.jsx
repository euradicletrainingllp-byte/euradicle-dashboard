import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ── Color palette ──────────────────────────────────────────────────────────────
const BRAND   = '#aa78a6';   // mauve
const DEEP    = '#3e3264';   // deep purple
const MID     = '#7a5090';   // mid purple
const LIGHT   = '#c8a0c4';   // light mauve

// ── Particles (instanced) ──────────────────────────────────────────────────────
function Particles({ count = 180 }) {
  const mesh1 = useRef();
  const mesh2 = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const p1 = useMemo(() => Array.from({ length: count }, () => ({
    pos:   [(Math.random()-0.5)*22, (Math.random()-0.5)*20, (Math.random()-0.5)*10],
    speed: 0.003 + Math.random()*0.005,
    phase: Math.random()*Math.PI*2,
    scale: 0.25 + Math.random()*0.65,
  })), [count]);

  const p2 = useMemo(() => Array.from({ length: Math.floor(count*0.5) }, () => ({
    pos:   [(Math.random()-0.5)*18, (Math.random()-0.5)*16, (Math.random()-0.5)*8],
    speed: 0.002 + Math.random()*0.004,
    phase: Math.random()*Math.PI*2,
    scale: 0.15 + Math.random()*0.4,
  })), [count]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    [mesh1, mesh2].forEach((mRef, mi) => {
      const arr = mi === 0 ? p1 : p2;
      if (!mRef.current) return;
      arr.forEach((p, i) => {
        const x = p.pos[0] + Math.sin(t*p.speed   + p.phase)*0.7;
        const y = p.pos[1] + Math.cos(t*p.speed*0.7 + p.phase)*0.7;
        const z = p.pos[2] + Math.sin(t*p.speed*0.5)*0.3;
        dummy.position.set(x, y, z);
        dummy.scale.setScalar(p.scale*(0.7 + Math.sin(t*p.speed*2+p.phase)*0.3));
        dummy.updateMatrix();
        mRef.current.setMatrixAt(i, dummy.matrix);
      });
      mRef.current.instanceMatrix.needsUpdate = true;
    });
  });

  return (
    <>
      <instancedMesh ref={mesh1} args={[null, null, count]}>
        <sphereGeometry args={[0.045, 6, 6]} />
        <meshBasicMaterial color={BRAND} transparent opacity={0.65} />
      </instancedMesh>
      <instancedMesh ref={mesh2} args={[null, null, Math.floor(count*0.5)]}>
        <sphereGeometry args={[0.035, 6, 6]} />
        <meshBasicMaterial color={MID} transparent opacity={0.45} />
      </instancedMesh>
    </>
  );
}

// ── Floating rings ─────────────────────────────────────────────────────────────
function FloatingRings() {
  const r1 = useRef(), r2 = useRef(), r3 = useRef(), r4 = useRef(), r5 = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (r1.current) { r1.current.rotation.x = t*0.14; r1.current.rotation.y = t*0.09; }
    if (r2.current) { r2.current.rotation.x = -t*0.07; r2.current.rotation.z = t*0.11; }
    if (r3.current) { r3.current.rotation.y = t*0.05; r3.current.rotation.z = -t*0.08; }
    if (r4.current) { r4.current.rotation.x = t*0.10; r4.current.rotation.y = -t*0.06; }
    if (r5.current) { r5.current.rotation.y = -t*0.04; r5.current.rotation.z = t*0.07; }
  });

  return (
    <>
      <mesh ref={r1} position={[3.5, 1.2, -3]}>
        <torusGeometry args={[1.6, 0.014, 16, 90]} />
        <meshBasicMaterial color={BRAND} transparent opacity={0.28} />
      </mesh>
      <mesh ref={r2} position={[-3.8, -1.2, -2]}>
        <torusGeometry args={[2.2, 0.011, 16, 90]} />
        <meshBasicMaterial color={DEEP} transparent opacity={0.22} />
      </mesh>
      <mesh ref={r3} position={[0.5, 3, -5]}>
        <torusGeometry args={[3, 0.009, 16, 90]} />
        <meshBasicMaterial color={MID} transparent opacity={0.15} />
      </mesh>
      <mesh ref={r4} position={[-1.5, -3, -4]}>
        <torusGeometry args={[1.8, 0.012, 16, 90]} />
        <meshBasicMaterial color={LIGHT} transparent opacity={0.18} />
      </mesh>
      <mesh ref={r5} position={[5, -1, -6]}>
        <torusGeometry args={[2.5, 0.008, 16, 90]} />
        <meshBasicMaterial color={DEEP} transparent opacity={0.12} />
      </mesh>
    </>
  );
}

// ── Connection lines ───────────────────────────────────────────────────────────
function ConnectionLines({ count = 45 }) {
  const lines = useRef([]);

  const lineData = useMemo(() => {
    return Array.from({ length: count }, () => {
      const start = new THREE.Vector3((Math.random()-0.5)*18, (Math.random()-0.5)*14, (Math.random()-0.5)*6);
      const end   = new THREE.Vector3(start.x+(Math.random()-0.5)*5, start.y+(Math.random()-0.5)*5, start.z+(Math.random()-0.5)*2);
      const geom  = new THREE.BufferGeometry().setFromPoints([start, end]);
      return { geom, speed: 0.001+Math.random()*0.003, phase: Math.random()*Math.PI*2, color: Math.random() > 0.5 ? BRAND : DEEP };
    });
  }, [count]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    lines.current.forEach((line, i) => {
      if (line) line.material.opacity = 0.04 + Math.abs(Math.sin(t*lineData[i].speed + lineData[i].phase))*0.18;
    });
  });

  return (
    <group>
      {lineData.map((ld, i) => (
        <line key={i} ref={el => lines.current[i] = el} geometry={ld.geom}>
          <lineBasicMaterial color={ld.color} transparent opacity={0.08} />
        </line>
      ))}
    </group>
  );
}

// ── Icosahedra floating shapes ─────────────────────────────────────────────────
function FloatingPolyhedra() {
  const refs = [useRef(), useRef(), useRef(), useRef()];

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.forEach((r, i) => {
      if (!r.current) return;
      r.current.rotation.x = t * (0.08 + i*0.02);
      r.current.rotation.y = t * (0.06 + i*0.015);
      r.current.position.y = [-2, 2.5, -1.5, 3][i] + Math.sin(t*0.4 + i*1.2)*0.4;
    });
  });

  const colors = [BRAND, DEEP, MID, LIGHT];
  const positions = [[-5, -2, -5], [5, 2.5, -4], [-2, -1.5, -6], [3.5, 3, -7]];
  const scales    = [0.35, 0.28, 0.22, 0.18];

  return (
    <>
      {refs.map((r, i) => (
        <mesh key={i} ref={r} position={positions[i]} scale={scales[i]}>
          <icosahedronGeometry args={[1, 1]} />
          <meshBasicMaterial color={colors[i]} transparent opacity={0.18} wireframe />
        </mesh>
      ))}
    </>
  );
}

// ── DNA Helix ─────────────────────────────────────────────────────────────────
function DNAHelix() {
  const groupRef = useRef();

  const helixData = useMemo(() => {
    const points = [];
    const N = 80;
    for (let i = 0; i < N; i++) {
      const t = (i/N) * Math.PI * 6;
      const y = (i/N)*12 - 6;
      const r = 0.6;
      points.push({
        a: new THREE.Vector3(Math.cos(t)*r, y, Math.sin(t)*r - 8),
        b: new THREE.Vector3(Math.cos(t+Math.PI)*r, y, Math.sin(t+Math.PI)*r - 8),
        bridge: i % 8 === 0,
      });
    }
    return points;
  }, []);

  const geomA = useMemo(() => {
    const pts = helixData.map(p => p.a);
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [helixData]);

  const geomB = useMemo(() => {
    const pts = helixData.map(p => p.b);
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [helixData]);

  const bridgeGeoms = useMemo(() => {
    return helixData.filter(p => p.bridge).map(p =>
      new THREE.BufferGeometry().setFromPoints([p.a, p.b])
    );
  }, [helixData]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.06;
      groupRef.current.position.x = Math.sin(t*0.07)*1.5 + 6;
    }
  });

  return (
    <group ref={groupRef} position={[6, 0, -7]}>
      <line geometry={geomA}>
        <lineBasicMaterial color={BRAND} transparent opacity={0.35} />
      </line>
      <line geometry={geomB}>
        <lineBasicMaterial color={DEEP} transparent opacity={0.35} />
      </line>
      {bridgeGeoms.map((g, i) => (
        <line key={i} geometry={g}>
          <lineBasicMaterial color={MID} transparent opacity={0.22} />
        </line>
      ))}
    </group>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
export default function ParticleField({ className = '' }) {
  return (
    <div className={`absolute inset-0 ${className}`} style={{ pointerEvents: 'none' }}>
      <Canvas camera={{ position: [0, 0, 9], fov: 62 }} dpr={[1, 1.5]}>
        <Particles />
        <FloatingRings />
        <ConnectionLines />
        <FloatingPolyhedra />
        <DNAHelix />
      </Canvas>
    </div>
  );
}

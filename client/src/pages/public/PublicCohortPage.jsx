import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import * as THREE from 'three';
import {
  Calendar, Clock, BookOpen, Brain, Target, Star, Sliders,
  Video, FileText, Layers, Package, Globe, Headphones,
  Lock, LogIn, MapPin, Users, CheckCircle, Activity,
  ChevronDown, ArrowRight, Sparkles,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import axios from 'axios';

const fetchPublicCohort = (id) =>
  axios.get(`/api/v1/public/cohorts/${id}`).then(r => r.data.data);

const PROGRAM_LABELS = {
  leadership_dev: 'Leadership Development',
  leadership_development: 'Leadership Development',
  behavioral: 'Behavioural Training',
  behavioral_training: 'Behavioural Training',
  ac_dc: 'Assessment Centre',
  consulting: 'Consulting Skills',
  consulting_capability: 'Consulting Skills',
  consulting_skills: 'Consulting Skills',
  onboarding: 'Onboarding',
  custom: 'Custom Program',
};

const CONTENT_TYPE_MAP = {
  article:           { label: 'Article',       color: '#6496dc', icon: FileText   },
  video:             { label: 'Video',          color: '#40c980', icon: Video      },
  case_study:        { label: 'Case Study',     color: '#c89650', icon: Star       },
  presentation:      { label: 'Presentation',  color: '#aa78a6', icon: Layers     },
  toolkit:           { label: 'Toolkit',        color: '#64c8b4', icon: Package    },
  external_link:     { label: 'Link',           color: '#c86464', icon: Globe      },
  audio:             { label: 'Audio',          color: '#c8a0c4', icon: Headphones },
  reflection_prompt: { label: 'Reflection',    color: '#d0a030', icon: BookOpen   },
};

const ASSESSMENT_TYPE_MAP = {
  personality:      { label: 'Personality',     color: '#aa78a6', icon: Brain    },
  behavioral:       { label: 'Behavioural',     color: '#6496dc', icon: Target   },
  leadership_style: { label: 'Leadership',      color: '#c89650', icon: Star     },
  psychometric:     { label: 'Psychometric',    color: '#64c8b4', icon: Sliders  },
  knowledge_check:  { label: 'Knowledge Check', color: '#c86464', icon: BookOpen },
};

const INTERVENTION_MAP = {
  pre_work:          { label: 'Pre-Work',        color: '#d0a030', icon: BookOpen  },
  virtual_session:   { label: 'Virtual Session', color: '#64c878', icon: Video     },
  case_study:        { label: 'Case Study',      color: '#c86464', icon: FileText  },
  study_material:    { label: 'Study Material',  color: '#6496dc', icon: BookOpen  },
  reflection:        { label: 'Reflection',      color: '#aa78a6', icon: Layers    },
  group_activity:    { label: 'Group Activity',  color: '#64c8b4', icon: Users     },
  assessment_window: { label: 'Assessment',      color: '#c89650', icon: Brain     },
  offline_session:   { label: 'Offline Session', color: '#c86496', icon: MapPin   },
  custom:            { label: 'Activity',        color: '#9080a8', icon: Activity  },
};

// ── Three.js World ────────────────────────────────────────────────────────────
function useThreeScene(canvasRef) {
  const sceneRef = useRef(null);
  const scrollRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!canvasRef.current) return;
    const W = window.innerWidth, H = window.innerHeight;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, alpha: true, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0e0c1a, 1);

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0e0c1a, 0.035);

    // Camera
    const camera = new THREE.PerspectiveCamera(65, W / H, 0.1, 200);
    camera.position.set(0, 2, 14);

    // Lights
    const ambient = new THREE.AmbientLight(0x2a1840, 1.2);
    scene.add(ambient);
    const purpleLight = new THREE.PointLight(0xaa78a6, 3, 40);
    purpleLight.position.set(-8, 6, 4);
    scene.add(purpleLight);
    const blueLight = new THREE.PointLight(0x6040c0, 2.5, 35);
    blueLight.position.set(10, -2, 8);
    scene.add(blueLight);
    const goldLight = new THREE.PointLight(0xc89650, 1.5, 25);
    goldLight.position.set(0, 12, -10);
    scene.add(goldLight);
    const greenLight = new THREE.PointLight(0x40c980, 1.2, 20);
    greenLight.position.set(5, 3, 12);
    scene.add(greenLight);

    // ── Stars / particles ──────────────────────────────────────────────────
    const starCount = 3500;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const palette = [
      [0.67, 0.47, 0.65], [0.38, 0.25, 0.63], [0.78, 0.72, 0.88],
      [0.25, 0.78, 0.50], [0.39, 0.59, 0.86], [0.78, 0.59, 0.31],
    ];
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3]     = (Math.random() - 0.5) * 180;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 120;
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 150;
      const c = palette[Math.floor(Math.random() * palette.length)];
      starColors[i * 3] = c[0]; starColors[i * 3 + 1] = c[1]; starColors[i * 3 + 2] = c[2];
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({ size: 0.18, vertexColors: true, transparent: true, opacity: 0.85, sizeAttenuation: true });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ── Floating crystals ─────────────────────────────────────────────────
    const crystalData = [];
    const crystalGeometries = [
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.OctahedronGeometry(1, 0),
      new THREE.TetrahedronGeometry(1, 0),
      new THREE.IcosahedronGeometry(0.6, 1),
    ];
    const crystalColors = [0xaa78a6, 0x6040c0, 0xc8b8e0, 0x40c980, 0x6496dc, 0xc89650, 0x9060d0];

    for (let i = 0; i < 28; i++) {
      const geo = crystalGeometries[Math.floor(Math.random() * crystalGeometries.length)].clone();
      const color = crystalColors[Math.floor(Math.random() * crystalColors.length)];
      const scale = 0.3 + Math.random() * 1.6;

      const solidMat = new THREE.MeshPhongMaterial({
        color, transparent: true, opacity: 0.15 + Math.random() * 0.2,
        shininess: 120, specular: 0xffffff,
      });
      const wireMat = new THREE.MeshBasicMaterial({
        color, wireframe: true, transparent: true, opacity: 0.5 + Math.random() * 0.3,
      });

      const solid = new THREE.Mesh(geo, solidMat);
      const wire  = new THREE.Mesh(geo.clone(), wireMat);
      const group = new THREE.Group();
      group.add(solid); group.add(wire);

      const spread = 22, depth = 30;
      group.position.set(
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * 16,
        -5 - Math.random() * depth
      );
      group.scale.setScalar(scale);
      group.userData = {
        rotX: (Math.random() - 0.5) * 0.006,
        rotY: (Math.random() - 0.5) * 0.009,
        rotZ: (Math.random() - 0.5) * 0.004,
        floatAmp: 0.008 + Math.random() * 0.012,
        floatSpeed: 0.3 + Math.random() * 0.7,
        floatOffset: Math.random() * Math.PI * 2,
        origY: group.position.y,
      };
      scene.add(group);
      crystalData.push(group);
    }

    // ── Floating rings ────────────────────────────────────────────────────
    const ringData = [];
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.TorusGeometry(1.2 + Math.random() * 2, 0.04 + Math.random() * 0.08, 8, 64);
      const color = crystalColors[Math.floor(Math.random() * crystalColors.length)];
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25 + Math.random() * 0.3 });
      const ring = new THREE.Mesh(geo, mat);
      ring.position.set(
        (Math.random() - 0.5) * 26,
        (Math.random() - 0.5) * 14,
        -8 - Math.random() * 25
      );
      ring.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      ring.userData = {
        rotX: (Math.random() - 0.5) * 0.007,
        rotY: (Math.random() - 0.5) * 0.005,
      };
      scene.add(ring);
      ringData.push(ring);
    }

    // ── Grid plane ────────────────────────────────────────────────────────
    const gridGeo = new THREE.PlaneGeometry(120, 120, 50, 50);
    const gridMat = new THREE.MeshBasicMaterial({
      color: 0x4a2880, wireframe: true, transparent: true, opacity: 0.06,
    });
    const grid = new THREE.Mesh(gridGeo, gridMat);
    grid.rotation.x = -Math.PI / 2;
    grid.position.y = -10;
    scene.add(grid);

    // ── Glow spheres (distant) ─────────────────────────────────────────────
    const glowData = [];
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.SphereGeometry(1.5 + Math.random() * 3, 16, 16);
      const color = crystalColors[Math.floor(Math.random() * crystalColors.length)];
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.04 + Math.random() * 0.06 });
      const sphere = new THREE.Mesh(geo, mat);
      sphere.position.set(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 15,
        -20 - Math.random() * 30
      );
      sphere.userData = { pulseSpeed: 0.4 + Math.random() * 0.8, pulseOffset: Math.random() * Math.PI * 2, mat };
      scene.add(sphere);
      glowData.push(sphere);
    }

    // ── Scroll camera waypoints ────────────────────────────────────────────
    const waypoints = [
      { pos: new THREE.Vector3(0,   2, 14), target: new THREE.Vector3(0, 0, 0) },
      { pos: new THREE.Vector3(-3,  1, 10), target: new THREE.Vector3(0, 1, -5) },
      { pos: new THREE.Vector3(3,  -1,  8), target: new THREE.Vector3(-2, 0, -8) },
      { pos: new THREE.Vector3(-2,  3,  6), target: new THREE.Vector3(2, -1, -10) },
      { pos: new THREE.Vector3(0,   0,  4), target: new THREE.Vector3(0, 2, -15) },
    ];

    // Animation
    let raf, t = 0;
    const clock = new THREE.Clock();
    const camPos = new THREE.Vector3();
    const camTarget = new THREE.Vector3();
    const tempPos = new THREE.Vector3();
    const tempTarget = new THREE.Vector3();

    function lerp(a, b, t) { return a + (b - a) * t; }

    function animate() {
      raf = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      t += dt;

      // scroll-driven camera
      const scrollProgress = Math.min(scrollRef.current / Math.max(document.body.scrollHeight - window.innerHeight, 1), 1);
      const wpIndex = scrollProgress * (waypoints.length - 1);
      const wpFloor = Math.floor(wpIndex);
      const wpCeil  = Math.min(wpFloor + 1, waypoints.length - 1);
      const wpT = wpIndex - wpFloor;

      const targetPos    = waypoints[wpFloor].pos.clone().lerp(waypoints[wpCeil].pos, wpT);
      const targetLookAt = waypoints[wpFloor].target.clone().lerp(waypoints[wpCeil].target, wpT);

      // gentle mouse parallax
      targetPos.x += mouseRef.current.x * 1.2;
      targetPos.y -= mouseRef.current.y * 0.8;

      // float drift
      targetPos.y += Math.sin(t * 0.4) * 0.15;
      targetPos.x += Math.cos(t * 0.25) * 0.1;

      camera.position.lerp(targetPos, 0.03);
      camTarget.lerp(targetLookAt, 0.03);
      camera.lookAt(camTarget);

      // animate crystals
      crystalData.forEach(c => {
        c.rotation.x += c.userData.rotX;
        c.rotation.y += c.userData.rotY;
        c.rotation.z += c.userData.rotZ;
        c.position.y = c.userData.origY + Math.sin(t * c.userData.floatSpeed + c.userData.floatOffset) * c.userData.floatAmp * 30;
      });

      // animate rings
      ringData.forEach(r => {
        r.rotation.x += r.userData.rotX;
        r.rotation.y += r.userData.rotY;
      });

      // pulse glow spheres
      glowData.forEach(g => {
        g.userData.mat.opacity = 0.04 + Math.abs(Math.sin(t * g.userData.pulseSpeed + g.userData.pulseOffset)) * 0.07;
      });

      // slowly rotate stars
      stars.rotation.y += 0.00008;
      stars.rotation.x += 0.00003;

      // pulse lights
      purpleLight.intensity = 2.5 + Math.sin(t * 0.7) * 0.8;
      blueLight.intensity   = 2.0 + Math.cos(t * 0.5) * 0.7;
      goldLight.intensity   = 1.2 + Math.sin(t * 1.1) * 0.5;

      renderer.render(scene, camera);
    }

    animate();
    sceneRef.current = { renderer, scene, camera };

    // Event handlers
    const onScroll = () => { scrollRef.current = window.scrollY; };
    const onMouse = (e) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const onResize = () => {
      const W = window.innerWidth, H = window.innerHeight;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H);
    };

    window.addEventListener('scroll', onScroll);
    window.addEventListener('mousemove', onMouse);
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, [canvasRef]);
}

// ── Reveal animation wrapper ───────────────────────────────────────────────────
function Reveal({ children, delay = 0, y = 30, className = '', style = {} }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className} style={style}>
      {children}
    </motion.div>
  );
}

// ── Locked pill ───────────────────────────────────────────────────────────────
function LockedPill() {
  return (
    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ background: 'rgba(90,72,112,0.18)', color: '#4a3060', border: '1px solid rgba(90,72,112,0.25)' }}>
      <Lock size={8} /> Locked
    </span>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionLabel({ number, title, subtitle, accent = '#aa78a6' }) {
  return (
    <div className="mb-10">
      <Reveal>
        <div className="flex items-baseline gap-4 mb-2">
          <span className="text-6xl font-black select-none"
            style={{ color: accent, opacity: 0.18, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {String(number).padStart(2, '0')}
          </span>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: '#f0e8fc' }}>{title}</h2>
        </div>
        {subtitle && <p className="text-sm ml-16" style={{ color: '#7060a0' }}>{subtitle}</p>}
      </Reveal>
    </div>
  );
}

// ── Journey timeline ───────────────────────────────────────────────────────────
function JourneySection({ journey }) {
  if (!journey?.interventions?.length) return null;
  const totalSessions = journey.interventions.length;
  const publicCount = journey.interventions.filter(x => x.is_public).length;

  return (
    <section className="relative py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <SectionLabel number={1} title={journey.name || 'Learning Journey'}
          subtitle={`${totalSessions} sessions · ${publicCount} preview available`} accent="#aa78a6" />

        <div className="relative">
          {/* vertical line */}
          <div className="absolute left-[18px] top-0 bottom-0 w-px"
            style={{ background: 'linear-gradient(to bottom, transparent, rgba(170,120,166,0.4) 10%, rgba(170,120,166,0.4) 90%, transparent)' }} />

          {journey.interventions.map((iv, i) => {
            const info = INTERVENTION_MAP[iv.intervention_type] || INTERVENTION_MAP.custom;
            const Icon = info.icon;
            return (
              <Reveal key={iv.id} delay={i * 0.06} y={20}>
                <div className="flex gap-5 mb-6 group">
                  {/* dot */}
                  <div className="relative flex-shrink-0 mt-1">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300"
                      style={{
                        background: iv.is_public ? `linear-gradient(135deg,${info.color}30,${info.color}18)` : 'rgba(30,20,50,0.8)',
                        border: `1px solid ${iv.is_public ? info.color + '50' : 'rgba(60,40,90,0.6)'}`,
                        boxShadow: iv.is_public ? `0 0 16px ${info.color}25` : 'none',
                      }}>
                      <Icon size={15} style={{ color: iv.is_public ? info.color : '#3a2860' }} />
                    </div>
                    {/* step number */}
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-center flex items-center justify-center text-xs font-bold"
                      style={{ background: '#0e0c1a', color: '#5a4070', border: '1px solid rgba(90,60,130,0.3)', fontSize: 9 }}>
                      {i + 1}
                    </span>
                  </div>

                  {/* content */}
                  <div className="flex-1 min-w-0 pb-2 rounded-2xl px-4 py-3 transition-all duration-300"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(170,120,166,0.08)' }}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold mb-1"
                          style={{ color: iv.is_public ? '#d8c8f0' : '#5a4070' }}>
                          {iv.title}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                            style={{ background: `${info.color}15`, color: iv.is_public ? info.color : '#4a3060', border: `1px solid ${info.color}20` }}>
                            {info.label}
                          </span>
                          {iv.scheduled_date && (
                            <span className="text-xs flex items-center gap-1" style={{ color: '#5a4070' }}>
                              <Calendar size={10} />
                              {format(parseISO(iv.scheduled_date), 'd MMM')}
                              {iv.scheduled_time ? ` · ${iv.scheduled_time.slice(0,5)}` : ''}
                            </span>
                          )}
                          {iv.duration_minutes && (
                            <span className="text-xs flex items-center gap-1" style={{ color: '#5a4070' }}>
                              <Clock size={10} /> {iv.duration_minutes}m
                            </span>
                          )}
                          {iv.location && (
                            <span className="text-xs flex items-center gap-1" style={{ color: '#5a4070' }}>
                              <MapPin size={10} /> {iv.location}
                            </span>
                          )}
                        </div>
                        {iv.is_public && iv.description && (
                          <p className="text-xs mt-2 leading-relaxed" style={{ color: '#6a5080' }}>{iv.description}</p>
                        )}
                      </div>
                      {!iv.is_public && <LockedPill />}
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Content section ────────────────────────────────────────────────────────────
function ContentSection({ items }) {
  if (!items?.length) return null;
  const publicCount = items.filter(x => x.is_public).length;
  return (
    <section className="relative py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <SectionLabel number={2} title="Learning Resources"
          subtitle={`${items.length} items · ${publicCount} publicly accessible`} accent="#6496dc" />

        <div className="grid grid-cols-1 gap-3">
          {items.map((item, i) => {
            const ct = CONTENT_TYPE_MAP[item.content_type] || { label: item.content_type, color: '#7060a0', icon: FileText };
            const Icon = ct.icon;
            return (
              <Reveal key={item.id} delay={i * 0.05} y={16}>
                <div className="flex items-center gap-4 p-4 rounded-2xl transition-all duration-300"
                  style={{
                    background: item.is_public ? 'rgba(100,150,220,0.05)' : 'rgba(255,255,255,0.015)',
                    border: `1px solid ${item.is_public ? 'rgba(100,150,220,0.2)' : 'rgba(60,40,90,0.3)'}`,
                    boxShadow: item.is_public ? '0 2px 20px rgba(100,150,220,0.06)' : 'none',
                  }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: item.is_public ? `linear-gradient(135deg,${ct.color}25,${ct.color}10)` : 'rgba(30,20,50,0.8)',
                      border: `1px solid ${ct.color}${item.is_public ? '40' : '18'}`,
                    }}>
                    <Icon size={16} style={{ color: item.is_public ? ct.color : '#3a2860' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: item.is_public ? '#c8b8e0' : '#4a3060' }}>
                      {item.title}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#4a3060' }}>
                      {ct.label}{item.estimated_minutes ? ` · ${item.estimated_minutes} min read` : ''}
                    </p>
                    {item.is_public && item.description && (
                      <p className="text-xs mt-1 line-clamp-1" style={{ color: '#5a4070' }}>{item.description}</p>
                    )}
                  </div>
                  {item.is_public
                    ? <Globe size={13} style={{ color: '#40c980', flexShrink: 0 }} />
                    : <LockedPill />}
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Assessments section ────────────────────────────────────────────────────────
function AssessmentsSection({ items }) {
  if (!items?.length) return null;
  const publicCount = items.filter(x => x.is_public).length;
  return (
    <section className="relative py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <SectionLabel number={3} title="Assessments"
          subtitle={`${items.length} instruments · ${publicCount} preview available`} accent="#c89650" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map((a, i) => {
            const at = ASSESSMENT_TYPE_MAP[a.assessment_type] || { label: a.assessment_type, color: '#aa78a6', icon: Brain };
            const Icon = at.icon;
            return (
              <Reveal key={a.id} delay={i * 0.07} y={16}>
                <div className="p-5 rounded-2xl h-full transition-all duration-300"
                  style={{
                    background: a.is_public ? `linear-gradient(135deg,${at.color}08,rgba(14,12,26,0.95))` : 'rgba(255,255,255,0.015)',
                    border: `1px solid ${a.is_public ? at.color + '30' : 'rgba(60,40,90,0.3)'}`,
                    boxShadow: a.is_public ? `0 4px 24px ${at.color}10` : 'none',
                  }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{
                        background: a.is_public ? `linear-gradient(135deg,${at.color}30,${at.color}12)` : 'rgba(30,20,50,0.8)',
                        border: `1px solid ${at.color}${a.is_public ? '50' : '20'}`,
                        boxShadow: a.is_public ? `0 0 16px ${at.color}20` : 'none',
                      }}>
                      <Icon size={16} style={{ color: a.is_public ? at.color : '#3a2860' }} />
                    </div>
                    {!a.is_public && <LockedPill />}
                  </div>
                  <p className="text-sm font-semibold mb-1" style={{ color: a.is_public ? '#d8c8f0' : '#4a3060' }}>
                    {a.title}
                  </p>
                  <p className="text-xs" style={{ color: '#4a3060' }}>
                    {at.label}{a.timer_minutes ? ` · ${a.timer_minutes} min` : ''}
                  </p>
                  {a.is_public && a.description && (
                    <p className="text-xs mt-2 leading-relaxed line-clamp-2" style={{ color: '#6a5080' }}>{a.description}</p>
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PublicCohortPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);

  useThreeScene(canvasRef);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  const { data: cohort, isLoading, isError } = useQuery({
    queryKey: ['public-cohort', id],
    queryFn: () => fetchPublicCohort(id),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0e0c1a' }}>
        <canvas ref={canvasRef} className="fixed inset-0 w-full h-full" style={{ zIndex: 0 }} />
        <div className="relative z-10 flex flex-col items-center gap-5">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-400 animate-spin" />
            <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-indigo-400 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
            <div className="absolute inset-4 rounded-full" style={{ background: 'radial-gradient(circle,rgba(170,120,166,0.3),transparent)' }} />
          </div>
          <p className="text-sm tracking-widest uppercase" style={{ color: '#5a4070', letterSpacing: '0.25em' }}>Entering the experience</p>
        </div>
      </div>
    );
  }

  if (isError || !cohort) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0e0c1a' }}>
        <canvas ref={canvasRef} className="fixed inset-0 w-full h-full" style={{ zIndex: 0 }} />
        <div className="relative z-10 text-center max-w-sm">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6, ease: [0.16,1,0.3,1] }}>
            <div className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,rgba(224,80,101,0.15),rgba(170,60,90,0.08))', border: '1px solid rgba(224,80,101,0.25)', boxShadow: '0 0 40px rgba(224,80,101,0.1)' }}>
              <Lock size={32} style={{ color: '#e05065' }} />
            </div>
            <h2 className="text-2xl font-bold mb-3" style={{ color: '#f0e8fc' }}>Program Not Available</h2>
            <p className="text-sm mb-8 leading-relaxed" style={{ color: '#5a4070' }}>
              This program either doesn't exist or hasn't been shared publicly.
            </p>
            <button onClick={() => navigate('/login')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-medium transition-all duration-300"
              style={{ background: 'rgba(170,120,166,0.15)', color: '#aa78a6', border: '1px solid rgba(170,120,166,0.3)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(170,120,166,0.25)'; e.currentTarget.style.transform = 'scale(1.02)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(170,120,166,0.15)'; e.currentTarget.style.transform = ''; }}>
              <LogIn size={15} /> Sign In
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  const programLabel = PROGRAM_LABELS[cohort.program_type] || cohort.program_type?.replace(/_/g, ' ');
  const totalMinutes = (cohort.content || []).reduce((s, c) => s + (c.estimated_minutes || 0), 0);
  const totalSessions = cohort.journey?.interventions?.length || 0;
  const totalAssessments = (cohort.assessments || []).length;
  const publicItemCount = [
    ...(cohort.journey?.interventions || []),
    ...(cohort.content || []),
    ...(cohort.assessments || []),
  ].filter(x => x.is_public).length;

  const hasContent   = (cohort.content || []).length > 0;
  const hasJourney   = totalSessions > 0;
  const hasAssess    = totalAssessments > 0;
  const sectionCount = [hasJourney, hasContent, hasAssess].filter(Boolean).length;

  return (
    <div style={{ background: '#0e0c1a', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>

      {/* 3D canvas — fixed full screen */}
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full" style={{ zIndex: 0 }} />

      {/* gradient overlays for readability */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 1,
        background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(96,64,160,0.18) 0%, transparent 70%)' }} />
      <div className="fixed bottom-0 left-0 right-0 h-64 pointer-events-none" style={{ zIndex: 1,
        background: 'linear-gradient(to top, rgba(14,12,26,0.95), transparent)' }} />

      {/* content */}
      <div className="relative" style={{ zIndex: 2 }}>

        {/* ── Top bar ───────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 transition-all duration-500"
          style={{ background: scrolled ? 'rgba(14,12,26,0.9)' : 'transparent', backdropFilter: scrolled ? 'blur(20px)' : 'none', borderBottom: scrolled ? '1px solid rgba(170,120,166,0.1)' : 'none' }}>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,rgba(170,120,166,0.5),rgba(96,64,160,0.7))', boxShadow: '0 0 16px rgba(170,120,166,0.3)' }}>
              <span style={{ color: '#f0e8fc', fontSize: 12, fontWeight: 800 }}>E</span>
            </div>
            <span className="text-sm font-semibold tracking-wide" style={{ color: '#c8b8e0' }}>EuRadicle</span>
          </div>

          <button onClick={() => navigate('/login')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300"
            style={{ background: 'rgba(170,120,166,0.12)', color: '#aa78a6', border: '1px solid rgba(170,120,166,0.25)', backdropFilter: 'blur(8px)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(170,120,166,0.25)'; e.currentTarget.style.color = '#f0e8fc'; e.currentTarget.style.borderColor = 'rgba(170,120,166,0.5)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(170,120,166,0.12)'; e.currentTarget.style.color = '#aa78a6'; e.currentTarget.style.borderColor = 'rgba(170,120,166,0.25)'; }}>
            <LogIn size={14} /> Login
          </button>
        </motion.div>

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-20">

          {/* ambient glow behind hero */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(ellipse 70% 55% at 50% 40%, rgba(96,64,160,0.15) 0%, rgba(170,120,166,0.06) 50%, transparent 80%)',
          }} />

          <div className="relative max-w-4xl mx-auto text-center w-full">

            {/* chip row */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
              className="flex flex-wrap items-center justify-center gap-2 mb-8">
              {cohort.organization?.display_name && (
                <span className="text-xs px-4 py-1.5 rounded-full font-medium tracking-wide"
                  style={{ background: 'rgba(170,120,166,0.12)', color: '#aa78a6', border: '1px solid rgba(170,120,166,0.25)', backdropFilter: 'blur(8px)' }}>
                  {cohort.organization.display_name}
                </span>
              )}
              <span className="text-xs px-4 py-1.5 rounded-full font-medium tracking-wide capitalize"
                style={{ background: 'rgba(100,150,220,0.1)', color: '#6496dc', border: '1px solid rgba(100,150,220,0.25)', backdropFilter: 'blur(8px)' }}>
                {programLabel}
              </span>
              {cohort.status === 'active' && (
                <span className="text-xs px-4 py-1.5 rounded-full font-medium flex items-center gap-1.5"
                  style={{ background: 'rgba(64,201,128,0.1)', color: '#40c980', border: '1px solid rgba(64,201,128,0.25)', backdropFilter: 'blur(8px)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Enrolling Now
                </span>
              )}
            </motion.div>

            {/* title */}
            <div className="overflow-hidden mb-6">
              <motion.h1
                initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="font-black leading-none tracking-tight"
                style={{ fontSize: 'clamp(2.4rem, 7vw, 5rem)', color: '#f0e8fc', textShadow: '0 0 60px rgba(170,120,166,0.3), 0 0 120px rgba(96,64,160,0.2)' }}>
                {cohort.name}
              </motion.h1>
            </div>

            {cohort.description && (
              <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}
                className="text-base max-w-2xl mx-auto leading-relaxed mb-10"
                style={{ color: '#7060a0' }}>
                {cohort.description}
              </motion.p>
            )}

            {/* stats row */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }}
              className="flex flex-wrap items-center justify-center gap-5 mb-12">
              {cohort.start_date && (
                <div className="flex items-center gap-2 text-sm" style={{ color: '#6050a0' }}>
                  <Calendar size={14} style={{ color: '#aa78a6' }} />
                  {format(parseISO(cohort.start_date), 'd MMM yyyy')}
                </div>
              )}
              {cohort.end_date && (
                <div className="flex items-center gap-2 text-sm" style={{ color: '#6050a0' }}>
                  <Calendar size={14} style={{ color: '#aa78a6' }} />
                  Ends {format(parseISO(cohort.end_date), 'd MMM yyyy')}
                </div>
              )}
              {totalSessions > 0 && (
                <div className="flex items-center gap-2 text-sm" style={{ color: '#6050a0' }}>
                  <Activity size={14} style={{ color: '#aa78a6' }} />
                  {totalSessions} sessions
                </div>
              )}
              {totalMinutes > 0 && (
                <div className="flex items-center gap-2 text-sm" style={{ color: '#6050a0' }}>
                  <Clock size={14} style={{ color: '#aa78a6' }} />
                  {totalMinutes >= 60 ? `${Math.round(totalMinutes / 60)}h` : `${totalMinutes}m`} of content
                </div>
              )}
              {totalAssessments > 0 && (
                <div className="flex items-center gap-2 text-sm" style={{ color: '#6050a0' }}>
                  <Brain size={14} style={{ color: '#c89650' }} />
                  {totalAssessments} assessment{totalAssessments !== 1 ? 's' : ''}
                </div>
              )}
            </motion.div>

            {/* public items note */}
            {publicItemCount > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                className="inline-flex items-center gap-2 text-xs px-4 py-2 rounded-full mb-10"
                style={{ background: 'rgba(64,201,128,0.06)', border: '1px solid rgba(64,201,128,0.15)', color: '#40c980', backdropFilter: 'blur(8px)' }}>
                <Globe size={11} />
                {publicItemCount} item{publicItemCount !== 1 ? 's' : ''} publicly visible — rest requires login
              </motion.div>
            )}

            {/* scroll hint */}
            {sectionCount > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
                className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-2">
                <p className="text-xs tracking-widest uppercase" style={{ color: '#3a2860', letterSpacing: '0.2em' }}>Scroll to explore</p>
                <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
                  <ChevronDown size={16} style={{ color: '#5a4070' }} />
                </motion.div>
              </motion.div>
            )}
          </div>
        </section>

        {/* ── horizontal divider with glow ─────────────────────────────────── */}
        {sectionCount > 0 && (
          <div className="relative h-px mx-auto max-w-3xl" style={{ background: 'linear-gradient(to right, transparent, rgba(170,120,166,0.3), transparent)' }}>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full"
              style={{ background: '#aa78a6', boxShadow: '0 0 12px 4px rgba(170,120,166,0.4)' }} />
          </div>
        )}

        {/* ── Content sections ──────────────────────────────────────────────── */}
        <JourneySection journey={cohort.journey} />
        <ContentSection items={cohort.content} />
        <AssessmentsSection items={cohort.assessments} />

        {/* ── CTA ───────────────────────────────────────────────────────────── */}
        <section className="relative py-32 px-6">
          <div className="max-w-2xl mx-auto text-center">
            <Reveal>
              {/* portal glow */}
              <div className="relative inline-flex items-center justify-center mb-10">
                <div className="absolute w-40 h-40 rounded-full"
                  style={{ background: 'radial-gradient(circle, rgba(170,120,166,0.2) 0%, rgba(96,64,160,0.1) 40%, transparent 70%)', filter: 'blur(20px)' }} />
                <div className="relative w-20 h-20 rounded-3xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,rgba(170,120,166,0.2),rgba(96,64,160,0.15))', border: '1px solid rgba(170,120,166,0.35)', boxShadow: '0 0 40px rgba(170,120,166,0.2), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
                  <Sparkles size={28} style={{ color: '#c8b8e0' }} />
                </div>
              </div>

              <h2 className="text-3xl font-black mb-4 tracking-tight"
                style={{ color: '#f0e8fc', textShadow: '0 0 40px rgba(170,120,166,0.2)' }}>
                Ready to begin your journey?
              </h2>
              <p className="text-sm leading-relaxed mb-10 max-w-md mx-auto" style={{ color: '#5a4070' }}>
                Log in to access your full programme — complete sessions, unlock assessments, and track your growth in real-time.
              </p>

              <button onClick={() => navigate('/login')}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-sm font-bold tracking-wide transition-all duration-300"
                style={{
                  background: 'linear-gradient(135deg,rgba(170,120,166,0.25),rgba(96,64,160,0.2))',
                  color: '#f0e8fc',
                  border: '1px solid rgba(170,120,166,0.4)',
                  boxShadow: '0 0 30px rgba(170,120,166,0.15)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'linear-gradient(135deg,rgba(170,120,166,0.4),rgba(96,64,160,0.35))';
                  e.currentTarget.style.boxShadow = '0 0 50px rgba(170,120,166,0.3)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'linear-gradient(135deg,rgba(170,120,166,0.25),rgba(96,64,160,0.2))';
                  e.currentTarget.style.boxShadow = '0 0 30px rgba(170,120,166,0.15)';
                  e.currentTarget.style.transform = '';
                }}>
                <LogIn size={16} />
                Login to Access
                <ArrowRight size={14} />
              </button>
            </Reveal>
          </div>

          <p className="text-center text-xs mt-16" style={{ color: '#251840' }}>
            Powered by EuRadicle · Learning &amp; Development Platform
          </p>
        </section>

      </div>
    </div>
  );
}

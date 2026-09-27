import { useEffect, useRef, useState } from 'react';

export interface VoiceOrbProps {
  size?: number; // default 220
  mode?: 'sim' | 'mic';
  micLevel?: number; // 0-1
  hoverInteractive?: boolean;
  className?: string;
  reactivity?: number;
}

export function VoiceOrb({
  size = 220,
  mode = 'sim',
  micLevel = 0,
  hoverInteractive = true,
  className = '',
  reactivity = 1,
}: VoiceOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const blob1Ref = useRef<HTMLDivElement>(null);
  const blob2Ref = useRef<HTMLDivElement>(null);
  const blob3Ref = useRef<HTMLDivElement>(null);

  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    let animId: number;
    let t = 0;
    let vSlow = 0;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    const render = () => {
      // Time progression
      const speedMult = isHovered && hoverInteractive ? 1.7 : 1.0;
      t += 0.016 * speedMult;

      // Compute volume/activity signal
      let v = 0;
      if (mode === 'mic') {
        v = micLevel;
        if (reactivity > 1) {
          v = Math.min(1, v * reactivity);
        }
      } else {
        // Speech-like envelope (13s cycle, 2 phrases, breathing)
        const cycle = (t % 13) / 13;
        const phrase1 = Math.max(0, Math.sin(cycle * Math.PI * 3)) * (cycle < 0.4 ? 1 : 0);
        const phrase2 = Math.max(0, Math.sin((cycle - 0.45) * Math.PI * 3.5)) * (cycle > 0.45 && cycle < 0.85 ? 1 : 0);
        const syllable = (Math.sin(t * 8) * Math.cos(t * 12) + 1) * 0.5;
        const breath = (Math.sin(t * 1.2) + 1) * 0.15;
        const rawV = (phrase1 + phrase2) * (0.4 + 0.6 * syllable) + breath;
        v = Math.min(1, Math.max(0.08, rawV)) * (isHovered ? 1.15 : 1.0);
      }

      vSlow = vSlow * 0.92 + v * 0.08;

      // 1. Morph border-radius for orb and glow
      const amp = 6 + v * 12;
      const radii: number[] = [];
      for (let i = 0; i < 8; i++) {
        const delta =
          0.58 * Math.sin(t * 2 + i * 1.31) +
          0.3 * Math.sin(1.73 * t * 2 + i * 2.11) +
          0.16 * Math.sin(2.9 * t * 2 + i * 0.83);
        radii.push(50 + delta * amp);
      }
      const brString = `${radii[0]}% ${100 - radii[0]}% ${radii[1]}% ${100 - radii[1]}% / ${radii[2]}% ${radii[3]}% ${100 - radii[3]}% ${100 - radii[2]}%`;

      if (orbRef.current) {
        orbRef.current.style.borderRadius = brString;
        const scale = 1 + v * 0.08;
        orbRef.current.style.transform = `scale(${scale})`;
      }

      if (glowRef.current) {
        glowRef.current.style.borderRadius = brString;
        const glowScale = 0.94 + v * 0.16;
        glowRef.current.style.transform = `scale(${glowScale})`;
      }

      // 2. Aurora blobs wandering
      const r1 = 36 + v * 20;
      const x1 = Math.cos(t * 1.1) * r1;
      const y1 = Math.sin(t * 0.9) * r1;
      if (blob1Ref.current) {
        blob1Ref.current.style.transform = `translate(${x1}px, ${y1}px)`;
        blob1Ref.current.style.opacity = `${0.5 + v * 0.5}`;
      }

      const r2 = 42 + v * 22;
      const x2 = Math.sin(t * 1.3 + 1.2) * r2;
      const y2 = Math.cos(t * 1.0) * r2;
      if (blob2Ref.current) {
        blob2Ref.current.style.transform = `translate(${x2}px, ${y2}px)`;
        blob2Ref.current.style.opacity = `${0.4 + v * 0.55}`;
      }

      const r3 = 34 + v * 18;
      const x3 = Math.cos(t * 0.8 + 2.5) * r3;
      const y3 = Math.sin(t * 1.2 + 0.8) * r3;
      if (blob3Ref.current) {
        blob3Ref.current.style.transform = `translate(${x3}px, ${y3}px)`;
        blob3Ref.current.style.opacity = `${0.38 + v * 0.54}`;
      }

      // 3. Canvas wobbly halo rings
      if (canvas && ctx) {
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        const cx = w / 2;
        const cy = h / 2;
        const baseRadius = (size / 2) * 0.96;

        // Halo Ring 1: Navy
        ctx.save();
        ctx.beginPath();
        const rot1 = t * 0.5;
        const steps = 72;
        for (let i = 0; i <= steps; i++) {
          const theta = (i / steps) * Math.PI * 2;
          const wobble =
            0.04 * Math.sin(3 * theta + rot1) +
            0.02 * Math.sin(5 * theta - rot1 * 1.2) +
            0.015 * Math.sin(7 * theta + rot1 * 0.7);
          const r = baseRadius * (0.92 + 0.08 * vSlow + wobble * (0.8 + 1.2 * v));
          const px = cx + Math.cos(theta) * r;
          const py = cy + Math.sin(theta) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(35, 64, 127, ${0.25 + 0.4 * vSlow})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.restore();

        // Halo Ring 2: Brick
        ctx.save();
        ctx.beginPath();
        const rot2 = -t * 0.32;
        for (let i = 0; i <= steps; i++) {
          const theta = (i / steps) * Math.PI * 2;
          const wobble =
            0.035 * Math.cos(3 * theta + rot2) +
            0.025 * Math.sin(5 * theta + rot2 * 1.1);
          const r = baseRadius * 1.06 * (0.92 + 0.08 * vSlow + wobble * (0.8 + 1.1 * v));
          const px = cx + Math.cos(theta) * r;
          const py = cy + Math.sin(theta) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(168, 52, 43, ${0.2 + 0.35 * vSlow})`;
        ctx.lineWidth = 1.0;
        ctx.stroke();
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [size, mode, micLevel, hoverInteractive, isHovered, reactivity]);

  // Scaled dimensions
  const scaleRatio = size / 220;
  const boxDim = 340 * scaleRatio;
  const glowDim = 300 * scaleRatio;

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative flex items-center justify-center select-none cursor-pointer ${className}`}
      style={{ width: `${boxDim}px`, height: `${boxDim}px` }}
    >
      {/* Outer Glow Wash */}
      <div
        ref={glowRef}
        className="absolute rounded-full pointer-events-none transition-transform"
        style={{
          width: `${glowDim}px`,
          height: `${glowDim}px`,
          background:
            'radial-gradient(circle, rgba(232,178,84,0.4) 0%, rgba(168,52,43,0.2) 52%, transparent 70%)',
          filter: 'blur(36px)',
        }}
      />

      {/* Main Orb Body */}
      <div
        ref={orbRef}
        className="relative overflow-hidden bg-bright transition-transform shadow-[0_0_0_1px_rgba(252,251,247,0.25),0_24px_60px_rgba(0,0,0,0.4)]"
        style={{
          width: `${size}px`,
          height: `${size}px`,
        }}
      >
        {/* Aurora Blobs Container */}
        <div
          className="absolute inset-[-30%] pointer-events-none"
          style={{ filter: 'saturate(1.2)' }}
        >
          {/* Navy blob */}
          <div
            ref={blob1Ref}
            className="absolute rounded-full"
            style={{
              width: `${200 * scaleRatio}px`,
              height: `${200 * scaleRatio}px`,
              left: '25%',
              top: '20%',
              background: 'radial-gradient(circle, rgba(35,64,127,0.95) 0%, transparent 70%)',
              filter: 'blur(20px)',
            }}
          />
          {/* Brick blob */}
          <div
            ref={blob2Ref}
            className="absolute rounded-full"
            style={{
              width: `${190 * scaleRatio}px`,
              height: `${190 * scaleRatio}px`,
              right: '20%',
              top: '30%',
              background: 'radial-gradient(circle, rgba(168,52,43,0.9) 0%, transparent 70%)',
              filter: 'blur(20px)',
            }}
          />
          {/* Ochre blob */}
          <div
            ref={blob3Ref}
            className="absolute rounded-full"
            style={{
              width: `${195 * scaleRatio}px`,
              height: `${195 * scaleRatio}px`,
              left: '30%',
              bottom: '20%',
              background: 'radial-gradient(circle, rgba(184,134,43,0.92) 0%, transparent 70%)',
              filter: 'blur(20px)',
            }}
          />
        </div>

        {/* Top-left Sheen & Bottom Shade */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 32% 24%, rgba(255,255,255,0.75) 0%, transparent 50%)',
            boxShadow: 'inset 0 -20px 36px rgba(23,22,26,0.14)',
          }}
        />
      </div>

      {/* Canvas for halo rings */}
      <canvas
        ref={canvasRef}
        width={boxDim}
        height={boxDim}
        className="absolute inset-0 pointer-events-none"
      />
    </div>
  );
}

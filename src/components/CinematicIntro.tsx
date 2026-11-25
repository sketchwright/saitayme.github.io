import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Cinematic boot intro (~5.5s after "JACK IN"). Orange/black/white only, no glow.
 * Sound is synthesized with Web Audio (no files) and only starts after the click.
 * Skippable (button / Esc / Space), mute remembered, reduced-motion → skipped.
 */

const MUTE_KEY = 'portfolio-intro-muted';
const ORANGE = '#f07e41';

function readMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

/* ---------------- Synth SFX ---------------- */
class IntroSynth {
  ctx: AudioContext;
  master: GainNode;
  constructor(muted: boolean) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
  }
  setMuted(m: boolean) { this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.02); }
  private noiseBuffer(sec: number) {
    const b = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * sec), this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  /** Low power-on hum that swells and decays */
  hum(at: number, dur = 2.6) {
    const t = this.ctx.currentTime + at;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(180, t);
    lp.frequency.linearRampToValueAtTime(600, t + dur);
    [55, 110.5].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = i ? 'sawtooth' : 'sine';
      o.frequency.value = f;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur);
    });
    lp.connect(g).connect(this.master);
  }
  /** Short digital glitch burst */
  glitch(at: number, len = 0.12) {
    const t = this.ctx.currentTime + at;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(len);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800 + Math.random() * 2500;
    bp.Q.value = 6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    // stuttered gate
    for (let k = 0; k < 6; k++) g.gain.setValueAtTime(k % 2 ? 0.0001 : 0.5, t + (k * len) / 6);
    g.gain.setValueAtTime(0.0001, t + len);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
  }
  /** Rising tension: filtered noise + detuned saws sweeping up */
  riser(at: number, dur = 1.2) {
    const t = this.ctx.currentTime + at;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(dur);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(6000, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + dur * 0.95);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    [0, 7].forEach((det) => {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(880, t + dur);
      o.detune.value = det * 10;
      const og = this.ctx.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.06, t + dur);
      og.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02);
      o.connect(og).connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
  }
  /** Impact: sub drop + noise crack */
  impact(at: number) {
    const t = this.ctx.currentTime + at;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.9);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 1.5);
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer(0.35);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.6, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    n.connect(hp).connect(ng).connect(this.master);
    n.start(t);
  }
  /** Soft data ticks while text decodes */
  ticks(at: number, count = 10, step = 0.045) {
    for (let k = 0; k < count; k++) {
      const t = this.ctx.currentTime + at + k * step;
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = 2200 + Math.random() * 1600;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.04);
    }
  }
  close() { this.ctx.close().catch(() => {}); }
}

/* ---------------- Particles that assemble "JS" ---------------- */
function sampleTextPoints(text: string, w: number, h: number, step: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 ${Math.floor(h * 0.8)}px Orbitron, Arial Black, sans-serif`;
  g.fillText(text, w / 2, h / 2);
  const d = g.getImageData(0, 0, w, h).data;
  const pts: [number, number][] = [];
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) if (d[(y * w + x) * 4 + 3] > 128) pts.push([x, y]);
  return pts;
}

const DECODE = 'MARKETING ENGINEER // GAMEPLAY PROGRAMMER';
const GLYPHS = '!<>-_\\/[]{}=+*^?#01ABCDEF';

export default function CinematicIntro({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'gate' | 'run' | 'out'>('gate');
  const [muted, setMuted] = useState(readMuted);
  const [t, setT] = useState(0); // seconds since JACK IN (coarse, for DOM layers)
  const [decoded, setDecoded] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const synthRef = useRef<IntroSynth | null>(null);
  const doneRef = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase('out');
    window.setTimeout(() => {
      synthRef.current?.close();
      onDone();
    }, 650);
  }, [onDone]);

  // reduced motion → skip
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) onDone();
  }, [onDone]);

  // keys: Enter/Space on gate = jack in; Esc = skip
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      else if (phase === 'gate' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); start(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, finish]);

  const toggleMute = () => {
    setMuted((m) => {
      const n = !m;
      try { localStorage.setItem(MUTE_KEY, n ? '1' : '0'); } catch { /* ignore */ }
      synthRef.current?.setMuted(n);
      return n;
    });
  };

  const start = () => {
    if (phase !== 'gate') return;
    try {
      const s = new IntroSynth(muted);
      synthRef.current = s;
      s.hum(0, 3.2);
      s.glitch(0.35);
      s.glitch(0.62, 0.08);
      s.glitch(1.45, 0.1);
      s.riser(1.9, 1.1);
      s.impact(3.0);
      s.ticks(3.45, 14, 0.05);
      s.glitch(4.7, 0.09);
    } catch { /* no audio available — run silently */ }
    setPhase('run');
  };

  // Main timeline: one rAF loop for canvas particles + coarse clock for DOM
  useEffect(() => {
    if (phase !== 'run') return;
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth;
    const H = window.innerHeight;
    cv.width = W * dpr;
    cv.height = H * dpr;
    const g = cv.getContext('2d')!;
    g.scale(dpr, dpr);

    const logoH = Math.min(220, H * 0.28);
    const logoW = logoH * 1.6;
    const step = Math.max(3, Math.round(logoH / 55));
    const pts = sampleTextPoints('JS', Math.round(logoW), Math.round(logoH), step);
    const ox = W / 2 - logoW / 2;
    const oy = H * 0.34 - logoH / 2;
    const parts = pts.map(([x, y]) => {
      const a = Math.random() * Math.PI * 2;
      const r = Math.max(W, H) * (0.4 + Math.random() * 0.6);
      return { tx: ox + x, ty: oy + y, sx: W / 2 + Math.cos(a) * r, sy: H / 2 + Math.sin(a) * r, d: Math.random() * 0.35 };
    });

    const t0 = performance.now();
    let raf = 0;
    let lastClock = -1;
    const ease = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 4);

    const frame = (now: number) => {
      const s = (now - t0) / 1000;
      const sc = Math.floor(s * 20) / 20;
      if (sc !== lastClock) { lastClock = sc; setT(sc); }

      g.clearRect(0, 0, W, H);
      // CRT power-on line (0–0.45s)
      if (s < 0.5) {
        const k = ease(s / 0.35);
        g.fillStyle = '#fff';
        g.fillRect(W / 2 - (W / 2) * k, H / 2 - 1, W * k, 2);
      }
      // particles converge 0.9s–2.3s, hold, then shatter on impact 3.0s
      if (s > 0.85) {
        g.fillStyle = ORANGE;
        for (const p of parts) {
          let x: number, y: number;
          if (s < 3.0) {
            const k = ease((s - 0.9 - p.d) / 1.2);
            x = p.sx + (p.tx - p.sx) * k;
            y = p.sy + (p.ty - p.sy) * k;
          } else {
            const k = (s - 3.0) * 1.6;
            x = p.tx + (p.tx - W / 2) * k * k * 0.9;
            y = p.ty + (p.ty - H * 0.34) * k * k * 0.9;
          }
          const sz = step * 0.62;
          g.globalAlpha = s < 3.0 ? 1 : Math.max(0, 1 - (s - 3.0) * 1.4);
          g.fillRect(x, y, sz, sz);
        }
        g.globalAlpha = 1;
      }
      if (s < 6.2 && !doneRef.current) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const endT = window.setTimeout(finish, 5400);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(endT);
    };
  }, [phase, finish]);

  // Decode the role line from 3.4s
  useEffect(() => {
    if (phase !== 'run' || t < 3.4) return;
    const p = Math.min(1, (t - 3.4) / 0.9);
    const n = Math.floor(p * DECODE.length);
    let s = '';
    for (let i = 0; i < DECODE.length; i++) s += i < n || DECODE[i] === ' ' ? DECODE[i] : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    setDecoded(s);
  }, [t, phase]);

  const shake = phase === 'run' && t >= 3.0 && t < 3.35;
  const nameIn = t >= 3.0;
  const push = phase === 'out' || t >= 4.8;

  return (
    <div
      className="fixed inset-0 z-[100] bg-[#060606] overflow-hidden select-none"
      style={{ opacity: phase === 'out' ? 0 : 1, transition: 'opacity 0.6s ease' }}
      role="dialog"
      aria-label="Intro"
    >
      {/* scanlines + vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.025) 0 1px, transparent 1px 3px)' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.85))' }} />

      {phase === 'gate' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
          <p className="font-mono text-[11px] tracking-[0.4em] text-gray-500 uppercase">js // portfolio · 2026</p>
          <button
            type="button"
            onClick={start}
            className="group relative px-10 py-4 font-mono text-sm tracking-[0.5em] text-primary border border-primary/50 hover:bg-primary hover:text-black transition-colors"
          >
            <span className="absolute -top-px -left-px w-3 h-3 border-t border-l border-primary" />
            <span className="absolute -bottom-px -right-px w-3 h-3 border-b border-r border-primary" />
            JACK IN
          </button>
          <p className="font-mono text-[10px] tracking-[0.3em] text-gray-600 uppercase">{muted ? 'sound off' : 'sound on'} · enter to start · esc to skip</p>
        </div>
      )}

      {phase !== 'gate' && (
        <div
          className="absolute inset-0"
          style={{
            transform: `${push ? 'scale(1.18)' : 'scale(1)'} ${shake ? `translate(${(Math.random() * 10 - 5).toFixed(1)}px, ${(Math.random() * 8 - 4).toFixed(1)}px)` : ''}`,
            transition: push ? 'transform 0.9s cubic-bezier(.6,0,.2,1)' : 'none',
          }}
        >
          {/* grid lines drawing in */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              opacity: t > 0.4 ? 0.5 : 0,
              transition: 'opacity 0.8s',
              backgroundImage: 'linear-gradient(rgba(240,126,65,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(240,126,65,0.08) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
              maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 70%)',
              WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 70%)',
            }}
          />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

          {/* Name slam with chromatic split (orange / white / dark red) */}
          <div className="absolute inset-x-0 top-[52%] -translate-y-1/2 flex justify-center pointer-events-none">
            <div
              className="relative font-cyber font-black tracking-[0.08em] text-5xl sm:text-7xl md:text-8xl"
              style={{
                opacity: nameIn ? 1 : 0,
                transform: nameIn ? 'scale(1)' : 'scale(1.6)',
                transition: 'transform 0.18s cubic-bezier(.2,.9,.2,1.2), opacity 0.05s',
              }}
            >
              <span className="absolute inset-0 text-[#8a1c12]" style={{ transform: `translate(${t < 3.5 ? -6 : -1.5}px, 0)`, transition: 'transform 0.5s', mixBlendMode: 'screen' }} aria-hidden>JULIAN STRUNZ</span>
              <span className="absolute inset-0 text-primary" style={{ transform: `translate(${t < 3.5 ? 6 : 1.5}px, 0)`, transition: 'transform 0.5s', mixBlendMode: 'screen' }} aria-hidden>JULIAN STRUNZ</span>
              <span className="relative text-[#f4efe8]">JULIAN STRUNZ</span>
            </div>
          </div>

          {/* Role line decoding */}
          <div className="absolute inset-x-0 top-[64%] flex justify-center px-4">
            <p className="font-mono text-xs sm:text-sm md:text-base tracking-[0.35em] text-primary text-center whitespace-pre-wrap" style={{ opacity: t >= 3.4 ? 1 : 0 }}>
              {decoded}
            </p>
          </div>

          {/* HUD corners + boot readout */}
          <div className="absolute left-5 bottom-5 font-mono text-[10px] text-gray-500 tracking-[0.2em] leading-5 pointer-events-none">
            <div>SYS.BOOT {Math.min(100, Math.round((t / 4.6) * 100)).toString().padStart(3, '0')}%</div>
            <div>{t < 1 ? 'POWER ……' : t < 2.3 ? 'ASSEMBLING ……' : t < 3 ? 'CHARGING ……' : 'LINK ESTABLISHED'}</div>
          </div>
        </div>
      )}

      {/* controls */}
      <div className="absolute top-4 right-4 flex gap-2 font-mono text-[10px] tracking-[0.25em] uppercase">
        <button type="button" onClick={toggleMute} className="px-3 py-1.5 border border-[#2e2e2e] text-gray-400 hover:text-primary hover:border-primary/60">
          {muted ? 'sound off' : 'sound on'}
        </button>
        <button type="button" onClick={finish} className="px-3 py-1.5 border border-[#2e2e2e] text-gray-400 hover:text-primary hover:border-primary/60">
          skip ›
        </button>
      </div>
    </div>
  );
}

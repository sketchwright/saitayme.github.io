import { useEffect, useRef, useState } from 'react';
import { ACCENT_MKT, BRAND_ORANGE } from '@/theme';

/**
 * BUILD × GROW skill radar — "Ember mono": orange only, no glow, lots of motion.
 * One rAF loop writes SVG attributes through refs (no React state per frame),
 * paused offscreen, static for prefers-reduced-motion.
 */

type Side = 'build' | 'grow';
type Skill = { id: string; short: string; label: string; side: Side; level: number; proof: string };

// Clockwise from top. Right half = GROW (marketing), left half = BUILD (engineering).
const SKILLS: Skill[] = [
  { id: 'social', short: 'SOCIAL', label: 'Social & Content', side: 'grow', level: 0.9, proof: 'Own the social channels and reveal campaign for Mayhem À La Carte' },
  { id: 'creators', short: 'CREATORS', label: 'Creators & Outreach', side: 'grow', level: 0.88, proof: 'Built IGS Outreach: live creator data + throttled personalised mail' },
  { id: 'automation', short: 'AUTOMATION', label: 'Automation & AI', side: 'grow', level: 0.86, proof: 'Agentic pipeline: 5-hour stream → approved clips → scheduled posts' },
  { id: 'web', short: 'WEB/LIVE', label: 'Web & Streams', side: 'grow', level: 0.82, proof: 'Built mayhemalacarte.com and the ModKit website; host dev streams' },
  { id: 'tools', short: 'TOOLS', label: 'Tools & Pipelines', side: 'build', level: 0.9, proof: 'One-click CSV → recipe data assets for every cooking step' },
  { id: 'network', short: 'NETWORK', label: 'Multiplayer', side: 'build', level: 0.88, proof: 'EOS subsystem behind Mayhem À La Carte’s 4-player co-op' },
  { id: 'gameplay', short: 'GAMEPLAY', label: 'Gameplay', side: 'build', level: 0.87, proof: '50+ fixes shipped in Crime Boss Update 20' },
  { id: 'code', short: 'C++/C#', label: 'C++ / C#', side: 'build', level: 0.82, proof: 'C++ for Unreal gameplay & networking, C# for Unity tools' },
];

type Mode = 'eng' | 'both' | 'mkt';

const SIZE = 520;
const C = SIZE / 2;
const R = 180;
const N = SKILLS.length;
const GRID = '#262626';
const ORANGE = BRAND_ORANGE;
const MKT = ACCENT_MKT;
const COLLAPSED = 0.12;

const angleOf = (i: number) => ((i + 0.5) / N) * Math.PI * 2 - Math.PI / 2;
const pt = (i: number, r: number): [number, number] => [C + r * Math.cos(angleOf(i)), C + r * Math.sin(angleOf(i))];

/** Target radius factor per axis for a polygon of `side` in `mode`. */
function targetLevels(side: Side, mode: Mode): number[] {
  const shown = mode === 'both' || (mode === 'eng' && side === 'build') || (mode === 'mkt' && side === 'grow');
  return SKILLS.map((s) => (s.side === side ? (shown ? s.level : COLLAPSED) : COLLAPSED * 0.6));
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const seg = (t: number, a: number, b: number) => ease((t - a) / (b - a));

export default function SkillReactor() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const axesRef = useRef<(SVGLineElement | null)[]>([]);
  const ringsRef = useRef<(SVGCircleElement | null)[]>([]);
  const buildRef = useRef<SVGPolygonElement>(null);
  const growRef = useRef<SVGPolygonElement>(null);
  const nodesRef = useRef<(SVGGElement | null)[]>([]);
  const labelsRef = useRef<(SVGTextElement | null)[]>([]);
  const sweepRef = useRef<SVGGElement>(null);
  const glitchRef = useRef<SVGRectElement>(null);
  const scanRef = useRef<HTMLSpanElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const leaderRef = useRef<SVGPolylineElement>(null);
  const anchorRef = useRef<SVGRectElement>(null);
  const termRef = useRef<SVGRectElement>(null);
  const focusRef = useRef(6);

  const [mode, setMode] = useState<Mode>('both');
  const [hover, setHover] = useState<number | null>(null);
  const [panel, setPanel] = useState(6); // start on GAMEPLAY

  // Animation state (mutable, not React state)
  const st = useRef({
    started: -1,
    cur: { build: new Array(N).fill(0) as number[], grow: new Array(N).fill(0) as number[] },
    target: { build: targetLevels('build', 'both'), grow: targetLevels('grow', 'both') },
    glitchAt: -1e9,
    nextLabelGlitch: 0,
    scanIdx: 0,
    nextScan: 0,
    countTo: 87,
    countAt: 0,
  });

  useEffect(() => {
    st.current.target = { build: targetLevels('build', mode), grow: targetLevels('grow', mode) };
    st.current.glitchAt = performance.now();
  }, [mode]);

  const focus = hover ?? panel;
  focusRef.current = focus;
  useEffect(() => {
    st.current.countTo = Math.round(SKILLS[focus].level * 100);
    st.current.countAt = performance.now();
  }, [focus]);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const s = st.current;
    let raf = 0;
    let visible = false;
    let last = 0;

    const writePoly = (el: SVGPolygonElement | null, lv: number[]) => {
      if (!el) return 0;
      const ps = lv.map((l, i) => pt(i, R * l));
      let per = 0;
      for (let i = 0; i < ps.length; i++) {
        const a = ps[i];
        const b = ps[(i + 1) % ps.length];
        per += Math.hypot(b[0] - a[0], b[1] - a[1]);
      }
      el.setAttribute('points', ps.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '));
      return per;
    };

    const frame = (now: number) => {
      if (s.started < 0) s.started = now;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      const t = reduce ? 99 : (now - s.started) / 1000;

      // 1) axes extend 0–0.5s
      const ax = seg(t, 0, 0.5);
      axesRef.current.forEach((el, i) => {
        if (!el) return;
        const [x, y] = pt(i, R * ax);
        el.setAttribute('x2', x.toFixed(1));
        el.setAttribute('y2', y.toFixed(1));
      });
      // 2) rings draw in 0.3–1.2s
      ringsRef.current.forEach((el, k) => {
        if (!el) return;
        const circ = 2 * Math.PI * Number(el.getAttribute('r'));
        el.setAttribute('stroke-dasharray', `${circ}`);
        el.setAttribute('stroke-dashoffset', `${circ * (1 - seg(t, 0.3 + k * 0.08, 1.0 + k * 0.08))}`);
      });

      // 3) polygons: intro growth, then smooth morph toward mode targets
      const lerp = reduce ? 1 : 1 - Math.exp(-dt * 7);
      (['build', 'grow'] as Side[]).forEach((side) => {
        const cur = s.cur[side];
        const tgt = s.target[side];
        const intro = side === 'build' ? seg(t, 0.9, 1.6) : seg(t, 1.4, 2.1);
        for (let i = 0; i < N; i++) cur[i] += (tgt[i] * intro - cur[i]) * lerp;
        const el = side === 'build' ? buildRef.current : growRef.current;
        const per = writePoly(el, cur);
        if (!el) return;
        if (side === 'build') {
          const d = seg(t, 0.9, 1.7);
          el.setAttribute('stroke-dasharray', d >= 1 ? 'none' : `${per}`);
          el.setAttribute('stroke-dashoffset', d >= 1 ? '0' : `${per * (1 - d)}`);
          el.setAttribute('fill-opacity', String(0.16 * seg(t, 1.4, 1.9)));
        } else {
          el.style.opacity = String(seg(t, 1.4, 2.2));
        }
      });

      // 3b) leader line: anchor = hovered skill's live (morphing) data vertex; end = panel header corner
      {
        const fi = focusRef.current;
        const side = SKILLS[fi].side;
        const [vx, vy] = pt(fi, R * s.cur[side][fi]);
        const shape = side === 'grow' ? `rotate(45 ${vx.toFixed(2)} ${vy.toFixed(2)})` : '';
        if (anchorRef.current) {
          anchorRef.current.setAttribute('x', (vx - 5).toFixed(2));
          anchorRef.current.setAttribute('y', (vy - 5).toFixed(2));
          anchorRef.current.setAttribute('transform', shape);
          anchorRef.current.setAttribute('data-cx', vx.toFixed(2));
          anchorRef.current.setAttribute('data-cy', vy.toFixed(2));
        }
        const svg = svgRef.current;
        const panelEl = panelRef.current;
        const line = leaderRef.current;
        if (svg && panelEl && line) {
          const sr = svg.getBoundingClientRect();
          const pr = panelEl.getBoundingClientRect();
          const beside = pr.left >= sr.right - 4; // panel to the right (desktop); otherwise it's below → no leader
          if (beside && sr.width > 0) {
            const k = SIZE / sr.width;
            const ex = (pr.left - sr.left) * k; // panel's left edge in SVG units
            const ey = (pr.top + 18 - sr.top) * k; // header row
            const ox = vx + Math.min(36, Math.max(14, Math.abs(ey - vy) * 0.35)); // elbow: diagonal out, then horizontal
            line.setAttribute('points', `${vx.toFixed(2)},${vy.toFixed(2)} ${ox.toFixed(2)},${ey.toFixed(2)} ${(ex - 2).toFixed(2)},${ey.toFixed(2)}`);
            line.style.opacity = String(seg(t, 2.0, 2.4));
            if (termRef.current) {
              termRef.current.setAttribute('x', (ex - 5).toFixed(2));
              termRef.current.setAttribute('y', (ey - 3).toFixed(2));
              termRef.current.style.opacity = line.style.opacity;
            }
          } else {
            line.style.opacity = '0';
            if (termRef.current) termRef.current.style.opacity = '0';
          }
        }
      }

      // 4) nodes power up one by one with a quick flicker
      nodesRef.current.forEach((el, i) => {
        if (!el) return;
        const on0 = 1.8 + i * 0.08;
        const o = reduce ? 1 : t < on0 ? 0 : t < on0 + 0.18 ? (Math.random() > 0.5 ? 1 : 0.2) : 1;
        el.style.opacity = String(o);
      });

      // 5) radar sweep (6s period)
      if (sweepRef.current) {
        const a = reduce ? -90 : ((now / 1000) * 60) % 360;
        sweepRef.current.setAttribute('transform', `rotate(${a.toFixed(2)} ${C} ${C})`);
        sweepRef.current.style.opacity = String(seg(t, 1.0, 1.6));
      }

      // 6) occasional label glitch
      if (!reduce && now > s.nextLabelGlitch && t > 2.5) {
        const el = labelsRef.current[Math.floor(Math.random() * N)];
        if (el) {
          el.setAttribute('transform', `translate(${(Math.random() * 4 - 2).toFixed(1)} 0)`);
          window.setTimeout(() => el.removeAttribute('transform'), 90);
        }
        s.nextLabelGlitch = now + 1800 + Math.random() * 2200;
      }

      // 7) mode-change scanline
      if (glitchRef.current) {
        const g = (now - s.glitchAt) / 320;
        if (g >= 0 && g <= 1 && t > 2.2) {
          glitchRef.current.setAttribute('y', String(-20 + g * (SIZE + 40)));
          glitchRef.current.style.opacity = String(0.3 * (1 - g));
        } else glitchRef.current.style.opacity = '0';
      }

      // 8) scanning readout + count-up
      if (scanRef.current && now > s.nextScan && t > 2) {
        const sk = SKILLS[s.scanIdx % N];
        scanRef.current.textContent = `SCAN ▸ ${sk.short.padEnd(10, ' ')} ${String(Math.round(sk.level * 100)).padStart(3, '0')}`;
        s.scanIdx++;
        s.nextScan = now + 900;
      }
      if (countRef.current) {
        const c = reduce ? 1 : seg((now - s.countAt) / 1000, 0, 0.6);
        countRef.current.textContent = String(Math.round(s.countTo * c)).padStart(3, '0');
      }

      if (visible && !reduce && !document.hidden) raf = requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        cancelAnimationFrame(raf);
        if (visible) {
          last = 0;
          raf = requestAnimationFrame(frame);
        }
      },
      { threshold: 0.15 }
    );
    if (wrapRef.current) io.observe(wrapRef.current);
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && visible) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    // reduced motion: render the final state once
    if (reduce) raf = requestAnimationFrame(frame);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      cancelAnimationFrame(raf);
    };
  }, []);

  const fs = SKILLS[focus];

  // Sweep trail: stacked wedges with falling opacity (no blur)
  const trail = Array.from({ length: 7 }).map((_, k) => {
    const a0 = (-(k + 1) * 6 * Math.PI) / 180;
    const a1 = (-k * 6 * Math.PI) / 180;
    const p0 = [C + R * Math.cos(a0), C + R * Math.sin(a0)];
    const p1 = [C + R * Math.cos(a1), C + R * Math.sin(a1)];
    return <path key={k} d={`M${C},${C} L${p0[0]},${p0[1]} A${R},${R} 0 0 1 ${p1[0]},${p1[1]} Z`} fill={ORANGE} fillOpacity={0.12 * (1 - k / 7)} />;
  });

  return (
    <div ref={wrapRef} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-6 lg:gap-8 items-center">
      <div className="min-w-0">
        {/* Mode toggle + scanning readout */}
        <div className="flex items-center gap-1 mb-3 font-mono text-[11px] tracking-[0.25em]" role="radiogroup" aria-label="Show skills">
          {(['eng', 'both', 'mkt'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 min-h-[40px] min-w-[48px] border transition-colors ${mode === m ? 'bg-primary text-cyber-black border-primary' : 'text-gray-400 border-[#2e2e2e] hover:text-primary hover:border-primary/60'}`}
            >
              {m === 'eng' ? 'ENG' : m === 'mkt' ? 'MKT' : 'BOTH'}
            </button>
          ))}
          <span ref={scanRef} className="ml-auto text-gray-500 whitespace-pre hidden sm:inline">SCAN ▸</span>
        </div>

        <div className="relative w-full max-w-[520px] mx-auto aspect-square">
          <svg ref={svgRef} viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full overflow-visible" role="img" aria-label="Skill map: engineering and marketing">
            <defs>
              <pattern id="sr-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" stroke={MKT} strokeWidth="1" strokeOpacity="0.6" />
              </pattern>
            </defs>

            {[1, 0.75, 0.5, 0.25].map((f, k) => (
              <circle key={f} ref={(el) => { ringsRef.current[k] = el; }} cx={C} cy={C} r={R * f} fill="none" stroke={GRID} strokeWidth="1" />
            ))}
            <g className="sr-spin-slow" style={{ transformOrigin: `${C}px ${C}px` }}>
              {Array.from({ length: 72 }).map((_, i) => {
                const a = (i / 72) * Math.PI * 2;
                const r1 = R + 40;
                const r2 = R + (i % 6 === 0 ? 50 : 44);
                return <line key={i} x1={C + r1 * Math.cos(a)} y1={C + r1 * Math.sin(a)} x2={C + r2 * Math.cos(a)} y2={C + r2 * Math.sin(a)} stroke={i % 6 === 0 ? '#3a3a3a' : GRID} strokeWidth="1" />;
              })}
            </g>
            <line x1={C} y1={C - R - 30} x2={C} y2={C + R + 30} stroke={GRID} strokeDasharray="3 5" />
            <text x={C - 10} y={C - R - 36} textAnchor="end" className="font-mono" fontSize="10" fill="#8a8a8a" letterSpacing="3">BUILD ■</text>
            <text x={C + 10} y={C - R - 36} textAnchor="start" className="font-mono" fontSize="10" fill="#8a8a8a" letterSpacing="3">◆ GROW</text>

            {SKILLS.map((s, i) => {
              const [x, y] = pt(i, R);
              const on = focus === i;
              return (
                <g key={`ax-${s.id}`}>
                  <line ref={(el) => { axesRef.current[i] = el; }} x1={C} y1={C} x2={C} y2={C} stroke={on ? ORANGE : GRID} strokeWidth={on ? 1.2 : 1} strokeDasharray={on ? undefined : '3 5'} />
                  <line x1={C} y1={C} x2={x} y2={y} stroke="transparent" strokeWidth="26" style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setPanel(i)} />
                </g>
              );
            })}

            <g ref={sweepRef} style={{ pointerEvents: 'none', opacity: 0 }}>
              {trail}
              <line x1={C} y1={C} x2={C + R} y2={C} stroke={ORANGE} strokeWidth="1" strokeOpacity="0.8" />
            </g>

            <polygon ref={buildRef} fill={ORANGE} fillOpacity="0" stroke={ORANGE} strokeWidth="1.2" strokeLinejoin="miter" style={{ pointerEvents: 'none' }} />
            <polygon ref={growRef} fill="url(#sr-hatch)" stroke={MKT} strokeWidth="1.2" strokeDasharray="5 4" strokeLinejoin="miter" style={{ pointerEvents: 'none', opacity: 0 }} />

            {/* leader: vertex anchor (enlarged, filled) → elbow → panel header; positioned every frame from the animated polygon */}
            <polyline ref={leaderRef} fill="none" stroke={ORANGE} strokeWidth="1" style={{ pointerEvents: 'none', opacity: 0 }} data-leader />
            <rect ref={termRef} width={6} height={6} fill={ORANGE} style={{ pointerEvents: 'none', opacity: 0 }} />
            <rect ref={anchorRef} width={10} height={10} fill={ORANGE} stroke="#0a0a0a" strokeWidth="1.5" style={{ pointerEvents: 'none' }} data-anchor />

            <rect x={C - 42} y={C - 16} width={84} height={32} fill="#0a0a0a" stroke="#3a3a3a" />
            <text x={C} y={C - 2} textAnchor="middle" className="font-mono" fontSize="8.5" fill="#e5e5e5" letterSpacing="2">MARKETING</text>
            <text x={C} y={C + 10} textAnchor="middle" className="font-mono" fontSize="8.5" fill="#e5e5e5" letterSpacing="2">ENGINEER</text>

            {SKILLS.map((s, i) => {
              const [x, y] = pt(i, R);
              const on = focus === i;
              const below = y > C;
              return (
                <g
                  key={s.id}
                  ref={(el) => { nodesRef.current[i] = el; }}
                  style={{ opacity: 0, cursor: 'pointer' }}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setPanel(i)}
                  tabIndex={0}
                  role="button"
                  aria-label={s.label}
                  onFocus={() => setPanel(i)}
                >
                  <rect x={x - 26} y={y - 26} width={52} height={52} fill="transparent" />
                  <rect x={x - 5} y={y - 5} width={10} height={10} transform={s.side === 'grow' ? `rotate(45 ${x} ${y})` : undefined}
                    fill="#0a0a0a" stroke={on ? '#f4efe8' : '#5a5a5a'} strokeWidth="1" strokeDasharray={s.side === 'grow' ? '2 2' : undefined} />
                  <text ref={(el) => { labelsRef.current[i] = el; }} x={x} y={below ? y + 28 : y - 18} textAnchor="middle" className="font-mono" fontSize="10" letterSpacing="2" fill={on ? '#ffffff' : '#8a8a8a'}>
                    {s.short}
                  </text>
                </g>
              );
            })}

            <rect ref={glitchRef} x={0} y={-20} width={SIZE} height={14} fill={ORANGE} style={{ opacity: 0, pointerEvents: 'none' }} />
          </svg>
        </div>
      </div>

      {/* HUD detail panel */}
      <div ref={panelRef} className="min-w-0 brackets border border-[#2e2e2e] bg-black/60">
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#2e2e2e] font-mono text-[10px] tracking-[0.25em] text-gray-500 uppercase">
          <span>{fs.side === 'build' ? '■ build // engineering' : '◆ grow // marketing'}</span>
          <span>axis {String(focus + 1).padStart(2, '0')}/{N}</span>
        </div>
        <div className="p-5">
          <div className="flex items-baseline justify-between gap-4 mb-2">
            <h4 className="font-cyber text-xl md:text-2xl text-primary">{fs.label}</h4>
            <span className="font-mono text-2xl text-white tabular-nums"><span ref={countRef}>000</span></span>
          </div>
          <div className="h-1 w-full bg-[#1c1c1c] mb-4">
            <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${fs.level * 100}%` }} />
          </div>
          <p className="font-mono text-sm text-gray-200 leading-snug min-h-[2.6rem]">
            <span className="text-primary">› </span>{fs.proof}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-5">
            {SKILLS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setPanel(i)}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                className={`text-[10px] font-mono tracking-wider px-1.5 py-1.5 min-h-[40px] border truncate transition-colors ${focus === i ? 'bg-primary text-cyber-black border-primary' : 'text-gray-400 border-[#2e2e2e] hover:text-primary hover:border-primary/60'}`}
              >
                {s.side === 'build' ? '■ ' : '◆ '}{s.short}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

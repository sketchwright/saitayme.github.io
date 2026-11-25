import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView } from 'framer-motion';
import { ACCENT_MKT } from '@/theme';

type Side = 'build' | 'grow';
type Skill = {
  id: string;
  label: string;
  short: string;
  side: Side;
  level: number; // 0..1, drives the gauge ring
  proof: string[];
  stack: string[];
};

/** Left hemisphere = engineering (BUILD), right hemisphere = marketing (GROW). Order is clockwise from top. */
const SKILLS: Skill[] = [
  {
    id: 'social', label: 'Social & Content', short: 'SOCIAL', side: 'grow', level: 0.9,
    proof: ['Own the social strategy and channels for Mayhem À La Carte', 'Reveal campaign, content calendar, short-form video', 'On camera: streams, dev videos, trailer VO'],
    stack: ['TikTok', 'YouTube', 'X', 'Instagram', 'Discord'],
  },
  {
    id: 'creators', label: 'Creators & Outreach', short: 'CREATORS', side: 'grow', level: 0.88,
    proof: ['Run creator outreach for Ingame Studios', 'Built IGS Outreach: CRM + throttled personalised mail engine', 'Reply tracking, follow-ups and campaign analytics'],
    stack: ['IGS Outreach', 'Twitch API', 'YouTube API', 'Microsoft Graph'],
  },
  {
    id: 'automation', label: 'Automation & AI', short: 'AUTOMATION', side: 'grow', level: 0.86,
    proof: ['Agentic content pipeline: stream → clips → copy → scheduled posts', 'Human-in-the-loop review queues', 'Scheduled data hydration jobs'],
    stack: ['Claude', 'Speech-to-text', 'Schedulers', 'APIs'],
  },
  {
    id: 'web', label: 'Web & Streams', short: 'WEB/LIVE', side: 'grow', level: 0.84,
    proof: ['Built mayhemalacarte.com and the ModKit docs', 'Host Twitch & YouTube dev streams', 'gamescom 2026, VGDM #98 Vienna'],
    stack: ['React', 'TypeScript', 'OBS', 'Twitch'],
  },
  {
    id: 'tools', label: 'Tools & Pipelines', short: 'TOOLS', side: 'build', level: 0.9,
    proof: ['CSV → recipe data-asset pipeline for Mayhem À La Carte', 'Crime Boss ModKit: Blueprint/DataTable moddability', 'Unity editor tools: scene loader, snapping, SO reset'],
    stack: ['Unreal Editor', 'Data Assets', 'DataTables', 'Unity Editor'],
  },
  {
    id: 'multiplayer', label: 'Multiplayer', short: 'NETWORK', side: 'build', level: 0.9,
    proof: ['EOS multiplayer subsystem behind Mayhem’s co-op', 'Join-in-progress replication fixes on Crime Boss', 'Network Session Kit: my OSSv2 sessions plugin'],
    stack: ['EOS', 'OSSv2', 'Replication', 'Dedicated servers'],
  },
  {
    id: 'gameplay', label: 'Gameplay', short: 'GAMEPLAY', side: 'build', level: 0.88,
    proof: ['50+ shipped fixes in Crime Boss Update 20', 'Abilities, items, mission logic, UI', 'Production debugging in a large live codebase'],
    stack: ['Unreal 4/5', 'GAS', 'Gameplay Tags', 'Blueprints'],
  },
  {
    id: 'code', label: 'C++ / C#', short: 'CODE', side: 'build', level: 0.82,
    proof: ['C++ for Unreal: gameplay, networking, editor modules', 'C# for Unity games and tools', 'Readable, maintainable systems over clever ones'],
    stack: ['C++', 'C#', 'TypeScript', 'Blueprint'],
  },
];

const SIZE = 520;
const C = SIZE / 2;
const ORBIT = 186;
const NODE_R = 30;
const ORANGE = '#f07e41';
const YELLOW = ACCENT_MKT; // marketing side, see src/theme.ts
const colorOf = (s: Side) => (s === 'build' ? ORANGE : YELLOW);

function nodePos(i: number) {
  // Place nodes evenly, offset so the vertical axis splits BUILD (left) / GROW (right).
  const a = ((i + 0.5) / SKILLS.length) * Math.PI * 2 - Math.PI / 2;
  return { x: C + ORBIT * Math.cos(a), y: C + ORBIT * Math.sin(a) };
}

const AUTO_CYCLE_MS = 3200;

export default function SkillReactor() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const [active, setActive] = useState(0);
  const [userHold, setUserHold] = useState(false);

  // Idle auto-cycle so the section always feels alive.
  useEffect(() => {
    if (!inView || userHold) return;
    const t = setInterval(() => setActive((i) => (i + 1) % SKILLS.length), AUTO_CYCLE_MS);
    return () => clearInterval(t);
  }, [inView, userHold]);

  const skill = SKILLS[active];
  const col = colorOf(skill.side);

  return (
    <div ref={ref} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-6 lg:gap-8 items-center">
      {/* Reactor */}
      <div className="relative w-full max-w-[520px] mx-auto aspect-square px-5" onMouseLeave={() => setUserHold(false)}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full overflow-visible" role="img" aria-label="Skill map: engineering and marketing">
          <defs>
            <radialGradient id="sr-core" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ORANGE} stopOpacity="0.55" />
              <stop offset="60%" stopColor={ORANGE} stopOpacity="0.08" />
              <stop offset="100%" stopColor={ORANGE} stopOpacity="0" />
            </radialGradient>
            <linearGradient id="sr-split" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={ORANGE} />
              <stop offset="100%" stopColor={YELLOW} />
            </linearGradient>
            <filter id="sr-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Ambient core glow */}
          <circle cx={C} cy={C} r={170} fill="url(#sr-core)" className="sr-breathe" />

          {/* Rotating HUD rings */}
          <g className="sr-spin-slow" style={{ transformOrigin: `${C}px ${C}px` }}>
            <circle cx={C} cy={C} r={ORBIT + 42} fill="none" stroke={ORANGE} strokeOpacity="0.18" strokeWidth="1" strokeDasharray="2 10" />
            {Array.from({ length: 48 }).map((_, i) => {
              const a = (i / 48) * Math.PI * 2;
              const r1 = ORBIT + 50;
              const r2 = ORBIT + (i % 4 === 0 ? 60 : 55);
              return <line key={i} x1={C + r1 * Math.cos(a)} y1={C + r1 * Math.sin(a)} x2={C + r2 * Math.cos(a)} y2={C + r2 * Math.sin(a)} stroke={ORANGE} strokeOpacity={i % 4 === 0 ? 0.45 : 0.18} strokeWidth="1" />;
            })}
          </g>
          <g className="sr-spin-rev" style={{ transformOrigin: `${C}px ${C}px` }}>
            <circle cx={C} cy={C} r={ORBIT} fill="none" stroke="url(#sr-split)" strokeOpacity="0.35" strokeWidth="1.2" strokeDasharray="40 14 4 14" />
          </g>
          <circle cx={C} cy={C} r={92} fill="none" stroke={ORANGE} strokeOpacity="0.25" strokeWidth="1" strokeDasharray="1 6" className="sr-spin-fast" style={{ transformOrigin: `${C}px ${C}px` }} />

          {/* Split axis */}
          <line x1={C} y1={C - ORBIT - 30} x2={C} y2={C + ORBIT + 30} stroke={ORANGE} strokeOpacity="0.15" strokeDasharray="3 6" />
          <text x={-6} y={C} textAnchor="middle" transform={`rotate(-90 -6 ${C})`} className="font-cyber" fontSize="13" fill={ORANGE} letterSpacing="6">BUILD</text>
          <text x={SIZE + 6} y={C} textAnchor="middle" transform={`rotate(90 ${SIZE + 6} ${C})`} className="font-cyber" fontSize="13" fill={YELLOW} letterSpacing="6">GROW</text>

          {/* Energy links */}
          {SKILLS.map((s, i) => {
            const p = nodePos(i);
            const on = i === active;
            const c = colorOf(s.side);
            const mx = (C + p.x) / 2 + (p.y - C) * 0.18;
            const my = (C + p.y) / 2 - (p.x - C) * 0.18;
            const d = `M${p.x},${p.y} Q${mx},${my} ${C},${C}`;
            return (
              <g key={`l-${s.id}`}>
                <motion.path
                  d={d}
                  fill="none"
                  stroke={c}
                  strokeOpacity={on ? 0.9 : 0.22}
                  strokeWidth={on ? 2.2 : 1}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: inView ? 1 : 0 }}
                  transition={{ duration: 0.9, delay: 0.3 + i * 0.06, ease: 'easeOut' }}
                />
                <path d={d} fill="none" stroke={c} strokeWidth={on ? 3 : 1.6} strokeLinecap="round" strokeDasharray="3 22" className={on ? 'sr-flow-fast' : 'sr-flow'} opacity={inView ? (on ? 1 : 0.55) : 0} filter={on ? 'url(#sr-glow)' : undefined} />
              </g>
            );
          })}

          {/* Core */}
          <g filter="url(#sr-glow)">
            <motion.polygon
              points={Array.from({ length: 6 }).map((_, k) => {
                const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
                return `${C + 64 * Math.cos(a)},${C + 64 * Math.sin(a)}`;
              }).join(' ')}
              fill="#0a0a0a"
              stroke={col}
              strokeWidth="2.5"
              initial={{ scale: 0 }}
              animate={{ scale: inView ? 1 : 0 }}
              style={{ transformOrigin: `${C}px ${C}px` }}
              transition={{ type: 'spring', stiffness: 180, damping: 14, delay: 0.1 }}
            />
          </g>
          <text x={C} y={C - 8} textAnchor="middle" className="font-cyber" fontSize="11" fill="#fff" letterSpacing="2">MARKETING</text>
          <text x={C} y={C + 9} textAnchor="middle" className="font-cyber" fontSize="11" fill="#fff" letterSpacing="2">ENGINEER</text>
          <text x={C} y={C + 28} textAnchor="middle" className="font-mono" fontSize="9" fill={col}>{'< build × grow >'}</text>

          {/* Nodes */}
          {SKILLS.map((s, i) => {
            const p = nodePos(i);
            const on = i === active;
            const c = colorOf(s.side);
            const circ = 2 * Math.PI * (NODE_R + 6);
            const labelBelow = p.y > C;
            return (
              <motion.g
                key={s.id}
                initial={{ x: C - p.x, y: C - p.y, opacity: 0 }}
                animate={inView ? { x: 0, y: 0, opacity: 1 } : {}}
                transition={{ type: 'spring', stiffness: 120, damping: 16, delay: 0.25 + i * 0.07 }}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => { setActive(i); setUserHold(true); }}
                onClick={() => { setActive(i); setUserHold(true); }}
                tabIndex={0}
                role="button"
                aria-label={s.label}
                onFocus={() => { setActive(i); setUserHold(true); }}
              >
                {on && <circle cx={p.x} cy={p.y} r={NODE_R + 16} fill={c} opacity="0.12" className="sr-ping" style={{ transformOrigin: `${p.x}px ${p.y}px` }} />}
                {/* gauge track + level arc */}
                <circle cx={p.x} cy={p.y} r={NODE_R + 6} fill="none" stroke={c} strokeOpacity="0.15" strokeWidth="3" />
                <motion.circle
                  cx={p.x}
                  cy={p.y}
                  r={NODE_R + 6}
                  fill="none"
                  stroke={c}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  initial={{ strokeDashoffset: circ }}
                  animate={{ strokeDashoffset: inView ? circ * (1 - s.level) : circ }}
                  transition={{ duration: 1.2, delay: 0.6 + i * 0.07, ease: 'easeOut' }}
                  transform={`rotate(-90 ${p.x} ${p.y})`}
                  filter={on ? 'url(#sr-glow)' : undefined}
                />
                <circle cx={p.x} cy={p.y} r={NODE_R} fill={on ? c : '#0d0d0d'} stroke={c} strokeOpacity={on ? 1 : 0.6} strokeWidth="1.5" style={{ transition: 'fill 0.25s' }} />
                <text x={p.x} y={p.y + 4} textAnchor="middle" className="font-mono" fontSize="11" fontWeight={700} fill={on ? '#0a0a0a' : c}>
                  {String(i + 1).padStart(2, '0')}
                </text>
                <text x={p.x} y={labelBelow ? p.y + NODE_R + 26 : p.y - NODE_R - 16} textAnchor="middle" className="font-cyber" fontSize="10.5" letterSpacing="1.5" fill={on ? '#fff' : c} fillOpacity={on ? 1 : 0.85}>
                  {s.short}
                </text>
              </motion.g>
            );
          })}
        </svg>
      </div>

      {/* Readout panel */}
      <div className="min-w-0">
        <div className="relative rounded-xl border bg-black/60 overflow-hidden" style={{ borderColor: `${col}66`, boxShadow: `0 0 32px ${col}1f` }}>
          <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: `${col}33` }}>
            <span className="text-[10px] font-mono uppercase tracking-[0.25em]" style={{ color: col }}>
              {skill.side === 'build' ? '◀ build // engineering' : 'grow // marketing ▶'}
            </span>
            <span className="text-[10px] font-mono text-gray-500">node {String(active + 1).padStart(2, '0')}/{SKILLS.length}</span>
          </div>
          <div className="p-5 min-h-[260px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={skill.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <h4 className="font-cyber text-xl md:text-2xl mb-1" style={{ color: col }}>{skill.label}</h4>
                <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden mb-4">
                  <motion.div className="h-full rounded-full" style={{ background: col, boxShadow: `0 0 12px ${col}` }} initial={{ width: 0 }} animate={{ width: `${skill.level * 100}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
                </div>
                <ul className="space-y-2 mb-4">
                  {skill.proof.map((line, k) => (
                    <motion.li key={line} className="flex gap-2 text-sm text-gray-200 font-mono leading-snug" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 + k * 0.08 }}>
                      <span style={{ color: col }}>›</span>
                      <span>{line}</span>
                    </motion.li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-1.5">
                  {skill.stack.map((t) => (
                    <span key={t} className="text-[11px] font-mono px-2 py-0.5 rounded border" style={{ color: col, borderColor: `${col}55`, background: `${col}12` }}>{t}</span>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          {/* auto-cycle progress */}
          {!userHold && <motion.div key={`p-${active}`} className="absolute bottom-0 left-0 h-0.5" style={{ background: col }} initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: AUTO_CYCLE_MS / 1000, ease: 'linear' }} />}
        </div>

        {/* Quick select chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          {SKILLS.map((s, i) => {
            const c = colorOf(s.side);
            const on = i === active;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => { setActive(i); setUserHold(true); }}
                className="text-[10px] font-cyber uppercase tracking-wider px-2 py-1.5 rounded border transition-all truncate"
                style={{ color: on ? '#0a0a0a' : c, background: on ? c : 'transparent', borderColor: `${c}${on ? 'ff' : '44'}` }}
              >
                {s.short}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

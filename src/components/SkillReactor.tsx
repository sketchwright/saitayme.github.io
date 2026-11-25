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
const ORANGE = '#f07e41';
const YELLOW = ACCENT_MKT; // marketing side, see src/theme.ts
const GRID = '#262626';
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
            <pattern id="sr-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke={YELLOW} strokeWidth="1" strokeOpacity="0.55" />
            </pattern>
          </defs>

          {/* Grid: concentric dashed rings + spokes, no glow */}
          {[1, 0.75, 0.5, 0.25].map((k) => (
            <circle key={k} cx={C} cy={C} r={ORBIT * k} fill="none" stroke={GRID} strokeWidth="1" strokeDasharray="3 5" />
          ))}
          {SKILLS.map((_, i) => {
            const p = nodePos(i);
            return <line key={`sp-${i}`} x1={C} y1={C} x2={p.x} y2={p.y} stroke={GRID} strokeWidth="1" strokeDasharray="3 5" />;
          })}
          {/* slow outer tick ring */}
          <g className="sr-spin-slow" style={{ transformOrigin: `${C}px ${C}px` }}>
            {Array.from({ length: 72 }).map((_, i) => {
              const a = (i / 72) * Math.PI * 2;
              const r1 = ORBIT + 46;
              const r2 = ORBIT + (i % 6 === 0 ? 56 : 50);
              return <line key={i} x1={C + r1 * Math.cos(a)} y1={C + r1 * Math.sin(a)} x2={C + r2 * Math.cos(a)} y2={C + r2 * Math.sin(a)} stroke={i % 6 === 0 ? '#3a3a3a' : GRID} strokeWidth="1" />;
            })}
          </g>

          {/* Split axis + side labels */}
          <line x1={C} y1={C - ORBIT - 36} x2={C} y2={C + ORBIT + 36} stroke={GRID} strokeWidth="1" strokeDasharray="3 5" />
          <text x={C - 12} y={22} textAnchor="end" className="font-mono" fontSize="10" fill="#8a8a8a" letterSpacing="3">BUILD · ENGINEERING</text>
          <text x={C + 12} y={22} textAnchor="start" className="font-mono" fontSize="10" fill="#8a8a8a" letterSpacing="3">GROW · MARKETING</text>

          {/* Shapes: BUILD = solid 16% fill, GROW = dashed outline + 45° hatch */}
          {(['build', 'grow'] as Side[]).map((side) => {
            const pts = SKILLS.map((sk, i) => ({ sk, i }))
              .filter(({ sk }) => sk.side === side)
              .map(({ sk, i }) => {
                const pos = nodePos(i);
                const k = sk.level;
                return `${C + (pos.x - C) * k},${C + (pos.y - C) * k}`;
              });
            const points = [`${C},${C}`, ...pts].join(' ');
            const isBuild = side === 'build';
            return (
              <motion.polygon
                key={side}
                points={points}
                fill={isBuild ? ORANGE : 'url(#sr-hatch)'}
                fillOpacity={isBuild ? 0.16 : 1}
                stroke={isBuild ? ORANGE : YELLOW}
                strokeWidth="1.2"
                strokeDasharray={isBuild ? undefined : '5 4'}
                strokeLinejoin="miter"
                initial={{ scale: 0, opacity: 0 }}
                animate={inView ? { scale: 1, opacity: 1 } : {}}
                style={{ transformOrigin: `${C}px ${C}px` }}
                transition={{ duration: 0.9, delay: isBuild ? 0.2 : 0.35, ease: [0.22, 1, 0.36, 1] }}
              />
            );
          })}

          {/* Active spoke */}
          {(() => {
            const pa = nodePos(active);
            return <line x1={C} y1={C} x2={pa.x} y2={pa.y} stroke={col} strokeWidth="1.2" strokeDasharray={skill.side === 'grow' ? '5 4' : undefined} />;
          })()}

          {/* Core */}
          <rect x={C - 46} y={C - 20} width={92} height={40} fill="#0a0a0a" stroke="#3a3a3a" strokeWidth="1" />
          <text x={C} y={C - 3} textAnchor="middle" className="font-mono" fontSize="9" fill="#e5e5e5" letterSpacing="2">MARKETING</text>
          <text x={C} y={C + 10} textAnchor="middle" className="font-mono" fontSize="9" fill="#e5e5e5" letterSpacing="2">ENGINEER</text>

          {/* Nodes: BUILD = squares, GROW = diamonds */}
          {SKILLS.map((s, i) => {
            const p = nodePos(i);
            const on = i === active;
            const c = colorOf(s.side);
            const labelBelow = p.y > C;
            const half = 11;
            return (
              <motion.g
                key={s.id}
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : {}}
                transition={{ duration: 0.4, delay: 0.5 + i * 0.06 }}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => { setActive(i); setUserHold(true); }}
                onClick={() => { setActive(i); setUserHold(true); }}
                tabIndex={0}
                role="button"
                aria-label={s.label}
                onFocus={() => { setActive(i); setUserHold(true); }}
              >
                <rect x={p.x - 22} y={p.y - 22} width={44} height={44} fill="transparent" />
                <rect
                  x={p.x - half}
                  y={p.y - half}
                  width={half * 2}
                  height={half * 2}
                  transform={s.side === 'grow' ? `rotate(45 ${p.x} ${p.y})` : undefined}
                  fill={on ? c : '#0a0a0a'}
                  stroke={c}
                  strokeWidth="1.2"
                  strokeDasharray={s.side === 'grow' && !on ? '3 2' : undefined}
                  style={{ transition: 'fill 0.2s' }}
                />
                <text x={p.x} y={p.y + 3.5} textAnchor="middle" className="font-mono" fontSize="9" fontWeight={700} fill={on ? '#0a0a0a' : c}>
                  {String(i + 1).padStart(2, '0')}
                </text>
                <text x={p.x} y={labelBelow ? p.y + 32 : p.y - 22} textAnchor="middle" className="font-mono" fontSize="10" letterSpacing="2" fill={on ? '#ffffff' : '#8a8a8a'}>
                  {s.short}
                </text>
              </motion.g>
            );
          })}
        </svg>
      </div>

      {/* Readout panel */}
      <div className="min-w-0">
        <div className="relative rounded-xl border bg-black/60 overflow-hidden" style={{ borderColor: '#2e2e2e' }}>
          <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: `${col}33` }}>
            <span className="text-[10px] font-mono uppercase tracking-[0.25em]" style={{ color: col }}>
              {skill.side === 'build' ? '■ build // engineering' : '◆ grow // marketing'}
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
                  <motion.div className="h-full rounded-full" style={{ background: col }} initial={{ width: 0 }} animate={{ width: `${skill.level * 100}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
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

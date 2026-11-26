// Cyber Defender: vertical arcade roguelite. The antivirus mind pushes through
// three sectors of a rogue AI. React owns only the modal chrome and the
// menu / map / upgrade / anomaly / pause / summary overlays; simulation and
// rendering run in a single requestAnimationFrame loop driven by refs.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPause, FiPlay, FiVolume2, FiVolumeX, FiX } from 'react-icons/fi';
import { Game } from './cybergame/engine';
import { Renderer } from './cybergame/render';
import { Sfx } from './cybergame/audio';
import { loadAutoFire, loadBest, loadHard, loadMuted, saveAutoFire, saveHard, saveMuted } from './cybergame/storage';
import type { NodeType, Phase, RunSummary } from './cybergame/types';
import { RARITY_LABEL, SYNERGIES, UPGRADE_BY_ID, computeSynergies } from './cybergame/content/upgrades';
import type { OwnedUpgrade } from './cybergame/types';
import type { UpgradeDef } from './cybergame/content/upgrades';
import { ROUTE_INFO } from './cybergame/content/routes';
import { ENCOUNTERS } from './cybergame/content/encounters';
import { SECTORS } from './cybergame/content/sectors';
import { parseSeed } from './cybergame/rng';

interface CyberGameProps {
  isVisible: boolean;
  onClose: () => void;
}

const ORANGE = '#f07e41';
const CORE = '#ff5a2a';
const WHITE = '#f4efe8';
const MAX_BACKING_PIXELS = 4_200_000;

const fontH = { fontFamily: "'Orbitron', sans-serif" };
const fontUi = { fontFamily: "'JetBrains Mono', monospace" };

const btnPrimary =
  'px-6 py-3 text-xs sm:text-sm tracking-[0.3em] border transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-white';
const btnGhost =
  'px-5 py-3 text-xs sm:text-sm tracking-[0.3em] border border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-400 transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-white';
const hdrBtn = 'h-8 px-2 flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-[10px] tracking-[0.2em]';

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const UpgradeIcon = ({ id, size = 28, color }: { id: string; size?: number; color?: string }) => {
  const def = UPGRADE_BY_ID[id];
  if (!def) return null;
  const c = color ?? (def.rarity === 'corrupted' ? CORE : def.rarity === 'rare' ? ORANGE : '#a8a8b0');
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={def.icon} fill="none" stroke={c} strokeWidth={1.5} strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
};

const NodeGlyph = ({ type, color }: { type: NodeType; color: string }) => {
  const p: Record<NodeType, ReactNode> = {
    fight: <path d="M12 3v5M12 16v5M3 12h5M16 12h5M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />,
    elite: <path d="M4 8l8-5 8 5M4 14l8-5 8 5M4 20l8-5 8 5" />,
    repair: <path d="M12 4v16M4 12h16M8 8h8v8H8z" />,
    cache: <path d="M5 7h14v12H5zM5 7l3-3h8l3 3M9 12h6" />,
    anomaly: <path d="M9 9a3 3 0 1 1 4 2.8c-.8.4-1 1-1 1.7V15M12 18v1M4 4l2 2M20 4l-2 2" />,
    boss: <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />,
  };
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <g fill="none" stroke={color} strokeWidth={1.6}>
        {p[type]}
      </g>
    </svg>
  );
};

/** Card frame by rarity: solid / hatched / glitched. Orange intensity only. */
const rarityFrame = (r: UpgradeDef['rarity']): CSSProperties => {
  if (r === 'common') return { border: '1px solid rgba(240,126,65,0.35)', background: 'rgba(10,9,9,0.92)' };
  if (r === 'rare')
    return {
      border: '1.5px solid rgba(240,126,65,0.85)',
      background: 'repeating-linear-gradient(135deg, rgba(240,126,65,0.09) 0 2px, rgba(10,9,9,0.94) 2px 9px)',
    };
  return {
    border: '1.5px solid rgba(255,90,42,0.95)',
    background:
      'repeating-linear-gradient(0deg, rgba(255,90,42,0.07) 0 1px, transparent 1px 4px), linear-gradient(180deg, rgba(40,10,6,0.95), rgba(10,8,8,0.95))',
    boxShadow: '3px 0 0 rgba(240,126,65,0.55), -2px 2px 0 rgba(255,90,42,0.35)',
    clipPath: 'polygon(0 0, 62% 0, 64% 3%, 100% 3%, 100% 70%, 98% 72%, 98% 100%, 30% 100%, 28% 97%, 0 97%)',
  };
};

/** SECTOR n/3 · WAVE k/5 -> BOSS, as labelled pips. */
const SectorProgress = ({ sector, wave, boss }: { sector: number; wave: number; boss: boolean }) => {
  const sec = SECTORS[sector];
  const n = sec.waves.length;
  const cur = boss ? n : Math.min(n, wave);
  return (
    <div style={fontUi}>
      <div className="text-[10px] tracking-[0.25em] text-neutral-400">
        SECTOR {sector + 1}/{SECTORS.length} · {sec.name} · {boss || wave >= n ? 'BOSS NEXT' : `WAVE ${wave + 1}/${n}`} {'->'} BOSS
      </div>
      <div className="mt-2 flex items-center gap-1">
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className="h-1.5 flex-1" style={{ background: i < cur ? ORANGE : i === cur ? WHITE : 'rgba(240,126,65,0.18)' }} title={`Wave ${i + 1}`} />
        ))}
        <span className="ml-1 text-[9px] tracking-[0.2em] px-1.5 py-0.5" style={{ border: `1px solid ${cur >= n ? CORE : 'rgba(255,90,42,0.4)'}`, color: cur >= n ? CORE : '#8a8a92' }}>
          BOSS
        </span>
      </div>
    </div>
  );
};

/** Owned upgrades by name + effect, plus active synergies explained. */
const BuildList = ({ build, syn, compact, hacked }: { build: OwnedUpgrade[]; syn: ReadonlySet<string>; compact?: boolean; hacked?: string | null }) => {
  const active = SYNERGIES.filter((x) => syn.has(x.id));
  return (
    <div className="text-left" style={fontUi}>
      <div className="text-[10px] tracking-[0.3em]" style={{ color: ORANGE }}>
        // YOUR BUILD
      </div>
      {build.length === 0 ? (
        <div className="mt-2 text-[11px] text-neutral-500">No modules yet. You pick one after every wave.</div>
      ) : (
        <ul className="mt-2 space-y-2">
          {build.map((b) => {
            const def = UPGRADE_BY_ID[b.id];
            if (!def) return null;
            return (
              <li key={b.id} className="flex gap-2 items-start">
                <span className="shrink-0 mt-0.5">
                  <UpgradeIcon id={b.id} size={18} />
                </span>
                <span className="min-w-0">
                  <span className="text-[11px] tracking-[0.08em]" style={{ color: hacked === b.id ? '#6a6a72' : WHITE, textDecoration: hacked === b.id ? 'line-through' : undefined }}>
                    {def.name}
                    {b.stacks > 1 ? ` x${b.stacks}` : ''}
                  </span>
                  {hacked === b.id && (
                    <span className="ml-2 text-[9px] tracking-[0.2em]" style={{ color: CORE }}>
                      HACKED // DISABLED
                    </span>
                  )}
                  <span className="ml-2 text-[9px] tracking-[0.2em]" style={{ color: def.rarity === 'corrupted' ? CORE : def.rarity === 'rare' ? ORANGE : '#8a8a92' }}>
                    {RARITY_LABEL[def.rarity]}
                  </span>
                  {!compact && (
                    <span className="block text-[10px] text-neutral-400 leading-snug">
                      {def.desc}
                      {def.drawback && <span style={{ color: CORE }}> Drawback: {def.drawback}</span>}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {active.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] tracking-[0.3em]" style={{ color: ORANGE }}>
            // ACTIVE SYNERGIES
          </div>
          <ul className="mt-1 space-y-1">
            {active.map((x) => (
              <li key={x.id} className="text-[10px] text-neutral-300 leading-snug">
                <span style={{ color: WHITE }}>{x.name}</span> - {x.desc}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className="border border-neutral-800 px-3 py-2 text-left">
    <div className="text-[10px] tracking-[0.25em] text-neutral-500" style={fontUi}>
      {label}
    </div>
    <div className="text-base sm:text-lg mt-1 truncate" style={{ ...fontH, color: accent ? ORANGE : WHITE }}>
      {value}
    </div>
  </div>
);

const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

const CyberGame = ({ isVisible, onClose }: CyberGameProps) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const sfxRef = useRef<Sfx | null>(null);
  const onCloseRef = useRef(onClose);
  const [phase, setPhase] = useState<Phase>('menu');
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [muted, setMuted] = useState<boolean>(loadMuted);
  const mutedRef = useRef(muted);
  const [autoFire, setAutoFire] = useState<boolean>(loadAutoFire);
  const [best, setBest] = useState<number>(0);
  const [seedText, setSeedText] = useState('');
  const [hard, setHard] = useState<boolean>(loadHard);
  const hardRef = useRef(hard);
  const seedRef = useRef('');

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    sfxRef.current?.setMuted(next);
    saveMuted(next);
    setMuted(next);
  }, []);

  const toggleAuto = useCallback(() => {
    const g = gameRef.current;
    const next = !(g ? g.autoFire : true);
    if (g) g.autoFire = next;
    saveAutoFire(next);
    setAutoFire(next);
  }, []);

  const startRun = useCallback((seed?: number) => {
    sfxRef.current?.unlock();
    const g = gameRef.current;
    if (!g) return;
    let s = seed;
    if (s === undefined && seedRef.current.trim()) s = parseSeed(seedRef.current) ?? undefined;
    g.hard = hardRef.current;
    g.start(s);
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const sfx = new Sfx(mutedRef.current);
    const game: Game = new Game(
      {
        sound: (n) => sfx.play(n),
        phase: (p) => {
          setPhase(p);
          if (p === 'summary') {
            setSummary(game.summary());
            setBest(game.best);
          }
        },
        changed: () => bump(),
      },
      loadBest(),
    );
    game.autoFire = loadAutoFire();
    game.debug = import.meta.env.DEV;
    try {
      game.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      game.reducedMotion = false;
    }
    const renderer = new Renderer(ctx);
    gameRef.current = game;
    sfxRef.current = sfx;
    setPhase('menu');
    setSummary(null);
    setBest(game.best);
    if (import.meta.env.DEV) Object.assign(window, { __cyberGame: game, __cyberRenderer: renderer, __cyberSectors: SECTORS });

    // ---- sizing (CSS px, backing store scaled by DPR and capped)
    let curW = 0;
    let curH = 0;
    let curDpr = 0;
    const resize = () => {
      const w = Math.max(1, wrap.clientWidth);
      const h = Math.max(1, wrap.clientHeight);
      let dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (w * h * dpr * dpr > MAX_BACKING_PIXELS) dpr = Math.sqrt(MAX_BACKING_PIXELS / (w * h));
      if (w === curW && h === curH && Math.abs(dpr - curDpr) < 0.01) return;
      curW = w;
      curH = h;
      curDpr = dpr;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      game.resize(w, h);
      renderer.resize(w, h, dpr);
    };
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(wrap);
    window.addEventListener('resize', resize);

    // ---- single RAF loop
    let raf = 0;
    let last = performance.now();
    let alive = true;
    const frame = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      game.update(dt);
      renderer.draw(game);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onVisibility = () => {
      if (document.hidden) {
        game.pause();
        sfx.suspend();
        cancelAnimationFrame(raf);
        raf = 0;
      } else {
        sfx.resume();
        last = performance.now();
        if (!raf && alive) raf = requestAnimationFrame(frame);
      }
    };
    const onBlur = () => {
      game.pause();
      game.clearInput();
    };

    // ---- pointer input
    const toLocal = (e: PointerEvent): [number, number] => {
      const r = canvas.getBoundingClientRect();
      const sx = r.width > 0 ? curW / r.width : 1;
      const sy = r.height > 0 ? curH / r.height : 1;
      return [(e.clientX - r.left) * sx, (e.clientY - r.top) * sy];
    };
    const onDown = (e: PointerEvent) => {
      sfx.unlock();
      if (e.pointerType !== 'mouse') e.preventDefault();
      const [x, y] = toLocal(e);
      if (game.pointerDown(x, y, e.button, e.pointerId, e.pointerType === 'mouse')) {
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    };
    const onMove = (e: PointerEvent) => {
      const [x, y] = toLocal(e);
      game.pointerMove(x, y, e.pointerId, e.pointerType === 'mouse');
    };
    const onUp = (e: PointerEvent) => game.pointerUp(e.pointerId, e.pointerType === 'mouse');
    const onLeave = (e: PointerEvent) => game.pointerLeave(e.pointerType === 'mouse');
    const onContext = (e: Event) => e.preventDefault();

    // ---- keyboard
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) {
        if (e.code === 'Enter' && game.phase === 'menu') {
          sfx.unlock();
          startRun();
        }
        return;
      }
      const p = game.phase;
      const digit = e.code.startsWith('Digit') ? parseInt(e.code.slice(5), 10) : e.code.startsWith('Numpad') ? parseInt(e.code.slice(6), 10) : NaN;
      if (e.code === 'KeyM' && !e.repeat) {
        toggleMute();
        return;
      }
      switch (p) {
        case 'playing':
          if (e.code === 'KeyP' || e.code === 'Escape') {
            e.preventDefault();
            if (!e.repeat) game.pause();
            return;
          }
          if (e.code === 'KeyF' && !e.repeat) {
            toggleAuto();
            return;
          }
          if (game.keyDown(e.code, e.repeat)) e.preventDefault();
          return;
        case 'paused':
          if ((e.code === 'KeyP' || e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') && !e.repeat) {
            e.preventDefault();
            game.resume();
          }
          return;
        case 'menu':
          if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
            e.preventDefault();
            sfx.unlock();
            startRun();
          } else if (e.code === 'Escape') onCloseRef.current();
          return;
        case 'map':
          if (digit >= 1 && digit <= 3) game.chooseRoute(digit - 1);
          return;
        case 'pick':
          if (digit >= 1 && digit <= 3) game.chooseUpgrade(digit - 1);
          else if (e.code === 'KeyS' || digit === 0) game.chooseUpgrade(-1);
          return;
        case 'anomaly':
          if (digit === 1 || e.code === 'KeyY') game.resolveAnomaly(true);
          else if (digit === 2 || e.code === 'KeyN') game.resolveAnomaly(false);
          return;
        case 'summary':
          if ((e.code === 'Enter' || e.code === 'KeyR') && !e.repeat) {
            e.preventDefault();
            startRun();
          } else if (e.code === 'Escape') onCloseRef.current();
          return;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => game.keyUp(e.code);

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('contextmenu', onContext);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('contextmenu', onContext);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      document.body.style.overflow = prevOverflow;
      sfx.dispose();
      gameRef.current = null;
      sfxRef.current = null;
      if (import.meta.env.DEV) Object.assign(window, { __cyberGame: undefined, __cyberRenderer: undefined });
    };
  }, [isVisible, toggleMute, toggleAuto, startRun]);

  const g = gameRef.current;
  const run = g?.run ?? null;
  const inRun = phase === 'playing' || phase === 'paused';
  const showHeaderRun = phase !== 'menu' && phase !== 'summary';

  // ------------------------------------------------------------ overlays
  const renderRoutes = () => {
    if (!g || !run) return null;
    const sec = SECTORS[run.sector];
    const hpPct = Math.round((g.hp / g.stats.maxHp) * 100);
    const bossStep = run.waveInSector >= sec.waves.length;
    return (
      <motion.div key="routes" {...fade} transition={{ duration: 0.25 }} className="absolute inset-0 overflow-y-auto flex" style={{ background: 'rgba(5,5,6,0.86)' }}>
        <div className="m-auto w-full max-w-5xl px-3 sm:px-6 py-5 flex flex-col lg:flex-row gap-5 lg:gap-8">
          <div className="flex-1 min-w-0">
            <SectorProgress sector={run.sector} wave={run.waveInSector} boss={false} />
            <h3 className="mt-4 text-xl sm:text-3xl tracking-[0.14em]" style={{ ...fontH, color: WHITE }}>
              CHOOSE YOUR ROUTE
            </h3>
            <p className="mt-1 text-xs text-neutral-400" style={fontUi}>
              {bossStep
                ? 'All waves of this sector are purged. The sector core is next.'
                : `Pick what happens before the next wave. ${sec.name}: ${sec.intro}`}
            </p>
            {run.toast && (
              <div className="mt-3 text-[11px] leading-relaxed border-l-2 pl-2" style={{ ...fontUi, borderColor: ORANGE, color: WHITE }}>
                {run.toast}
              </div>
            )}
            <div className={`mt-5 grid grid-cols-1 gap-3 sm:gap-4 ${run.routes.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
              {run.routes.map((t, i) => {
                const info = ROUTE_INFO[t];
                const danger = t === 'elite' || t === 'boss' || t === 'anomaly';
                const name = bossStep && t === 'repair' ? 'REPAIR, THEN CORE' : info.name;
                const repPct = Math.round(g.repairFrac() * 100);
                const line = t === 'repair' ? `Restore ${repPct}% integrity and refill shields, then ${bossStep ? 'engage the sector core' : 'a standard wave'}.` : info.line;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => g.chooseRoute(i)}
                    className="text-left p-4 sm:p-5 transition-transform duration-150 hover:-translate-y-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-white"
                    style={{ ...fontUi, border: `1.5px solid ${danger ? 'rgba(255,90,42,0.8)' : 'rgba(240,126,65,0.6)'}`, background: 'rgba(10,9,9,0.94)' }}
                  >
                    <div className="flex items-start justify-between">
                      <span className="p-2" style={{ border: '1px solid rgba(240,126,65,0.35)' }}>
                        <NodeGlyph type={t} color={danger ? CORE : ORANGE} />
                      </span>
                      <span className="text-[10px] tracking-[0.25em] text-neutral-500">KEY {i + 1}</span>
                    </div>
                    <div className="mt-3 text-sm sm:text-base tracking-[0.12em]" style={{ ...fontH, color: WHITE }}>
                      {name}
                    </div>
                    <p className="mt-2 text-xs text-neutral-300 leading-relaxed">{line}</p>
                    {t !== 'boss' && run.routeEnc[i] && (
                      <div className="mt-3 px-2 py-1.5 text-[10px] leading-snug" style={{ border: '1px dashed rgba(240,126,65,0.5)' }}>
                        <span className="tracking-[0.2em]" style={{ color: run.routeEnc[i] === 'standard' ? '#9a9aa2' : ORANGE }}>
                          WAVE TYPE // {ENCOUNTERS[run.routeEnc[i]].name}
                        </span>
                        <span className="block text-neutral-400 mt-0.5">{ENCOUNTERS[run.routeEnc[i]].rule}</span>
                      </div>
                    )}
                    <div className="mt-3 text-[10px] leading-relaxed">
                      <div>
                        <span style={{ color: ORANGE }}>REWARD </span>
                        <span className="text-neutral-300">{t === 'repair' ? `+${repPct}% integrity, shields refilled` : info.reward}</span>
                      </div>
                      <div>
                        <span style={{ color: CORE }}>RISK </span>
                        <span className="text-neutral-300">{info.risk}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="lg:w-72 shrink-0 border border-neutral-800 p-4" style={{ background: 'rgba(7,7,8,0.8)' }}>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <Stat label="INTEGRITY" value={`${hpPct}%`} accent={hpPct > 30} />
              <Stat label="SCORE" value={g.score.toLocaleString('en-US')} />
            </div>
            <BuildList build={run.build} syn={g.syn} />
          </div>
        </div>
      </motion.div>
    );
  };

  const renderPick = () => {
    if (!g || !run) return null;
    const src = run.offerSource;
    const title = src === 'boss' ? 'CORE FRAGMENT RECOVERED' : src === 'cache' ? 'DATA CACHE DECRYPTED' : src === 'elite' ? 'HARDENED PAYLOAD' : src === 'anomaly' ? 'ANOMALOUS MODULE' : 'WAVE PURGED';
    return (
      <motion.div key="pick" {...fade} transition={{ duration: 0.2 }} className="absolute inset-0 overflow-y-auto flex" style={{ background: 'rgba(5,5,6,0.84)' }}>
        <div className="m-auto w-full max-w-4xl px-3 sm:px-6 py-5 text-center">
          <div className="text-[10px] sm:text-xs tracking-[0.35em]" style={{ ...fontUi, color: ORANGE }}>
            // {title}
          </div>
          <h3 className="mt-2 text-xl sm:text-3xl tracking-[0.14em]" style={{ ...fontH, color: WHITE }}>
            INSTALL MODULE
          </h3>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {run.offers.map((def, i) => {
              const owned = g.owned.get(def.id) ?? 0;
              const next = new Map(g.owned);
              next.set(def.id, owned + 1);
              const after = computeSynergies(next);
              const newSyn = SYNERGIES.filter((s) => after.has(s.id) && !g.syn.has(s.id));
              return (
                <button
                  key={def.id}
                  type="button"
                  onClick={() => g.chooseUpgrade(i)}
                  className="relative text-left p-4 sm:p-5 transition-transform duration-150 hover:-translate-y-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-white"
                  style={{ ...rarityFrame(def.rarity), ...fontUi }}
                >
                  <div className="flex items-start justify-between">
                    <span className="p-1.5" style={{ border: '1px solid rgba(240,126,65,0.3)', background: '#0a0909' }}>
                      <UpgradeIcon id={def.id} size={34} />
                    </span>
                    <span className="text-[9px] tracking-[0.25em]" style={{ color: def.rarity === 'common' ? '#9a9aa2' : def.rarity === 'rare' ? ORANGE : CORE }}>
                      {i + 1} // {RARITY_LABEL[def.rarity]}
                    </span>
                  </div>
                  <div className="mt-3 text-sm sm:text-[15px] tracking-[0.12em]" style={{ ...fontH, color: WHITE }}>
                    {def.name}
                  </div>
                  <div className="mt-1 text-[10px] tracking-[0.2em] text-neutral-500">
                    {owned > 0 ? `LV ${owned} > ${owned + 1}` : 'NEW'}
                    {def.maxStacks > 1 ? ` // MAX ${def.maxStacks}` : ''}
                  </div>
                  <p className="mt-3 text-xs text-neutral-300 leading-relaxed">{def.desc}</p>
                  {def.drawback && (
                    <p className="mt-2 text-xs leading-relaxed" style={{ color: CORE }}>
                      DRAWBACK: {def.drawback}
                    </p>
                  )}
                  {newSyn.map((s) => (
                    <div key={s.id} className="mt-3 text-[10px] tracking-[0.15em] px-2 py-1" style={{ border: `1px dashed ${ORANGE}`, color: WHITE }}>
                      SYNERGY // {s.name}
                      <div className="text-neutral-400 tracking-normal mt-0.5">{s.desc}</div>
                    </div>
                  ))}
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex flex-col items-center gap-2">
            <button type="button" onClick={() => g.chooseUpgrade(-1)} className={btnGhost} style={fontH}>
              SKIP // +400
            </button>
            <div className="text-[10px] tracking-[0.25em] text-neutral-500" style={fontUi}>
              KEYS 1-3 TO INSTALL // S TO SKIP
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderAnomaly = () => {
    const a = run?.anomaly;
    if (!g || !a) return null;
    return (
      <motion.div key="anomaly" {...fade} transition={{ duration: 0.2 }} className="absolute inset-0 overflow-y-auto flex" style={{ background: 'rgba(8,5,5,0.86)' }}>
        <div className="m-auto w-full max-w-lg px-4 py-6 text-center">
          <div className="text-[10px] tracking-[0.35em]" style={{ ...fontUi, color: CORE }}>
            // ANOMALY DETECTED
          </div>
          <h3 className="mt-3 text-2xl sm:text-3xl tracking-[0.12em]" style={{ ...fontH, color: WHITE }}>
            {a.title}
          </h3>
          <p className="mt-4 text-sm text-neutral-300 leading-relaxed" style={fontUi}>
            {a.text}
          </p>
          <div className="mt-6 flex flex-col gap-3 items-stretch">
            <button type="button" onClick={() => g.resolveAnomaly(true)} className={`${btnPrimary} text-black hover:text-white`} style={{ ...fontUi, background: ORANGE, borderColor: ORANGE }} onMouseEnter={(e) => (e.currentTarget.style.background = 'transparent')} onMouseLeave={(e) => (e.currentTarget.style.background = ORANGE)}>
              1 // {a.accept}
            </button>
            <button type="button" onClick={() => g.resolveAnomaly(false)} className={btnGhost} style={fontUi}>
              2 // {a.decline}
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderSummary = () => {
    const s = summary;
    if (!s) return null;
    return (
      <motion.div
        key="summary"
        {...fade}
        transition={{ duration: 0.3 }}
        className="absolute inset-0 overflow-y-auto flex"
        style={{ background: s.victory ? 'radial-gradient(ellipse at center, rgba(30,14,6,0.75) 0%, rgba(5,5,6,0.95) 70%)' : 'radial-gradient(ellipse at center, rgba(24,6,4,0.75) 0%, rgba(5,5,6,0.95) 70%)' }}
      >
        <div className="m-auto w-full max-w-xl px-4 py-6 text-center">
          <div className="text-[10px] sm:text-xs tracking-[0.35em]" style={{ ...fontUi, color: s.victory ? ORANGE : CORE }}>
            {s.victory ? '// ROGUE KERNEL TERMINATED' : `// LOST IN SECTOR ${s.sector} // ${s.sectorName}`}
          </div>
          <h2 className="mt-3 text-2xl sm:text-4xl tracking-[0.12em]" style={{ ...fontH, color: s.victory ? WHITE : CORE }}>
            {s.victory ? 'CORE SECURED' : 'SYSTEM COMPROMISED'}
          </h2>
          <div className="mt-5" style={fontUi}>
            <div className="text-[10px] tracking-[0.3em] text-neutral-500">FINAL SCORE</div>
            <div className="mt-1 text-4xl sm:text-5xl" style={{ ...fontH, color: WHITE }}>
              {s.score.toLocaleString('en-US')}
            </div>
            {s.newBest && (
              <div className="mt-2 inline-block px-2 py-0.5 text-[10px] tracking-[0.3em] text-black" style={{ background: ORANGE }}>
                NEW RECORD
              </div>
            )}
          </div>
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Stat label="BEST" value={s.best.toLocaleString('en-US')} accent />
            <Stat label="REACHED" value={`S${s.sector} // W${s.wave}`} />
            <Stat label="WAVES" value={String(s.wavesCleared)} />
            <Stat label="PURGED" value={String(s.kills)} />
            <Stat label="MAX CHAIN" value={String(s.maxCombo)} />
            <Stat label="TIME" value={fmtTime(s.time)} />
          </div>
          <div className="mt-4 text-left border border-neutral-800 px-3 py-3" style={fontUi}>
            <div className="text-[10px] tracking-[0.25em] text-neutral-500">BUILD // {s.build.reduce((a, b) => a + b.stacks, 0)} MODULES</div>
            {s.build.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {s.build.map((b) => (
                  <span key={b.id} className="flex items-center gap-1.5 border border-neutral-800 pl-1 pr-2 py-1 text-[10px] text-neutral-300" title={UPGRADE_BY_ID[b.id]?.desc}>
                    <UpgradeIcon id={b.id} size={18} />
                    {UPGRADE_BY_ID[b.id]?.name ?? b.id}
                    {b.stacks > 1 ? ` x${b.stacks}` : ''}
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-[11px] text-neutral-500">No modules installed.</div>
            )}
            {s.synergies.length > 0 && (
              <div className="mt-2 text-[10px] tracking-[0.2em]" style={{ color: ORANGE }}>
                SYNERGIES // {s.synergies.join(' + ')}
              </div>
            )}
            <div className="mt-2 text-[10px] tracking-[0.25em] text-neutral-500">
              SEED <span style={{ color: WHITE }}>{s.seedStr}</span>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3 justify-center">
            <button type="button" onClick={() => startRun()} className={`${btnPrimary} text-black`} style={{ ...fontH, background: ORANGE, borderColor: ORANGE }}>
              RUN AGAIN
            </button>
            <button type="button" onClick={() => startRun(s.seed)} className={btnGhost} style={fontH} title="Replay with the same seed (same map and offers)">
              SAME SEED
            </button>
            <button type="button" onClick={onClose} className={btnGhost} style={fontH}>
              EXIT
            </button>
          </div>
          <div className="mt-3 text-[10px] tracking-[0.25em] text-neutral-500" style={fontUi}>
            ENTER / R TO RUN AGAIN // ESC TO EXIT
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="cyber-defender"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(0,0,0,0.94)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Cyber Defender mini-game"
        >
          <div
            className="relative flex flex-col w-full h-full"
            style={{
              maxWidth: 1280,
              maxHeight: 860,
              background: '#050506',
              border: '1px solid rgba(240,126,65,0.35)',
              boxShadow: '0 0 60px rgba(240,126,65,0.07)',
            }}
          >
            {/* header */}
            <div className="flex items-center justify-between px-3 sm:px-4 h-11 shrink-0" style={{ borderBottom: '1px solid rgba(240,126,65,0.18)' }}>
              <div className="flex items-baseline gap-3 min-w-0">
                <span className="text-xs sm:text-sm tracking-[0.3em] whitespace-nowrap" style={{ ...fontH, color: ORANGE }}>
                  CYBER DEFENDER
                </span>
                <span className="hidden sm:inline text-[10px] tracking-[0.2em] text-neutral-500 truncate" style={fontUi}>
                  {showHeaderRun && run ? `// SEED ${run.seedStr}` : '// NEURAL FIREWALL'}
                </span>
              </div>
              <div className="flex items-center gap-1" style={fontUi}>
                <button type="button" onClick={toggleAuto} className={hdrBtn} aria-pressed={autoFire} aria-label="Toggle auto-fire" title="Auto-fire (F)">
                  <span className="inline-block w-2 h-2" style={{ background: autoFire ? ORANGE : 'transparent', border: `1px solid ${ORANGE}` }} />
                  <span className="hidden sm:inline">AUTO-FIRE</span>
                </button>
                {inRun && (
                  <button type="button" onClick={() => gameRef.current?.togglePause()} className={hdrBtn} aria-label={phase === 'paused' ? 'Resume' : 'Pause'}>
                    {phase === 'paused' ? <FiPlay /> : <FiPause />}
                    <span className="hidden sm:inline">{phase === 'paused' ? 'RESUME' : 'PAUSE'}</span>
                  </button>
                )}
                <button type="button" onClick={toggleMute} className={hdrBtn} aria-label={muted ? 'Unmute sound' : 'Mute sound'} aria-pressed={muted}>
                  {muted ? <FiVolumeX /> : <FiVolume2 />}
                  <span className="hidden sm:inline">{muted ? 'MUTED' : 'SOUND'}</span>
                </button>
                <button type="button" onClick={onClose} className="h-8 w-8 flex items-center justify-center text-neutral-400 hover:text-white transition-colors" aria-label="Close game">
                  <FiX size={18} />
                </button>
              </div>
            </div>

            {/* play field */}
            <div ref={wrapRef} className="relative flex-1 min-h-0 overflow-hidden select-none">
              <canvas
                ref={canvasRef}
                className="absolute inset-0 block"
                style={{ width: '100%', height: '100%', touchAction: 'none', cursor: phase === 'playing' ? 'none' : 'default' }}
              />

              <AnimatePresence>
                {phase === 'menu' && (
                  <motion.div
                    key="menu"
                    {...fade}
                    transition={{ duration: 0.25 }}
                    className="absolute inset-0 overflow-y-auto flex"
                    style={{ background: 'radial-gradient(ellipse at center, rgba(5,5,6,0.55) 0%, rgba(5,5,6,0.92) 70%)' }}
                  >
                    <div className="m-auto w-full max-w-2xl px-4 py-6 sm:py-8 text-center">
                      <div className="text-[10px] sm:text-xs tracking-[0.35em]" style={{ ...fontUi, color: CORE }}>
                        // INTRUSION DETECTED
                      </div>
                      <h2 className="mt-3 text-3xl sm:text-5xl tracking-[0.12em]" style={{ ...fontH, color: WHITE }}>
                        CYBER <span style={{ color: ORANGE }}>DEFENDER</span>
                      </h2>
                      <p className="mt-3 text-xs sm:text-sm text-neutral-400 max-w-md mx-auto leading-relaxed" style={fontUi}>
                        You are the antivirus: a human mind wired into a network a rogue AI is taking apart. Breach three sectors, choose your path, build your firewall, and terminate the core.
                      </p>

                      <ol className="mt-6 text-left border border-neutral-800 divide-y divide-neutral-800" style={{ ...fontUi, background: 'rgba(7,7,8,0.85)' }}>
                        {[
                          ['01', 'MOVE / SHOOT / PULSE', `Mouse, drag or WASD to move in the lower field. ${autoFire ? 'Auto-fire is on (F toggles).' : 'Hold click or Space to fire (F: auto).'} E / right click fires the EMP pulse once installed.`],
                          ['02', 'UPGRADE AFTER EVERY WAVE', 'Install 1 of 3 modules. Rare ones are strong; corrupted ones are stronger but bite back.'],
                          ['03', 'CHOOSE YOUR ROUTE', 'Then pick the next route: standard wave, elite breach, repair, cache or anomaly. Five waves, then the sector core.'],
                        ].map(([n, k, v]) => (
                          <li key={n} className="flex gap-3 px-3 py-2.5">
                            <span className="text-[11px]" style={{ color: ORANGE }}>
                              {n}
                            </span>
                            <span>
                              <span className="block text-[11px] tracking-[0.2em]" style={{ color: WHITE }}>
                                {k}
                              </span>
                              <span className="block text-[11px] text-neutral-400 leading-snug mt-0.5">{v}</span>
                            </span>
                          </li>
                        ))}
                      </ol>
                      <div className="mt-2 text-[10px] tracking-[0.2em] text-neutral-500" style={fontUi}>
                        SHIFT DASH (WHEN INSTALLED) // P PAUSE // M MUTE
                      </div>

                      <div className="mt-6 flex flex-col items-center gap-3">
                        <button
                          type="button"
                          onClick={() => startRun()}
                          className={`${btnPrimary} text-black hover:text-white`}
                          style={{ ...fontH, background: ORANGE, borderColor: ORANGE }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'transparent')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = ORANGE)}
                        >
                          INITIALIZE FIREWALL
                        </button>
                        <div className="flex items-center gap-2 text-[10px] tracking-[0.25em] text-neutral-500" style={fontUi} role="radiogroup" aria-label="Difficulty">
                          DIFFICULTY
                          {(['NORMAL', 'HARD'] as const).map((d) => {
                            const on = (d === 'HARD') === hard;
                            return (
                              <button
                                key={d}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                onClick={() => {
                                  const v = d === 'HARD';
                                  hardRef.current = v;
                                  saveHard(v);
                                  setHard(v);
                                }}
                                className="px-2 py-1 border tracking-[0.2em] focus:outline-none focus-visible:ring-1 focus-visible:ring-white"
                                style={{ borderColor: on ? (d === 'HARD' ? CORE : ORANGE) : '#404046', color: on ? WHITE : '#7a7a82', background: on ? 'rgba(240,126,65,0.12)' : 'transparent' }}
                              >
                                {d}
                              </button>
                            );
                          })}
                        </div>
                        <label className="flex items-center gap-2 text-[10px] tracking-[0.25em] text-neutral-500" style={fontUi}>
                          SEED
                          <input
                            value={seedText}
                            onChange={(e) => {
                              setSeedText(e.target.value);
                              seedRef.current = e.target.value;
                            }}
                            placeholder="RANDOM"
                            maxLength={9}
                            className="w-28 bg-transparent border border-neutral-700 px-2 py-1 text-neutral-200 tracking-[0.2em] focus:outline-none focus:border-[#f07e41]"
                            aria-label="Run seed (optional, hex)"
                          />
                        </label>
                        <div className="text-[10px] tracking-[0.25em] text-neutral-500" style={fontUi}>
                          ENTER TO START{best > 0 ? ` // BEST ${best.toLocaleString('en-US')}` : ''}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {phase === 'map' && renderRoutes()}
                {phase === 'pick' && renderPick()}
                {phase === 'anomaly' && renderAnomaly()}

                {phase === 'paused' && (
                  <motion.div key="paused" {...fade} transition={{ duration: 0.15 }} className="absolute inset-0 flex items-center justify-center overflow-y-auto" style={{ background: 'rgba(5,5,6,0.8)' }}>
                    <div className="text-center px-4 py-4 w-full">
                      <div className="text-[10px] tracking-[0.35em] text-neutral-500" style={fontUi}>
                        // PROCESS SUSPENDED
                      </div>
                      <div className="mt-2 text-3xl sm:text-4xl tracking-[0.2em]" style={{ ...fontH, color: WHITE }}>
                        PAUSED
                      </div>
                      {run && g && (
                        <div className="mt-4 text-left max-w-md mx-auto max-h-[45vh] overflow-y-auto border border-neutral-800 p-3" style={{ background: 'rgba(7,7,8,0.85)' }}>
                          <SectorProgress sector={run.sector} wave={run.waveInSector} boss={g.isBoss} />
                          <div className="mt-3">
                            <BuildList build={run.build} syn={g.syn} hacked={g.hacked} />
                          </div>
                          <div className="mt-3 text-[10px] tracking-[0.25em] text-neutral-500" style={fontUi}>
                            SEED {run.seedStr}
                          </div>
                        </div>
                      )}
                      <div className="mt-6 flex gap-3 justify-center">
                        <button type="button" onClick={() => gameRef.current?.resume()} className={`${btnPrimary} text-black`} style={{ ...fontH, background: ORANGE, borderColor: ORANGE }}>
                          RESUME
                        </button>
                        <button type="button" onClick={onClose} className={btnGhost} style={fontH}>
                          EXIT
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {phase === 'summary' && renderSummary()}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CyberGame;

// Cyber Defender: defend the core node against procedural virus spiders.
// React only owns the modal chrome and the menu / pause / game-over overlays;
// the simulation and rendering run in a single requestAnimationFrame loop
// driven by refs (see ./cybergame/*).
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPause, FiPlay, FiVolume2, FiVolumeX, FiX } from 'react-icons/fi';
import { Game } from './cybergame/engine';
import { Renderer } from './cybergame/render';
import { Sfx } from './cybergame/audio';
import { loadBest, loadMuted, saveMuted } from './cybergame/storage';
import type { GameResult, Phase } from './cybergame/types';

interface CyberGameProps {
  isVisible: boolean;
  onClose: () => void;
}

const ORANGE = '#f07e41';
const RED = '#e5383b';
const MAX_BACKING_PIXELS = 4_200_000;

const fontH = { fontFamily: "'Orbitron', sans-serif" };
const fontUi = { fontFamily: "'JetBrains Mono', monospace" };

const btnPrimary =
  'px-6 py-3 text-xs sm:text-sm tracking-[0.3em] border transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-white';
const btnGhost =
  'px-5 py-3 text-xs sm:text-sm tracking-[0.3em] border border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-400 transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-white';

/** Tiny SVG silhouettes for the threat briefing. */
const ThreatIcon = ({ kind }: { kind: 'crawler' | 'brooder' | 'brute' | 'boss' }) => {
  const legs = kind === 'crawler' ? 3 : 4;
  const lines: ReactNode[] = [];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < legs; i++) {
      const f = i / (legs - 1);
      const a = 0.5 + f * 2.2;
      const hx = 20 + Math.cos(a) * 4;
      const hy = 20 + side * Math.sin(a) * 4;
      const kx = 20 + Math.cos(a - 0.35) * 11;
      const ky = 20 + side * (Math.sin(a - 0.35) * 11 + 3);
      const fx = 20 + Math.cos(a + 0.1) * 17;
      const fy = 20 + side * Math.sin(a + 0.1) * 17;
      lines.push(<polyline key={`${side}${i}`} points={`${hx},${hy} ${kx},${ky} ${fx},${fy}`} />);
    }
  }
  return (
    <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true" style={{ transform: 'rotate(-90deg)' }}>
      <g fill="none" stroke={ORANGE} strokeOpacity={0.7} strokeWidth={kind === 'brute' || kind === 'boss' ? 1.8 : 1.1}>
        {lines}
      </g>
      {kind === 'brute' ? (
        <polygon points="31,20 27,13 15,12 10,17 10,23 15,28 27,27" fill="#0b0b0e" stroke={ORANGE} strokeWidth="1" />
      ) : (
        <>
          <ellipse cx={kind === 'brooder' ? 14 : 13} cy="20" rx={kind === 'brooder' ? 9 : kind === 'boss' ? 10 : 7} ry={kind === 'brooder' ? 8 : kind === 'boss' ? 8 : 5} fill="#0b0b0e" stroke={ORANGE} strokeWidth="1" />
          <ellipse cx="24" cy="20" rx="4.5" ry="4" fill="#0b0b0e" stroke={ORANGE} strokeWidth="1" />
        </>
      )}
      <circle cx={kind === 'brute' ? 20 : 13} cy="20" r={kind === 'boss' ? 3.5 : 2} fill={kind === 'brute' ? ORANGE : RED} />
    </svg>
  );
};

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className="border border-neutral-800 px-3 py-2 text-left">
    <div className="text-[10px] tracking-[0.25em] text-neutral-500" style={fontUi}>
      {label}
    </div>
    <div className="text-lg sm:text-xl mt-1" style={{ ...fontH, color: accent ? ORANGE : '#fff' }}>
      {value}
    </div>
  </div>
);

const CyberGame = ({ isVisible, onClose }: CyberGameProps) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const sfxRef = useRef<Sfx | null>(null);
  const onCloseRef = useRef(onClose);
  const [phase, setPhase] = useState<Phase>('menu');
  const [result, setResult] = useState<GameResult | null>(null);
  const [muted, setMuted] = useState<boolean>(loadMuted);
  const mutedRef = useRef(muted);
  const [best, setBest] = useState<number>(0);

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

  const startGame = useCallback(() => {
    sfxRef.current?.unlock();
    gameRef.current?.start();
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
          if (p === 'over') {
            setResult(game.result());
            setBest(game.best);
          }
        },
      },
      loadBest(),
    );
    try {
      game.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      game.reducedMotion = false;
    }
    const renderer = new Renderer(ctx);
    gameRef.current = game;
    sfxRef.current = sfx;
    setPhase('menu');
    setResult(null);
    setBest(game.best);

    // ---- sizing (CSS px world, backing store scaled by DPR and capped)
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
    const onBlur = () => game.pause();

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
      game.pointerDown(x, y, e.button, e.pointerId, e.pointerType === 'mouse');
      if (game.firePointer === e.pointerId) {
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
    const onUp = (e: PointerEvent) => game.pointerUp(e.pointerId);
    const onLeave = (e: PointerEvent) => game.pointerLeave(e.pointerType === 'mouse');
    const onContext = (e: Event) => e.preventDefault();

    // ---- keyboard
    const onKey = (e: KeyboardEvent) => {
      const p = game.phase;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (p === 'playing') game.triggerEmp();
          else if ((p === 'menu' || p === 'over') && !e.repeat) {
            sfx.unlock();
            game.start();
          } else if (p === 'paused' && !e.repeat) game.resume();
          break;
        case 'Enter':
        case 'NumpadEnter':
        case 'KeyR':
          if ((p === 'menu' || p === 'over') && !e.repeat) {
            e.preventDefault();
            sfx.unlock();
            game.start();
          }
          break;
        case 'KeyP':
          if (!e.repeat) game.togglePause();
          break;
        case 'KeyM':
          if (!e.repeat) toggleMute();
          break;
        case 'Escape':
          e.preventDefault();
          if (p === 'playing') game.pause();
          else if (p === 'paused') game.resume();
          else onCloseRef.current();
          break;
      }
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('contextmenu', onContext);
    window.addEventListener('keydown', onKey);
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
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      document.body.style.overflow = prevOverflow;
      sfx.dispose();
      gameRef.current = null;
      sfxRef.current = null;
    };
  }, [isVisible, toggleMute]);

  const inRun = phase === 'playing' || phase === 'paused';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="cyber-defender"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
          style={{ background: 'rgba(0,0,0,0.94)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Cyber Defender mini-game"
        >
          <div
            className="relative flex flex-col w-full h-full"
            style={{
              maxWidth: 1280,
              maxHeight: 820,
              background: '#050506',
              border: '1px solid rgba(240,126,65,0.35)',
              boxShadow: '0 0 60px rgba(240,126,65,0.07)',
            }}
          >
            {/* header */}
            <div
              className="flex items-center justify-between px-3 sm:px-4 h-11 shrink-0"
              style={{ borderBottom: '1px solid rgba(240,126,65,0.18)' }}
            >
              <div className="flex items-baseline gap-3 min-w-0">
                <span className="text-xs sm:text-sm tracking-[0.3em] whitespace-nowrap" style={{ ...fontH, color: ORANGE }}>
                  CYBER DEFENDER
                </span>
                <span className="hidden sm:inline text-[10px] tracking-[0.2em] text-neutral-500 truncate" style={fontUi}>
                  // CORE DEFENSE PROTOCOL
                </span>
              </div>
              <div className="flex items-center gap-1" style={fontUi}>
                {inRun && (
                  <button
                    type="button"
                    onClick={() => gameRef.current?.togglePause()}
                    className="h-8 px-2 flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-[10px] tracking-[0.2em]"
                    aria-label={phase === 'paused' ? 'Resume' : 'Pause'}
                  >
                    {phase === 'paused' ? <FiPlay /> : <FiPause />}
                    <span className="hidden sm:inline">{phase === 'paused' ? 'RESUME' : 'PAUSE'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleMute}
                  className="h-8 px-2 flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-[10px] tracking-[0.2em]"
                  aria-label={muted ? 'Unmute sound' : 'Mute sound'}
                  aria-pressed={muted}
                >
                  {muted ? <FiVolumeX /> : <FiVolume2 />}
                  <span className="hidden sm:inline">{muted ? 'MUTED' : 'SOUND'}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-8 w-8 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                  aria-label="Close game"
                >
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
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="absolute inset-0 overflow-y-auto flex"
                    style={{ background: 'radial-gradient(ellipse at center, rgba(5,5,6,0.55) 0%, rgba(5,5,6,0.9) 70%)' }}
                  >
                    <div className="m-auto w-full max-w-2xl px-4 py-6 sm:py-8 text-center">
                      <div className="text-[10px] sm:text-xs tracking-[0.35em]" style={{ ...fontUi, color: RED }}>
                        // INTRUSION DETECTED
                      </div>
                      <h2 className="mt-3 text-3xl sm:text-5xl text-white tracking-[0.12em]" style={fontH}>
                        CYBER <span style={{ color: ORANGE }}>DEFENDER</span>
                      </h2>
                      <p className="mt-3 text-xs sm:text-sm text-neutral-400 max-w-md mx-auto leading-relaxed" style={fontUi}>
                        Viral processes are crawling toward the core node. Purge them before integrity hits zero.
                      </p>

                      <div className="mt-6 grid grid-cols-2 gap-px text-left" style={{ ...fontUi, background: 'rgba(240,126,65,0.15)' }}>
                        {[
                          ['AIM', 'Mouse / touch'],
                          ['FIRE', 'Hold left click / hold finger'],
                          ['EMP PULSE', 'Right click / Space / EMP button'],
                          ['PAUSE', 'P / Esc'],
                        ].map(([k, v]) => (
                          <div key={k} className="px-3 py-2" style={{ background: '#070708' }}>
                            <div className="text-[10px] tracking-[0.25em]" style={{ color: ORANGE }}>
                              {k}
                            </div>
                            <div className="text-[11px] sm:text-xs text-neutral-300 mt-0.5">{v}</div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-left" style={fontUi}>
                        {(
                          [
                            ['crawler', 'CRAWLER', 'Fast. Swarms in packs.'],
                            ['brooder', 'BROODER', 'Splits into mites.'],
                            ['brute', 'BRUTE', 'Armored. Hits hard.'],
                            ['boss', 'KERNEL LEECH', 'Every 5th wave.'],
                          ] as const
                        ).map(([kind, name, desc]) => (
                          <div key={kind} className="flex items-center gap-2 border border-neutral-800 px-2 py-2" style={{ background: 'rgba(7,7,8,0.8)' }}>
                            <ThreatIcon kind={kind} />
                            <div className="min-w-0">
                              <div className="text-[10px] tracking-[0.2em] text-white">{name}</div>
                              <div className="text-[10px] text-neutral-500 leading-tight">{desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <p className="mt-4 text-[10px] sm:text-[11px] text-neutral-500 leading-relaxed" style={fontUi}>
                        Chain kills to raise the multiplier up to x8. x4 overclocks fire rate, x6 adds twin tracers. Taking a hit breaks the chain.
                      </p>

                      <div className="mt-6 flex flex-col items-center gap-3">
                        <button
                          type="button"
                          onClick={startGame}
                          className={`${btnPrimary} text-black hover:text-white`}
                          style={{ ...fontH, background: ORANGE, borderColor: ORANGE }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'transparent')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = ORANGE)}
                        >
                          INITIALIZE DEFENSE
                        </button>
                        <div className="text-[10px] tracking-[0.25em] text-neutral-500" style={fontUi}>
                          ENTER TO START{best > 0 ? ` // BEST ${best.toLocaleString('en-US')}` : ''}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {phase === 'paused' && (
                  <motion.div
                    key="paused"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ background: 'rgba(5,5,6,0.72)' }}
                  >
                    <div className="text-center px-4">
                      <div className="text-[10px] tracking-[0.35em] text-neutral-500" style={fontUi}>
                        // PROCESS SUSPENDED
                      </div>
                      <div className="mt-2 text-3xl sm:text-4xl text-white tracking-[0.2em]" style={fontH}>
                        PAUSED
                      </div>
                      <div className="mt-6 flex gap-3 justify-center">
                        <button
                          type="button"
                          onClick={() => gameRef.current?.resume()}
                          className={`${btnPrimary} text-black`}
                          style={{ ...fontH, background: ORANGE, borderColor: ORANGE }}
                        >
                          RESUME
                        </button>
                        <button type="button" onClick={onClose} className={btnGhost} style={fontH}>
                          EXIT
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {phase === 'over' && result && (
                  <motion.div
                    key="over"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 overflow-y-auto flex"
                    style={{ background: 'radial-gradient(ellipse at center, rgba(20,4,4,0.7) 0%, rgba(5,5,6,0.94) 70%)' }}
                  >
                    <div className="m-auto w-full max-w-md px-4 py-6 text-center">
                      <div className="text-[10px] sm:text-xs tracking-[0.35em]" style={{ ...fontUi, color: RED }}>
                        // INTEGRITY 0%
                      </div>
                      <h2 className="mt-3 text-2xl sm:text-4xl tracking-[0.12em]" style={{ ...fontH, color: RED }}>
                        CORE COMPROMISED
                      </h2>
                      <div className="mt-6" style={fontUi}>
                        <div className="text-[10px] tracking-[0.3em] text-neutral-500">FINAL SCORE</div>
                        <div className="mt-1 text-4xl sm:text-5xl text-white" style={fontH}>
                          {result.score.toLocaleString('en-US')}
                        </div>
                        {result.newBest && (
                          <div className="mt-2 inline-block px-2 py-0.5 text-[10px] tracking-[0.3em] text-black" style={{ background: ORANGE }}>
                            NEW RECORD
                          </div>
                        )}
                      </div>
                      <div className="mt-6 grid grid-cols-2 gap-2">
                        <Stat label="BEST" value={result.best.toLocaleString('en-US')} accent />
                        <Stat label="WAVE" value={String(result.wave).padStart(2, '0')} />
                        <Stat label="PURGED" value={String(result.kills)} />
                        <Stat label="MAX CHAIN" value={String(result.maxCombo)} />
                      </div>
                      <div className="mt-6 flex gap-3 justify-center">
                        <button
                          type="button"
                          onClick={startGame}
                          className={`${btnPrimary} text-black`}
                          style={{ ...fontH, background: ORANGE, borderColor: ORANGE }}
                        >
                          REBOOT
                        </button>
                        <button type="button" onClick={onClose} className={btnGhost} style={fontH}>
                          EXIT
                        </button>
                      </div>
                      <div className="mt-3 text-[10px] tracking-[0.25em] text-neutral-500" style={fontUi}>
                        ENTER / R TO REBOOT // ESC TO EXIT
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CyberGame;

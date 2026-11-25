import { useEffect, useRef, useState } from 'react';

/**
 * Hero boot sequence (~2.6s, silent, no click). The hero is already rendered underneath;
 * this layer plays fast cyberpunk title cuts, forms JULIAN STRUNZ at the exact position/size
 * of the hero title, then a scanline sweep dissolves the black layer top→bottom so the real
 * hero is simply "there". Any scroll/key/click completes it instantly.
 * Photosensitivity: no full-screen flashes; cuts are small, mid-contrast, < 3 luminance changes/s.
 */

const YEL = '#fcee0a';
const CYA = '#00fff9';
const MAG = '#ff00c1';
const ORANGE = '#f07e41';
const GLYPHS = '!<>-_\\/[]{}=+*^?#░▒▓01ABCDEF';

const CUTS = ['SYS//BOOT', 'NEURAL·LINK', 'JS', 'MKT×ENG'];

type Rect = { left: number; top: number; width: number; height: number; fontSize: string; letterSpacing: string };

function scramble(text: string, p: number) {
  const n = Math.floor(p * text.length);
  let s = '';
  for (let i = 0; i < text.length; i++) s += i < n || text[i] === ' ' ? text[i] : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  return s;
}

export default function CinematicIntro({ onDone }: { onDone: () => void }) {
  const [t, setT] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [gone, setGone] = useState(false);
  const doneRef = useRef(false);
  const t0 = useRef(0);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setGone(true);
    onDone();
  };

  // reduced motion: show final state immediately
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // measure the real hero title so the boot name lands exactly on it
  useEffect(() => {
    const measure = () => {
      const el = document.querySelector('[data-hero-name]') as HTMLElement | null;
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      setRect({ left: r.left, top: r.top, width: r.width, height: r.height, fontSize: cs.fontSize, letterSpacing: cs.letterSpacing });
      return true;
    };
    let tries = 0;
    const id = window.setInterval(() => { if (measure() || ++tries > 40) window.clearInterval(id); }, 25);
    window.addEventListener('resize', measure);
    return () => { window.clearInterval(id); window.removeEventListener('resize', measure); };
  }, []);

  // clock
  useEffect(() => {
    let raf = 0;
    t0.current = performance.now();
    const tick = (now: number) => {
      const s = (now - t0.current) / 1000;
      setT(s);
      if (s >= 2.7) finish();
      else if (!doneRef.current) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const skip = () => finish();
    window.addEventListener('wheel', skip, { passive: true });
    window.addEventListener('touchmove', skip, { passive: true });
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('wheel', skip);
      window.removeEventListener('touchmove', skip);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (gone) return null;

  // ---- timeline ----
  const cutIdx = t < 0.18 ? -1 : t < 0.75 ? Math.min(CUTS.length - 1, Math.floor((t - 0.18) / 0.14)) : -1;
  const nameP = Math.max(0, Math.min(1, (t - 0.72) / 0.55)); // stencil reveal progress
  const settle = Math.max(0, Math.min(1, (t - 1.15) / 0.45)); // glitch settling
  const sweep = Math.max(0, Math.min(1, (t - 1.45) / 0.65)); // scanline dissolve 0→1 (top→bottom)
  const sweepY = sweep * 100;
  const nameRevealedBelow = rect ? (rect.top + rect.height) / window.innerHeight * 100 < sweepY : false;

  // datamosh slices for the name: 6 horizontal bands with decaying random offsets
  const bands = 6;
  const jitter = (1 - settle) * 28;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none select-none" aria-hidden>
      {/* Black layer, dissolved by a hard scanline sweep */}
      <div
        className="absolute inset-0 bg-[#050505]"
        style={{ clipPath: `inset(${sweepY}% 0 0 0)` }}
      >
        {/* scanlines + vignette */}
        <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.03) 0 1px, transparent 1px 3px)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.8))' }} />

        {/* HUD frame + boot readout */}
        <div className="absolute inset-4 md:inset-8 border border-[#f07e41]/25" style={{ opacity: t > 0.05 ? 1 : 0 }}>
          {['-top-px -left-px border-t-2 border-l-2', '-top-px -right-px border-t-2 border-r-2', '-bottom-px -left-px border-b-2 border-l-2', '-bottom-px -right-px border-b-2 border-r-2'].map((c) => (
            <span key={c} className={`absolute ${c} w-6 h-6 border-[#f07e41]`} />
          ))}
          <div className="absolute left-3 top-2 font-mono text-[10px] tracking-[0.3em] text-[#f07e41]">
            {scramble('JS//PORTFOLIO_OS v2.6', Math.min(1, t / 0.4))}
          </div>
          <div className="absolute right-3 top-2 font-mono text-[10px] tracking-[0.3em] text-[#f07e41]/80">
            SYS.BOOT {String(Math.min(100, Math.round((t / 1.6) * 100))).padStart(3, '0')}%
          </div>
          <div className="absolute left-3 bottom-2 font-mono text-[10px] tracking-[0.3em] text-gray-500">
            {t < 0.7 ? 'DECRYPTING IDENTITY' : t < 1.4 ? 'IDENTITY LOCKED' : 'HANDING OFF ▸ HERO'}
          </div>
        </div>

        {/* Rapid hard cuts: bold typographic fragments with RGB split (centre, small area) */}
        {cutIdx >= 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative font-cyber font-black tracking-[0.12em] text-4xl md:text-6xl" style={{ transform: `translateX(${(cutIdx % 2 ? 1 : -1) * 6}px) skewX(${cutIdx % 2 ? -8 : 6}deg)` }}>
              <span className="absolute inset-0" style={{ color: CYA, transform: 'translate(-5px, 0)', mixBlendMode: 'screen' }}>{CUTS[cutIdx]}</span>
              <span className="absolute inset-0" style={{ color: MAG, transform: 'translate(5px, 1px)', mixBlendMode: 'screen' }}>{CUTS[cutIdx]}</span>
              <span className="relative" style={{ color: cutIdx === 2 ? ORANGE : '#e9e2d6' }}>{CUTS[cutIdx]}</span>
              {/* HUD tick under fragment */}
              <span className="absolute left-0 -bottom-3 h-[2px] bg-[#f07e41]" style={{ width: `${30 + cutIdx * 18}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Name forming at the exact hero title position (above the black layer until the sweep passes it) */}
      {rect && t >= 0.72 && !nameRevealedBelow && (
        <div
          className="absolute font-cyber font-bold uppercase whitespace-nowrap"
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height, fontSize: rect.fontSize, letterSpacing: rect.letterSpacing, lineHeight: `${rect.height}px` }}
        >
          {Array.from({ length: bands }).map((_, b) => {
            const top = (b / bands) * 100;
            const bottom = 100 - ((b + 1) / bands) * 100;
            const dx = Math.round((Math.sin(b * 12.9898 + t * 40) * 0.5 + 0.5 - 0.5) * 2 * jitter);
            return (
              <div key={b} className="absolute inset-0" style={{ clipPath: `inset(${top}% 0 ${bottom}% 0)`, transform: `translateX(${dx}px)` }}>
                <span className="absolute inset-0 text-center" style={{ color: CYA, transform: `translateX(${-3 - jitter * 0.25}px)`, opacity: 0.9, mixBlendMode: 'screen' }}>JULIAN STRUNZ</span>
                <span className="absolute inset-0 text-center" style={{ color: MAG, transform: `translateX(${3 + jitter * 0.25}px)`, opacity: 0.9, mixBlendMode: 'screen' }}>JULIAN STRUNZ</span>
                <span className="absolute inset-0 text-center" style={{ color: YEL }}>{nameP < 1 ? scramble('JULIAN STRUNZ', nameP) : 'JULIAN STRUNZ'}</span>
              </div>
            );
          })}
          {/* stencil blocks covering letters, removed progressively */}
          {Array.from({ length: 13 }).map((_, k) => {
            const order = (k * 7) % 13;
            const visible = nameP < (order + 1) / 13;
            return visible ? (
              <span key={k} className="absolute top-[8%] bottom-[8%] bg-[#050505] border-l border-[#f07e41]/60" style={{ left: `${(k / 13) * 100}%`, width: `${100 / 13 + 0.4}%` }} />
            ) : null;
          })}
        </div>
      )}

      {/* The sweep line itself */}
      {sweep > 0 && sweep < 1 && (
        <div className="absolute inset-x-0 h-[2px]" style={{ top: `${sweepY}%`, background: ORANGE }}>
          <div className="absolute inset-x-0 -top-6 h-6" style={{ background: 'linear-gradient(to bottom, transparent, rgba(240,126,65,0.18))' }} />
        </div>
      )}
    </div>
  );
}

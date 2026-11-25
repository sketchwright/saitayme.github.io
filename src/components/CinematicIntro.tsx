import { useEffect, useRef, useState } from 'react';

/**
 * Hero boot v3 (~2.8s, silent, no click). Kinetic cyberpunk title cuts → the name slams together
 * letter by letter at the exact hero-title position → torn-band datamosh reveal of the live hero.
 * Any scroll/key/click completes it instantly. Reduced motion → skipped.
 * Photosensitivity: at most 2 bright frames (< 3/s), never full-screen, no strobing.
 */

const YEL = '#fcee0a';
const CYA = '#00fff9';
const MAG = '#ff00c1';
const ORANGE = '#f07e41';
const OFF = '#f4efe8';
const GLYPHS = '!<>-_\\/[]{}=+*^?#01ABCDEF';
const NAME = 'JULIAN STRUNZ';
const BANDS = 14;
const END = 3.2;
const NAME_T = 0.98; // giant name appears, cropped
const PULL = 0.8; // pull-back duration (expo)

type Rect = { left: number; top: number; width: number; height: number; fontSize: string; letterSpacing: string };

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const easeIn = (t: number) => clamp(t) ** 3;
const expoOut = (t: number) => (clamp(t) >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t)));
const scramble = (text: string, p: number) =>
  text.split('').map((c, i) => (i < Math.floor(p * text.length) || c === ' ' ? c : GLYPHS[(i * 7 + Math.floor(performance.now() / 40)) % GLYPHS.length])).join('');

/* ---- kinetic cuts ---- */
function Cut({ i }: { i: number }) {
  switch (i) {
    case 0: // giant outline word + diagonal yellow block
      return (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          <div className="absolute w-[140vw] h-[22vh] -rotate-12" style={{ background: YEL }} />
          <div className="relative font-cyber font-black text-[22vw] leading-none -skew-x-12" style={{ WebkitTextStroke: `3px ${OFF}`, color: 'transparent' }}>BOOT</div>
        </div>
      );
    case 1: // sliced RGB word
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          {Array.from({ length: 5 }).map((_, b) => (
            <div key={b} className="absolute font-cyber font-black text-[11vw] tracking-[0.06em]" style={{ clipPath: `inset(${b * 20}% 0 ${80 - b * 20}% 0)`, transform: `translateX(${(b % 2 ? 1 : -1) * (8 + b * 6)}px)` }}>
              <span className="absolute inset-0" style={{ color: CYA, transform: 'translateX(-8px)', mixBlendMode: 'screen' }}>NEURAL//LINK</span>
              <span className="absolute inset-0" style={{ color: MAG, transform: 'translateX(8px)', mixBlendMode: 'screen' }}>NEURAL//LINK</span>
              <span className="relative" style={{ color: OFF }}>NEURAL//LINK</span>
            </div>
          ))}
        </div>
      );
    case 2: // poster block: black JS on yellow, barcode
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative px-[4vw] py-[2vh] rotate-3" style={{ background: YEL }}>
            <div className="font-cyber font-black text-[18vw] leading-none text-black">JS</div>
            <div className="absolute -bottom-6 left-0 right-0 h-4" style={{ background: `repeating-linear-gradient(90deg, ${YEL} 0 2px, transparent 2px 5px, ${YEL} 5px 6px, transparent 6px 10px)` }} />
            <div className="absolute top-1 right-2 font-mono text-[10px] text-black tracking-[0.3em]">ID//0x4A53</div>
          </div>
        </div>
      );
    case 3: // stacked outline role, orange
      return (
        <div className="absolute inset-0 flex flex-col items-start justify-center pl-[6vw] gap-1 overflow-hidden">
          {['MARKETING', 'ENGINEER'].map((w, k) => (
            <div key={w} className="font-cyber font-black text-[12vw] leading-[0.85]" style={{ color: k ? 'transparent' : ORANGE, WebkitTextStroke: k ? `2px ${ORANGE}` : undefined, transform: `translateX(${k * 8}vw)` }}>{w}</div>
          ))}
        </div>
      );
    default: // second role, RGB split, right aligned
      return (
        <div className="absolute inset-0 flex flex-col items-end justify-center pr-[6vw] overflow-hidden">
          {['GAMEPLAY', 'PROGRAMMER'].map((w, k) => (
            <div key={w} className="relative font-cyber font-black text-[10vw] leading-[0.9]" style={{ transform: `translateX(${-k * 6}vw)` }}>
              <span className="absolute inset-0" style={{ color: CYA, transform: 'translateX(-6px)', mixBlendMode: 'screen' }}>{w}</span>
              <span className="absolute inset-0" style={{ color: MAG, transform: 'translateX(6px)', mixBlendMode: 'screen' }}>{w}</span>
              <span className="relative" style={{ color: OFF }}>{w}</span>
            </div>
          ))}
        </div>
      );
  }
}

export default function CinematicIntro({ onDone }: { onDone: () => void }) {
  const [t, setT] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [gone, setGone] = useState(false);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setGone(true);
    onDone();
  };

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // measure the real hero title
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

  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const s = (now - t0) / 1000;
      setT(s);
      if (s >= END) finish();
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
  const CUT_START = 0.22;
  const CUT_LEN = 0.15;
  const cutIdx = t >= CUT_START && t < Math.min(NAME_T, CUT_START + CUT_LEN * 5) ? Math.floor((t - CUT_START) / CUT_LEN) : -1;
  const cutLocal = cutIdx >= 0 ? (t - CUT_START - cutIdx * CUT_LEN) / CUT_LEN : 0;

  const SLAM_T = NAME_T + PULL; // lands in hero slot = impact
  const shake = t > SLAM_T && t < SLAM_T + 0.28 ? (1 - (t - SLAM_T) / 0.28) * 3 : t >= CUT_START && t < 0.97 && cutLocal < 0.25 ? 4 : 0;
  const sx = shake ? Math.sin(t * 190) * shake : 0;
  const sy = shake ? Math.cos(t * 230) * shake * 0.6 : 0;
  const split = t < SLAM_T ? 10 : 10 * (1 - easeOut((t - SLAM_T) / 0.5)) + 1.5;
  const punch = t < SLAM_T ? 1 : 1 + 0.08 * (1 - easeOut((t - SLAM_T) / 0.35));

  const REVEAL_T = SLAM_T + 0.12;
  const bandProgress = (b: number) => easeIn((t - REVEAL_T - ((b * 5) % BANDS) * 0.022) / 0.38);
  const nameBand = rect ? Math.floor(((rect.top + rect.height / 2) / window.innerHeight) * BANDS) : -1;
  const nameCovered = nameBand < 0 || bandProgress(nameBand) < 0.6;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none select-none overflow-hidden" aria-hidden>
      {/* torn black bands (slide off alternately = datamosh reveal of the live hero) */}
      {Array.from({ length: BANDS }).map((_, b) => {
        const p = bandProgress(b);
        const dir = b % 2 ? 1 : -1;
        return (
          <div
            key={b}
            className="absolute left-0 right-0 bg-[#050505]"
            style={{ top: `${(b / BANDS) * 100}%`, height: `${100 / BANDS + 0.2}%`, transform: `translateX(${dir * p * 115}%)` }}
          >
            {p > 0 && p < 1 && <div className="absolute inset-y-0 w-[3px]" style={{ [dir > 0 ? 'left' : 'right']: 0, background: b % 3 ? ORANGE : YEL } as React.CSSProperties} />}
          </div>
        );
      })}

      <div className="absolute inset-0" style={{ transform: `translate(${sx}px, ${sy}px)`, opacity: t < REVEAL_T + 0.1 ? 1 : 0, transition: 'opacity 0.15s' }}>
        {/* scanlines */}
        <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.035) 0 1px, transparent 1px 3px)' }} />

        {/* opening line */}
        {t < 0.3 && <div className="absolute left-1/2 top-1/2 h-[2px] -translate-x-1/2" style={{ width: `${easeOut(t / 0.22) * 100}%`, background: ORANGE }} />}

        {/* HUD */}
        <div className="absolute inset-4 md:inset-8" style={{ opacity: t > 0.1 ? 1 : 0 }}>
          {['top-0 left-0 border-t-2 border-l-2', 'top-0 right-0 border-t-2 border-r-2', 'bottom-0 left-0 border-b-2 border-l-2', 'bottom-0 right-0 border-b-2 border-r-2'].map((c) => (
            <span key={c} className={`absolute ${c} w-8 h-8`} style={{ borderColor: ORANGE }} />
          ))}
          <div className="absolute left-4 top-3 font-mono text-[10px] md:text-xs tracking-[0.3em]" style={{ color: ORANGE }}>{scramble('JS//PORTFOLIO_OS 2.6 :: BOOT', clamp(t / 0.5))}</div>
          <div className="absolute right-4 top-3 font-mono text-[10px] md:text-xs tracking-[0.3em] text-gray-400">SYS {String(Math.min(100, Math.round((t / 1.8) * 100))).padStart(3, '0')}%</div>
          <div className="absolute left-4 bottom-3 font-mono text-[10px] md:text-xs tracking-[0.3em] text-gray-500">
            {t < 1 ? 'DECRYPTING IDENTITY ▒▒▒' : t < SLAM_T ? 'ASSEMBLING ▓▓▓' : 'IDENTITY LOCKED ▸ JACKING IN'}
          </div>
          {/* side barcode ticks */}
          <div className="absolute right-4 bottom-10 w-24 h-3" style={{ background: `repeating-linear-gradient(90deg, ${ORANGE} 0 1px, transparent 1px 4px)` }} />
        </div>

        {/* kinetic cuts */}
        {cutIdx >= 0 && (
          <div className="absolute inset-0" style={{ transform: `scale(${1.06 - cutLocal * 0.06})` }}>
            <Cut i={cutIdx} />
          </div>
        )}

        {/* THE MOVE: giant cropped name, camera pulls back (expo) and the name slots into the hero title */}
        {rect && t >= NAME_T && nameCovered && (() => {
          const k = expoOut((t - NAME_T) / PULL);
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const big = (vw * 2.6) / rect.width; // letters far bigger than the viewport
          const S = big + (punch - big) * k;
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const tx = (vw / 2 - cx) * (1 - k) + vw * 0.18 * (1 - k); // start off-centre so it crops hard
          const ty = (vh / 2 - cy) * (1 - k);
          const slice = (1 - k) * 90;
          const sp = split * (0.4 + (1 - k) * 2.2);
          return (
            <div
              className="absolute font-cyber font-bold uppercase whitespace-nowrap"
              style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height, fontSize: rect.fontSize, letterSpacing: rect.letterSpacing, lineHeight: `${rect.height}px`, transform: `translate(${tx}px, ${ty}px) scale(${S})`, transformOrigin: 'center' }}
            >
              {Array.from({ length: 6 }).map((_, b2) => (
                <div key={b2} className="absolute inset-0 text-center" style={{ clipPath: `inset(${b2 * (100 / 6)}% 0 ${100 - (b2 + 1) * (100 / 6)}% 0)`, transform: `translateX(${Math.sin(b2 * 3.1 + t * 22) * slice / S}px)` }}>
                  <span className="absolute inset-0" style={{ color: CYA, transform: `translateX(${-sp / S * 3}px)`, mixBlendMode: 'screen' }}>{NAME}</span>
                  <span className="absolute inset-0" style={{ color: MAG, transform: `translateX(${sp / S * 3}px)`, mixBlendMode: 'screen' }}>{NAME}</span>
                  <span className="absolute inset-0" style={{ color: YEL }}>{t - NAME_T < 0.12 ? scramble(NAME, (t - NAME_T) / 0.12) : NAME}</span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* impact line under the name */}
        {rect && t > SLAM_T && t < REVEAL_T + 0.2 && (
          <div className="absolute h-[3px]" style={{ left: rect.left + rect.width / 2, top: rect.top + rect.height + 10, width: easeOut((t - SLAM_T) / 0.25) * rect.width * 1.1, transform: 'translateX(-50%)', background: ORANGE }} />
        )}
      </div>
    </div>
  );
}

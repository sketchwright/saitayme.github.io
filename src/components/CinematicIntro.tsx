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
const END = 3.15;
const NAME_T = 0.98; // giant name appears, cropped
const PULL = 0.8; // pull-back duration (expo)

type Rect = { left: number; top: number; width: number; height: number; fontSize: string; letterSpacing: string; lineHeight: string };

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const expoOut = (t: number) => (clamp(t) >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t)));
const expoIn = (t: number) => (clamp(t) <= 0 ? 0 : Math.pow(2, 10 * clamp(t) - 10));
const backOut = (t: number) => { const c = 2.2; const x = clamp(t) - 1; return 1 + (c + 1) * x * x * x + c * x * x; };
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
    // let the CSS entrances finish if they're mid-flight; on skip they end immediately
    window.setTimeout(() => document.documentElement.classList.remove('boot-seq'), 50);
  };

  // hero/nav entrance choreography lives in CSS under html.boot-seq (delays are synced to this timeline)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    document.documentElement.classList.add('boot-seq');
    return () => document.documentElement.classList.remove('boot-seq');
  }, []);

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
      setRect({ left: r.left, top: r.top, width: r.width, height: r.height, fontSize: cs.fontSize, letterSpacing: cs.letterSpacing, lineHeight: cs.lineHeight });
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

  const LAND_T = NAME_T + PULL; // pull-back reaches overshoot (0.96)
  const SNAP = 0.07; // snap back to 1.0
  const HOLD = 0.035; // hit-stop (~2 frames)
  const IMPACT_T = LAND_T + SNAP + HOLD; // shockwave, doors, tear
  const DOORS = 0.34;
  const KICK_T = IMPACT_T + 0.95; // final micro-beat

  // camera shake: during cuts, on impact (3px), final kick (1.5px)
  let shake = 0;
  if (t >= CUT_START && t < NAME_T && cutLocal < 0.25) shake = 4;
  if (t > IMPACT_T && t < IMPACT_T + 0.22) shake = (1 - (t - IMPACT_T) / 0.22) * 3;
  if (t > KICK_T && t < KICK_T + 0.12) shake = 1.5;
  const sx = shake ? Math.sin(t * 190) * shake : 0;
  const sy = shake ? Math.cos(t * 230) * shake * 0.6 : 0;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;
  const cx = rect ? rect.left + rect.width / 2 : vw / 2;
  const cy = rect ? rect.top + rect.height / 2 : vh / 3;

  // blast doors along a diagonal through the name
  const dp = expoIn((t - IMPACT_T) / DOORS);
  const seamY1 = ((cy - 0.12 * vh) / vh) * 100;
  const seamY2 = ((cy + 0.12 * vh) / vh) * 100;
  const doorsOpen = t > IMPACT_T + DOORS;

  // shockwave
  const shockP = clamp((t - IMPACT_T) / 0.6);
  const maxR = Math.hypot(Math.max(cx, vw - cx), Math.max(cy, vh - cy));
  const shockR = expoOut(shockP) * maxR;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none select-none overflow-hidden" aria-hidden>
      {/* Blast doors: the last card splits along a diagonal and flies apart with motion smear */}
      {!doorsOpen && (
        <>
          <div
            className="absolute inset-0 bg-[#050505]"
            style={{
              clipPath: `polygon(0 0, 100% 0, 100% ${seamY1}%, 0 ${seamY2}%)`,
              transform: `translate(${-dp * 18}%, ${-dp * 70}%) skewY(${dp * -4}deg) scaleX(${1 + dp * 0.25})`,
            }}
          >
            <div className="absolute left-0 right-0 h-[3px]" style={{ top: `${(seamY1 + seamY2) / 2}%`, transform: `rotate(${Math.atan2((seamY1 - seamY2) * vh, 100 * vw) * (180 / Math.PI)}deg)`, background: ORANGE, opacity: t > IMPACT_T ? 1 : 0 }} />
          </div>
          <div
            className="absolute inset-0 bg-[#050505]"
            style={{
              clipPath: `polygon(0 ${seamY2}%, 100% ${seamY1}%, 100% 100%, 0 100%)`,
              transform: `translate(${dp * 18}%, ${dp * 70}%) skewY(${dp * -4}deg) scaleX(${1 + dp * 0.25})`,
            }}
          />
        </>
      )}

      {/* Shockwave ring + grid powering on behind the wave front */}
      {t > IMPACT_T && shockP < 1 && (
        <>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(${ORANGE} 1px, transparent 1px), linear-gradient(90deg, ${ORANGE} 1px, transparent 1px)`,
              backgroundSize: '40px 40px',
              opacity: 0.35 * (1 - shockP),
              WebkitMaskImage: `radial-gradient(circle at ${cx}px ${cy}px, transparent ${Math.max(0, shockR - 140)}px, black ${shockR - 20}px, transparent ${shockR + 6}px)`,
              maskImage: `radial-gradient(circle at ${cx}px ${cy}px, transparent ${Math.max(0, shockR - 140)}px, black ${shockR - 20}px, transparent ${shockR + 6}px)`,
            }}
          />
          <div
            className="absolute rounded-full"
            style={{ left: cx - shockR, top: cy - shockR, width: shockR * 2, height: shockR * 2, border: `2px solid ${ORANGE}`, opacity: 1 - shockP }}
          />
        </>
      )}

      <div className="absolute inset-0" style={{ transform: `translate(${sx}px, ${sy}px)` }}>
        {!doorsOpen && (
          <>
            {/* scanlines */}
            <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.035) 0 1px, transparent 1px 3px)', opacity: 1 - dp }} />
            {/* opening line */}
            {t < 0.3 && <div className="absolute left-1/2 top-1/2 h-[2px] -translate-x-1/2" style={{ width: `${easeOut(t / 0.22) * 100}%`, background: ORANGE }} />}
            {/* kinetic cuts */}
            {cutIdx >= 0 && (
              <div className="absolute inset-0" style={{ transform: `scale(${1.06 - cutLocal * 0.06})` }}>
                <Cut i={cutIdx} />
              </div>
            )}
          </>
        )}

        {/* HUD: brackets slide from the screen corners onto the hero frame and settle at the final kick */}
        {(() => {
          const settle = expoOut((t - IMPACT_T) / 0.9);
          const inset = 16 + settle * 0; // keep frame
          const op = t < KICK_T + 0.15 ? 1 : 0;
          return (
            <div className="absolute" style={{ inset, opacity: t > 0.1 ? op : 0, transition: 'opacity 0.12s' }}>
              {['top-0 left-0 border-t-2 border-l-2', 'top-0 right-0 border-t-2 border-r-2', 'bottom-0 left-0 border-b-2 border-l-2', 'bottom-0 right-0 border-b-2 border-r-2'].map((c) => (
                <span key={c} className={`absolute ${c}`} style={{ borderColor: ORANGE, width: 32 - settle * 14, height: 32 - settle * 14 }} />
              ))}
              {!doorsOpen && (
                <>
                  <div className="absolute left-4 top-3 font-mono text-[10px] md:text-xs tracking-[0.3em]" style={{ color: ORANGE }}>{scramble('JS//PORTFOLIO_OS 2.6 :: BOOT', clamp(t / 0.5))}</div>
                  <div className="absolute right-4 top-3 font-mono text-[10px] md:text-xs tracking-[0.3em] text-gray-400">SYS {String(Math.min(100, Math.round((t / IMPACT_T) * 100))).padStart(3, '0')}%</div>
                  <div className="absolute left-4 bottom-3 font-mono text-[10px] md:text-xs tracking-[0.3em] text-gray-500">
                    {t < 1 ? 'DECRYPTING IDENTITY ▒▒▒' : t < LAND_T ? 'ASSEMBLING ▓▓▓' : 'IDENTITY LOCKED ▸ JACKING IN'}
                  </div>
                  <div className="absolute right-4 bottom-10 w-24 h-3" style={{ background: `repeating-linear-gradient(90deg, ${ORANGE} 0 1px, transparent 1px 4px)` }} />
                </>
              )}
            </div>
          );
        })()}

        {/* THE MOVE: giant cropped name → pull-back (expo) → overshoot 4% → snap → 2-frame hold → impact tear */}
        {rect && t >= NAME_T && t < IMPACT_T + 0.14 && (() => {
          const k = expoOut((t - NAME_T) / PULL);
          const big = (vw * 2.6) / rect.width;
          let S = big + (0.96 - big) * k;
          if (t >= LAND_T) S = 0.96 + 0.04 * backOut((t - LAND_T) / SNAP);
          const tx = (vw / 2 - cx) * (1 - k) + vw * 0.18 * (1 - k);
          const ty = (vh / 2 - cy) * (1 - k);
          const slice = (1 - k) * 90;
          const sp = t < IMPACT_T ? 10 * (0.4 + (1 - k) * 2.2) : 0; // split slams shut on impact
          const tearBand = 3;
          const tear = t >= IMPACT_T && t < IMPACT_T + 0.1 ? 34 : 0;
          return (
            <div
              className="absolute font-cyber font-bold uppercase"
              style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height, fontSize: rect.fontSize, letterSpacing: rect.letterSpacing, lineHeight: rect.lineHeight, transform: `translate(${tx}px, ${ty}px) scale(${S})`, transformOrigin: 'center' }}
            >
              {Array.from({ length: 6 }).map((_, b2) => (
                <div key={b2} className="absolute inset-0 text-center" style={{ clipPath: `inset(${b2 * (100 / 6)}% 0 ${100 - (b2 + 1) * (100 / 6)}% 0)`, transform: `translateX(${(Math.sin(b2 * 3.1 + t * 22) * slice) / S + (b2 === tearBand ? tear : 0)}px)` }}>
                  <span className="absolute inset-0" style={{ color: CYA, transform: `translateX(${(-sp / S) * 3}px)`, mixBlendMode: 'screen' }}>{NAME}</span>
                  <span className="absolute inset-0" style={{ color: MAG, transform: `translateX(${(sp / S) * 3}px)`, mixBlendMode: 'screen' }}>{NAME}</span>
                  <span className="absolute inset-0" style={{ color: YEL }}>{t - NAME_T < 0.12 ? scramble(NAME, (t - NAME_T) / 0.12) : NAME}</span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* impact line under the name */}
        {rect && t > IMPACT_T && t < IMPACT_T + 0.35 && (
          <div className="absolute h-[3px]" style={{ left: cx, top: rect.top + rect.height + 10, width: expoOut((t - IMPACT_T) / 0.2) * rect.width * 1.2, transform: 'translateX(-50%)', background: ORANGE, opacity: 1 - clamp((t - IMPACT_T - 0.2) / 0.15) }} />
        )}
      </div>
    </div>
  );
}

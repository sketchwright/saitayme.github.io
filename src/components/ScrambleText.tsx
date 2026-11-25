import { useEffect, useRef, useState } from 'react';

const GLYPHS = '!<>-_\\/[]{}—=+*^?#ABCDEF0123456789';

/**
 * Cyberpunk "decrypt" text: characters resolve from random glyphs left to right
 * the first time the element scrolls into view. Respects prefers-reduced-motion.
 */
export default function ScrambleText({
  text,
  className = '',
  duration = 900,
  as: Tag = 'span',
}: {
  text: string;
  className?: string;
  duration?: number;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'p';
}) {
  const [out, setOut] = useState(text);
  const ref = useRef<HTMLElement | null>(null);
  const played = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    let raf = 0;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || played.current) return;
        played.current = true;
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const resolved = Math.floor(t * text.length);
          let s = '';
          for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (i < resolved || ch === ' ') s += ch;
            else s += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          }
          setOut(s);
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [text, duration]);

  return (
    <Tag ref={ref as never} className={className} aria-label={text}>
      <span aria-hidden>{out}</span>
    </Tag>
  );
}

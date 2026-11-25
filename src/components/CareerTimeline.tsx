import { useRef } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { ACCENT_MKT, BRAND_ORANGE } from '@/theme';

type Stop = {
  when: string;
  role: string;
  org: string;
  line: string;
  track: 'build' | 'grow' | 'edu';
  now?: boolean;
};

/** Chronological: the scroll fill travels toward the present and ends on NOW. One short line per stop. */
const STOPS_NEWEST_FIRST: Stop[] = [
  { when: 'Oct 2026 – now', role: 'Marketing Engineer', org: 'Ingame Studios', track: 'grow', now: true, line: 'Mayhem À La Carte marketing + the tools behind it (IGS Outreach, AI content pipeline).' },
  { when: '2026', role: 'ModKit tutorials & streams', org: 'Crime Boss: Rockay City', track: 'grow', line: '11-part tutorial series and website; the content worked, so marketing came calling.' },
  { when: 'Oct 2025 – Sep 2026', role: 'Game Developer', org: 'Ingame Studios', track: 'build', line: '50+ fixes in Crime Boss Update 20, ModKit moddability, EOS multiplayer.' },
  { when: 'Mar – Jun 2025', role: 'Game Developer', org: 'nerdmonkeys', track: 'build', line: 'NOK sound system, Unity tools, Red Cross client project.' },
  { when: '2022 – 2025', role: 'BSc Mediatechnology & Design', org: 'FH Hagenberg', track: 'edu', line: 'Games, media and web engineering.' },
];

const STOPS = [...STOPS_NEWEST_FIRST].reverse();

const TRACK_COLOR = { build: BRAND_ORANGE, grow: ACCENT_MKT, edu: '#6b7280' } as const;

/** Single source of truth for the rail's x position: line, fill and dots all use it. */
const RAIL = 11; // px from the left edge of the list

export default function CareerTimeline() {
  const ref = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 85%', 'end 55%'] });
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });

  return (
    <>
    <p className="mb-5 text-sm font-mono text-gray-400">
      <span className="text-gray-500 uppercase tracking-[0.2em] text-[11px] mr-2">Currently</span>
      <span className="text-white font-semibold">Marketing Engineer</span>
      <span className="text-gray-600"> · </span>
      <span className="text-primary">Ingame Studios</span>
      <span className="text-gray-600"> · </span>
      <span>since Oct 2026</span>
    </p>
    <ol ref={ref} className="relative" style={{ ['--rail' as string]: `${RAIL}px` }}>
      {/* base line */}
      <span aria-hidden data-timeline-line className="absolute top-2 bottom-2 w-px bg-primary/20" style={{ left: 'var(--rail)', transform: 'translateX(-50%)' }} />
      {/* scroll fill (scaleY only, so it never shifts horizontally) */}
      <span aria-hidden className="absolute top-2 bottom-2 w-[2px]" style={{ left: 'var(--rail)', transform: 'translateX(-50%)' }}>
        <motion.span
          className="block w-full h-full origin-top"
          style={{ scaleY: fill, background: `linear-gradient(to bottom, #6b7280, ${BRAND_ORANGE} 45%, ${ACCENT_MKT})` }}
        />
      </span>

      {STOPS.map((s) => {
        const c = TRACK_COLOR[s.track];
        return (
          <li key={s.when + s.role} className="relative py-3 pr-2" style={{ paddingLeft: 'calc(var(--rail) + 24px)' }}>
            {/* dot: static centring wrapper, animated inner element */}
            <span
              aria-hidden
              data-timeline-dot
              className="absolute w-3.5 h-3.5"
              style={{ left: 'var(--rail)', top: '1.55rem', transform: 'translate(-50%, -50%)' }}
            >
              <motion.span
                className="block w-full h-full rounded-full border-2"
                style={{ borderColor: c, background: s.now ? c : '#0a0a0a' }}
                initial={{ scale: 0.4, opacity: 0.4 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true, margin: '-35% 0px -35% 0px' }}
                transition={{ type: 'spring', stiffness: 320, damping: 16 }}
              />
              {s.now && <span className="absolute inset-[-5px] rounded-full border animate-ping" style={{ borderColor: c }} />}
            </span>

            <div className={`grid grid-cols-1 sm:grid-cols-[150px_minmax(0,1fr)] gap-x-5 gap-y-0.5 items-baseline rounded-lg px-3 py-2 ${s.now ? 'bg-primary/[0.07] ring-1 ring-primary/40' : ''}`}>
              <span className="text-xs font-mono text-gray-500 whitespace-nowrap">
                {s.when}
                {s.now && <span className="ml-2 text-[9px] font-cyber tracking-[0.2em] px-1.5 py-0.5 rounded bg-primary text-cyber-black align-middle">NOW</span>}
              </span>
              <div className="min-w-0">
                <p className="text-[15px] leading-snug">
                  <span className="font-semibold text-white">{s.role}</span>
                  <span className="text-gray-600"> · </span>
                  <span className="text-primary">{s.org}</span>
                </p>
                <p className="text-sm text-gray-400 leading-snug">{s.line}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
    </>
  );
}

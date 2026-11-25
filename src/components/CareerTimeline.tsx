import { useRef } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'framer-motion';

type Stop = {
  when: string;
  title: string;
  org: string;
  track: 'build' | 'grow' | 'edu';
  lines: string[];
  now?: boolean;
};

const STOPS: Stop[] = [
  { when: '2022 – 2025', title: 'BSc Mediatechnology & Design', org: 'FH Hagenberg', track: 'edu', lines: ['Games, media and web engineering', 'Game jams: Scalien (GMTK 2024), Five Nights at Furbys'] },
  { when: 'Mar – Jun 2025', title: 'Game Developer', org: 'nerdmonkeys', track: 'build', lines: ['NOK sound system, Unity editor tools', 'Client work for the Portuguese Red Cross'] },
  { when: 'Oct 2025', title: 'Game Developer', org: 'Ingame Studios', track: 'build', lines: ['50+ fixes in Crime Boss Update 20', 'ModKit moddability, EOS multiplayer framework'] },
  { when: '2026', title: 'ModKit tutorials & streams', org: 'Crime Boss community', track: 'grow', lines: ['11-part tutorial series + docs site', 'The content worked, so marketing came calling'] },
  { when: 'Oct 2026 →', title: 'Marketing Engineer', org: 'Ingame Studios · Mayhem À La Carte', track: 'grow', now: true, lines: ['Social, reveal, creators, streams, website', 'Built IGS Outreach and an agentic content pipeline', 'Still shipping code: recipe pipeline, co-op framework'] },
];

const TRACK_COLOR = { build: '#f07e41', grow: '#fcee0a', edu: '#9ca3af' } as const;
const TRACK_LABEL = { build: 'BUILD', grow: 'GROW', edu: 'LEARN' } as const;

export default function CareerTimeline() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 80%', 'end 60%'] });
  const fill = useSpring(useTransform(scrollYProgress, [0, 1], [0, 1]), { stiffness: 120, damping: 24 });

  return (
    <div ref={ref} className="relative">
      {/* spine */}
      <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-primary/15 md:-translate-x-1/2" />
      <motion.div
        className="absolute left-4 md:left-1/2 top-0 w-[2px] md:-translate-x-1/2 origin-top"
        style={{ scaleY: fill, height: '100%', background: 'linear-gradient(to bottom, #9ca3af, #f07e41 45%, #fcee0a)', boxShadow: '0 0 12px rgba(240,126,65,0.6)' }}
      />
      <ol className="space-y-8 md:space-y-10">
        {STOPS.map((s, i) => {
          const left = i % 2 === 0;
          const c = TRACK_COLOR[s.track];
          return (
            <li key={s.when + s.title} className={`relative md:grid md:grid-cols-2 md:gap-12 ${i > 0 ? 'md:-mt-20' : ''}`}>
              {/* node */}
              <motion.span
                className="absolute left-4 md:left-1/2 top-3 -translate-x-1/2 w-4 h-4 rounded-full border-2 bg-cyber-black z-10"
                style={{ borderColor: c }}
                initial={{ scale: 0 }}
                whileInView={{ scale: 1, boxShadow: `0 0 0 4px ${c}22, 0 0 16px ${c}` }}
                viewport={{ once: true, margin: '-30% 0px -30% 0px' }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              >
                {s.now && <span className="absolute -inset-2 rounded-full border animate-ping" style={{ borderColor: c }} />}
              </motion.span>
              <motion.div
                className={`pl-12 md:pl-0 ${left ? 'md:col-start-1 md:text-right md:pr-4' : 'md:col-start-2 md:pl-4'}`}
                initial={{ opacity: 0, x: left ? -24 : 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              >
                <div
                  className={`inline-block text-left rounded-lg border bg-black/50 p-4 md:p-5 w-full max-w-md transition-shadow hover:shadow-[0_0_24px_rgba(240,126,65,0.15)] ${s.now ? 'bg-primary/[0.06]' : ''}`}
                  style={{ borderColor: `${c}55` }}
                >
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="text-[11px] font-mono text-gray-400">{s.when}</span>
                    <span className="text-[9px] font-cyber tracking-[0.25em] px-1.5 py-0.5 rounded" style={{ color: c, background: `${c}18` }}>
                      {s.now ? 'NOW · ' : ''}{TRACK_LABEL[s.track]}
                    </span>
                  </div>
                  <h4 className="font-cyber text-base md:text-lg" style={{ color: s.track === 'edu' ? '#e5e7eb' : c }}>{s.title}</h4>
                  <p className="text-xs font-mono text-gray-400 mb-2">{s.org}</p>
                  <ul className="space-y-1">
                    {s.lines.map((l) => (
                      <li key={l} className="text-sm text-gray-300 flex gap-2">
                        <span style={{ color: c }}>›</span>
                        <span>{l}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

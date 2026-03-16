import { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const IMPACT_ITEMS = [
  { type: 'SHIPPED', value: 'Crime Boss: Rockay City' },
  { type: 'SHIPPED', value: 'NOK (Steam)' },
  { type: 'ENGINE', value: 'Unreal Engine' },
  { type: 'ENGINE', value: 'Unity' },
  { type: 'SPECIALTY', value: 'Gameplay / Systems / Multiplayer' },
];

const EMPHASIS_INTERVAL_MS = 5000;
const EMPHASIS_DURATION_MS = 1200;

interface ImpactStripProps {
  compact?: boolean;
}

export default function ImpactStrip({ compact }: ImpactStripProps) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const sectionRef = useRef<HTMLElement>(null);
  useInView(sectionRef, { once: true, amount: 0.3 });

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((i) => {
        const next = (i + 1) % IMPACT_ITEMS.length;
        return next;
      });
    }, EMPHASIS_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeIndex < 0) return;
    const t = setTimeout(() => setActiveIndex(-1), EMPHASIS_DURATION_MS);
    return () => clearTimeout(t);
  }, [activeIndex]);

  return (
    <motion.section
      ref={sectionRef}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: compact ? '-20px' : '-80px' }}
      transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`relative overflow-hidden ${compact ? 'py-3 md:py-4' : 'py-16 md:py-20'}`}
    >
      <div className="cyber-container relative z-10">
        <div className="flex flex-wrap justify-center gap-3 md:gap-4">
          {IMPACT_ITEMS.map((item, idx) => (
            <motion.div
              key={`${item.type}-${item.value}`}
              className={`
                relative rounded-lg border px-4 py-3 md:px-5 md:py-3.5
                flex items-center gap-3 min-w-0
                transition-colors duration-500
                ${activeIndex === idx
                  ? 'border-primary/70 bg-primary/10 shadow-[0_0_24px_rgba(240,126,65,0.15)]'
                  : 'border-primary/25 bg-cyber-dark/80 hover:border-primary/40'
                }
              `}
            >
              {/* Glowing indicator dot */}
              <span
                className={`shrink-0 w-2 h-2 rounded-full transition-all duration-500 ${
                  activeIndex === idx ? 'bg-primary shadow-[0_0_8px_rgba(240,126,65,0.8)]' : 'bg-primary/50'
                }`}
              />
              <div className="min-w-0">
                <span className="text-[10px] md:text-xs font-mono text-primary/80 uppercase tracking-wider block">
                  {item.type}
                </span>
                <span className="text-sm md:text-base font-cyber text-white truncate block">
                  {item.value}
                </span>
              </div>
              {/* One-time scanline sweep when this segment is active */}
              {activeIndex === idx && (
                <motion.div
                  className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none"
                  initial={false}
                >
                  <div
                    className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/60 to-transparent"
                    style={{ animation: 'impact-scan-sweep 1.2s ease-out forwards' }}
                  />
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

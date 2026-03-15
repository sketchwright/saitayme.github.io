import { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const QUOTES = [
  'Julian solved several complex gameplay issues extremely quickly.',
  'Excellent debugging and replication skills.',
  'Strong systems thinking and clear communication.',
];

const TYPING_MS_PER_CHAR = 28;
const HOLD_AFTER_TYPING_MS = 2200;
const CYCLE_MS = 8000;

function TypingQuote({ text, isActive, onDone }: { text: string; isActive: boolean; onDone: () => void }) {
  const [visibleLength, setVisibleLength] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'typing' | 'hold'>('idle');

  useEffect(() => {
    if (!isActive) {
      setVisibleLength(0);
      setPhase('idle');
      return;
    }
    setPhase('typing');
    setVisibleLength(0);
  }, [isActive, text]);

  useEffect(() => {
    if (phase !== 'typing' || visibleLength >= text.length) {
      if (phase === 'typing' && visibleLength >= text.length) {
        setPhase('hold');
        const t = setTimeout(() => {
          onDone();
        }, HOLD_AFTER_TYPING_MS);
        return () => clearTimeout(t);
      }
      return;
    }
    const t = setTimeout(() => setVisibleLength((n) => Math.min(n + 1, text.length)), TYPING_MS_PER_CHAR);
    return () => clearTimeout(t);
  }, [phase, visibleLength, text.length, onDone]);

  if (!isActive) return null;
  return (
    <p className="text-gray-200 text-sm md:text-base leading-relaxed">
      &ldquo;{text.slice(0, visibleLength)}
      {visibleLength < text.length && <span className="text-primary animate-pulse">|</span>}
      &rdquo;
    </p>
  );
}

export default function QuoteWall() {
  const sectionRef = useRef<HTMLElement>(null);
  useInView(sectionRef, { once: true, amount: 0.2 });
  const [activeIndex, setActiveIndex] = useState(0);
  const [key, setKey] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setActiveIndex((i) => (i + 1) % QUOTES.length);
      setKey((k) => k + 1);
    }, CYCLE_MS);
    return () => clearInterval(t);
  }, []);

  const visibleQuotes = [activeIndex, (activeIndex + 1) % QUOTES.length].map((i) => QUOTES[i]);

  return (
    <motion.section
      ref={sectionRef}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="py-20 md:py-28 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyber-black/30 to-transparent pointer-events-none" />
      <div className="cyber-container relative z-10">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-2xl md:text-3xl font-cyber text-primary uppercase tracking-wider mb-12"
        >
          Recommendations
        </motion.h2>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl">
          {visibleQuotes.map((quote, i) => (
            <motion.div
              key={`${key}-${i}`}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="rounded-xl border border-primary/25 bg-cyber-dark/60 p-6 relative overflow-hidden"
              style={{
                y: i === 0 ? 0 : 8,
              }}
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary/50 to-transparent opacity-60" />
              <TypingQuote
                text={quote}
                isActive={i === 0}
                onDone={() => {}}
              />
              <p className="text-xs font-mono text-primary/50 mt-4 uppercase tracking-wider">
                Collaborator / Lead
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

import { motion } from 'framer-motion';

const QUOTES = [
  'Julian solved several complex gameplay issues extremely quickly.',
  'Excellent debugging and replication skills.',
  'Strong systems thinking and clear communication.',
];

const EASE = [0.22, 0.61, 0.36, 1];
const STAGGER = 0.12;

function QuoteCard({ quote, index }: { quote: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.65, delay: index * STAGGER, ease: EASE }}
      className="relative rounded-xl overflow-hidden quote-card-flex"
    >
      {/* Soft scanlines — matches holo-ad-panel */}
      <div
        className="absolute inset-0 pointer-events-none z-[1] opacity-[0.35]"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 4px)',
        }}
        aria-hidden
      />
      {/* Top accent — primary gradient like carousel */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 z-[2]"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(240,126,65,0.6) 50%, transparent 100%)',
          boxShadow: '0 0 12px rgba(240,126,65,0.35)',
        }}
      />
      <div className="relative px-6 md:px-8 py-8 md:py-10 z-[2]">
        <p className="text-gray-100 text-lg md:text-xl leading-relaxed font-medium">
          &ldquo;{quote}&rdquo;
        </p>
        <p
          className="text-xs font-mono uppercase tracking-[0.2em] mt-6 font-semibold"
          style={{ color: 'rgba(240, 126, 65, 0.85)' }}
        >
          Collaborator / Lead
        </p>
      </div>
    </motion.div>
  );
}

export default function QuoteWall() {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: EASE }}
      className="py-24 md:py-32 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyber-black/20 to-transparent pointer-events-none" />
      <div className="cyber-container relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.05, ease: EASE }}
          className="mb-14 md:mb-16"
        >
          <h2 className="text-2xl md:text-3xl font-cyber text-primary uppercase tracking-wider mb-2">
            Recommendations
          </h2>
          <p className="text-gray-400 font-mono text-sm">
            What collaborators and leads say
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-6xl">
          {QUOTES.map((quote, index) => (
            <QuoteCard key={index} quote={quote} index={index} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}

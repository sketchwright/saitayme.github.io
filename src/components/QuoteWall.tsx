import { motion } from 'framer-motion';

type Recommendation = {
  quote: string;
  /** Person's name (omit for generic attribution) */
  name?: string;
  /** Primary line under quote (e.g. role / title) */
  role: string;
  /** Optional second line — games / context */
  credits?: string;
};

const RECOMMENDATIONS: Recommendation[] = [
  {
    quote:
      "I enjoyed working with Julian! He's responsible, proactive and fast at implementing new technologies.",
    name: 'Alexey Sytianov',
    role: 'Lead Game Designer & Writer — S.T.A.L.K.E.R.',
    credits: 'Metro Exodus · Chernobylite',
  },
  {
    quote: 'Julian solved several complex gameplay issues extremely quickly.',
    role: 'Collaborator / Lead',
  },
  {
    quote: 'Excellent debugging and replication skills.',
    role: 'Collaborator / Lead',
  },
  {
    quote: 'Strong systems thinking and clear communication.',
    role: 'Collaborator / Lead',
  },
];

const EASE = [0.22, 0.61, 0.36, 1];
const STAGGER = 0.12;

function QuoteCard({ item, index }: { item: Recommendation; index: number }) {
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
          &ldquo;{item.quote}&rdquo;
        </p>
        <div className="mt-6 space-y-1">
          {item.name && (
            <p className="text-sm font-cyber text-white tracking-wide">{item.name}</p>
          )}
          <p
            className="text-xs font-mono uppercase tracking-[0.2em] font-semibold"
            style={{ color: 'rgba(240, 126, 65, 0.85)' }}
          >
            {item.role}
          </p>
          {item.credits && (
            <p className="text-xs font-mono text-gray-500 tracking-wide pt-0.5">{item.credits}</p>
          )}
        </div>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 max-w-7xl">
          {RECOMMENDATIONS.map((item, index) => (
            <QuoteCard key={index} item={item} index={index} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}

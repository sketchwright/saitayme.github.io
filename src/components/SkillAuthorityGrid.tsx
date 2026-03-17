import { useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const SKILLS = [
  {
    label: 'Gameplay',
    bullets: ['Blueprint & C++', 'Abilities & items', 'Mission logic', 'Production debugging'],
  },
  {
    label: 'Networking',
    bullets: ['EOS sessions', 'Replication debugging', 'Lobby architecture', 'Dedicated servers'],
  },
  {
    label: 'AI',
    bullets: ['Behavior systems', 'State machines', 'Navigation', 'Performance'],
  },
  {
    label: 'Systems',
    bullets: ['Subsystems', 'Data-driven design', 'Moddable architecture', 'APIs'],
  },
  {
    label: 'Tools',
    bullets: ['Editor extensions', 'Pipelines', 'Modkits', 'Technical docs'],
  },
];

export default function SkillAuthorityGrid() {
  const [hovered, setHovered] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  useInView(sectionRef, { once: true, amount: 0.15 });

  return (
    <motion.section
      ref={sectionRef}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6 }}
      className="py-20 md:py-28 relative"
    >
      <div className="cyber-container relative z-10">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-2xl md:text-3xl font-cyber text-primary uppercase tracking-wider mb-4"
        >
          Technical Authority
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-gray-400 font-mono text-sm mb-12"
        >
          Depth across gameplay, networking, and engine systems
        </motion.p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {SKILLS.map((skill, idx) => (
            <motion.div
              key={skill.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.06 }}
              onMouseEnter={() => setHovered(idx)}
              onMouseLeave={() => setHovered(null)}
              className={`
                rounded-xl border p-5 min-h-[120px] md:min-h-[140px] flex flex-col justify-between
                transition-colors duration-300
                ${hovered === idx
                  ? 'border-primary/60 bg-primary/5 shadow-[0_0_24px_rgba(240,126,65,0.08)]'
                  : 'border-primary/25 bg-cyber-dark/60 hover:border-primary/40'
                }
              `}
              whileHover={{ scale: 1.02, y: -4, transition: { type: 'spring', stiffness: 300, damping: 20 } }}
            >
              <h3 className="text-sm font-cyber text-primary uppercase tracking-wider">
                {skill.label}
              </h3>
              {hovered === idx && (
                <motion.ul
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.25 }}
                  className="mt-3 space-y-1 text-gray-300 text-xs font-mono"
                >
                  {skill.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-1.5">
                      <span className="text-primary/60">·</span>
                      {b}
                    </li>
                  ))}
                </motion.ul>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

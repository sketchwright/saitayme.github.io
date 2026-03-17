import { useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';

/** Skills from CV: Programming, Engines, Multiplayer, Gameplay, Tools */
const SKILLS = [
  {
    label: 'Programming',
    bullets: ['C++', 'C#', 'Blueprint'],
  },
  {
    label: 'Engines',
    bullets: ['Unity', 'Unreal'],
  },
  {
    label: 'Multiplayer',
    bullets: ['Replication', 'JIP', 'EOS', 'Photon'],
  },
  {
    label: 'Gameplay',
    bullets: ['GAS', 'Gameplay Tags', 'Abilities & items', 'Mission logic', 'Production debugging'],
  },
  {
    label: 'Tools',
    bullets: ['Git', 'SVN', 'Perforce', 'Jira', 'Confluence'],
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
      className="py-20 md:py-28 pb-32 md:pb-40 relative"
    >
      <div className="cyber-container relative z-10">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-2xl md:text-3xl font-cyber text-primary uppercase tracking-wider mb-4"
        >
          Skills
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-gray-400 font-mono text-sm mb-12"
        >
          Programming, engines, multiplayer, and tools
        </motion.p>
        {/* Grid items have min-height so expanded cards don't push content below */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 [grid-auto-rows:minmax(220px,auto)]">
          {SKILLS.map((skill, idx) => (
            <motion.div
              key={skill.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.06 }}
              className="min-h-[220px] flex flex-col"
            >
              <motion.div
                className={`
                  rounded-xl border p-5 min-h-[120px] w-full flex flex-col flex-shrink-0
                  transition-colors duration-300
                  ${hovered === idx
                    ? 'border-primary/60 bg-primary/5 shadow-[0_0_24px_rgba(240,126,65,0.08)]'
                    : 'border-primary/25 bg-cyber-dark/60 hover:border-primary/40'
                  }
                `}
                onMouseEnter={() => setHovered(idx)}
                onMouseLeave={() => setHovered(null)}
                whileHover={{ scale: 1.02, y: -4 }}
              >
                <h3 className="text-sm font-cyber text-primary uppercase tracking-wider">
                  {skill.label}
                </h3>
                {hovered === idx ? (
                  <motion.ul
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="mt-3 space-y-1 text-gray-300 text-xs font-mono list-none"
                  >
                    {skill.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-1.5">
                        <span className="text-primary/60">·</span>
                        {b}
                      </li>
                    ))}
                  </motion.ul>
                ) : null}
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

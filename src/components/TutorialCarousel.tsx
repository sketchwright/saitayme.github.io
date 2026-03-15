import { useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { FaPlay } from 'react-icons/fa';

const TUTORIALS = [
  { title: 'Crime Boss Modkit – Blueprint setup', tag: 'Modding' },
  { title: 'Unreal replication debugging', tag: 'Engine' },
  { title: 'EOS session & lobby flow', tag: 'Networking' },
  { title: 'DataTable-driven gameplay', tag: 'Systems' },
  { title: 'Editor tools pipeline', tag: 'Tools' },
];

export default function TutorialCarousel() {
  const sectionRef = useRef<HTMLElement>(null);
  useInView(sectionRef, { once: true, amount: 0.1 });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <motion.section
      ref={sectionRef}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6 }}
      className="py-20 md:py-28 relative overflow-hidden"
    >
      <div className="cyber-container relative z-10">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-2xl md:text-3xl font-cyber text-primary uppercase tracking-wider mb-4"
        >
          Modding & Tutorials
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-gray-400 font-mono text-sm mb-12"
        >
          Guides and community content
        </motion.p>
        <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
          {TUTORIALS.map((item, idx) => (
            <motion.article
              key={item.title}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="flex-shrink-0 w-[240px] md:w-[280px] rounded-xl border border-primary/25 bg-cyber-dark/80 overflow-hidden group cursor-pointer"
              whileHover={{ y: -6, borderColor: 'rgba(240,126,65,0.4)', boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }}
            >
              <div className="relative aspect-video bg-cyber-black flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-50" />
                <motion.div
                  className="relative z-10 rounded-full border-2 border-primary/60 bg-primary/20 p-4 flex items-center justify-center"
                  animate={{ scale: hoveredIndex === idx ? 1.1 : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <FaPlay className="text-primary text-lg ml-0.5" />
                </motion.div>
                <span className="absolute bottom-2 left-2 text-[10px] font-mono text-primary/70 uppercase tracking-wider">
                  {item.tag}
                </span>
              </div>
              <div className="p-4 border-t border-primary/20">
                <h3 className="text-sm font-cyber text-white group-hover:text-primary/90 transition-colors">
                  {item.title}
                </h3>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

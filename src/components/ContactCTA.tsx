import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function ContactCTA() {
  const sectionRef = useRef<HTMLElement>(null);
  useInView(sectionRef, { once: true, amount: 0.2 });

  return (
    <motion.section
      ref={sectionRef}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="py-24 md:py-32 relative overflow-hidden"
    >
      {/* Subtle terminal connection lines behind */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[200px] opacity-20">
          <svg viewBox="0 0 400 200" className="w-full h-full">
            <defs>
              <linearGradient id="cta-line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="transparent" />
                <stop offset="50%" stopColor="rgb(240,126,65)" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
            <motion.path
              d="M 50 100 Q 200 80 350 100"
              fill="none"
              stroke="url(#cta-line-grad)"
              strokeWidth="0.5"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 0.5 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
            <motion.path
              d="M 50 100 Q 200 120 350 100"
              fill="none"
              stroke="url(#cta-line-grad)"
              strokeWidth="0.5"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 0.35 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.12, ease: 'easeOut' }}
            />
          </svg>
        </div>
      </div>
      <div className="cyber-container relative z-10 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-2xl md:text-4xl font-cyber text-white mb-4"
        >
          Interested in working together?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-gray-400 font-mono text-sm md:text-base mb-10 max-w-lg mx-auto"
        >
          View projects or get in touch for opportunities in gameplay, systems, or multiplayer.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link to="/projects">
            <motion.button
              className="cyber-button primary-button px-8 py-3 text-base"
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              View Projects
            </motion.button>
          </Link>
          <Link to="/contact">
            <motion.button
              className="cyber-button secondary-button px-8 py-3 text-base"
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              Contact Me
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </motion.section>
  );
}

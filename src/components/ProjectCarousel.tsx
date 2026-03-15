import { useState, useRef, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { Project } from '@/data/projects';
import { getProjectsBySection } from '@/data/projects';
import { projects } from '@/data/projects';

const DRIFT_PIXELS_PER_SEC = 12;
const CAROUSEL_PAUSE_ON_HOVER = true;

function CarouselCard({ project, index }: { project: Project; index: number }) {
  const firstImpact = project.impact?.[0] ?? project.shortDescription ?? project.description.slice(0, 60);
  const secondImpact = project.impact?.[1];

  return (
    <Link to="/projects" className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <motion.article
        className="relative h-full rounded-xl border border-primary/30 bg-cyber-dark/90 overflow-hidden flex flex-col w-[300px] flex-shrink-0"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: index * 0.08 }}
        whileHover={{
          y: -8,
          transition: { duration: 0.3, ease: 'easeOut' },
          boxShadow: '0 20px 40px rgba(0,0,0,0.4), 0 0 32px rgba(240,126,65,0.12)',
          borderColor: 'rgba(240,126,65,0.5)',
        }}
      >
        <div className="relative aspect-video overflow-hidden bg-cyber-black">
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            whileHover={{ scale: 1.06 }}
            transition={{ duration: 0.4 }}
          >
            <img
              src={project.thumbnail}
              alt={project.title}
              className="w-full h-full object-cover"
            />
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-t from-cyber-black via-transparent to-transparent opacity-80" />
          <div className="absolute bottom-2 left-3 right-3">
            <h3 className="font-cyber text-lg text-white drop-shadow-lg">{project.title}</h3>
            <p className="text-xs text-primary/90 font-mono">{project.category}</p>
          </div>
        </div>
        <div className="p-4 flex-1 flex flex-col border-t border-primary/20">
          <p className="text-xs font-mono text-primary/70 uppercase tracking-wider mb-1">
            {project.role ?? 'Developer'}
          </p>
          <p className="text-gray-200 text-sm leading-snug">{firstImpact}</p>
          {secondImpact && (
            <motion.p
              className="text-gray-400 text-sm leading-snug mt-1"
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
            >
              {secondImpact}
            </motion.p>
          )}
        </div>
      </motion.article>
    </Link>
  );
}

export default function ProjectCarousel() {
  const sectionRef = useRef<HTMLElement>(null);
  useInView(sectionRef, { once: true, amount: 0.1 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [scrollLeft, setScrollLeft] = useState(0);

  const featured = getProjectsBySection(projects).featured.slice(0, 6);
  const cardWidth = 300;
  const gap = 24;
  const totalWidth = featured.length * (cardWidth + gap);

  useEffect(() => {
    if (featured.length === 0) return;
    let rafId: number;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!CAROUSEL_PAUSE_ON_HOVER || !isHovering) {
        setScrollLeft((s) => {
          const next = s + DRIFT_PIXELS_PER_SEC * dt;
          return next >= totalWidth ? next % totalWidth : next;
        });
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isHovering, featured.length, totalWidth]);

  return (
    <motion.section
      ref={sectionRef}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6 }}
      className="py-20 md:py-28 relative overflow-hidden"
    >
      <div className="cyber-container relative z-10 mb-10">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-2xl md:text-3xl font-cyber text-primary uppercase tracking-wider"
        >
          Featured Work
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-gray-400 font-mono text-sm mt-2"
        >
          Shipped titles and production systems
        </motion.p>
      </div>
      <div
        ref={scrollRef}
        className="overflow-hidden"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <motion.div
          className="flex gap-6 pb-4"
          initial={false}
          style={{
            width: totalWidth * 3,
            x: -scrollLeft,
          }}
        >
          {[...featured, ...featured, ...featured].map((project, i) => (
            <div key={`${project.id}-${i}`} className="flex-shrink-0 flex justify-center">
              <CarouselCard project={project} index={i % featured.length} />
            </div>
          ))}
        </motion.div>
      </div>
      <div className="cyber-container mt-6 text-center">
        <Link
          to="/projects"
          className="text-sm font-mono text-primary/80 hover:text-primary transition-colors"
        >
          View all projects →
        </Link>
      </div>
    </motion.section>
  );
}

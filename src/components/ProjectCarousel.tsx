import { useState, useRef, useEffect } from 'react';
import { motion, useInView, useMotionValue } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { Project } from '@/data/projects';
import { getProjectsBySection } from '@/data/projects';
import { projects } from '@/data/projects';

const DRIFT_PIXELS_PER_SEC = 12;
const CAROUSEL_PAUSE_ON_HOVER = true;

function CarouselCard({ project }: { project: Project }) {
  const firstImpact = project.headline ?? project.impact?.[0] ?? project.shortDescription ?? project.description.slice(0, 60);
  const secondImpact = project.badge;

  return (
    <Link to="/projects" className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <motion.article
        className="relative h-full rounded-xl border border-primary/30 bg-cyber-dark/90 overflow-hidden flex flex-col w-[300px] flex-shrink-0"
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
              className={`w-full h-full ${/mayhem\/logo|ingame-studios|nerd-monkeys/.test(project.thumbnail) ? 'object-contain p-6' : 'object-cover'}`}
              style={{ objectPosition: project.thumbnailPosition }}
              loading="lazy"
              decoding="async"
            />
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-t from-cyber-black via-transparent to-transparent opacity-80" />
          <div className="absolute bottom-2 left-3 right-3 flex flex-col gap-0.5">
            <div className="inline-flex w-fit max-w-full flex-col gap-0.5 rounded-md border border-primary/50 border-l-4 border-l-primary bg-black/75 px-3 py-1.5 shadow-[0_0_18px_rgba(240,126,65,0.18),0_2px_12px_rgba(0,0,0,0.6)]">
              <h3 className="font-cyber text-lg text-white leading-tight tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{project.title}</h3>
              <p className="text-xs text-primary font-mono uppercase tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{project.category}</p>
            </div>
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
  const x = useMotionValue(0);

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
        // Motion value: moves the strip without re-rendering React every frame.
        const next = -x.get() + DRIFT_PIXELS_PER_SEC * dt;
        x.set(-(next >= totalWidth ? next % totalWidth : next));
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isHovering, featured.length, totalWidth, x]);

  return (
    <motion.section
      ref={sectionRef}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6 }}
      className="pt-14 md:pt-16 pb-10 md:pb-12 relative"
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
          Shipped games, marketing tools and production systems
        </motion.p>
      </div>
      <div className="cyber-container">
        <div
          ref={scrollRef}
          className="holo-ad-panel overflow-hidden rounded-xl relative"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <motion.div
            className="flex gap-6 py-6 px-4 md:px-6 relative z-[1]"
            initial={false}
            style={{
              width: totalWidth * 3,
              x,
            }}
          >
            {[...featured, ...featured, ...featured].map((project, i) => (
              <div key={`${project.id}-${i}`} className="flex-shrink-0 flex justify-center">
                <CarouselCard project={project} />
              </div>
            ))}
          </motion.div>
        </div>
      </div>
      <div className="cyber-container mt-6 text-center">
        <Link
          to="/projects"
          className="inline-block py-3 px-2 text-sm font-mono text-primary/80 hover:text-primary transition-colors"
        >
          View all projects →
        </Link>
      </div>
    </motion.section>
  );
}

import { useState, useRef, useEffect } from 'react';
import { motion, useSpring } from 'framer-motion';
import { Project } from '../data/projects';
import { DiUnitySmall } from 'react-icons/di';
import { SiUnrealengine } from 'react-icons/si';
import { MdCampaign } from 'react-icons/md';

const PROJECT_TYPE_LABELS: Record<string, string> = {
  Professional: 'Professional',
  Personal: 'Personal',
  'Game Jam': 'Game Jam',
  Tool: 'Tool',
  Prototype: 'Prototype',
};

const DELAYED_HOVER_MS = 780;
const MICRO_CTA = 'inspect dossier →';

interface ProjectCardProps {
  project: Project;
  onClick?: () => void;
  isSpotlight?: boolean;
  isDimmed?: boolean;
  isFeatured?: boolean;
  featuredIdleActive?: boolean;
  onHoverChange?: (hovered: boolean) => void;
  compact?: boolean;
}

const ProjectCard = ({
  project,
  onClick,
  isSpotlight = false,
  isDimmed = false,
  isFeatured: _isFeatured = false,
  featuredIdleActive = false,
  compact = false,
  onHoverChange,
}: ProjectCardProps) => {
  const EngineIcon = project.category === 'Unity' ? DiUnitySmall : project.category === 'Marketing' ? MdCampaign : SiUnrealengine;
  const summary = project.headline ?? project.shortDescription ?? project.description;
  const isLogoThumb = /ingame-studios|nerd-monkeys|mayhem\/logo/.test(project.thumbnail);
  const [showDelayedReward, setShowDelayedReward] = useState(false);
  const [sweepPlayed, setSweepPlayed] = useState(false);
  const delayedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    onHoverChange?.(true);
    delayedTimerRef.current = setTimeout(() => setShowDelayedReward(true), DELAYED_HOVER_MS);
  };

  // Holo tilt + cursor spotlight
  const cardRef = useRef<HTMLDivElement>(null);
  const tiltX = useSpring(0, { stiffness: 220, damping: 20 });
  const tiltY = useSpring(0, { stiffness: 220, damping: 20 });
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${px * 100}%`);
    el.style.setProperty('--my', `${py * 100}%`);
    tiltX.set((0.5 - py) * 7);
    tiltY.set((px - 0.5) * 9);
  };

  const handleMouseLeave = () => {
    tiltX.set(0);
    tiltY.set(0);
    onHoverChange?.(false);
    if (delayedTimerRef.current) {
      clearTimeout(delayedTimerRef.current);
      delayedTimerRef.current = null;
    }
    setShowDelayedReward(false);
  };

  useEffect(() => {
    return () => {
      if (delayedTimerRef.current) clearTimeout(delayedTimerRef.current);
    };
  }, []);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -6, transition: { duration: 0.25, ease: 'easeOut' } }}
      className={`group relative rounded-lg overflow-hidden cursor-pointer transition-all duration-300
        ${isDimmed ? 'project-card-dimmed' : ''}
        ${isSpotlight ? 'project-card-spotlight z-10 ring-2 ring-primary/60 shadow-[0_0_32px_rgba(240,126,65,0.22)]' : 'z-0'}
        ${featuredIdleActive ? 'project-card-idle-active' : ''}
        ${isSpotlight ? 'border-2 border-primary/60 bg-cyber-black/95' : 'border-2 border-primary/30 bg-cyber-black'}
      `}
      ref={cardRef}
      style={{ rotateX: tiltX, rotateY: tiltY, transformPerspective: 900 }}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Cursor-follow holo spotlight */}
      <div
        className="absolute inset-0 z-30 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 mix-blend-screen"
        style={{ background: 'radial-gradient(420px circle at var(--mx, 50%) var(--my, 50%), rgba(240,126,65,0.16), transparent 45%)' }}
        aria-hidden
      />
      {/* Thumbnail: image inset by 2px so a solid bg frame hides any seam during zoom; zoom stays inside that frame */}
      <div className="relative aspect-video overflow-hidden rounded-t-lg bg-cyber-black shrink-0 isolate">
        <div className="absolute -inset-2 bg-cyber-black pointer-events-none" aria-hidden />
        <div className="absolute -inset-2 bg-gradient-to-t from-cyber-black via-transparent to-transparent z-10 pointer-events-none" />
        <motion.div
          className="absolute inset-[2px] flex items-center justify-center origin-center rounded-t-[6px] overflow-hidden"
          style={{ willChange: 'transform', backfaceVisibility: 'hidden' as const }}
          initial={{ scale: 1.04 }}
          animate={{ scale: 1.04 }}
          whileHover={{ scale: 1.1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <img
            src={project.thumbnail}
            alt={project.title}
            loading="lazy"
            decoding="async"
            className={`w-full h-full transition-none object-center ${isLogoThumb ? 'object-contain p-4' : 'object-cover'}`}
            style={{ display: 'block', minWidth: '100%', minHeight: '100%', objectPosition: project.thumbnailPosition }}
          />
        </motion.div>
        {/* One-time faint scan sweep on first hover */}
        {isSpotlight && !sweepPlayed && (
          <div
            className="absolute inset-[2px] z-20 pointer-events-none project-thumb-sweep rounded-t-[6px] overflow-hidden"
            style={{ animation: 'project-thumb-sweep 0.55s ease-out 1 forwards' }}
            onAnimationEnd={() => setSweepPlayed(true)}
          />
        )}
        {/* Micro CTA: inspect dossier → — absolute, never affects layout */}
        <motion.div
          className="absolute bottom-3 left-4 right-4 z-20 flex items-center justify-end pointer-events-none"
          initial={false}
          animate={{ opacity: isSpotlight ? 1 : 0, y: isSpotlight ? 0 : 6 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <span className="text-[10px] font-mono text-primary/90 tracking-wider whitespace-nowrap">
            {MICRO_CTA}
          </span>
        </motion.div>

        {/* Top badges */}
        <div className="absolute top-4 left-4 z-20 flex flex-wrap gap-2">
          {project.featured && (
            <span className="bg-primary/90 text-cyber-black px-2 py-0.5 rounded text-xs font-cyber font-semibold">
              FEATURED
            </span>
          )}
          {project.projectType && (
            <span className="bg-cyber-dark/95 px-2 py-0.5 rounded text-xs font-mono text-gray-300 border border-primary/20">
              {PROJECT_TYPE_LABELS[project.projectType] ?? project.projectType}
            </span>
          )}
          {project.isSecret && (
            <span className="bg-primary/25 px-2 py-0.5 rounded text-xs font-cyber text-primary border border-primary/30">
              SECRET
            </span>
          )}
        </div>

        <div className="absolute top-4 right-4 z-20">
          <EngineIcon className="text-primary text-2xl" />
        </div>
      </div>

      {/* Content */}
      <div className={compact ? "p-4" : "p-6"}>
        <h3
          className={`${compact ? "text-base" : "text-xl"} font-cyber mb-1 transition-all duration-300
            ${isSpotlight ? 'text-primary drop-shadow-[0_0_8px_rgba(240,126,65,0.4)]' : 'text-primary group-hover:text-primary/95'}
          `}
        >
          {project.title}
        </h3>
        {(project.role || project.company) && (
          <p className="text-gray-500 text-xs font-mono mb-2">
            {[project.role, project.company].filter(Boolean).join(' · ')}
            {project.timeframe && ` · ${project.timeframe}`}
          </p>
        )}
        <p className="text-gray-200 text-[15px] leading-snug mb-4 min-h-[2.6rem] transition-colors duration-300 group-hover:text-white">
          {summary}
        </p>

        {project.badge && !compact && (
          <div className="mb-4">
            <span
              className={`inline-flex items-center gap-2 px-2.5 py-1 rounded border font-mono text-[11px] uppercase tracking-wider transition-all duration-300
                ${showDelayedReward || isSpotlight ? 'border-primary bg-primary/15 text-primary shadow-[0_0_14px_rgba(240,126,65,0.3)]' : 'border-primary/40 bg-primary/5 text-primary/90'}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {project.badge}
            </span>
          </div>
        )}

        {/* Tags: max 3, more legible on hover */}
        <div className="flex flex-wrap gap-2">
          {project.tags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              className={`text-xs px-2 py-1 rounded-full transition-all duration-300
                ${isSpotlight ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary/80 group-hover:bg-primary/15 group-hover:text-primary/90'}
              `}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Hover overlay: stronger on spotlight */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-300
          ${isSpotlight ? 'bg-gradient-to-t from-primary/25 to-transparent opacity-100' : 'bg-gradient-to-t from-primary/20 to-transparent opacity-0 group-hover:opacity-100'}
        `}
      />
    </motion.div>
  );
};

export default ProjectCard;

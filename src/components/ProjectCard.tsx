import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Project } from '../data/projects';
import { DiUnitySmall } from 'react-icons/di';
import { SiUnrealengine } from 'react-icons/si';

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
}

const ProjectCard = ({
  project,
  onClick,
  isSpotlight = false,
  isDimmed = false,
  isFeatured: _isFeatured = false,
  featuredIdleActive = false,
  onHoverChange,
}: ProjectCardProps) => {
  const EngineIcon = project.category === 'Unity' ? DiUnitySmall : SiUnrealengine;
  const summary = project.shortDescription ?? project.description;
  const impactPreview = project.impact?.slice(0, 2) ?? [];
  const impactDelayed = project.impact?.[2];
  const isLogoThumb = /ingame-studios|nerd-monkeys/.test(project.thumbnail);
  const [showDelayedReward, setShowDelayedReward] = useState(false);
  const [sweepPlayed, setSweepPlayed] = useState(false);
  const delayedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    onHoverChange?.(true);
    delayedTimerRef.current = setTimeout(() => setShowDelayedReward(true), DELAYED_HOVER_MS);
  };

  const handleMouseLeave = () => {
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
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
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
            className={`w-full h-full transition-none object-center ${isLogoThumb ? 'object-contain p-4' : 'object-cover'}`}
            style={{ display: 'block', minWidth: '100%', minHeight: '100%' }}
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
            <span className="bg-cyber-dark/90 backdrop-blur-sm px-2 py-0.5 rounded text-xs font-mono text-gray-300 border border-primary/20">
              {PROJECT_TYPE_LABELS[project.projectType] ?? project.projectType}
            </span>
          )}
          {project.isSecret && (
            <span className="bg-primary/20 backdrop-blur-sm px-2 py-0.5 rounded text-xs font-cyber text-primary border border-primary/30">
              SECRET
            </span>
          )}
        </div>

        <div className="absolute top-4 right-4 z-20">
          <EngineIcon className="text-primary text-2xl" />
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <h3
          className={`text-xl font-cyber mb-1 transition-all duration-300
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
        <p className="text-gray-400 text-sm mb-3 line-clamp-2 transition-colors duration-300 group-hover:text-gray-300">
          {summary}
        </p>

        {impactPreview.length > 0 && (
          <ul
            className={`text-xs mb-3 space-y-0.5 ${impactDelayed ? 'min-h-[3.5rem]' : ''}`}
            aria-hidden
          >
            {impactPreview.map((line, i) => (
              <li
                key={i}
                className={`line-clamp-1 transition-all duration-300
                  ${i === 0 && showDelayedReward ? 'text-primary/90 font-medium' : 'text-gray-500'}
                `}
              >
                • {line}
              </li>
            ))}
            {/* Delayed reward: third line lives in reserved space so no layout shift */}
            {impactDelayed && (
              <motion.li
                initial={false}
                animate={{ opacity: showDelayedReward ? 1 : 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="text-primary/80 line-clamp-1"
              >
                • {impactDelayed}
              </motion.li>
            )}
          </ul>
        )}

        {/* Tags: more legible on hover */}
        <div className="flex flex-wrap gap-2">
          {project.tags.map((tag, index) => (
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

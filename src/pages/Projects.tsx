import { useState, useMemo, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { DiUnitySmall } from 'react-icons/di';
import { SiUnrealengine } from 'react-icons/si';
import { MdCampaign } from 'react-icons/md';
import ProjectCard from '@/components/ProjectCard';
import ProjectModal from '@/components/ProjectModal';
import { useKonamiCode } from '@/hooks/useKonamiCode';
import { Project } from '@/utils/types';
import { projects, secretProjects, getProjectsBySection } from '../data/projects';
import InteractiveBackground from '@/components/InteractiveBackground';

function filterByCategory(list: Project[], category: 'all' | 'Unity' | 'Unreal Engine' | 'Marketing'): Project[] {
  if (category === 'all') return list;
  return list.filter((p) => p.category === category);
}

const FEATURED_IDLE_INTERVAL_MS = 4800;

const Projects = () => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'Unity' | 'Unreal Engine' | 'Marketing'>('all');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showSecretProjects, setShowSecretProjects] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [featuredIdleIndex, setFeaturedIdleIndex] = useState(0);
  const [scrollCTAVisible, setScrollCTAVisible] = useState(true);
  const [archiveOpen, setArchiveOpen] = useState(false);

  useKonamiCode(() => {
    setShowSecretProjects(true);
  });

  useEffect(() => {
    const t = setInterval(() => {
      setFeaturedIdleIndex((i) => i + 1);
    }, FEATURED_IDLE_INTERVAL_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrollCTAVisible(window.scrollY < 120);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const allProjects = useMemo(
    () => [...projects, ...(showSecretProjects ? secretProjects : [])],
    [showSecretProjects]
  );

  const { featured, professional, additional } = useMemo(
    () => getProjectsBySection(allProjects),
    [allProjects]
  );

  const featuredFiltered = useMemo(() => filterByCategory(featured, selectedCategory), [featured, selectedCategory]);
  const professionalFiltered = useMemo(() => filterByCategory(professional, selectedCategory), [professional, selectedCategory]);
  const additionalFiltered = useMemo(() => filterByCategory(additional, selectedCategory), [additional, selectedCategory]);

  const hasAny = featuredFiltered.length > 0 || professionalFiltered.length > 0 || additionalFiltered.length > 0;

  return (
    <div className="min-h-screen py-24 relative">
      <InteractiveBackground variant="particles" intensity="medium" />
      <div className="scanline" />

      <div className="cyber-container">
        {/* Page header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-cyber text-white mb-4 neon-text">
            Selected Work
          </h1>
          <p className="text-gray-400 font-mono text-lg max-w-2xl mx-auto mb-6">
            Marketing engineering, Unreal gameplay &amp; multiplayer, and the tools in between.
          </p>
          <div className="flex justify-center gap-8 mb-4">
            <div className="flex items-center gap-2 text-primary">
              <MdCampaign className="text-2xl" />
              <span className="font-mono">Marketing</span>
            </div>
            <div className="flex items-center gap-2 text-primary">
              <DiUnitySmall className="text-2xl" />
              <span className="font-mono">Unity</span>
            </div>
            <div className="flex items-center gap-2 text-primary">
              <SiUnrealengine className="text-2xl" />
              <span className="font-mono">Unreal Engine</span>
            </div>
          </div>
          {showSecretProjects && (
            <div className="text-primary font-mono text-sm mb-4">
              Secret projects unlocked! 🔓
            </div>
          )}
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-3 md:gap-4 mb-10">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 md:px-6 py-2 rounded-md font-cyber text-sm transition-all duration-300
              ${selectedCategory === 'all'
                ? 'bg-primary text-cyber-black shadow-[0_0_15px_rgba(240,126,65,0.5)]'
                : 'bg-cyber-black text-primary border-2 border-primary/30 hover:border-primary hover:shadow-[0_0_10px_rgba(240,126,65,0.3)]'
              }`}
          >
            All
          </button>
          <button
            onClick={() => setSelectedCategory('Unity')}
            className={`px-4 md:px-6 py-2 rounded-md font-cyber text-sm transition-all duration-300
              ${selectedCategory === 'Unity'
                ? 'bg-primary text-cyber-black shadow-[0_0_15px_rgba(240,126,65,0.5)]'
                : 'bg-cyber-black text-primary border-2 border-primary/30 hover:border-primary hover:shadow-[0_0_10px_rgba(240,126,65,0.3)]'
              }`}
          >
            Unity
          </button>
          <button
            onClick={() => setSelectedCategory('Unreal Engine')}
            className={`px-4 md:px-6 py-2 rounded-md font-cyber text-sm transition-all duration-300
              ${selectedCategory === 'Unreal Engine'
                ? 'bg-primary text-cyber-black shadow-[0_0_15px_rgba(240,126,65,0.5)]'
                : 'bg-cyber-black text-primary border-2 border-primary/30 hover:border-primary hover:shadow-[0_0_10px_rgba(240,126,65,0.3)]'
              }`}
          >
            Unreal Engine
          </button>
          <button
            onClick={() => setSelectedCategory('Marketing')}
            className={`px-4 md:px-6 py-2 rounded-md font-cyber text-sm transition-all duration-300
              ${selectedCategory === 'Marketing'
                ? 'bg-primary text-cyber-black shadow-[0_0_15px_rgba(240,126,65,0.5)]'
                : 'bg-cyber-black text-primary border-2 border-primary/30 hover:border-primary hover:shadow-[0_0_10px_rgba(240,126,65,0.3)]'
              }`}
          >
            Marketing
          </button>
        </div>

        {/* Scroll-to-explore CTA: rewards browsing, fades after user scrolls */}
        {hasAny && (
          <motion.div
            className={`flex flex-col items-center gap-2 py-4 pb-2 ${!scrollCTAVisible ? 'pointer-events-none' : ''}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{
              opacity: scrollCTAVisible ? 0.95 : 0,
              y: scrollCTAVisible ? 0 : -8,
            }}
            transition={{ duration: 0.35 }}
          >
            <span className="text-[11px] font-mono text-primary/80 tracking-[0.2em] uppercase">
              Scroll to explore
            </span>
            <motion.span
              className="text-primary/90 text-lg leading-none"
              animate={{ y: [0, 5, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            >
              ↓
            </motion.span>
          </motion.div>
        )}

        {/* Flagship projects */}
        {featuredFiltered.length > 0 && (
          <section className="mb-16">
            <h2 className="text-2xl font-cyber text-primary mb-6 border-b border-primary/30 pb-2">
              Flagship Projects
            </h2>
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              onMouseLeave={() => setHoveredCardId(null)}
            >
              {featuredFiltered.map((project, index) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => setSelectedProject(project)}
                  isSpotlight={hoveredCardId === project.id}
                  isDimmed={hoveredCardId !== null && hoveredCardId !== project.id}
                  isFeatured
                  featuredIdleActive={featuredIdleIndex % featuredFiltered.length === index}
                  onHoverChange={(hovered) => setHoveredCardId(hovered ? project.id : null)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Also built: compact one-line tiles */}
        {professionalFiltered.length > 0 && (
          <section className="mb-14">
            <div className="flex items-end justify-between mb-5 border-b border-primary/30 pb-2">
              <h2 className="text-2xl font-cyber text-primary">Also built</h2>
              <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wider">click for details</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {professionalFiltered.map((project, i) => (
                <motion.button
                  key={project.id}
                  type="button"
                  onClick={() => setSelectedProject(project)}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                  whileHover={{ x: 4 }}
                  className="group flex items-center gap-3 text-left rounded-lg border border-primary/25 bg-cyber-black/80 p-2.5 pr-3 hover:border-primary/70 hover:shadow-[0_0_18px_rgba(240,126,65,0.15)] transition-colors"
                >
                  <span className="relative w-20 shrink-0 aspect-video rounded overflow-hidden border border-primary/20 bg-cyber-dark">
                    <img src={project.thumbnail} alt="" loading="lazy" className="w-full h-full object-cover" style={{ objectPosition: project.thumbnailPosition }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-cyber text-sm text-primary truncate">{project.title}</span>
                      {project.badge && <span className="hidden xl:inline text-[9px] font-mono uppercase text-gray-500 border border-gray-700 rounded px-1 shrink-0">{project.badge}</span>}
                    </span>
                    <span className="block text-xs text-gray-400 leading-snug line-clamp-2 group-hover:text-gray-200">{project.headline ?? project.shortDescription}</span>
                  </span>
                  <span className="text-primary/40 group-hover:text-primary font-mono text-sm shrink-0">›</span>
                </motion.button>
              ))}
            </div>
          </section>
        )}

        {/* Archive: collapsed */}
        {additionalFiltered.length > 0 && (
          <section className="mb-16">
            <button
              type="button"
              onClick={() => setArchiveOpen((v) => !v)}
              aria-expanded={archiveOpen}
              className="w-full flex items-center justify-between rounded-lg border border-primary/20 bg-cyber-black/60 px-4 py-3 hover:border-primary/50 transition-colors"
            >
              <span className="font-cyber text-sm text-gray-300 uppercase tracking-wider">
                Archive: early tools &amp; game jams <span className="text-gray-500 font-mono normal-case">({additionalFiltered.length})</span>
              </span>
              <motion.span animate={{ rotate: archiveOpen ? 90 : 0 }} className="text-primary font-mono">›</motion.span>
            </button>
            <AnimatePresence initial={false}>
              {archiveOpen && (
                <motion.ul
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden mt-2 divide-y divide-primary/10 rounded-lg border border-primary/15"
                >
                  {additionalFiltered.map((project) => (
                    <li key={project.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedProject(project)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-primary/5 transition-colors"
                      >
                        <span className="font-mono text-sm text-primary/90 w-56 shrink-0 truncate">{project.title}</span>
                        <span className="text-xs text-gray-500 truncate flex-1">{project.headline ?? project.shortDescription}</span>
                        <span className="text-[10px] font-mono text-gray-600 uppercase shrink-0 hidden sm:inline">{project.projectType}</span>
                      </button>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </section>
        )}

        {!hasAny && (
          <div className="text-center py-20">
            <p className="text-gray-400">No projects in this category.</p>
          </div>
        )}
      </div>

      {selectedProject && (
        <ProjectModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </div>
  );
};

export default Projects;

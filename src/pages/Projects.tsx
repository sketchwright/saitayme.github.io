import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DiUnitySmall } from 'react-icons/di';
import { SiUnrealengine } from 'react-icons/si';
import ProjectCard from '@/components/ProjectCard';
import ProjectModal from '@/components/ProjectModal';
import { useKonamiCode } from '@/hooks/useKonamiCode';
import { Project } from '@/utils/types';
import { projects, secretProjects, getProjectsBySection } from '../data/projects';
import InteractiveBackground from '@/components/InteractiveBackground';

function filterByCategory(list: Project[], category: 'all' | 'Unity' | 'Unreal Engine'): Project[] {
  if (category === 'all') return list;
  return list.filter((p) => p.category === category);
}

const FEATURED_IDLE_INTERVAL_MS = 4800;

const Projects = () => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'Unity' | 'Unreal Engine'>('all');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showSecretProjects, setShowSecretProjects] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [featuredIdleIndex, setFeaturedIdleIndex] = useState(0);
  const [scrollCTAVisible, setScrollCTAVisible] = useState(true);

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
            Professional projects, tools, and prototypes across Unreal Engine and Unity.
          </p>
          <div className="flex justify-center gap-8 mb-4">
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
        <div className="flex gap-4 mb-10">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-6 py-2 rounded-md font-cyber text-sm transition-all duration-300
              ${selectedCategory === 'all'
                ? 'bg-primary text-cyber-black shadow-[0_0_15px_rgba(240,126,65,0.5)]'
                : 'bg-cyber-black text-primary border-2 border-primary/30 hover:border-primary hover:shadow-[0_0_10px_rgba(240,126,65,0.3)]'
              }`}
          >
            All
          </button>
          <button
            onClick={() => setSelectedCategory('Unity')}
            className={`px-6 py-2 rounded-md font-cyber text-sm transition-all duration-300
              ${selectedCategory === 'Unity'
                ? 'bg-primary text-cyber-black shadow-[0_0_15px_rgba(240,126,65,0.5)]'
                : 'bg-cyber-black text-primary border-2 border-primary/30 hover:border-primary hover:shadow-[0_0_10px_rgba(240,126,65,0.3)]'
              }`}
          >
            Unity
          </button>
          <button
            onClick={() => setSelectedCategory('Unreal Engine')}
            className={`px-6 py-2 rounded-md font-cyber text-sm transition-all duration-300
              ${selectedCategory === 'Unreal Engine'
                ? 'bg-primary text-cyber-black shadow-[0_0_15px_rgba(240,126,65,0.5)]'
                : 'bg-cyber-black text-primary border-2 border-primary/30 hover:border-primary hover:shadow-[0_0_10px_rgba(240,126,65,0.3)]'
              }`}
          >
            Unreal Engine
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

        {/* Featured (priority 1–5) */}
        {featuredFiltered.length > 0 && (
          <section className="mb-16">
            <h2 className="text-2xl font-cyber text-primary mb-6 border-b border-primary/30 pb-2">
              Featured Projects
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

        {/* Professional tools (priority 6–9) */}
        {professionalFiltered.length > 0 && (
          <section className="mb-16">
            <h2 className="text-2xl font-cyber text-primary mb-6 border-b border-primary/30 pb-2">
              More Professional Work
            </h2>
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              onMouseLeave={() => setHoveredCardId(null)}
            >
              {professionalFiltered.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => setSelectedProject(project)}
                  isSpotlight={hoveredCardId === project.id}
                  isDimmed={hoveredCardId !== null && hoveredCardId !== project.id}
                  onHoverChange={(hovered) => setHoveredCardId(hovered ? project.id : null)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Additional (priority 10+, jams / personal) */}
        {additionalFiltered.length > 0 && (
          <section className="mb-16">
            <h2 className="text-2xl font-cyber text-primary mb-6 border-b border-primary/30 pb-2">
              Additional Projects
            </h2>
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              onMouseLeave={() => setHoveredCardId(null)}
            >
              {additionalFiltered.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => setSelectedProject(project)}
                  isSpotlight={hoveredCardId === project.id}
                  isDimmed={hoveredCardId !== null && hoveredCardId !== project.id}
                  onHoverChange={(hovered) => setHoveredCardId(hovered ? project.id : null)}
                />
              ))}
            </div>
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

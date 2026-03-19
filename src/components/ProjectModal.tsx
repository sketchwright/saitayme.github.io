import { motion, AnimatePresence } from 'framer-motion';
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

interface ProjectModalProps {
  project: Project | null;
  onClose: () => void;
}

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.28 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};
const modalVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 16 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.32, ease: [0.22, 0.61, 0.36, 1] },
  },
  exit: { opacity: 0, scale: 0.98, y: 8, transition: { duration: 0.2 } },
};
const lineVariants = {
  hidden: { scaleX: 0 },
  visible: { scaleX: 1, transition: { duration: 0.35, ease: 'easeOut', delay: 0.08 } },
};
const stagger = {
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.12 } },
  hidden: {},
};
const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0 },
};

const ProjectModal = ({ project, onClose }: ProjectModalProps) => {
  if (!project) return null;

  const EngineIcon = project.category === 'Unity' ? DiUnitySmall : SiUnrealengine;

  return (
    <AnimatePresence>
      <motion.div
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={{ duration: 0.28 }}
        className="fixed inset-0 bg-black/92 backdrop-blur-md z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="relative bg-cyber-black border-2 border-primary/30 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-[0_0_60px_rgba(0,0,0,0.6)]"
          onClick={e => e.stopPropagation()}
        >
          {/* Top-line activation (dossier feel) */}
          <motion.div
            variants={lineVariants}
            initial="hidden"
            animate="visible"
            className="absolute top-0 left-0 right-0 h-0.5 bg-primary/80 origin-left rounded-t-lg"
          />
          {/* Header */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="relative p-6 border-b border-primary/30"
          >
            <button
              onClick={onClose}
              className="absolute top-6 right-6 text-gray-400 hover:text-primary text-xl leading-none"
              aria-label="Close"
            >
              ✕
            </button>

            <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-2 mb-2">
              <EngineIcon className="text-3xl text-primary flex-shrink-0" />
              {project.featured && (
                <span className="bg-primary/20 text-primary px-2 py-0.5 rounded text-xs font-cyber">
                  FEATURED
                </span>
              )}
              {project.projectType && (
                <span className="text-xs font-mono text-gray-500 border border-primary/20 px-2 py-0.5 rounded">
                  {PROJECT_TYPE_LABELS[project.projectType] ?? project.projectType}
                </span>
              )}
            </motion.div>

            <motion.h2
              variants={itemVariants}
              className="text-2xl font-cyber text-primary neon-text mb-2"
            >
              {project.title}
            </motion.h2>

            {(project.role || project.company || project.timeframe) && (
              <motion.p variants={itemVariants} className="text-gray-400 text-sm font-mono mb-3">
                {[project.role, project.company].filter(Boolean).join(' · ')}
                {project.timeframe && ` · ${project.timeframe}`}
              </motion.p>
            )}

            <motion.p variants={itemVariants} className="text-gray-400">
              {project.description}
            </motion.p>
          </motion.div>

          {/* Impact & Challenges */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="p-6 space-y-6"
          >
            {project.impact && project.impact.length > 0 && (
              <motion.div variants={itemVariants}>
                <h3 className="text-lg font-cyber text-primary mb-3">Impact</h3>
                <ul className="list-disc list-inside text-gray-400 space-y-1">
                  {project.impact.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </motion.div>
            )}

            {project.challenges && project.challenges.length > 0 && (
              <motion.div variants={itemVariants}>
                <h3 className="text-lg font-cyber text-primary mb-3">Challenges</h3>
                <ul className="list-disc list-inside text-gray-400 space-y-1">
                  {project.challenges.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Tags */}
            <motion.div variants={itemVariants}>
              <h3 className="text-lg font-cyber text-primary mb-3">Technologies</h3>
              <div className="flex flex-wrap gap-2">
                {project.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="text-sm px-3 py-1 rounded-full bg-primary/10 text-primary/80"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* Systems */}
            <motion.div variants={itemVariants} className="space-y-6">
              <h3 className="text-lg font-cyber text-primary mb-4">Technical Systems</h3>
              {project.systems.map((system, index) => (
                <div
                  key={index}
                  className="border border-primary/30 rounded-lg p-6 bg-black/30"
                >
                  <h4 className="text-lg text-primary mb-2">{system.name}</h4>
                  <p className="text-gray-400 mb-4">{system.description}</p>

                  <div className="mb-4">
                    <h5 className="text-sm text-gray-500 mb-2">Tech Stack</h5>
                    <div className="flex flex-wrap gap-2">
                      {system.techStack.map((tech, techIndex) => (
                        <span
                          key={techIndex}
                          className="text-xs px-2 py-1 rounded bg-primary/10 text-primary/80"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h5 className="text-sm text-gray-500 mb-2">Key Features</h5>
                    <ul className="list-disc list-inside text-gray-400">
                      {system.features.map((feature, featureIndex) => (
                        <li key={featureIndex}>{feature}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </motion.div>

            {/* Links — contextual labels, same button style */}
            <motion.div
              variants={itemVariants}
              className="pt-6 border-t border-primary/30 flex flex-wrap gap-3"
            >
              {project.demoUrl && (
                <a
                  href={project.demoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cyber-button"
                >
                  {project.demoUrl.includes('steampowered')
                    ? 'View on Steam'
                    : project.demoUrl.includes('itch.io')
                      ? 'View on itch.io'
                      : 'View project'}
                </a>
              )}
              {project.githubUrl && (
                <a
                  href={project.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cyber-button"
                >
                  View code
                </a>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ProjectModal;

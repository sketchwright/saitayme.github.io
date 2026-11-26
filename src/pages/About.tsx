import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FaUser, FaGraduationCap, FaAddressCard, FaCheck } from 'react-icons/fa';
import Section from '@/components/Section';
import ContactPanel from '@/components/ContactPanel';
import LanguageChip from '@/components/LanguageChip';
import InteractiveBackground from '@/components/InteractiveBackground';
import SkillReactor from '@/components/SkillReactor';
import CareerTimeline from '@/components/CareerTimeline';
import ScrambleText from '@/components/ScrambleText';

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: 'easeOut' },
};

const staggerContainer = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

/** Hero choreography: panel → portrait+name → role → value → chips → CTAs */
const heroPanel = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] },
};
const heroPortrait = { ...fadeIn, transition: { duration: 0.4, delay: 0.12, ease: 'easeOut' } };
const heroName = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay: 0.22, ease: [0.25, 0.46, 0.45, 0.94] },
};
const heroRole = { ...fadeIn, transition: { duration: 0.3, delay: 0.32, ease: 'easeOut' } };
const heroValue = { ...fadeIn, transition: { duration: 0.35, delay: 0.42, ease: 'easeOut' } };
const heroChipsWrap = { ...fadeIn, transition: { duration: 0.3, delay: 0.52, ease: 'easeOut' } };
const heroCTAs = { ...fadeIn, transition: { duration: 0.3, delay: 0.68, ease: 'easeOut' } };


/** Content width — overflow-x-clip prevents horizontal scroll without making overflow-y auto (avoids stray scrollbar that appears then disappears on click) */
const CONTENT_MAX = 'max-w-5xl mx-auto w-full min-w-0 px-4 sm:px-6 overflow-x-clip';

/** Vertical rhythm: more breathing room between major sections */
const SECTION_SPACE = 'mb-20 md:mb-28';

/** Hero: one-line value proposition */
const VALUE_PROP =
  'Marketing engineer at Ingame Studios: I run marketing for Mayhem À La Carte and build the tools behind it, from creator outreach software to AI content pipelines. Before that I shipped gameplay and multiplayer code on Crime Boss: Rockay City, and I still write the code.';

/** High-signal chips for hero (marketing first, engineering second) */
const HERO_CHIPS = [
  'Game Marketing',
  'Creator Outreach',
  'Marketing Automation',
  'Unreal Engine',
  'Multiplayer / EOS',
  'C++ & Blueprint',
];
/** Chips that get subtle loop emphasis (priority proof signals) */
const CHIP_PRIORITY = new Set(HERO_CHIPS);

/** Career highlight cards: skimmable, bullet-led (matches CV experience) */
const CAREER_HIGHLIGHTS = [
  {
    title: 'Ingame Studios',
    subtitle: 'Marketing Engineer · Oct 2026 – Present',
    project: 'Mayhem À La Carte',
    companyUrl: 'https://mayhemalacarte.com/',
    bullets: [
      'Own social media strategy and channels; reveal campaign',
      'Built IGS Outreach: creator CRM + personalised mail engine',
      'Built mayhemalacarte.com and an AI content pipeline',
      'On camera: Twitch/YouTube streams, trailer VO, gamescom 2026',
      'Still coding: EOS co-op framework, recipe data pipeline',
    ],
    accent: true,
    previous: {
    subtitle: 'Game Developer · Oct 2025 – Sep 2026',
    project: 'Crime Boss: Rockay City',
    bullets: [
      '50+ bug fixes in Update 20 (gameplay, UI, replication)',
      'ModKit: Blueprint/DataTable-driven moddable systems',
      'ModKit tutorial series + docs: where the marketing started',
    ],
    },
  },
  {
    title: 'nerdmonkeys',
    subtitle: 'Game Developer · Mar – Jun 2025',
    project: 'NOK & Unity professional projects',
    companyUrl: 'https://nerdmonkeys.games/',
    bullets: [
      'NOK: Sound Manager, editor tools, gameplay',
      'Gameplay systems, editor tools, ScriptableObject workflows',
      'Advanced audio (NOK), scene loading, proximity chat',
      'Shipped indie & client work',
    ],
    accent: false,
  },
  {
    title: 'Focus',
    subtitle: 'What I bring to the table',
    project: null,
    bullets: [
      'Marketing that is engineered: tools, data and automation',
      'Creator relations, social and community, on and off camera',
      'Unreal gameplay & multiplayer depth, so I speak dev fluently',
    ],
    accent: false,
  },
];

/** Recurring motif: section header with › prompt and animated accent line */
const SectionLabel = ({ label, className = '' }: { label: string; className?: string }) => (
  <div className={className}>
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[10px] font-mono text-primary/80">›</span>
      <h3 className="text-xs font-cyber text-primary/90 uppercase tracking-wider">{label}</h3>
    </div>
    <motion.div
      className="h-px w-12 bg-primary/60 origin-left"
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, margin: '-20px' }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    />
  </div>
);

const CV_PDF_PATH = '/cv.pdf';
const CV_DOWNLOAD_FILENAME = 'Julian-Strunz-CV.pdf';
const CV_SUCCESS_RESET_MS = 2200;

const About = () => {
  const [cvStatus, setCvStatus] = useState<'idle' | 'success'>('idle');

  const handleCvDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    if (cvStatus === 'success') return;
    setCvStatus('success');
    const a = document.createElement('a');
    a.href = CV_PDF_PATH;
    a.download = CV_DOWNLOAD_FILENAME;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setCvStatus('idle'), CV_SUCCESS_RESET_MS);
  };
  return (
    <div className="min-h-screen pt-20 relative overflow-x-hidden">
      <InteractiveBackground variant="grid" intensity="subtle" />
      <Section id="about" title="About Me">
        <div className={CONTENT_MAX}>
          {/* —— 1. Identity panel: choreographed reveal + signature scan —— */}
          <motion.div
            className="relative rounded-xl border-2 border-primary/40 bg-black/50 overflow-hidden mb-8 md:mb-12"
            initial={heroPanel.initial}
            animate={heroPanel.animate}
            transition={heroPanel.transition}
            style={{ boxShadow: '0 0 24px rgba(240,126,65,0.08)' }}
          >
            {/* Signature: one-time scan sweep */}
            <motion.div
              className="absolute left-0 right-0 h-0.5 bg-gradient-to-b from-transparent via-primary/50 to-transparent z-10 pointer-events-none"
              initial={{ top: '0%', opacity: 0 }}
              animate={{ top: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.1, ease: 'easeInOut', delay: 0.25 }}
            />
            {/* Animated top bar (activation) */}
            <motion.div
              className="h-1 bg-gradient-to-r from-primary/60 via-primary/30 to-transparent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.15 }}
            />
            <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 md:gap-8 p-6 md:p-8 items-center relative">
              {/* Left: portrait + label */}
              <div className="flex flex-col items-center md:items-start">
                <div className="flex items-center gap-2 mb-3 md:mb-4">
                  <FaUser className="text-primary/80 text-sm" />
                  <span className="text-[10px] font-mono text-primary/80 uppercase tracking-[0.2em]">
                    Identity
                  </span>
                </div>
                <motion.div
                  variants={heroPortrait}
                  initial="initial"
                  animate="animate"
                  className="relative"
                >
                  <motion.img
                    src="/assets/images/profile.jpg"
                    alt="Julian Strunz"
                    className="rounded-lg w-32 h-32 md:w-40 md:h-40 border border-primary/50 object-cover bg-cyber-dark transition-shadow duration-300 hover:shadow-[0_0_24px_rgba(240,126,65,0.12)]"
                    whileHover={{ y: -3 }}
                    transition={{ type: 'tween', duration: 0.2 }}
                  />
                  <div className="absolute inset-0 rounded-lg border border-primary/20 pointer-events-none" />
                </motion.div>
              </div>
              {/* Right: name, role, tagline, chips, CTAs (staggered) */}
              <div className="flex flex-col md:pl-2">
                <motion.h1
                  variants={heroName}
                  initial="initial"
                  animate="animate"
                  className="text-3xl md:text-4xl font-cyber text-primary mb-1"
                >
                  <motion.span
                    initial={{ filter: 'drop-shadow(0 0 0 rgba(240,126,65,0))' }}
                    animate={{
                      filter: [
                        'drop-shadow(0 0 0 rgba(240,126,65,0))',
                        'drop-shadow(0 0 12px rgba(240,126,65,0.4))',
                        'drop-shadow(0 0 0 rgba(240,126,65,0))',
                      ],
                    }}
                    transition={{ duration: 1.4, times: [0, 0.35, 1], delay: 0.4 }}
                  >
                    Julian Strunz <span className="attention-badge text-primary font-cyber font-semibold text-base uppercase tracking-wider ml-1">BSc</span>
                  </motion.span>
                </motion.h1>
                <motion.p
                  variants={heroRole}
                  initial="initial"
                  animate="animate"
                  className="text-lg md:text-xl text-white font-medium mb-2"
                >
                  Marketing Engineer // Gameplay Programmer
                </motion.p>
                <motion.p
                  variants={heroValue}
                  initial="initial"
                  animate="animate"
                  className="text-gray-200 text-sm md:text-base mb-4 max-w-xl"
                >
                  {VALUE_PROP}
                </motion.p>
                <motion.div
                  variants={heroChipsWrap}
                  initial="initial"
                  animate="animate"
                  className="flex flex-wrap gap-2 mb-5"
                >
                  {HERO_CHIPS.map((chip, i) => (
                    <motion.span
                      key={chip}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: 0.52 + i * 0.04, ease: 'easeOut' }}
                      className={`px-2.5 py-1 rounded text-xs font-medium bg-primary/10 border border-primary/25 text-primary ${CHIP_PRIORITY.has(chip) ? 'chip-priority' : ''}`}
                    >
                      {chip}
                    </motion.span>
                  ))}
                </motion.div>
                <motion.div
                  variants={heroCTAs}
                  initial="initial"
                  animate="animate"
                  className="flex flex-wrap gap-2"
                >
                  <motion.button
                    type="button"
                    onClick={handleCvDownload}
                    animate={cvStatus === 'success' ? { scale: [1, 1.08, 1.02], y: 0 } : { scale: 1, y: 0 }}
                    transition={cvStatus === 'success' ? { duration: 0.4, times: [0, 0.4, 1] } : { type: 'spring', stiffness: 380, damping: 20 }}
                    className={`attention-cta cv-cta-win inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium min-w-[5.5rem] transition-colors duration-300 ${cvStatus === 'success' ? 'bg-primary text-cyber-black shadow-[0_0_28px_rgba(240,126,65,0.55)]' : 'bg-primary text-black hover:bg-primary/90'}`}
                    whileHover={cvStatus === 'idle' ? { y: -5, scale: 1.06, transition: { type: 'spring', stiffness: 400, damping: 18 } } : undefined}
                    whileTap={cvStatus === 'idle' ? { y: -2, scale: 0.98, transition: { duration: 0.1 } } : undefined}
                  >
                    {cvStatus === 'success' ? (
                      <motion.span
                        key="success"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                        className="inline-flex items-center justify-center gap-2"
                      >
                        <FaCheck className="text-base shrink-0" aria-hidden />
                        <span>Downloaded</span>
                      </motion.span>
                    ) : (
                      <span>CV</span>
                    )}
                  </motion.button>
                  <Link
                    to="/projects"
                    className="px-4 py-2.5 min-h-[40px] inline-flex items-center rounded-lg text-sm font-medium border border-primary text-primary hover:bg-primary/10 transition-colors"
                  >
                    Projects
                  </Link>
                  <Link
                    to="/contact"
                    className="px-4 py-2.5 min-h-[40px] inline-flex items-center rounded-lg text-sm font-medium border border-primary/50 text-gray-100 hover:bg-white/5 transition-colors"
                  >
                    Contact
                  </Link>
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* —— 2. Career highlights: staggered reveal + card hover polish —— */}
          <motion.div
            className={`grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6 lg:gap-8 ${SECTION_SPACE}`}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-60px' }}
            variants={staggerContainer}
          >
            {/* Ingame Studios: dominant card */}
            <motion.div
              variants={fadeIn}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              whileHover={{ y: -3, scale: 1.005, transition: { duration: 0.2 } }}
              className="attention-igs rounded-xl p-6 md:p-8 border-2 border-primary/50 bg-primary/5 min-h-[200px] cursor-default transition-all duration-200 hover:border-primary/60 hover:bg-primary/[0.07] hover:shadow-[0_0_28px_rgba(240,126,65,0.12)]"
              style={{ boxShadow: '0 0 20px rgba(240,126,65,0.06)' }}
            >
              <h3 className="text-xl md:text-2xl font-cyber text-primary mb-1">
                {CAREER_HIGHLIGHTS[0].title}
              </h3>
              <p className="text-xs text-gray-400 font-mono mb-2">{CAREER_HIGHLIGHTS[0].subtitle}</p>
              {'companyUrl' in CAREER_HIGHLIGHTS[0] && CAREER_HIGHLIGHTS[0].companyUrl && (
                <a
                  href={CAREER_HIGHLIGHTS[0].companyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1.5 min-h-[40px] text-xs font-mono border border-primary/50 text-primary/90 hover:bg-primary/10 hover:border-primary hover:text-primary transition-colors rounded mb-3"
                >
                  Visit site →
                </a>
              )}
              <p className="text-base text-white font-medium mb-4 pl-2 border-l-2 border-l-primary/60">
                {CAREER_HIGHLIGHTS[0].project}
              </p>
              <ul className="space-y-2 text-gray-200 text-sm md:text-base">
                {CAREER_HIGHLIGHTS[0].bullets.map((b, j) => (
                  <li key={j} className="flex items-start gap-2">
                    <span className="text-primary/70 shrink-0">·</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              {CAREER_HIGHLIGHTS[0].previous && (
                <div className="mt-6 pt-5 border-t border-primary/20">
                  <p className="text-xs text-gray-400 font-mono mb-2">{CAREER_HIGHLIGHTS[0].previous.subtitle}</p>
                  <p className="text-base text-white font-medium mb-4 pl-2 border-l-2 border-l-primary/60">
                    {CAREER_HIGHLIGHTS[0].previous.project}
                  </p>
                  <ul className="space-y-2 text-gray-200 text-sm md:text-base">
                    {CAREER_HIGHLIGHTS[0].previous.bullets.map((b, j) => (
                      <li key={j} className="flex items-start gap-2">
                        <span className="text-primary/70 shrink-0">·</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>

            {/* Right column: Nerd Monkeys + Focus (staggered) */}
            <motion.div
              className="flex flex-col gap-5 lg:gap-6 min-w-0"
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, margin: '-60px' }}
              variants={{ initial: {}, animate: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } } }}
            >
              <motion.div
                variants={fadeIn}
                whileHover={{ y: -2, scale: 1.003, transition: { duration: 0.2 } }}
                className="rounded-xl p-6 border border-primary/30 bg-black/30 flex-1 cursor-default transition-shadow duration-200 hover:border-primary/45 hover:shadow-[0_0_20px_rgba(240,126,65,0.08)]"
              >
                <h3 className="text-lg font-cyber text-primary/95 mb-1">
                  {CAREER_HIGHLIGHTS[1].title}
                </h3>
                <p className="text-xs text-gray-400 font-mono mb-2">{CAREER_HIGHLIGHTS[1].subtitle}</p>
                {'companyUrl' in CAREER_HIGHLIGHTS[1] && CAREER_HIGHLIGHTS[1].companyUrl && (
                  <a
                    href={CAREER_HIGHLIGHTS[1].companyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-1.5 min-h-[40px] text-xs font-mono border border-primary/50 text-primary/90 hover:bg-primary/10 hover:border-primary hover:text-primary transition-colors rounded mb-2"
                  >
                    Visit site →
                  </a>
                )}
                <p className="text-sm text-white font-medium mb-3">{CAREER_HIGHLIGHTS[1].project}</p>
                <ul className="space-y-2 text-gray-200 text-sm">
                  {CAREER_HIGHLIGHTS[1].bullets.map((b, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <span className="text-primary/60 shrink-0">·</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
              <motion.div
                variants={fadeIn}
                initial="initial"
                whileInView="animate"
                viewport={{ once: true }}
                transition={{ delay: 0.16 }}
                whileHover={{ y: -2, transition: { duration: 0.2 } }}
                className="rounded-lg p-4 border border-primary/25 bg-black/25 cursor-default transition-colors duration-200 hover:border-primary/35 hover:bg-black/30"
              >
                <h4 className="text-xs font-cyber text-primary/80 uppercase tracking-wider mb-2">
                  {CAREER_HIGHLIGHTS[2].title}
                </h4>
                <ul className="space-y-1.5 text-gray-300 text-sm">
                  {CAREER_HIGHLIGHTS[2].bullets.map((b, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <span className="text-primary/60 shrink-0">·</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* —— 3. Skill map: BUILD × GROW reactor —— */}
          <motion.div
            className={`relative rounded-xl border border-primary/30 bg-black/40 p-4 md:p-8 w-full min-w-0 overflow-hidden ${SECTION_SPACE}`}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5 }}
          >
            <div className="absolute inset-0 pointer-events-none sr-grid-bg" aria-hidden />
            <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-2 mb-6">
              <div>
                <SectionLabel label="Skill map" className="mb-3" />
                <ScrambleText as="h3" text="BUILD × GROW" className="text-2xl md:text-3xl font-cyber text-white tracking-wider" />
              </div>
              <p className="text-gray-400 text-sm font-mono max-w-sm md:text-right">
                Half engineer, half marketer, one job. Hover a node to see the proof.
              </p>
            </div>
            <div className="relative">
              <SkillReactor />
            </div>
          </motion.div>

          {/* —— 4. Career timeline —— */}
          <motion.div
            className={`min-w-0 ${SECTION_SPACE}`}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-8">
              <SectionLabel label="Trajectory" className="mb-3" />
              <ScrambleText as="h3" text="FROM CODE TO CAMPAIGNS" className="text-2xl md:text-3xl font-cyber text-white tracking-wider" />
            </div>
            <CareerTimeline />
          </motion.div>

          {/* —— 5. Supporting info (panel + motif + subtle hover) —— */}
          <motion.div
            className="rounded-xl border border-primary/25 bg-black/30 overflow-hidden transition-colors duration-300 hover:border-primary/30"
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <motion.div
              className="h-0.5 bg-primary/20 w-full"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{ transformOrigin: 'left' }}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-primary/15">
              <div className="p-6 md:p-8 group">
                <div className="flex items-center gap-2 mb-2">
                  <FaGraduationCap className="text-primary/70 text-sm shrink-0 transition-colors duration-200 group-hover:text-primary/90" />
                  <h4 className="text-xs font-cyber text-primary/70 uppercase tracking-wider">Education</h4>
                </div>
                <motion.div
                  className="h-px w-10 bg-primary/40 origin-left mb-3"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: 0.1 }}
                />
                <div className="flex flex-wrap items-baseline gap-2 mb-1">
                  <span className="attention-badge text-primary font-cyber font-semibold text-sm uppercase tracking-wider">BSc</span>
                  <span className="text-gray-400 text-xs">·</span>
                  <span className="text-gray-200 font-medium text-sm">Mediatechnology and Design</span>
                </div>
                <p className="text-gray-100 font-medium text-sm">FH Hagenberg</p>
                <p className="text-gray-400 text-xs mt-0.5">Oct 2022 – Jul 2025</p>
                <div className="mt-3 pt-3 border-t border-primary/15">
                  <span className="attention-badge text-primary font-cyber font-semibold text-sm uppercase tracking-wider">Matura</span>
                  <p className="text-gray-100 font-medium text-sm">BRG Hamerling</p>
                  <p className="text-gray-400 text-xs mt-0.5">Jul 2012 – May 2020</p>
                </div>
              </div>
              <div className="p-6 md:p-8 group">
                <div className="flex items-center gap-2 mb-2">
                  <FaAddressCard className="text-primary/70 text-sm shrink-0 transition-colors duration-200 group-hover:text-primary/90" />
                  <h4 className="text-xs font-cyber text-primary/70 uppercase tracking-wider">Contact & languages</h4>
                </div>
                <motion.div
                  className="h-px w-10 bg-primary/40 origin-left mb-3"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: 0.15 }}
                />
                <ContactPanel compact />
                <div className="mt-4 flex flex-wrap gap-2">
                  <LanguageChip countryCode="de" label="German" context="Native." />
                  <LanguageChip countryCode="gb" label="English" context="Advanced · C1 (Anglo Continental)." />
                  <LanguageChip countryCode="es" label="Spanish" context="Basic (second foreign language in AHS)." />
                </div>
                <p className="mt-3 text-gray-400 text-xs font-mono uppercase tracking-wider">Hobbies: Fishing, Fitness, Music</p>
              </div>
            </div>
          </motion.div>
        </div>
      </Section>
    </div>
  );
};

export default About;

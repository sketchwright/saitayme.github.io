import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, useInView, animate } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FaUser, FaGraduationCap, FaAddressCard, FaCheck } from 'react-icons/fa';
import Section from '@/components/Section';
import ContactPanel from '@/components/ContactPanel';
import LanguageChip from '@/components/LanguageChip';
import InteractiveBackground from '@/components/InteractiveBackground';

/** Phrases to highlight in profile text (order: longest first to avoid partial matches) */
const PROFILE_HIGHLIGHT_PHRASES = [
  'Crime Boss: Rockay City',
  'Ingame Studios',
  'Nerd Monkeys',
  'Unreal Engine',
  'EOS-based',
  'moddable',
  'readable code',
  'shipping',
];

/** Splits text by phrases and returns segments; matching segments get highlight class. Uses earliest occurrence so "Ingame Studios" is highlighted before "Crime Boss" when both appear. */
function profileWithHighlights(displayed: string): (string | { phrase: string })[] {
  if (!displayed) return [];
  const segments: (string | { phrase: string })[] = [];
  let remaining = displayed;
  while (remaining.length > 0) {
    let bestIndex = remaining.length;
    let bestPhrase: string | null = null;
    for (const phrase of PROFILE_HIGHLIGHT_PHRASES) {
      const i = remaining.indexOf(phrase);
      if (i !== -1 && i < bestIndex) {
        bestIndex = i;
        bestPhrase = phrase;
      }
    }
    if (bestPhrase === null) {
      segments.push(remaining);
      break;
    }
    if (bestIndex > 0) segments.push(remaining.slice(0, bestIndex));
    segments.push({ phrase: bestPhrase });
    remaining = remaining.slice(bestIndex + bestPhrase.length);
  }
  return segments;
}

/** Typewriter: word-by-word, fixed height, terminal cursor always on, orange highlights (colors via .profile-typewriter in CSS) */
const TYPEWRITER_WORD_MS = 55;
const TypewriterProfile = ({ text }: { text: string }) => {
  const words = text.split(' ');
  const [wordIndex, setWordIndex] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !hasStarted) setHasStarted(true);
      },
      { threshold: 0.2, rootMargin: '-20px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted || wordIndex >= words.length) return;
    const t = setInterval(() => {
      setWordIndex((n) => Math.min(n + 1, words.length));
    }, TYPEWRITER_WORD_MS);
    return () => clearInterval(t);
  }, [hasStarted, wordIndex, words.length]);

  const displayed = words.slice(0, wordIndex).join(' ');
  const segments = profileWithHighlights(displayed);

  return (
    <div ref={ref} className="profile-typewriter min-h-[15.5rem] md:min-h-[16rem] text-base md:text-[1.05rem] leading-[1.75]">
      <span>
        {segments.map((seg, i) =>
          typeof seg === 'string' ? (
            <span key={`t-${i}`} data-profile-segment="normal">{seg}</span>
          ) : (
            <span key={`p-${i}-${seg.phrase}`} className="profile-highlight" data-profile-segment="highlight" style={{ color: '#f07e41', fontWeight: 500 }}>{seg.phrase}</span>
          )
        )}
      </span>
      <span
        className="typer-cursor inline-block w-[3px] h-4 align-middle bg-primary ml-0.5 rounded-none"
        style={{ boxShadow: '0 0 0 1px rgba(240,126,65,0.4)' }}
        aria-hidden
      />
    </div>
  );
};

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


/** Content width — wide enough for asymmetrical composition */
const CONTENT_MAX = 'max-w-5xl mx-auto w-full px-6';

/** Vertical rhythm: more breathing room between major sections */
const SECTION_SPACE = 'mb-20 md:mb-28';

/** Hero: one-line value proposition */
const VALUE_PROP =
  'Gameplay & systems programmer — Unreal Engine, multiplayer, modding, and production debugging.';

/** High-signal tech/project chips for hero */
const HERO_CHIPS = [
  'Unreal Engine',
  'Crime Boss: Rockay City',
  'Multiplayer / EOS',
  'Blueprint & C++',
  'Unity / Tools',
];
/** Chips that get subtle loop emphasis (priority proof signals) */
const CHIP_PRIORITY = new Set(['Unreal Engine', 'Crime Boss: Rockay City', 'Multiplayer / EOS', 'Blueprint & C++', 'Unity / Tools']);

/** Career highlight cards: skimmable, bullet-led */
const CAREER_HIGHLIGHTS = [
  {
    title: 'Ingame Studios',
    subtitle: 'Gameplay Programmer · Oct 2025 – Present',
    project: 'Crime Boss: Rockay City',
    bullets: [
      '50+ bug fixes in Update 20 (gameplay, UI, replication)',
      'Modkit: Blueprint/DataTable-driven moddable systems',
      'EOS multiplayer framework & session/lobby systems',
    ],
    accent: true,
  },
  {
    title: 'Nerd Monkeys',
    subtitle: 'Game Developer · Feb – Jun 2025',
    project: 'Unity professional projects',
    bullets: [
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
      'Gameplay systems & production debugging in Unreal',
      'Multiplayer architecture, replication, EOS',
      'Moddable systems, tools, and clean C++/Blueprint workflows',
    ],
    accent: false,
  },
];

/** One compact about paragraph (5–6 lines) */
const ABOUT_SUMMARY = `I'm a gameplay and systems programmer focused on Unreal Engine, multiplayer, and moddable architecture. At Ingame Studios I work on Crime Boss: Rockay City — gameplay and replication fixes, modkit development, and reusable EOS-based multiplayer systems. Before that I built gameplay systems, tools, and audio at Nerd Monkeys on professional Unity projects. I care about readable code, clear systems, and shipping.`;

/** Core strengths: 6 categories. Card = minimal teaser; detail panel = in-depth (different content). */
const CORE_STRENGTHS = [
  {
    label: 'Gameplay systems',
    teaser: ['Unreal · Blueprints & C++', 'Abilities, items, mission logic'],
    detail: [
      'Shipped gameplay and replication fixes on Crime Boss: Rockay City in a large Unreal codebase.',
      'Comfortable with hybrid Blueprint/C++ systems, gameplay abilities, item systems, and mission logic.',
      'Production debugging and maintaining live game systems.',
    ],
  },
  {
    label: 'Networking / EOS',
    teaser: ['Sessions & lobbies', 'Replication · EOS'],
    detail: [
      'Built reusable multiplayer framework on EOS: session creation, lobby flow, dedicated server support.',
      'Handled join-in-progress, replication edge cases, and async session lifecycle.',
      'Experience debugging networked gameplay in production.',
    ],
  },
  {
    label: 'Tools & modding',
    teaser: ['Modkit · DataTables', 'Editor tooling'],
    detail: [
      'Refactored gameplay systems for the Crime Boss modkit: Blueprint-extensible, DataTable-driven design.',
      'Editor tools and pipelines (Unity and Unreal). Technical docs and modding support.',
    ],
  },
  {
    label: 'Engines & languages',
    teaser: ['Unreal 4/5', 'Unity'],
    detail: [
      'Daily driver: Unreal Engine 4/5 (C++, Blueprints). Prior professional work in Unity (C#).',
      'Familiar with engine APIs, build pipelines, and cross-engine patterns.',
    ],
  },
  {
    label: 'Code',
    teaser: ['C++ & C#', 'Readable systems'],
    detail: [
      'C++ for Unreal (native modules, gameplay, networking). C# for Unity and tools.',
      'Focus on readable code, clear architecture, and maintainable systems. Blueprint and native integration.',
    ],
  },
  {
    label: 'Shipping / Production',
    teaser: ['Live debugging', 'Updates'],
    detail: [
      'Bug fixing and maintenance in shipped, live codebases (e.g. 50+ fixes in Crime Boss Update 20).',
      'Comfortable with update pipelines, QA handoff, and getting changes to release.',
    ],
  },
];

/** Radar chart: 6 axes, same order as CORE_STRENGTHS; short labels for SVG */
const RADAR_CENTER = 120;
const RADAR_RADIUS = 96;
const RADAR_STATS = [
  { label: 'Gameplay', value: 0.92 },
  { label: 'Networking', value: 0.88 },
  { label: 'Tools', value: 0.85 },
  { label: 'Engines', value: 0.9 },
  { label: 'Code', value: 0.78 },
  { label: 'Shipping', value: 0.95 },
];

/** Per-corner drift: each corner has its own phase so they move independently, not one pulse */
const RADAR_DRIFT_AMP = 2;
const RADAR_DRIFT_SPEED = 0.00045;
const RADAR_DRIFT_PHASE = [0, 1.05, 2.1, 0.5, 1.6, 2.4];

/** Neural topology: ring (adjacent) + a few chords. Not a star so it reads as a network, not a pentagram. */
const RADAR_NEURAL_RING: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],
];
const RADAR_NEURAL_CHORDS: [number, number][] = [
  [0, 2], [1, 4], [3, 5],
];
/** Signal speed along each link; per-link phase so signals don’t move in lockstep. */
const NEURAL_SIGNAL_SPEED = 0.00012;
const NEURAL_SIGNAL_PHASE_RING = [0, 0.4, 0.8, 0.2, 0.6, 1.0];
const NEURAL_SIGNAL_PHASE_CHORDS = [0.3, 0.7, 0.1];

function getRadarCorners(values: number[], progress: number, time: number): { x: number; y: number }[] {
  const n = values.length;
  return values.map((v, i) => {
    const angleDeg = (i * 360) / n - 90;
    const rad = (angleDeg * Math.PI) / 180;
    const baseR = RADAR_RADIUS * Math.min(1, v * progress);
    const phaseOffset = RADAR_DRIFT_PHASE[i] ?? i;
    const drift = RADAR_DRIFT_AMP * Math.sin(time * RADAR_DRIFT_SPEED + phaseOffset);
    const r = baseR + drift;
    return {
      x: RADAR_CENTER + r * Math.cos(rad),
      y: RADAR_CENTER + r * Math.sin(rad),
    };
  });
}

function getRadarPointsFromCorners(corners: { x: number; y: number }[]): string {
  return corners.map((c) => `${c.x},${c.y}`).join(' ');
}

/** Labels on a fixed circle only; motion is 100% CSS float so no JS-driven jumps */
const LABEL_RADIUS = RADAR_RADIUS * 1.32;

function getRadarAxisAnimated(
  i: number,
  value: number,
  progress: number,
  time: number
): { axisX: number; axisY: number; labelX: number; labelY: number } {
  const n = 6;
  const phaseOffset = RADAR_DRIFT_PHASE[i] ?? i;
  const drift = RADAR_DRIFT_AMP * Math.sin(time * RADAR_DRIFT_SPEED + phaseOffset);
  const angleDeg = (i * 360) / n - 90;
  const rad = (angleDeg * Math.PI) / 180;
  const baseR = RADAR_RADIUS * Math.min(1, value * progress);
  const animatedR = baseR + drift;
  const axisX = RADAR_CENTER + animatedR * Math.cos(rad);
  const axisY = RADAR_CENTER + animatedR * Math.sin(rad);
  const labelX = RADAR_CENTER + LABEL_RADIUS * Math.cos(rad);
  const labelY = RADAR_CENTER + LABEL_RADIUS * Math.sin(rad);
  return { axisX, axisY, labelX, labelY };
}

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
  const [hoveredStrength, setHoveredStrength] = useState<number | null>(null);
  const [radarProgress, setRadarProgress] = useState(0);
  const [radarTime, setRadarTime] = useState(0);
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
  const radarRef = useRef<HTMLDivElement>(null);
  const radarInView = useInView(radarRef, { once: true, amount: 0.3 });
  useEffect(() => {
    if (!radarInView) return;
    const ctrl = animate(0, 1, { duration: 1.1, ease: 'easeOut', onUpdate: (v) => setRadarProgress(v) });
    return () => ctrl.stop();
  }, [radarInView]);
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      setRadarTime((t) => t + 14);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const radarCorners = useMemo(
    () => getRadarCorners(RADAR_STATS.map((s) => s.value), radarProgress, radarTime),
    [radarProgress, radarTime]
  );

  return (
    <div className="min-h-screen pt-20 relative">
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
              initial={{ y: 0 }}
              animate={{ y: 420 }}
              transition={{ duration: 1.1, ease: 'easeInOut', delay: 0.25 }}
              style={{ top: 0 }}
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
                    Julian Strunz
                  </motion.span>
                </motion.h1>
                <motion.p
                  variants={heroRole}
                  initial="initial"
                  animate="animate"
                  className="text-lg md:text-xl text-white font-medium mb-2"
                >
                  Gameplay Programmer
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
                    className="px-4 py-2 rounded-lg text-sm font-medium border border-primary text-primary hover:bg-primary/10 transition-colors"
                  >
                    Projects
                  </Link>
                  <Link
                    to="/contact"
                    className="px-4 py-2 rounded-lg text-sm font-medium border border-primary/50 text-gray-100 hover:bg-white/5 transition-colors"
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

          {/* —— 3. Core strengths: strict grid — top row LEFT = graph, RIGHT = detail; bottom row 6 cards —— */}
          <motion.div
            className={`rounded-xl border border-primary/30 bg-black/30 p-4 md:p-5 w-full max-w-5xl mx-auto overflow-hidden ${SECTION_SPACE}`}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-60px' }}
            variants={{ initial: {}, animate: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } }}
          >
            <SectionLabel label="Core strengths" className="mb-4" />
            {/* Top row: 2 columns — LEFT = graph; RIGHT = detail (scrolls) + cockpit strip (fixed at bottom, above cards) */}
            <div
              ref={radarRef}
              className="grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] gap-4 md:gap-6 mb-4 w-full min-w-0 items-stretch"
            >
              {/* Left column: radar graph — no internal padding, center 120, larger radius */}
              <motion.div
                className="min-w-0 self-start justify-self-start w-full"
                initial={{ opacity: 0, scale: 0.92 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              >
                <div className="w-full max-w-[480px] aspect-square overflow-visible">
                  <svg viewBox="-15 -15 270 270" className="w-full h-full block overflow-visible" aria-hidden>
                    <defs>
                      <linearGradient id="radar-fill" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="rgba(240,126,65,0.4)" />
                        <stop offset="100%" stopColor="rgba(240,126,65,0.06)" />
                      </linearGradient>
                      <filter id="radar-glow">
                        <feGaussianBlur stdDeviation="1.5" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                      <filter id="radar-highlight-glow" x="-40" y="-40" width="320" height="320" filterUnits="userSpaceOnUse">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                      <filter id="radar-signal-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    {[0.25, 0.5, 0.75, 1].map((r, i) => (
                      <circle
                        key={i}
                        cx="120"
                        cy="120"
                        r={RADAR_RADIUS * r}
                        fill="none"
                        stroke="rgba(240,126,65,0.14)"
                        strokeWidth="0.8"
                      />
                    ))}

                    {/* Neural network: ring + chords, two signals per edge (opposite directions) + glow */}
                    {[...RADAR_NEURAL_RING, ...RADAR_NEURAL_CHORDS].map(([a, b], idx) => {
                      const from = radarCorners[a];
                      const to = radarCorners[b];
                      if (!from || !to) return null;
                      const isRing = idx < RADAR_NEURAL_RING.length;
                      const phase = isRing
                        ? NEURAL_SIGNAL_PHASE_RING[idx]
                        : NEURAL_SIGNAL_PHASE_CHORDS[idx - RADAR_NEURAL_RING.length];
                      const t1 = (radarTime * NEURAL_SIGNAL_SPEED + phase) % 1;
                      const t2 = (radarTime * NEURAL_SIGNAL_SPEED * 0.9 + phase + 0.5) % 1;
                      const sx1 = from.x + (to.x - from.x) * t1;
                      const sy1 = from.y + (to.y - from.y) * t1;
                      const sx2 = from.x + (to.x - from.x) * t2;
                      const sy2 = from.y + (to.y - from.y) * t2;
                      return (
                        <g key={`neural-${a}-${b}`}>
                          <line
                            x1={from.x}
                            y1={from.y}
                            x2={to.x}
                            y2={to.y}
                            stroke="rgba(240,126,65,0.16)"
                            strokeWidth="0.65"
                            strokeLinecap="round"
                          />
                          <circle cx={sx1} cy={sy1} r={1.6} fill="rgba(240,126,65,0.65)" stroke="rgba(240,126,65,0.4)" strokeWidth="0.35" filter="url(#radar-signal-glow)" />
                          <circle cx={sx2} cy={sy2} r={1.2} fill="rgba(240,126,65,0.45)" stroke="rgba(240,126,65,0.3)" strokeWidth="0.3" filter="url(#radar-signal-glow)" />
                        </g>
                      );
                    })}
                    {/* Node “neurons” — soft fill + ring */}
                    {radarCorners.map((c, i) => (
                      <g key={`node-${i}`}>
                        <circle cx={c.x} cy={c.y} r={2.4} fill="rgba(240,126,65,0.08)" />
                        <circle cx={c.x} cy={c.y} r={1.9} fill="rgba(240,126,65,0.22)" stroke="rgba(240,126,65,0.35)" strokeWidth="0.5" />
                      </g>
                    ))}

                    {/* Polygon: unified breathing so edges move as one */}
                    <polygon
                      className="radar-polygon-pulse"
                      points={getRadarPointsFromCorners(radarCorners)}
                      fill="url(#radar-fill)"
                      stroke="rgba(240,126,65,0.55)"
                      strokeWidth="1.4"
                      filter="url(#radar-glow)"
                    />

                    {/* Axis lines: non-highlighted (use animated position) */}
                    {RADAR_STATS.map((stat, i) => {
                      const { axisX, axisY } = getRadarAxisAnimated(
                        i,
                        stat.value,
                        radarProgress,
                        radarTime
                      );
                      const isHighlight = hoveredStrength === i;
                      if (isHighlight) return null;
                      return (
                        <line
                          key={`axis-${stat.label}`}
                          x1={RADAR_CENTER}
                          y1={RADAR_CENTER}
                          x2={axisX}
                          y2={axisY}
                          stroke="rgba(240,126,65,0.22)"
                          strokeWidth="0.8"
                          strokeLinecap="round"
                        />
                      );
                    })}
                    {/* Labels — fixed position (base radius only, no breathe) so they don’t move with the graph */}
                    {RADAR_STATS.map((stat, i) => {
                      const { labelX, labelY } = getRadarAxisAnimated(
                        i,
                        stat.value,
                        radarProgress,
                        radarTime
                      );
                      const isHighlight = hoveredStrength === i;
                      const padH = 6;
                      const padV = 3;
                      const boxW = Math.max(44, stat.label.length * 5.2) + padH * 2;
                      const boxH = 14 + padV * 2;
                      return (
                        <g key={`label-${stat.label}`} transform={`translate(${labelX},${labelY})`}>
                          <rect
                            x={-boxW / 2}
                            y={-boxH / 2}
                            width={boxW}
                            height={boxH}
                            rx="3"
                            ry="3"
                            fill={isHighlight ? 'rgba(20,20,20,0.95)' : 'rgba(0,0,0,0.85)'}
                            stroke={isHighlight ? 'rgba(240,126,65,0.95)' : 'rgba(240,126,65,0.5)'}
                            strokeWidth={isHighlight ? 1.6 : 0.8}
                            className={!isHighlight ? 'radar-label-box-pulse' : undefined}
                          />
                          <text
                            x={0}
                            y={0}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className={isHighlight ? 'fill-primary font-mono' : 'fill-primary/90 font-mono'}
                            style={{ fontSize: '10px', fontWeight: isHighlight ? 700 : 600 }}
                          >
                            {stat.label}
                          </text>
                        </g>
                      );
                    })}
                    {/* Highlighted axis drawn last so it’s on top of labels (fixes top/bottom being covered) */}
                    {hoveredStrength !== null && (() => {
                      const { axisX, axisY } = getRadarAxisAnimated(
                        hoveredStrength,
                        RADAR_STATS[hoveredStrength].value,
                        radarProgress,
                        radarTime
                      );
                      return (
                        <>
                          <line
                            x1={RADAR_CENTER}
                            y1={RADAR_CENTER}
                            x2={axisX}
                            y2={axisY}
                            stroke="rgba(240,126,65,0.9)"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            filter="url(#radar-highlight-glow)"
                          />
                          <line
                            x1={RADAR_CENTER}
                            y1={RADAR_CENTER}
                            x2={axisX}
                            y2={axisY}
                            stroke="rgb(240,126,65)"
                            strokeWidth="1"
                            strokeLinecap="round"
                            opacity="0.95"
                          />
                        </>
                      );
                    })()}
                  </svg>
                </div>
              </motion.div>
              {/* Right column: detail scrolls in flex-1; cockpit strip fixed at bottom (static above cards), no interaction with detail */}
              <motion.div
                className="min-w-0 min-h-0 flex flex-col w-full"
                initial={false}
                animate={{ opacity: hoveredStrength !== null ? 1 : 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-primary/25 bg-black/40 p-4">
                  <h4 className="text-xs font-mono text-primary/70 uppercase tracking-wider mb-2 shrink-0">
                    {hoveredStrength !== null ? CORE_STRENGTHS[hoveredStrength].label : 'Detail'}
                  </h4>
                  {hoveredStrength !== null ? (
                    <ul className="space-y-1.5 text-gray-200 text-sm leading-snug min-w-0">
                      {CORE_STRENGTHS[hoveredStrength].detail.map((line) => (
                        <li key={line} className="flex items-start gap-1.5">
                          <span className="text-primary/50 shrink-0 mt-0.5">·</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-400 text-sm min-w-0">Hover a category to see skills & experience.</p>
                  )}
                </div>
                {/* Cockpit strip: left = racing logs + one graph + lights; right = readouts + lights (balanced) */}
                <div
                  className="flex-shrink-0 h-[140px] mt-3 rounded-lg border border-primary/20 bg-black/50 overflow-hidden font-mono text-[10px] relative flex"
                  aria-hidden
                >
                  {/* Left: Sys/LOG header + racing logs + single bar graph */}
                  <div className="flex-1 min-w-0 flex flex-col border-r border-primary/15">
                    <div className="p-2 border-b border-primary/15 flex items-center gap-2 shrink-0">
                      <span className="text-primary/60 uppercase tracking-widest">Sys</span>
                      <span className="cockpit-blink w-1.5 h-1.5 rounded-full bg-primary/90" style={{ animationDelay: '0s' }} />
                      <span className="text-gray-500">|</span>
                      <span className="text-gray-500">LOG</span>
                      <span className="cockpit-blink w-1.5 h-1.5 rounded-full bg-emerald-500/80" style={{ animationDelay: '0.4s' }} />
                    </div>
                    <div className="flex-1 min-h-0 overflow-hidden">
                      <div className="cockpit-log-race p-2 space-y-0.5 text-gray-500">
                        <div className="flex gap-2"><span className="text-primary/50 shrink-0">›</span><span>0x04A8 .. ok</span></div>
                        <div className="flex gap-2"><span className="text-primary/50 shrink-0">›</span><span>sync 12ms</span></div>
                        <div className="flex gap-2"><span className="text-primary/50 shrink-0">›</span><span>ch[3] idle</span></div>
                        <div className="flex gap-2"><span className="text-primary/50 shrink-0">›</span><span>latency &lt;8</span></div>
                        <div className="flex gap-2"><span className="text-primary/50 shrink-0">›</span><span>tx 0x1B2C ack</span></div>
                        <div className="flex gap-2"><span className="text-primary/50 shrink-0">›</span><span>heap 42%</span></div>
                        <div className="flex gap-2"><span className="text-primary/50 shrink-0">›</span><span>0x04A8 .. ok</span></div>
                        <div className="flex gap-2"><span className="text-primary/50 shrink-0">›</span><span>sync 12ms</span></div>
                        <div className="flex gap-2"><span className="text-primary/50 shrink-0">›</span><span>ch[3] idle</span></div>
                        <div className="flex gap-2"><span className="text-primary/50 shrink-0">›</span><span>latency &lt;8</span></div>
                        <div className="flex gap-2"><span className="text-primary/50 shrink-0">›</span><span>tx 0x1B2C ack</span></div>
                        <div className="flex gap-2"><span className="text-primary/50 shrink-0">›</span><span>heap 42%</span></div>
                      </div>
                    </div>
                    <div className="h-5 px-2 border-t border-primary/15 bg-black/40 flex items-end gap-1 shrink-0">
                      <div className="flex items-end gap-0.5 h-3">
                        {[5, 9, 6, 12, 7].map((h, i) => (
                          <div key={i} className="cockpit-bar-pulse w-1.5 bg-primary/50 rounded-sm flex-shrink-0" style={{ height: `${h}px`, animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                      <span className="text-primary/40 text-[8px] ml-1 uppercase">lvl</span>
                    </div>
                  </div>
                  {/* Right: STAT/IO readouts + blinking LEDs + fake digits */}
                  <div className="w-[48%] min-w-[120px] flex flex-col p-2 gap-2 border-l border-primary/10">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-primary/50 uppercase tracking-wider text-[9px]">Stat</span>
                      <div className="flex gap-1">
                        <span className="cockpit-blink w-1 h-1 rounded-full bg-primary/80" style={{ animationDelay: '0.1s' }} />
                        <span className="cockpit-blink w-1 h-1 rounded-full bg-amber-500/70" style={{ animationDelay: '0.6s' }} />
                        <span className="cockpit-blink w-1 h-1 rounded-full bg-emerald-500/70" style={{ animationDelay: '1.1s' }} />
                      </div>
                    </div>
                    <div className="text-gray-500 text-[9px] space-y-0.5">
                      <div className="flex justify-between"><span>PWR</span><span className="text-primary/60">ON</span></div>
                      <div className="flex justify-between"><span>IO</span><span className="text-primary/50">--</span></div>
                      <div className="flex justify-between"><span>CRC</span><span className="text-emerald-500/70">0x00</span></div>
                    </div>
                    <div className="mt-auto flex items-center justify-end gap-2">
                      <span className="text-primary/30 text-[8px] uppercase">rdy</span>
                      <span className="cockpit-blink w-1.5 h-1.5 rounded-full bg-primary/90" style={{ animationDelay: '0.3s' }} />
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
            {/* Bottom row: 6 cards in one row on desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 md:gap-3 w-full min-w-0">
              {CORE_STRENGTHS.map((group, idx) => (
                <motion.div
                  key={group.label}
                  variants={fadeIn}
                  onMouseEnter={() => setHoveredStrength(idx)}
                  onMouseLeave={() => setHoveredStrength(null)}
                  whileHover={{ y: -2, transition: { duration: 0.2 } }}
                  className={`min-w-0 min-h-[78px] md:min-h-[84px] attention-strength-${idx} rounded-lg border p-3 pl-3 border-l-2 cursor-pointer transition-all duration-200 ${hoveredStrength === idx ? 'border-primary/70 border-l-primary ring-2 ring-primary/60 bg-black/50 shadow-[0_0_20px_rgba(240,126,65,0.18)]' : 'border-primary/25 border-l-primary/60 bg-black/40 hover:border-primary/40 hover:border-l-primary hover:shadow-[0_0_12px_rgba(240,126,65,0.08)]'}`}
                >
                  <h4 className="text-xs font-cyber text-primary uppercase tracking-wider mb-1.5">
                    {group.label}
                  </h4>
                  <ul className="space-y-0.5 text-gray-300 text-xs leading-snug">
                    {group.teaser.map((item) => (
                      <li key={item} className="flex items-start gap-1">
                        <span className="text-primary/50 shrink-0">·</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* —— 4. Profile (typewriter when in view) —— */}
          <motion.div
            className={`profile-panel-breathe rounded-lg border border-primary/20 bg-black/30 p-6 ${SECTION_SPACE}`}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <SectionLabel label="Profile" className="mb-4" />
            <div className="max-w-2xl">
              <TypewriterProfile text={ABOUT_SUMMARY} />
            </div>
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
                  <span className="text-gray-200 font-medium text-sm">Media Technology and Design</span>
                </div>
                <p className="text-gray-100 font-medium text-sm">Hagenberg Campus, FH Upper Austria</p>
                <p className="text-gray-400 text-xs mt-0.5">Oct 2022 – Jul 2025</p>
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
                  <LanguageChip countryCode="gb" label="English" context="Work & projects." />
                  <LanguageChip countryCode="es" label="Spanish" context="Basic." />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </Section>
    </div>
  );
};

export default About;

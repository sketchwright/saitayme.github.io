import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import AnimatedGrid from '@/components/AnimatedGrid';
import ImpactStrip from '@/components/ImpactStrip';
import ProjectCarousel from '@/components/ProjectCarousel';
import MediaHub from '@/components/MediaHub';
import CinematicIntro from '@/components/CinematicIntro';
import QuoteWall from '@/components/QuoteWall';
import SkillAuthorityGrid from '@/components/SkillAuthorityGrid';
import ContactCTA from '@/components/ContactCTA';
import React from 'react';

/** Subtle scroll cue: shown once per session, pinned to the viewport bottom, hidden if it would overlap content. */
const SCROLL_INVITE_DELAY_FIRST = 4200; // after boot + name reveal
const SCROLL_INVITE_DELAY_RETURN = 1200;
const SCROLL_CUE_SEEN_KEY = 'portfolio-scroll-cue-seen';
const SCROLL_CUE_LIFETIME_MS = 4000;

function ScrollInvite({ avoidRef }: { avoidRef: React.RefObject<HTMLElement> }) {
  const [visible, setVisible] = React.useState(true);
  const [fits, setFits] = React.useState(true);

  React.useEffect(() => {
    try { sessionStorage.setItem(SCROLL_CUE_SEEN_KEY, 'true'); } catch (_) {}
    // Only show if there is real empty space between the hero content and the viewport bottom.
    const check = () => {
      const el = avoidRef.current;
      if (!el) return;
      const bottom = el.getBoundingClientRect().bottom;
      setFits(window.innerHeight - bottom > 72);
    };
    check();
    const hide = () => setVisible(false);
    const t = setTimeout(hide, SCROLL_CUE_LIFETIME_MS);
    window.addEventListener('scroll', hide, { passive: true, once: true });
    window.addEventListener('resize', check);
    return () => {
      clearTimeout(t);
      window.removeEventListener('scroll', hide);
      window.removeEventListener('resize', check);
    };
  }, [avoidRef]);

  return (
    <AnimatePresence>
      {visible && fits && (
        <motion.div
          className="fixed inset-x-0 bottom-5 z-20 flex justify-center pointer-events-none"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          aria-hidden
        >
          <div className="flex flex-col items-center gap-1.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.35em] text-primary/60">scroll</span>
            <span className="relative block w-px h-8 overflow-hidden bg-primary/15">
              <span className="scroll-cue-dash absolute left-0 w-px h-3 bg-primary shadow-[0_0_6px_rgba(240,126,65,0.9)]" />
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Thin progress bar on the right — rewards scrolling */
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const height = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);
  return (
    <div className="fixed right-0 top-0 w-1 h-full z-40 pointer-events-none">
      <div className="absolute inset-0 bg-cyber-black/80" />
      <motion.div
        className="absolute bottom-0 left-0 right-0 bg-primary/80 rounded-l"
        style={{ height }}
              />
    </div>
  );
}

interface HomeProps {
  onPlayGame: () => void;
}

const GlitchText = ({ children, delay = 0, initialReveal = false }: { children: string, delay?: number, initialReveal?: boolean }) => {
  const [isRevealed, setIsRevealed] = React.useState(false);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (initialReveal) {
      timerRef.current = setTimeout(() => {
        setIsRevealed(true);
      }, 4200); // Well after boot + hero visible so you see the name glitch then reveal
    }
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [initialReveal]);

  if (!isRevealed && initialReveal) {
    return (
      <motion.div 
        className="relative inline-block"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay }}
      >
        <div className="mega-glitch" data-text={children}>
          {children}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="relative inline-block"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: initialReveal ? 0 : delay }}
    >
      <div className="glitch-text" data-text={children} data-hero-name>
        {children}
      </div>
    </motion.div>
  );
};

const BOOT_SEEN_KEY = 'portfolio-boot-seen';


const DECODE_GLYPHS = '!<>-_\\/[]{}=+*^?#01ABCDEF';
const TerminalText = ({ children, delay = 0, decode = false }: { children: string, delay?: number, decode?: boolean }) => {
  const [text, setText] = React.useState('');
  const [isComplete, setIsComplete] = React.useState(false);
  const [hasStarted, setHasStarted] = React.useState(false);
  const mountedRef = React.useRef(true);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    mountedRef.current = true;
    
    timerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      
      setHasStarted(true);
      if (decode) {
        // fast decode scramble: whole line present, resolves left→right in ~0.4s
        const start = performance.now();
        intervalRef.current = setInterval(() => {
          if (!mountedRef.current) return;
          const p = Math.min(1, (performance.now() - start) / 400);
          const n = Math.floor(p * children.length);
          let out = '';
          for (let i = 0; i < children.length; i++) out += i < n || children[i] === ' ' ? children[i] : DECODE_GLYPHS[Math.floor(Math.random() * DECODE_GLYPHS.length)];
          setText(out);
          if (p >= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
            setIsComplete(true);
          }
        }, 30);
        return;
      }
      let currentText = '';
      let currentIndex = 0;

      intervalRef.current = setInterval(() => {
        if (!mountedRef.current) return;
        
        if (currentIndex < children.length) {
          currentText += children[currentIndex];
          setText(currentText);
          currentIndex++;
        } else {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsComplete(true);
        }
      }, 45); // Slightly faster typing
    }, delay);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [children, delay, decode]);

  // Don't render anything until we've started
  if (!hasStarted) {
    return <div className="font-mono text-primary relative min-h-[1.5em]" />;
  }

  return (
    <div className="font-mono text-primary relative">
      <span className={`${isComplete ? 'after:opacity-0' : 'after:opacity-100'} after:content-['_'] after:animate-pulse after:ml-1`}>
        {text}
      </span>
    </div>
  );
};

const Home = ({ onPlayGame }: HomeProps) => {
  const [hasSeenBoot, setHasSeenBoot] = React.useState(() => {
    if (typeof sessionStorage === 'undefined') return false;
    return sessionStorage.getItem(BOOT_SEEN_KEY) === 'true';
  });
  const [showScrollInvite, setShowScrollInvite] = React.useState(false);
  const heroContentRef = React.useRef<HTMLDivElement>(null);
  const initialHadSeenBoot = React.useRef(hasSeenBoot);

  // After name anim + 1–2s static, show scroll-invite once
  React.useEffect(() => {
    if (!hasSeenBoot) return;
    try { if (sessionStorage.getItem(SCROLL_CUE_SEEN_KEY) === 'true') return; } catch (_) {}
    if (window.scrollY > 40) return;
    const delay = initialHadSeenBoot.current ? SCROLL_INVITE_DELAY_RETURN : SCROLL_INVITE_DELAY_FIRST;
    const t = setTimeout(() => setShowScrollInvite(true), delay);
    return () => clearTimeout(t);
  }, [hasSeenBoot]);

  const gameButtonVariants = React.useMemo(() => ({
    initial: { opacity: 0, y: 20 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        delay: initialHadSeenBoot.current ? 0.3 : 2.6,
        duration: 0.6,
        ease: "easeOut"
      }
    },
    hover: {
      scale: 1.05,
      y: -5,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    }
  }), [hasSeenBoot]);

  // Boot ~1s then overlay goes; hero fades in after, name reveal later so it’s visible
  // Delays are fixed for this mount (based on whether the boot plays now), so nothing re-reveals when the boot ends.
  const firstVisit = !initialHadSeenBoot.current;
  const heroDelay = 0;
  const heroDuration = firstVisit ? 0.2 : 0.5;
  const contentDelays = firstVisit
    ? { glitch: 0, terminal: 1950, paragraph: 0, buttons: 0 }
    : { glitch: 0, terminal: 0, paragraph: 0.2, buttons: 0.3 };

  const handleBootComplete = React.useCallback(() => {
    try { sessionStorage.setItem(BOOT_SEEN_KEY, 'true'); } catch (_) {}
    setHasSeenBoot(true);
  }, []);

  return (
    <div className="min-h-screen bg-cyber-black">
      {!hasSeenBoot && <CinematicIntro onDone={handleBootComplete} />}
      {/* Scanline Effect */}
      <div className="scanline" />

      {/* Hero — full viewport so nothing peeks under the scroll invite */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: heroDuration, delay: heroDelay, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="min-h-[88svh] md:h-[88vh] flex flex-col justify-between relative overflow-hidden"
      >
        {/* Animated Grid Background */}
        <AnimatedGrid />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyber-black/50 to-cyber-black/80" />

        <div className="cyber-container relative z-10 flex-1 flex flex-col justify-center pt-24 pb-8 md:pt-12 md:pb-0">
          <motion.div
            className="text-center space-y-8 md:space-y-12 z-10"
            initial="hidden"
            animate="visible"
          >
            <motion.div className="space-y-8">
              <h1 className="text-6xl md:text-8xl tracking-wider space-y-4">
                <GlitchText delay={contentDelays.glitch} initialReveal={false}>Julian Strunz</GlitchText>
                <div className="h-4 md:h-12" />
                <div className="boot-sub flex flex-col items-center justify-center space-y-4">
                  <div className="text-[#fcee0a] font-cyber tracking-[0.2em] text-2xl md:text-4xl min-h-[3rem] flex items-center">
                    <TerminalText delay={contentDelays.terminal} decode={firstVisit}>{`> MARKETING ENGINEER // GAMEPLAY PROGRAMMER_`}</TerminalText>
                  </div>
                </div>
              </h1>
            </motion.div>

            <motion.p
              initial={firstVisit ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: contentDelays.paragraph, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="boot-wipe text-gray-400 max-w-2xl mx-auto px-4 text-lg font-mono"
            >
              Marketing Engineer at Ingame Studios: I run marketing for Mayhem À La Carte
              and build the tools behind it. Before that, Unreal gameplay &amp; multiplayer on Crime Boss.
              I build games, then I get people to play them.
            </motion.p>

            <motion.div
              initial={firstVisit ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: contentDelays.buttons, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="boot-stamp flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 mt-8"
            >
              <Link to="/projects">
                <motion.button
                  className="cyber-button primary-button cta-glow relative overflow-hidden"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="relative z-10">View Projects</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent animate-shimmer" />
                </motion.button>
              </Link>

              <Link to="/contact">
                <motion.button
                  className="cyber-button secondary-button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Get in Touch
                </motion.button>
              </Link>

              <motion.button
                onClick={onPlayGame}
                className="group relative px-5 py-2.5 font-mono text-xs tracking-[0.3em] uppercase text-primary border border-primary/40 hover:bg-primary hover:text-black transition-colors"
                variants={gameButtonVariants}
                initial={firstVisit ? false : 'initial'}
                animate="animate"
                whileHover="hover"
              >
                <span className="absolute -top-px -left-px w-2.5 h-2.5 border-t border-l border-primary" />
                <span className="absolute -bottom-px -right-px w-2.5 h-2.5 border-b border-r border-primary" />
                <span className="relative flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 bg-primary group-hover:bg-black animate-pulse" />
                  Play Cyber Defender
                </span>
              </motion.button>
            </motion.div>
          </motion.div>
        </div>

        {/* Tags at bottom edge of hero — existing ImpactStrip moved here */}
        <div ref={heroContentRef} className="boot-stats relative z-10 pb-4">
          <ImpactStrip compact={true} />
        </div>

        {showScrollInvite && <ScrollInvite avoidRef={heroContentRef} />}
      </motion.section>

      {/* Scroll progress — rewards scrolling with a filling bar */}
      <ScrollProgress />

      {/* Content below the fold — id for click-to-scroll */}
      <div id="home-explore">
      {/* Featured Project Carousel */}
      <section className="bg-cyber-dark/50">
        <ProjectCarousel />
      </section>

      {/* Media Hub: streams, studio videos, socials, ModKit origins */}
      <section className="bg-cyber-dark/35">
        <MediaHub />
      </section>

      {/* Recommendations / Quotes */}
      <QuoteWall />

      {/* Technical Authority Grid */}
      <section className="bg-cyber-dark/30">
        <SkillAuthorityGrid />
      </section>

      {/* Final Contact CTA */}
      <ContactCTA />
      </div>
    </div>
  );
};

export default Home; 
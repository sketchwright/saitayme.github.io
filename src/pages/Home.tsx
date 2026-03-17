import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import AnimatedGrid from '@/components/AnimatedGrid';
import ImpactStrip from '@/components/ImpactStrip';
import ProjectCarousel from '@/components/ProjectCarousel';
import QuoteWall from '@/components/QuoteWall';
import SkillAuthorityGrid from '@/components/SkillAuthorityGrid';
import ContactCTA from '@/components/ContactCTA';
import React from 'react';

/** Cyberpunk scroll-invite: plays once after hero intro + short static pause */
const SCROLL_INVITE_DELAY_FIRST = 5000;  // after boot: name + static
const SCROLL_INVITE_DELAY_RETURN = 3000; // return visit: content + static

function ScrollInvite() {
  const { scrollYProgress } = useScroll();
  const [exiting, setExiting] = React.useState(false);
  const [hidden, setHidden] = React.useState(false);
  React.useEffect(() => {
    const unsub = scrollYProgress.on('change', (v) => {
      if (v > 0.06) setExiting(true);
    });
    return () => unsub();
  }, [scrollYProgress]);
  if (hidden) return null;
  return (
    <motion.div
      className="absolute inset-x-0 bottom-10 z-20 flex justify-center"
      initial={{ opacity: 0, y: 32 }}
      animate={
        exiting
          ? { opacity: 0, y: 48, scale: 0.96 }
          : { opacity: 1, y: 0, scale: 1 }
      }
      transition={{
        duration: exiting ? 0.5 : 0.55,
        ease: exiting ? [0.4, 0, 0.2, 1] : [0.34, 1.56, 0.64, 1],
      }}
      onAnimationComplete={() => {
        if (exiting) setHidden(true);
      }}
    >
      {/* Panel: punchy “neon on” — scale pop + quick flicker */}
      <motion.div
        className="relative rounded-lg border border-primary/40 bg-cyber-black/95 backdrop-blur-sm px-5 pt-4 pb-3 min-w-[200px]"
        initial={{ opacity: 0, scale: 0.82 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          type: 'spring',
          stiffness: 380,
          damping: 22,
          mass: 0.8,
        }}
        style={{
          boxShadow: '0 0 0 1px rgba(240,126,65,0.15), 0 0 24px rgba(240,126,65,0.08)',
        }}
      >
        {/* Neon “flicker on” — quick flash then settle */}
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-lg"
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.9, 0.15, 0],
          }}
          transition={{
            duration: 0.35,
            times: [0, 0.15, 0.4, 1],
          }}
          style={{
            boxShadow: 'inset 0 0 48px rgba(240,126,65,0.35)',
          }}
        />

        {/* Scanning beam — runs down continuously */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="scroll-invite-scan absolute left-0 right-0 w-full h-8"
            style={{
              background: 'linear-gradient(to bottom, transparent, rgba(240,126,65,0.35), transparent)',
              boxShadow: '0 0 20px rgba(240,126,65,0.4)',
            }}
          />
        </div>

        {/* Terminal-style prompt + label */}
        <div className="relative flex flex-col items-center gap-2">
          <div className="flex items-center justify-center gap-2">
            <span className="font-mono text-primary text-sm">»</span>
            <span className="font-cyber text-primary uppercase tracking-[0.25em] text-xs neon-text">
              Scroll to explore
            </span>
            <motion.span
              className="inline-block w-0.5 h-3.5 bg-primary"
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0.4 }}
            />
          </div>
          {/* Downward chevrons — clear “scroll down” cue */}
          <div className="flex flex-col items-center gap-0.5 text-primary/90">
            <span className="scroll-invite-chevron text-lg leading-none" style={{ textShadow: '0 0 8px rgba(240,126,65,0.5)' }}>▼</span>
            <span className="scroll-invite-chevron scroll-invite-chevron-2 text-sm leading-none opacity-80">▼</span>
            <span className="scroll-invite-chevron scroll-invite-chevron-3 text-xs leading-none opacity-60">▼</span>
          </div>
        </div>

        {/* Subtle corner accents — matches hero, not heavy HUD */}
        <div className="absolute top-1.5 left-1.5 w-2 h-2 border-l border-t border-primary/50 rounded-tl" />
        <div className="absolute top-1.5 right-1.5 w-2 h-2 border-r border-t border-primary/50 rounded-tr" />
        <div className="absolute bottom-1.5 left-1.5 w-2 h-2 border-l border-b border-primary/50 rounded-bl" />
        <div className="absolute bottom-1.5 right-1.5 w-2 h-2 border-r border-b border-primary/50 rounded-br" />
      </motion.div>
    </motion.div>
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
      <div className="glitch-text" data-text={children}>
        {children}
      </div>
    </motion.div>
  );
};

const BOOT_SEEN_KEY = 'portfolio-boot-seen';

const FADE_OUT_MS = 650;
const HOLD_AFTER_LOGS_MS = 550;

const StartupSequence = ({ onComplete }: { onComplete?: () => void }) => {
  const [isComplete, setIsComplete] = React.useState(false);
  const [fadingOut, setFadingOut] = React.useState(false);
  const [text, setText] = React.useState('');
  const [showGlitch, setShowGlitch] = React.useState(false);
  const intervalRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const glitchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = React.useRef(true);
  const onCompleteRef = React.useRef(onComplete);
  onCompleteRef.current = onComplete;
  
  // Simplified, faster text for better performance
  const fullText = `> INITIALIZING NEURAL INTERFACE...
> LOADING CORE MODULES...
> ESTABLISHING CONNECTION...
> BYPASSING SECURITY...
> DECRYPTING DATA...
> ACCESSING PROFILE...

[SYSTEM STATUS]
---------------
NEURAL LINK: ACTIVE
CORE SYSTEMS: ONLINE
SECURITY: MAXIMUM

[PROFILE DATA]
-------------
NAME: JULIAN STRUNZ
ROLE: GAMEPLAY PROGRAMMER
STATUS: ACTIVE

> NEURAL INTERFACE STABILIZED
> INITIATING DISPLAY...
> ACCESS GRANTED_`;

  React.useEffect(() => {
    mountedRef.current = true;
    let currentIndex = 0;
    const CHUNK_SIZE = 12;   // chars per tick
    const TICK_MS = 18;     // ~1s total for full text

    const tick = () => {
      if (!mountedRef.current) return;
      if (currentIndex < fullText.length) {
        const end = Math.min(currentIndex + CHUNK_SIZE, fullText.length);
        currentIndex = end;
        setText(fullText.slice(0, end));
        if (Math.random() < 0.04) {
          setShowGlitch(true);
          if (glitchTimeoutRef.current) clearTimeout(glitchTimeoutRef.current);
          glitchTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) setShowGlitch(false);
          }, 60);
        }
        intervalRef.current = window.setTimeout(tick, TICK_MS) as unknown as ReturnType<typeof setTimeout>;
      } else {
        if (intervalRef.current) clearTimeout(intervalRef.current);
        intervalRef.current = null;
        timeoutRef.current = window.setTimeout(() => {
          if (mountedRef.current) setIsComplete(true);
        }, HOLD_AFTER_LOGS_MS) as unknown as ReturnType<typeof setTimeout>;
      }
    };
    intervalRef.current = window.setTimeout(tick, TICK_MS) as unknown as ReturnType<typeof setTimeout>;

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearTimeout(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
      if (glitchTimeoutRef.current) clearTimeout(glitchTimeoutRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (isComplete) {
      try {
        sessionStorage.setItem(BOOT_SEEN_KEY, 'true');
      } catch (_) {}
      setFadingOut(true);
    }
  }, [isComplete]);

  React.useEffect(() => {
    if (!fadingOut) return;
    fadeTimeoutRef.current = window.setTimeout(() => {
      onCompleteRef.current?.();
    }, FADE_OUT_MS) as unknown as ReturnType<typeof setTimeout>;
    return () => {
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
  }, [fadingOut]);

  return (
    <motion.div
      className="fixed inset-0 bg-cyber-black z-50 flex items-center justify-center pointer-events-none"
      initial={{ opacity: 1 }}
      animate={{ opacity: fadingOut ? 0 : 1 }}
      transition={{ duration: FADE_OUT_MS / 1000, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="matrix-rain" />
      <div className="relative max-w-3xl w-full mx-4">
        <pre className={`font-mono text-primary whitespace-pre-wrap startup-text ${showGlitch ? 'startup-glitch' : ''}`}>
          {text}
        </pre>
        <div className="absolute inset-0 pointer-events-none">
          <div className="scanline opacity-40 animate-pulse" />
        </div>
      </div>
    </motion.div>
  );
};

const TerminalText = ({ children, delay = 0 }: { children: string, delay?: number }) => {
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
  }, [children, delay]);

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
  const initialHadSeenBoot = React.useRef(hasSeenBoot);

  // After name anim + 1–2s static, show scroll-invite once
  React.useEffect(() => {
    if (!hasSeenBoot) return;
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
        delay: hasSeenBoot ? 0.3 : 1.5,
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
  const bootHoldPlusFadeStart = 1 + HOLD_AFTER_LOGS_MS / 1000;
  const heroDelay = hasSeenBoot ? 0 : bootHoldPlusFadeStart;
  const heroDuration = hasSeenBoot ? 0.5 : 1;
  const contentDelays = hasSeenBoot
    ? { glitch: 0, terminal: 0, paragraph: 0.2, buttons: 0.3 }
    : { glitch: bootHoldPlusFadeStart, terminal: 1750, paragraph: 2.2, buttons: 2.6 };

  const handleBootComplete = React.useCallback(() => {
    setHasSeenBoot(true);
  }, []);

  return (
    <div className="min-h-screen bg-cyber-black">
      {!hasSeenBoot && <StartupSequence onComplete={handleBootComplete} />}
      {/* Scanline Effect */}
      <div className="scanline" />

      {/* Hero — full viewport so nothing peeks under the scroll invite */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: heroDuration, delay: heroDelay, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="min-h-screen h-screen flex flex-col justify-between relative overflow-hidden"
      >
        {/* Animated Grid Background */}
        <AnimatedGrid />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyber-black/50 to-cyber-black/80" />

        <div className="cyber-container relative z-10 flex-1 flex flex-col justify-center pt-12">
          <motion.div
            className="text-center space-y-12 z-10"
            initial="hidden"
            animate="visible"
          >
            <motion.div className="space-y-8">
              <h1 className="text-6xl md:text-8xl tracking-wider space-y-4">
                <GlitchText delay={contentDelays.glitch} initialReveal={!hasSeenBoot}>Julian Strunz</GlitchText>
                <div className="h-12" />
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="text-[#fcee0a] font-cyber tracking-[0.2em] text-2xl md:text-4xl min-h-[3rem] flex items-center">
                    <TerminalText delay={contentDelays.terminal}>{`> GAME & ENGINE PROGRAMMER_`}</TerminalText>
                  </div>
                </div>
              </h1>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: contentDelays.paragraph, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="text-gray-400 max-w-2xl mx-auto px-4 text-lg font-mono"
            >
              Crafting immersive gameplay experiences and robust engine tools
              for Unity and Unreal Engine.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: contentDelays.buttons, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 mt-8"
            >
              <Link to="/projects">
                <motion.button
                  className="cyber-button primary-button relative overflow-hidden"
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
                className="cyber-button-game group relative"
                variants={gameButtonVariants}
                initial="initial"
                animate="animate"
                whileHover="hover"
              >
                <span className="relative z-10 flex items-center">
                  <span className="mr-2">🎮</span>
                  Play Cyber Defender
                  <span className="ml-2 text-sm opacity-70">[New!]</span>
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 group-hover:opacity-100 opacity-0 transition-opacity duration-300" />
              </motion.button>
            </motion.div>
          </motion.div>
        </div>

        {/* Tags at bottom edge of hero — existing ImpactStrip moved here */}
        <div className="relative z-10 pb-4">
          <ImpactStrip compact={true} />
        </div>

        {showScrollInvite && <ScrollInvite />}
      </motion.section>

      {/* Scroll progress — rewards scrolling with a filling bar */}
      <ScrollProgress />

      {/* Content below the fold — id for click-to-scroll */}
      <div id="home-explore">
      {/* Featured Project Carousel */}
      <section className="bg-cyber-dark/50">
        <ProjectCarousel />
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
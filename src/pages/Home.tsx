import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FaGamepad, FaTools } from 'react-icons/fa';
import AnimatedGrid from '@/components/AnimatedGrid';
import React from 'react';

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
ROLE: GAME & ENGINE PROGRAMMER
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

      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: heroDuration, delay: heroDelay, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="h-screen flex items-center relative overflow-hidden"
      >
        {/* Animated Grid Background */}
        <AnimatedGrid />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyber-black/50 to-cyber-black" />

        <div className="cyber-container relative z-10">
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
      </motion.section>

      {/* Features Section */}
      <section className="py-20 bg-cyber-dark relative overflow-hidden">
        <div className="cyber-container relative z-10">
          <div className="grid md:grid-cols-2 gap-12">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="cyber-card group"
            >
              <FaGamepad className="text-4xl text-primary mb-4 neon-flicker" />
              <h2 className="text-2xl font-cyber text-white mb-4 group-hover:text-primary group-hover:neon-text transition-all">
                Gameplay Programming
              </h2>
              <p className="text-gray-400 font-mono">
                Specializing in combat systems, procedural generation, and AI behavior
                implementation for engaging player experiences.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="cyber-card group"
            >
              <FaTools className="text-4xl text-primary mb-4 neon-flicker" />
              <h2 className="text-2xl font-cyber text-white mb-4 group-hover:text-primary group-hover:neon-text transition-all">
                Engine Tools
              </h2>
              <p className="text-gray-400 font-mono">
                Building efficient tools and frameworks for scene management, audio systems,
                and custom editor extensions.
              </p>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home; 
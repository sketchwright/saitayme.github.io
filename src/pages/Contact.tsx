import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaItchIo, FaLinkedin, FaGithub, FaEnvelope } from 'react-icons/fa';
import { SiSpotify, SiInstagram } from 'react-icons/si';
import InteractiveBackground from '@/components/InteractiveBackground';

const OPENING_PHASE_MS = 280;
const SUCCESS_PHASE_MS = 380;
const OPENING_DELAY_MS = OPENING_PHASE_MS + SUCCESS_PHASE_MS;
const PRIMARY_IDLE_INTERVAL_MS = 5200;
const SYS_LINE_1_DELAY_MS = 2200;
const SYS_LINE_2_DELAY_MS = 4500;

const socialLinks = [
  {
    name: 'Itch.io',
    url: 'https://itch.io/profile/sssodium',
    icon: FaItchIo,
    color: '#fa5c5c',
    description: 'Game Portfolio',
    hoverHint: 'Browse game projects & releases',
    primary: false,
  },
  {
    name: 'LinkedIn',
    url: 'https://www.linkedin.com/in/julian-strunz/',
    icon: FaLinkedin,
    color: '#0077b5',
    description: 'Professional Network',
    hoverHint: 'Preferred for recruiters',
    primary: true,
  },
  {
    name: 'GitHub',
    url: 'https://github.com/saitayme',
    icon: FaGithub,
    color: '#6e5494',
    description: 'Code Repository',
    hoverHint: 'Browse technical work',
    primary: false,
  },
  {
    name: 'Spotify',
    url: 'https://open.spotify.com/user/huliwun?si=92fb6bdc4dd24ff7',
    icon: SiSpotify,
    color: '#1db954',
    description: 'Music Playlists',
    hoverHint: 'Listen & connect',
    primary: false,
  },
  {
    name: 'Instagram',
    url: 'https://www.instagram.com/saitayme/',
    icon: SiInstagram,
    color: '#e4405f',
    description: 'Visual Stories',
    hoverHint: 'Personal & creative',
    primary: false,
  },
  {
    name: 'Email',
    url: 'mailto:julian.strunz@hotmail.com',
    icon: FaEnvelope,
    color: '#f07e41',
    description: 'Direct Contact',
    hoverHint: 'Fastest response',
    primary: true,
  },
];

const primaryLinks = socialLinks.filter((l) => l.primary);
const primaryNames = primaryLinks.map((l) => l.name);

const Contact = () => {
  const [openingChannel, setOpeningChannel] = useState<string | null>(null);
  const [openingPhase, setOpeningPhase] = useState<'opening' | 'success' | null>(null);
  const [primaryIdleIndex, setPrimaryIdleIndex] = useState(0);
  const [sysLine1, setSysLine1] = useState(false);
  const [sysLine2, setSysLine2] = useState(false);
  const [hoveredChannel, setHoveredChannel] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setPrimaryIdleIndex((i) => (i + 1) % primaryNames.length), PRIMARY_IDLE_INTERVAL_MS);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setSysLine1(true), SYS_LINE_1_DELAY_MS);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setSysLine2(true), SYS_LINE_2_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  const handleChannelClick = (e: React.MouseEvent, link: (typeof socialLinks)[0]) => {
    if (openingChannel) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    setOpeningChannel(link.name);
    setOpeningPhase('opening');
    setTimeout(() => setOpeningPhase('success'), OPENING_PHASE_MS);
    setTimeout(() => {
      if (link.url.startsWith('mailto:')) {
        window.location.href = link.url;
      } else {
        window.open(link.url, '_blank', 'noopener,noreferrer');
      }
      setOpeningChannel(null);
      setOpeningPhase(null);
    }, OPENING_DELAY_MS);
  };

  return (
    <div className="min-h-screen py-24 relative">
      <InteractiveBackground variant="particles" intensity="medium" />

      <div className="cyber-container">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl md:text-6xl font-cyber text-white mb-4 neon-text">
            CONTACT
          </h1>
          <div className="w-32 h-1 bg-primary mx-auto mb-6 shadow-[0_0_15px_rgba(240,126,65,0.5)]" />
          <p className="text-gray-300 text-lg font-mono max-w-2xl mx-auto">
            Establishing secure communication channels...
            <br />
            <span className="text-primary">Connection protocols active</span>
          </p>
        </motion.div>

        {/* Social Links Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {socialLinks.map((link, index) => (
            <motion.a
              key={link.name}
              href={link.url}
              target={link.url.startsWith('mailto:') ? undefined : '_blank'}
              rel="noopener noreferrer"
              onClick={(e) => handleChannelClick(e, link)}
              onMouseEnter={() => setHoveredChannel(link.name)}
              onMouseLeave={() => setHoveredChannel(null)}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group relative overflow-hidden block"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Card Background — primary: stronger hover + idle attention loop */}
              <div
                className={`relative bg-cyber-black border-2 rounded-lg p-6 h-full transition-all duration-300
                  ${link.primary ? 'border-primary/40 hover:border-primary/90 hover:shadow-[0_0_28px_rgba(240,126,65,0.35)]' : 'border-primary/30 hover:border-primary hover:shadow-[0_0_25px_rgba(240,126,65,0.3)]'}
                  ${link.primary && primaryNames[primaryIdleIndex] === link.name ? 'contact-card-idle-active' : ''}`}
              >
                {/* Animated Border Effect */}
                <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute inset-[1px] rounded-lg bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-pulse" />
                </div>

                {/* Icon Container — ping ring on hover + bounce (reward exploration) */}
                <div className="relative z-10 flex flex-col items-center text-center">
                  <motion.div
                    className={`contact-icon-ping-ring w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-all duration-300 ${link.primary ? 'group-hover:shadow-[0_0_24px_rgba(240,126,65,0.3)]' : ''}`}
                    style={{
                      backgroundColor: `${link.color}20`,
                      boxShadow: link.primary ? `0 0 20px ${link.color}50` : `0 0 20px ${link.color}40`,
                    }}
                    whileHover={{ scale: 1.12 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 14 }}
                  >
                    <link.icon
                      className={`w-8 h-8 transition-all duration-300 ${link.primary ? 'group-hover:brightness-110' : ''}`}
                      style={{ color: link.color }}
                    />
                  </motion.div>

                  {/* Platform Name */}
                  <h3 className="text-xl font-cyber text-white mb-2 group-hover:text-primary transition-colors duration-300">
                    {link.name}
                  </h3>

                  {/* Description */}
                  <p className="text-gray-400 text-sm font-mono mb-1">
                    {link.description}
                  </p>
                  {/* Hover guidance — reward exploration: slide up + drawing line */}
                  <div className="mb-4 min-h-[2rem] flex flex-col items-center justify-center">
                    <p className="text-primary/90 text-xs font-mono text-center opacity-0 group-hover:opacity-100 transition-all duration-350 translate-y-1 group-hover:translate-y-0">
                      <span className="text-primary">›</span> {link.name} → {link.hoverHint}
                    </p>
                    <div className="contact-hint-line mt-1.5 h-0.5 w-16 bg-gradient-to-r from-primary to-primary/50 rounded-full shrink-0" />
                  </div>

                  {/* Access Button — primary: breathe + shimmer; click: two-phase reward + success pop */}
                  <div
                    className={`w-full h-8 bg-cyber-black border border-primary/50 rounded flex items-center justify-center font-mono text-xs text-primary transition-all duration-300
                      ${link.primary && !openingChannel ? 'contact-btn-breathe contact-btn-shimmer' : ''}
                      ${openingChannel === link.name && openingPhase === 'success' ? '!border-primary bg-primary/10 shadow-[0_0_20px_rgba(240,126,65,0.35)]' : ''}
                      group-hover:bg-primary/10 group-hover:shadow-[0_0_15px_rgba(240,126,65,0.35)]`}
                  >
                    {openingChannel === link.name ? (
                      openingPhase === 'success' ? (
                        <span className="text-primary font-medium contact-success-pop inline-block">Channel opened ✓</span>
                      ) : (
                        <span className="text-primary/90">&gt; opening channel...</span>
                      )
                    ) : (
                      <>ACCESS CHANNEL</>
                    )}
                  </div>
                </div>

                {/* Hover Glow Effect — stronger for primary */}
                <div
                  className={`absolute inset-0 rounded-lg opacity-0 group-hover:opacity-20 transition-opacity duration-300 pointer-events-none ${link.primary ? 'group-hover:opacity-25' : ''}`}
                  style={{
                    background: `radial-gradient(circle at center, ${link.color} 0%, transparent 70%)`,
                  }}
                />
              </div>
            </motion.a>
          ))}
        </div>

        {/* Bottom Terminal Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16 max-w-4xl mx-auto"
        >
          <div className="bg-cyber-black border-2 border-primary/30 rounded-lg p-6 font-mono">
            <div className="flex items-center mb-4">
              <div className="flex space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                <div className="w-3 h-3 bg-green-500 rounded-full" />
              </div>
              <span className="ml-4 text-primary text-sm">communication_terminal.exe</span>
            </div>

            <div className="text-green-400 text-sm leading-relaxed">
              <p className="mb-2">
                <span className="text-primary">$</span> handshake --initialize
              </p>
              <p className="mb-2">
                <span className="text-gray-500">[OK]</span> All communication channels active
              </p>
              <p className="mb-2">
                <span className="text-gray-500">[OK]</span> Average response time: &lt; 24h
              </p>
              <p className="mb-2">
                <span className="text-gray-500">[OK]</span> Recruiter inquiries prioritized
              </p>
              <p className="mb-2">
                <span className="text-gray-500">[SECURE]</span> AES-256 encryption enabled
              </p>
              <p className="mb-2 mt-3">
                <span className="text-primary">$</span> availability
              </p>
              <p className="mb-2">
                <span className="text-gray-500">[STATUS]</span> Open to opportunities
              </p>
              <p className="mb-2">
                <span className="text-gray-500">[INFO]</span> Worked on shipped title: Crime Boss: Rockay City
              </p>
              {/* Fixed-height slot for delayed [SYS] lines so terminal never grows */}
              <div className="min-h-[3rem] mb-2" aria-hidden>
                <motion.p
                  className="mb-2 text-primary/80"
                  initial={false}
                  animate={{ opacity: sysLine1 ? 1 : 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <span className="text-gray-500">[SYS]</span> 6 channels available — hover to explore
                </motion.p>
                <motion.p
                  className="mb-2 text-primary/80"
                  initial={false}
                  animate={{ opacity: sysLine2 ? 1 : 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <span className="text-gray-500">[SYS]</span> Select a channel to initiate connection
                </motion.p>
              </div>
              {/* Fixed-height slot so "Channel detected" never changes terminal height */}
              <div className="min-h-[1.5rem] mb-2" aria-hidden>
                <motion.p
                  className="text-primary"
                  initial={false}
                  animate={{
                    opacity: hoveredChannel ? 1 : 0,
                    x: hoveredChannel ? 0 : -4,
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <span className="text-gray-500">[SYS]</span> Channel detected: <span className="text-primary font-medium">{hoveredChannel ?? '\u00A0'}</span>
                </motion.p>
              </div>
              <p className="text-primary mt-3 flex items-center gap-0.5 contact-terminal-ready-pulse">
                <span className="text-primary">$</span>
                <span> Ready for incoming transmission</span>
                <span className="contact-terminal-cursor text-primary">_</span>
              </p>
            </div>
          </div>
        </motion.div>

        {/* Floating Contact Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          className="mt-12 text-center"
        >
          <p className="text-gray-500 font-mono text-sm">
            Preferred contact protocol: <span className="text-primary">EMAIL</span>{' '}
            <span className="text-primary/70 text-xs">(Fastest response)</span>
          </p>
          <p className="text-gray-500 font-mono text-xs mt-2">
            julian.strunz@hotmail.com
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Contact; 
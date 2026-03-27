import { motion } from 'framer-motion';
import { useState } from 'react';

type VideoItem = {
  title: string;
  youtubeId: string;
};

const PROMO_VIDEOS: VideoItem[] = [
  { title: 'Crime Boss Modkit Promo 1', youtubeId: 'VIOCtbHPRlI' },
  { title: 'Crime Boss Modkit Promo 2', youtubeId: 'GaMi5qA_dgM' },
];

const TUTORIAL_VIDEOS: VideoItem[] = [
  { title: 'Tutorial 01', youtubeId: 'wBp9MJ_q9Bo' },
  { title: 'Tutorial 02', youtubeId: '_jGFuSeVW_U' },
  { title: 'Tutorial 05', youtubeId: 'asUeFDAknwI' },
  { title: 'Tutorial 06', youtubeId: 'ya2JscKQSaU' },
  { title: 'Tutorial 07', youtubeId: 'uPPTvso86ag' },
  { title: 'Tutorial 08', youtubeId: 'uFRUUdRbM8s' },
  { title: 'Tutorial 09', youtubeId: 'OqiTBeJnAkA' },
  { title: 'Tutorial 10', youtubeId: 'RcEJNEmkBxg' },
  { title: 'Tutorial 11', youtubeId: '5WQAcYlNL6k' },
  { title: 'Tutorial 12', youtubeId: 'xCiBI67ozpg' },
  { title: 'Tutorial 13', youtubeId: 'a4c6ZE0l3gw' },
];

function EmbeddedVideo({ item }: { item: VideoItem }) {
  return (
    <div className="group rounded-xl overflow-hidden border border-primary/35 bg-cyber-black/70 shadow-[0_0_24px_rgba(240,126,65,0.08)] transition-all duration-300 hover:border-primary/60 hover:shadow-[0_0_30px_rgba(240,126,65,0.14)]">
      <div className="relative aspect-video">
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube.com/embed/${item.youtubeId}`}
          title={item.title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <div className="px-3 py-2 border-t border-primary/20 text-xs font-mono text-primary/80 group-hover:text-primary/95">
        {item.title}
      </div>
    </div>
  );
}

export default function ModkitShowcase() {
  const totalVideos = PROMO_VIDEOS.length + TUTORIAL_VIDEOS.length;
  const [showTutorials, setShowTutorials] = useState(false);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6 }}
      className="py-20 md:py-24 relative"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyber-black/15 to-transparent pointer-events-none" />
      <div className="cyber-container relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-8 md:mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4"
        >
          <div>
            <h2 className="text-2xl md:text-3xl font-cyber text-primary uppercase tracking-wider">
              Modkit Media Hub
            </h2>
            <p className="text-gray-400 font-mono text-sm mt-2">
              Promo features + tutorial series showcasing my Crime Boss modkit work
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-primary/35 bg-cyber-black/60 px-3 py-1.5 text-xs font-mono text-primary/90 w-fit">
            <span>{PROMO_VIDEOS.length} promos</span>
            <span className="text-primary/40">•</span>
            <span>{TUTORIAL_VIDEOS.length} tutorials</span>
            <span className="text-primary/40">•</span>
            <span>{totalVideos} total</span>
          </div>
        </motion.div>

        <div className="rounded-xl border border-primary/30 bg-cyber-dark/35 p-4 md:p-5 mb-6 md:mb-7">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-cyber text-primary uppercase tracking-wider">
              Featured Promos
            </h3>
            <span className="text-[11px] font-mono text-primary/70 uppercase tracking-wider">Spotlight</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {PROMO_VIDEOS.map((video, idx) => (
            <motion.div
              key={video.youtubeId}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: idx * 0.08 }}
            >
              <EmbeddedVideo item={video} />
            </motion.div>
          ))}
          </div>
        </div>

        <div className="rounded-xl border border-primary/25 bg-cyber-dark/30 p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-cyber text-primary uppercase tracking-wider">
              Tutorial Series
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wider">Episode index</span>
              <button
                type="button"
                onClick={() => setShowTutorials((v) => !v)}
                className="text-xs font-mono px-3 py-1.5 rounded border border-primary/40 text-primary/85 hover:text-primary hover:border-primary hover:bg-primary/10 transition-colors"
                aria-expanded={showTutorials}
                aria-controls="modkit-tutorial-grid"
              >
                {showTutorials ? 'Hide tutorials' : 'Show tutorials'}
              </button>
            </div>
          </div>
          <motion.div
            id="modkit-tutorial-grid"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={`relative ${showTutorials ? '' : 'max-h-[260px] overflow-hidden rounded-lg'}`}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {TUTORIAL_VIDEOS.map((video, idx) => (
                <motion.div
                  key={video.youtubeId}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: Math.min(idx * 0.03, 0.3) }}
                >
                  <EmbeddedVideo item={video} />
                </motion.div>
              ))}
            </div>
            {!showTutorials && (
              <div
                className="absolute inset-x-0 bottom-0 h-16 pointer-events-none"
                style={{ background: 'linear-gradient(to bottom, transparent, rgba(10,10,10,0.92))' }}
              />
            )}
          </motion.div>
          {!showTutorials && (
            <p className="mt-3 text-xs font-mono text-gray-500">
              Showing first row. Click <span className="text-primary/90">Show tutorials</span> to expand all {TUTORIAL_VIDEOS.length} episodes.
            </p>
          )}
        </div>
      </div>
    </motion.section>
  );
}

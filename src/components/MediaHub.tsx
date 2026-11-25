import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MEDIA_CHANNELS, MediaItem, ChannelLink } from '@/data/media';
import { FaTwitch, FaYoutube, FaInstagram, FaGlobe } from 'react-icons/fa';
import ScrambleText from '@/components/ScrambleText';

function thumbOf(item: MediaItem): string | undefined {
  if (item.thumbnail) return item.thumbnail;
  if (item.youtubeId) return `https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`;
  return undefined;
}

/** Spotlight player: shows a poster until clicked, then loads the YouTube iframe (keeps the page fast). */
function Spotlight({ item }: { item: MediaItem }) {
  const [playing, setPlaying] = useState(false);
  const thumb = thumbOf(item);
  const isExternal = !item.youtubeId && item.url;

  return (
    <div className="relative rounded-xl overflow-hidden border-2 border-primary/40 bg-cyber-black shadow-[0_0_40px_rgba(240,126,65,0.12)]">
      {/* HUD corners */}
      {['top-2 left-2 border-l-2 border-t-2', 'top-2 right-2 border-r-2 border-t-2', 'bottom-2 left-2 border-l-2 border-b-2', 'bottom-2 right-2 border-r-2 border-b-2'].map((c) => (
        <span key={c} className={`absolute ${c} w-4 h-4 border-primary/80 z-20 pointer-events-none`} />
      ))}
      <div className="relative aspect-video">
        {playing && item.youtubeId ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${item.youtubeId}?autoplay=1&rel=0`}
            title={item.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            className="group absolute inset-0 w-full h-full"
            onClick={() => (isExternal ? window.open(item.url, '_blank', 'noopener') : setPlaying(true))}
            aria-label={`Play ${item.title}`}
          >
            {thumb && <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />}
            <div className="absolute inset-0 bg-gradient-to-t from-cyber-black via-cyber-black/20 to-transparent" />
            <div className="media-scanlines absolute inset-0 pointer-events-none" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="relative flex items-center justify-center w-20 h-20 rounded-full border-2 border-primary bg-cyber-black/70 backdrop-blur-sm shadow-[0_0_30px_rgba(240,126,65,0.5)] transition-transform duration-300 group-hover:scale-110">
                <span className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-30" />
                <span className="ml-1 w-0 h-0 border-y-[12px] border-y-transparent border-l-[20px] border-l-primary" />
              </span>
            </span>
            <span className="absolute left-4 bottom-4 right-4 text-left">
              {item.meta && <span className="block text-[11px] font-mono uppercase tracking-[0.2em] text-primary/90 mb-1">{item.meta}</span>}
              <span className="block font-cyber text-lg md:text-2xl text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">{item.title}</span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

const LINK_ICON = { twitch: FaTwitch, youtube: FaYoutube, instagram: FaInstagram, web: FaGlobe } as const;

function LinkChip({ link, big = false }: { link: ChannelLink; big?: boolean }) {
  const Icon = LINK_ICON[link.kind];
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group inline-flex items-center gap-3 rounded-lg border border-primary/30 bg-cyber-black/70 hover:border-primary hover:bg-primary/10 hover:shadow-[0_0_20px_rgba(240,126,65,0.2)] transition-all ${big ? 'px-5 py-4' : 'px-3 py-1.5'}`}
    >
      <Icon className={`text-primary ${big ? 'text-2xl' : 'text-sm'}`} />
      <span className={`font-mono text-gray-200 group-hover:text-white ${big ? 'text-sm' : 'text-xs'}`}>{link.label}</span>
      <span className="text-primary/60 group-hover:text-primary text-xs">↗</span>
    </a>
  );
}

export default function MediaHub() {
  const channels = useMemo(() => MEDIA_CHANNELS.filter((c) => c.items.length > 0 || (c.links?.length ?? 0) > 0), []);
  const [channelId, setChannelId] = useState(channels[0]?.id);
  const channel = channels.find((c) => c.id === channelId) ?? channels[0];
  const [activeIdx, setActiveIdx] = useState(0);
  const total = channels.reduce((n, c) => n + c.items.length, 0);

  if (!channel) return null;
  const active = channel.items.length ? channel.items[Math.min(activeIdx, channel.items.length - 1)] : undefined;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6 }}
      className="py-20 md:py-24 relative"
    >
      <div className="cyber-container relative z-10">
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-[11px] font-mono text-primary/70 uppercase tracking-[0.3em] mb-2">› on camera</p>
            <ScrambleText as="h2" text="MEDIA HUB" className="text-2xl md:text-4xl font-cyber text-primary tracking-wider neon-text" />
            <p className="text-gray-400 font-mono text-sm mt-2 max-w-xl">{channel.tagline}</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-primary/90">
            <span className="relative flex w-2.5 h-2.5">
              <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-60" />
              <span className="relative w-2.5 h-2.5 rounded-full bg-red-500" />
            </span>
            <span className="uppercase tracking-wider">{total} videos indexed</span>
          </div>
        </div>

        {/* Channel tabs */}
        {channels.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-6" role="tablist">
            {channels.map((c) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={c.id === channel.id}
                onClick={() => {
                  setChannelId(c.id);
                  setActiveIdx(0);
                }}
                className={`relative px-4 py-2 rounded-md font-cyber text-xs uppercase tracking-wider transition-colors ${c.id === channel.id ? 'text-cyber-black' : 'text-primary border border-primary/30 hover:border-primary'}`}
              >
                {c.id === channel.id && (
                  <motion.span layoutId="media-tab" className="absolute inset-0 rounded-md bg-primary shadow-[0_0_18px_rgba(240,126,65,0.5)]" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />
                )}
                <span className="relative">{c.label}</span>
              </button>
            ))}
          </div>
        )}

        {channel.links && channel.links.length > 0 && active && (
          <div className="flex flex-wrap gap-2 mb-4">
            {channel.links.map((l) => <LinkChip key={l.url} link={l} />)}
          </div>
        )}

        {!active ? (
          <div className="rounded-xl border border-primary/25 bg-cyber-dark/40 p-6 md:p-10 flex flex-wrap gap-4">
            {(channel.links ?? []).map((l) => <LinkChip key={l.url} link={l} big />)}
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${channel.id}-${activeIdx}`}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 14 }}
              transition={{ duration: 0.28 }}
            >
              <Spotlight item={active} />
            </motion.div>
          </AnimatePresence>

          {/* Playlist rail */}
          <div className="rounded-xl border border-primary/25 bg-cyber-dark/40 p-2 lg:max-h-[420px] overflow-y-auto media-rail">
            <div className="flex items-center justify-between px-2 py-1.5 mb-1">
              <span className="text-[11px] font-mono text-primary/80 uppercase tracking-wider">Playlist · {channel.items.length}</span>

            </div>
            <ul className="space-y-1.5">
              {channel.items.map((item, i) => {
                const thumb = thumbOf(item);
                const on = i === activeIdx;
                return (
                  <li key={`${item.title}-${i}`}>
                    <button
                      type="button"
                      onClick={() => setActiveIdx(i)}
                      className={`group w-full flex items-center gap-3 p-1.5 rounded-lg text-left transition-all ${on ? 'bg-primary/15 ring-1 ring-primary/60' : 'hover:bg-primary/5'}`}
                    >
                      <span className="relative w-24 shrink-0 aspect-video rounded overflow-hidden border border-primary/20 bg-cyber-black">
                        {thumb && <img src={thumb} alt="" loading="lazy" className="w-full h-full object-cover" />}
                        {on && <span className="absolute inset-0 bg-primary/20 flex items-center justify-center text-[9px] font-mono text-white tracking-widest">▶ NOW</span>}
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-xs font-mono truncate ${on ? 'text-primary' : 'text-gray-300 group-hover:text-primary/90'}`}>{item.title}</span>
                        {item.meta && <span className="block text-[10px] font-mono text-gray-500 truncate">{item.meta}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        )}
      </div>
    </motion.section>
  );
}

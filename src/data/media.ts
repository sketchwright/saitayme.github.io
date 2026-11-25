/**
 * Media Hub content. Each channel shows its videos (spotlight + playlist) and/or
 * its outbound channel links. Channels with neither are hidden.
 *
 * youtubeId: the part after "watch?v=" or "youtu.be/".
 * For non-YouTube media (Twitch VOD, TikTok, Instagram…), use `url` + `thumbnail`.
 */
export type MediaItem = {
  title: string;
  /** Short context line, e.g. "Mayhem À La Carte · Dev stream" */
  meta?: string;
  youtubeId?: string;
  url?: string;
  thumbnail?: string;
};

export type ChannelLink = {
  label: string;
  url: string;
  kind: 'twitch' | 'youtube' | 'instagram' | 'web';
};

export type MediaChannel = {
  id: string;
  label: string;
  tagline: string;
  links?: ChannelLink[];
  items: MediaItem[];
};

export const MEDIA_CHANNELS: MediaChannel[] = [
  {
    id: 'live',
    label: 'Dev Streams',
    tagline: 'Live dev streams for Mayhem À La Carte on Twitch and YouTube.',
    links: [
      { label: 'Ingame Studios on Twitch', url: 'https://www.twitch.tv/ingame_studios', kind: 'twitch' },
      { label: 'Ingame Studios on YouTube', url: 'https://www.youtube.com/@IngameStudiosGames', kind: 'youtube' },
    ],
    items: [
      { title: 'Mayhem À La Carte Dev Stream', meta: 'Nov 2026 · Ingame Studios', youtubeId: '0BKtmrlAXZs' },
      { title: 'Mayhem À La Carte Dev Stream', meta: 'Nov 2026 · Ingame Studios', youtubeId: 'f6YXXkD4atM' },
      { title: 'Mayhem À La Carte Dev Stream', meta: 'Oct 2026 · Ingame Studios', youtubeId: 'jhweuFVXR6Q' },
      { title: 'Mayhem À La Carte Dev Stream', meta: 'Oct 2026 · Ingame Studios', youtubeId: 'NEcMjLHvhWA' },
    ],
  },
  {
    id: 'modkit',
    label: 'ModKit',
    tagline: 'Where it started: ModKit streams, promos and my 11-part tutorial series.',
    links: [{ label: 'Crime Boss ModKit website', url: 'https://cbmodkit.ingamestudios.com/', kind: 'web' }],
    items: [
      { title: 'What’s in ModKit 1.0?', meta: 'ModKit stream', youtubeId: 'ACxK5sQ2BV4' },
      { title: 'ModKit Stream with Vax', meta: 'ModKit stream', youtubeId: 'Tc1vXolh7aE' },
      { title: 'Community Showcase #8', meta: 'ModKit stream', youtubeId: 'kcynC2FRxTE' },
      { title: 'Crime Boss ModKit — Promo 1', meta: 'Promo', youtubeId: 'VIOCtbHPRlI' },
      { title: 'Crime Boss ModKit — Promo 2', meta: 'Promo', youtubeId: 'GaMi5qA_dgM' },
      { title: 'Tutorial 01', meta: 'ModKit tutorial', youtubeId: 'wBp9MJ_q9Bo' },
      { title: 'Tutorial 02', meta: 'ModKit tutorial', youtubeId: '_jGFuSeVW_U' },
      { title: 'Tutorial 05', meta: 'ModKit tutorial', youtubeId: 'asUeFDAknwI' },
      { title: 'Tutorial 06', meta: 'ModKit tutorial', youtubeId: 'ya2JscKQSaU' },
      { title: 'Tutorial 07', meta: 'ModKit tutorial', youtubeId: 'uPPTvso86ag' },
      { title: 'Tutorial 08', meta: 'ModKit tutorial', youtubeId: 'uFRUUdRbM8s' },
      { title: 'Tutorial 09', meta: 'ModKit tutorial', youtubeId: 'OqiTBeJnAkA' },
      { title: 'Tutorial 10', meta: 'ModKit tutorial', youtubeId: 'RcEJNEmkBxg' },
      { title: 'Tutorial 11', meta: 'ModKit tutorial', youtubeId: '5WQAcYlNL6k' },
      { title: 'Tutorial 12', meta: 'ModKit tutorial', youtubeId: 'xCiBI67ozpg' },
      { title: 'Tutorial 13', meta: 'ModKit tutorial', youtubeId: 'a4c6ZE0l3gw' },
    ],
  },
  {
    id: 'social',
    label: 'Socials',
    tagline: 'Channels I run for Mayhem À La Carte.',
    links: [
      { label: 'Mayhem À La Carte on Instagram', url: 'https://www.instagram.com/mayhemalacarte', kind: 'instagram' },
      { label: 'Mayhem À La Carte on YouTube', url: 'https://www.youtube.com/@Mayhem%C3%80LaCarte', kind: 'youtube' },
    ],
    items: [],
  },
];

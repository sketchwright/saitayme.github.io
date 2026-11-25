/**
 * Media Hub content. Add videos here — the Home page Media Hub renders every
 * channel that has at least one item (empty channels are hidden).
 *
 * youtubeId: the part after "watch?v=" or "youtu.be/".
 * For Twitch VODs / clips or social posts, use `url` + `thumbnail` instead.
 */
export type MediaItem = {
  title: string;
  /** Short context line, e.g. "Twitch · Mayhem dev stream" */
  meta?: string;
  youtubeId?: string;
  /** External link for non-YouTube media (Twitch VOD, TikTok, X, Instagram…) */
  url?: string;
  /** Required when using `url` (no YouTube thumbnail available) */
  thumbnail?: string;
};

export type MediaChannel = {
  id: string;
  label: string;
  tagline: string;
  /** Optional "visit channel" link */
  channelUrl?: string;
  items: MediaItem[];
};

export const MEDIA_CHANNELS: MediaChannel[] = [
  {
    id: 'live',
    label: 'Live & Streams',
    tagline: 'Hosting dev streams on Twitch and YouTube for Crime Boss and Mayhem À La Carte.',
    items: [
      // { title: 'Mayhem À La Carte dev stream #1', meta: 'Twitch · co-host', youtubeId: '...' },
    ],
  },
  {
    id: 'studio',
    label: 'Ingame Studios YouTube',
    tagline: 'Studio videos I appear in or produced.',
    items: [
      // { title: '...', meta: 'Ingame Studios', youtubeId: '...' },
    ],
  },
  {
    id: 'social',
    label: 'Socials',
    tagline: 'Short-form content I made or star in.',
    items: [
      // { title: '...', meta: 'TikTok', url: 'https://…', thumbnail: '/media/…jpg' },
    ],
  },
  {
    id: 'modkit',
    label: 'ModKit Origins',
    tagline: 'Where it started: promos and my 11-part Crime Boss ModKit tutorial series.',
    channelUrl: 'https://igstudios.atlassian.net/wiki/spaces/CBMK',
    items: [
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
];

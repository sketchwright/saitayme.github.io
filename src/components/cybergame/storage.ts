// localStorage helpers that never throw (private mode, blocked storage, SSR).

const BEST_KEY = 'cyberDefenderHighScore';
const MUTE_KEY = 'cyberDefenderMuted';

export const loadBest = (): number => {
  try {
    const v = parseInt(window.localStorage.getItem(BEST_KEY) || '0', 10);
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
};

export const saveBest = (score: number): void => {
  try {
    window.localStorage.setItem(BEST_KEY, String(Math.floor(score)));
  } catch {
    /* ignore */
  }
};

export const loadMuted = (): boolean => {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
};

export const saveMuted = (muted: boolean): void => {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* ignore */
  }
};

// localStorage helpers that never throw (private mode, blocked storage, SSR).

const BEST_KEY = 'cyberDefenderBestRun';
const MUTE_KEY = 'cyberDefenderMuted';
const AUTO_KEY = 'cyberDefenderAutoFire';
const HARD_KEY = 'cyberDefenderHard';

const get = (k: string): string | null => {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};

const set = (k: string, v: string): void => {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

export const loadBest = (): number => {
  const v = parseInt(get(BEST_KEY) || '0', 10);
  return Number.isFinite(v) && v > 0 ? v : 0;
};

export const saveBest = (score: number): void => set(BEST_KEY, String(Math.floor(score)));

export const loadMuted = (): boolean => get(MUTE_KEY) === '1';
export const saveMuted = (muted: boolean): void => set(MUTE_KEY, muted ? '1' : '0');

/** Auto-fire defaults to on. */
export const loadAutoFire = (): boolean => get(AUTO_KEY) !== '0';
export const saveAutoFire = (on: boolean): void => set(AUTO_KEY, on ? '1' : '0');

export const loadHard = (): boolean => get(HARD_KEY) === '1';
export const saveHard = (on: boolean): void => set(HARD_KEY, on ? '1' : '0');

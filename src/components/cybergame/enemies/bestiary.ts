// Dev-only bestiary: live grid of every enemy type + a pursuit arena.
// Served by Vite at /bestiary.html; not part of the production build.

import {
  BOSS_SIZE,
  Boss,
  BossTell,
  bossVariantCount,
  CRAWLER_SIZE,
  Enemy,
  EnemyKind,
  FRAGMENT_SIZE,
  LEECH_SIZE,
  Leech,
  SENTINEL_SIZE,
  SWARM_SIZE,
  SwarmNode,
  TAU,
  Vec,
  WRAITH_SIZE,
  beginSplit,
  bossCharge,
  createEnemy,
  drawEnemy,
  drawEnemyDebug,
  hurtEnemy,
  isDying,
  killEnemy,
  leechIsLatched,
  leechToggleLatch,
  monoFont,
  provokeEnemy,
  setBossPhase,
  spawnEnemy,
  updateEnemy,
} from './index';

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };
type CellKind = 'crawler' | 'wraith' | 'leech' | 'swarm' | 'sentinel' | 'boss' | 'pursuit';

interface Cell {
  kind: CellKind;
  no: string;
  label: string;
  sub: string;
  hint: string;
  span: number;
  hMul: number;
  x: number;
  y: number;
  w: number;
  h: number;
  enemies: Enemy[];
  target: Vec;
  mouseIn: boolean;
  respawnT: number;
  ph: number;
}

const HEADER = 44;
const SIZES: Record<EnemyKind, number> = {
  crawler: CRAWLER_SIZE,
  wraith: WRAITH_SIZE,
  leech: LEECH_SIZE,
  swarm: SWARM_SIZE,
  fragment: FRAGMENT_SIZE,
  sentinel: SENTINEL_SIZE,
  boss: BOSS_SIZE,
};

const canvasEl = document.getElementById('c');
const spacer = document.getElementById('spacer');
const statsEl = document.getElementById('stats');
if (!(canvasEl instanceof HTMLCanvasElement)) throw new Error('bestiary: canvas missing');
const canvas: HTMLCanvasElement = canvasEl;
const ctx2 = canvas.getContext('2d');
if (!ctx2) throw new Error('bestiary: no 2d context');
const ctx: Ctx = ctx2;

const state = {
  scale: 1,
  debug: false,
  slow: false,
  paused: false,
  stress: false,
  bossP2: false,
  bossPhase: 0,
  bossVariant: 2,
  bossTell: 0,
  chaos: false,
  time: 0,
  mouseX: -1,
  mouseY: -1,
  mouseOver: false,
  viewW: 0,
  viewH: 0,
  layoutH: 0,
  dpr: 1,
};

let seedCounter = 1;
const nextSeed = (): number => (seedCounter = (seedCounter * 16807 + 11) % 2147483647);

const spawn = (kind: EnemyKind, x: number, y: number): Enemy => createEnemy(kind, x, y, nextSeed(), { size: SIZES[kind] * state.scale });

const CELL_DEFS: Array<Omit<Cell, 'x' | 'y' | 'w' | 'h' | 'enemies' | 'target' | 'mouseIn' | 'respawnT' | 'ph'>> = [
  { kind: 'crawler', no: '01', label: 'CRAWLER', sub: 'BLADE WALKER / 5 LIMBS, 1 DRAGGED', hint: 'CLICK: FREEZE > LUNGE', span: 1, hMul: 1 },
  { kind: 'wraith', no: '02', label: 'WRAITH', sub: 'TORN VEIL / PHASING FLYER', hint: 'CLICK: PHASE STRIKE', span: 1, hMul: 1 },
  { kind: 'leech', no: '03', label: 'LEECH', sub: 'SEGMENTED LANCE / DRAIN', hint: 'CLICK: LATCH / RELEASE', span: 1, hMul: 1 },
  { kind: 'swarm', no: '04', label: 'SWARM-NODE', sub: 'CUBE CLUSTER / SPLITS', hint: 'CLICK: SPLIT', span: 1, hMul: 1 },
  { kind: 'sentinel', no: '05', label: 'SENTINEL', sub: 'ARMORED LENS TOWER', hint: 'CLICK: CHARGE + FIRE', span: 2, hMul: 1 },
  { kind: 'boss', no: '06', label: 'BOSS / ROGUE EYE', sub: 'PHASE 1  TELL NONE', hint: 'B: PHASE  V: VARIANT  T: TELL', span: 99, hMul: 1.6 },
  { kind: 'pursuit', no: '07', label: 'PURSUIT', sub: 'ALL TYPES CHASE THE CURSOR', hint: 'CLICK: SPLIT NEAREST NODE / PROVOKE ALL', span: 99, hMul: 1.5 },
];

let cells: Cell[] = [];

function populate(c: Cell): void {
  const cx = c.w / 2;
  const cy = c.h / 2;
  c.enemies = [];
  c.respawnT = 0;
  switch (c.kind) {
    case 'pursuit': {
      const mix: EnemyKind[] = ['leech', 'leech', 'sentinel', 'crawler', 'crawler', 'crawler', 'swarm', 'swarm', 'fragment', 'fragment', 'fragment', 'wraith', 'wraith'];
      mix.forEach((k, i) => {
        const a = (i / mix.length) * TAU;
        c.enemies.push(spawn(k, cx + Math.cos(a) * c.w * 0.35, cy + Math.sin(a) * c.h * 0.32));
      });
      if (state.stress) addStress(c);
      break;
    }
    case 'boss': {
      const b = createEnemy('boss', cx, state.bossVariant === 0 ? c.h * 0.3 : cy, nextSeed(), { size: SIZES.boss * state.scale, variant: state.bossVariant }) as Boss;
      setBossPhase(b, state.bossPhase);
      b.bossTell = TELLS[state.bossTell];
      c.enemies.push(b);
      break;
    }
    default:
      c.enemies.push(spawn(c.kind, cx, cy));
  }
}

function addStress(c: Cell): void {
  const kinds: EnemyKind[] = ['crawler', 'crawler', 'crawler', 'wraith', 'leech', 'fragment', 'swarm', 'crawler'];
  for (let i = 0; i < 60; i++) {
    const k = kinds[i % kinds.length];
    c.enemies.push(spawn(k, 20 + Math.random() * (c.w - 40), 20 + Math.random() * (c.h - 40)));
  }
}

function layout(): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  state.dpr = dpr;
  state.viewW = document.documentElement.clientWidth || window.innerWidth;
  state.viewH = window.innerHeight - HEADER;
  canvas.width = Math.round(state.viewW * dpr);
  canvas.height = Math.round(state.viewH * dpr);
  canvas.style.width = `${state.viewW}px`;
  canvas.style.height = `${state.viewH}px`;

  const W = state.viewW;
  const s = state.scale;
  const base = Math.min(W, 330 * s);
  const cols = Math.max(1, Math.floor(W / base));
  const cw = W / cols;
  const ch = Math.min(290 * s, Math.max(240, cw * 0.95));
  const old = cells;
  cells = [];
  let col = 0;
  let y = 0;
  let rowH = 0;
  for (const d of CELL_DEFS) {
    const span = Math.min(cols, d.span);
    if (col + span > cols) {
      y += rowH;
      col = 0;
      rowH = 0;
    }
    const h = ch * d.hMul;
    const prev = old.find((o) => o.kind === d.kind);
    cells.push({ ...d, x: col * cw, y, w: cw * span, h, enemies: [], target: { x: 0, y: 0 }, mouseIn: false, respawnT: 0, ph: prev?.ph ?? Math.random() * TAU });
    col += span;
    rowH = Math.max(rowH, h);
  }
  state.layoutH = y + rowH;
  if (spacer) spacer.style.height = `${state.layoutH + HEADER}px`;
  for (const c of cells) populate(c);
}

// ---------------------------------------------------------------------------
// Input

const worldMouse = (ev: MouseEvent): void => {
  const r = canvas.getBoundingClientRect();
  state.mouseX = ev.clientX - r.left;
  state.mouseY = ev.clientY - r.top + window.scrollY;
  state.mouseOver = true;
};
canvas.addEventListener('mousemove', worldMouse);
canvas.addEventListener('mouseleave', () => (state.mouseOver = false));
window.addEventListener('scroll', () => (state.mouseOver = false));

const cellAt = (x: number, y: number): Cell | undefined => cells.find((c) => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h);

canvas.addEventListener('click', (ev) => {
  worldMouse(ev);
  const c = cellAt(state.mouseX, state.mouseY);
  if (!c) return;
  const lx = state.mouseX - c.x;
  const ly = state.mouseY - c.y;
  switch (c.kind) {
    case 'swarm':
      for (const e of c.enemies) if (e.kind === 'swarm') beginSplit(e);
      break;
    case 'boss':
      toggleBoss();
      break;
    case 'leech':
      for (const e of c.enemies) if (e.kind === 'leech') leechToggleLatch(e);
      break;
    case 'pursuit': {
      let best: SwarmNode | null = null;
      let bd = 80 * state.scale;
      for (const e of c.enemies) {
        if (e.kind !== 'swarm' || !e.alive) continue;
        const d = Math.hypot(e.x - lx, e.y - ly);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      if (best) beginSplit(best);
      else for (const e of c.enemies) provokeEnemy(e);
      break;
    }
    default:
      for (const e of c.enemies) provokeEnemy(e);
  }
});

const TELLS: BossTell[] = ['none', 'laserGrid', 'charge', 'teleport', 'clone', 'tether', 'spiral', 'beam', 'hack', 'sweep', 'burst', 'summon'];
const VARIANT_NAMES = ['WARDEN.EXE', 'ECHO', 'ROGUE EYE'];

function bossSub(): void {
  const bc = cells.find((c) => c.kind === 'boss');
  if (!bc) return;
  bc.label = `BOSS / ${VARIANT_NAMES[state.bossVariant]}`;
  bc.sub = `PHASE ${state.bossPhase + 1}  TELL ${TELLS[state.bossTell].toUpperCase()}`;
}

/** B: cycle phase 1 -> 2 -> 3 -> 1 */
function toggleBoss(): void {
  state.bossPhase = (state.bossPhase + 1) % 3;
  state.bossP2 = state.bossPhase > 0;
  for (const c of cells) for (const e of c.enemies) if (e.kind === 'boss') setBossPhase(e, state.bossPhase);
  bossSub();
  syncButtons();
}

/** V: next boss variant (respawns the boss cell) */
function cycleVariant(): void {
  state.bossVariant = (state.bossVariant + 1) % bossVariantCount;
  const bc = cells.find((c) => c.kind === 'boss');
  if (bc) populate(bc);
  bossSub();
}

/** T: cycle the telegraph shown on the boss */
function cycleTell(): void {
  state.bossTell = (state.bossTell + 1) % TELLS.length;
  for (const c of cells) for (const e of c.enemies) if (e.kind === 'boss') e.bossTell = TELLS[state.bossTell];
  bossSub();
}

function lungeAll(): void {
  for (const c of cells) {
    for (const e of c.enemies) {
      if (e.kind === 'leech' && leechIsLatched(e as Leech)) continue;
      if (e.kind === 'boss') bossCharge(e);
      else provokeEnemy(e);
    }
  }
}

// ---------------------------------------------------------------------------
// Chaos test: abrupt random / absurd / NaN intents, teleports, dt spikes on
// the pursuit cell. Leg sanity is measured and shown on the cell.

interface ChaosIn {
  v: Vec;
  t: number;
}
const chaosIn = new WeakMap<Enemy, ChaosIn>();
const chaosStats = { stretch: 0, segErr: 0, snaps: 0, winStretch: 0, winSeg: 0, winT: 0, spikeT: 1 };

function legSanity(list: Enemy[]): void {
  for (const e of list) {
    if (e.kind !== 'crawler' && e.kind !== 'sentinel') continue;
    for (const L of e.rig.legs) {
      if (L.det >= 0) continue;
      const n = L.n;
      const reach = Math.hypot(L.j[n * 2] - L.j[0], L.j[n * 2 + 1] - L.j[1]) / L.total;
      if (reach > chaosStats.winStretch) chaosStats.winStretch = reach;
      for (let k = 0; k < n; k++) {
        const l = Math.hypot(L.j[k * 2 + 2] - L.j[k * 2], L.j[k * 2 + 3] - L.j[k * 2 + 1]);
        const err = Math.abs(l / L.len[k] - 1);
        // middle joints sit on a bow (approximate by design); only femur + needle are exact
        if ((k === 0 || k === n - 1) && err > chaosStats.winSeg) chaosStats.winSeg = err;
      }
    }
  }
}

function chaosDrive(c: Cell, dt: number): void {
  const list = c.enemies;
  for (const e of list) {
    let ci = chaosIn.get(e);
    if (!ci) {
      ci = { v: { x: 0, y: 0 }, t: 0 };
      chaosIn.set(e, ci);
    }
    ci.t -= dt;
    if (ci.t <= 0) {
      ci.t = 0.05 + Math.random() * 0.45;
      const a = Math.random() * TAU;
      const m = Math.random() < 0.15 ? 3000 : Math.random() * 400 * state.scale;
      ci.v.x = Math.random() < 0.05 ? NaN : Math.cos(a) * m;
      ci.v.y = Math.sin(a) * m;
    }
    if (Math.random() < dt * 0.35) {
      e.x = 30 + Math.random() * (c.w - 60);
      e.y = 30 + Math.random() * (c.h - 60);
    }
  }
}

function hitAll(): void {
  for (const c of cells) {
    for (const e of c.enemies) {
      // knock away from the cell's target (cursor / reticle)
      hurtEnemy(e, e.x - c.target.x, e.y - c.target.y, 1);
    }
  }
}

function killAll(): void {
  for (const c of cells) for (const e of c.enemies) if (!isDying(e)) killEnemy(e);
}

function respawnAll(): void {
  for (const c of cells) {
    populate(c);
    for (const e of c.enemies) spawnEnemy(e);
  }
}

function splitAll(): void {
  for (const c of cells) for (const e of c.enemies) if (e.kind === 'swarm') beginSplit(e);
}

function toggleChaos(): void {
  state.chaos = !state.chaos;
  chaosStats.stretch = chaosStats.segErr = chaosStats.winStretch = chaosStats.winSeg = 0;
  syncButtons();
}

function setScale(s: number): void {
  if (state.scale === s) return;
  state.scale = s;
  layout();
  syncButtons();
}

const btn = (id: string): HTMLElement | null => document.getElementById(id);
const bind = (id: string, fn: () => void): void => {
  btn(id)?.addEventListener('click', (ev) => {
    fn();
    (ev.currentTarget as HTMLElement).blur();
  });
};
function syncButtons(): void {
  btn('b-debug')?.classList.toggle('on', state.debug);
  btn('b-slow')?.classList.toggle('on', state.slow);
  btn('b-pause')?.classList.toggle('on', state.paused);
  btn('b-stress')?.classList.toggle('on', state.stress);
  btn('b-boss')?.classList.toggle('on', state.bossP2);
  btn('b-chaos')?.classList.toggle('on', state.chaos);
  btn('b-s1')?.classList.toggle('on', state.scale === 1);
  btn('b-s2')?.classList.toggle('on', state.scale === 2);
  btn('b-s3')?.classList.toggle('on', state.scale === 3);
}
const toggleStress = (): void => {
  state.stress = !state.stress;
  const pc = cells.find((c) => c.kind === 'pursuit');
  if (pc) populate(pc);
  syncButtons();
};
bind('b-debug', () => {
  state.debug = !state.debug;
  syncButtons();
});
bind('b-lunge', lungeAll);
bind('b-boss', toggleBoss);
bind('b-split', splitAll);
bind('b-hit', hitAll);
bind('b-chaos', toggleChaos);
bind('b-variant', cycleVariant);
bind('b-tell', cycleTell);
bind('b-kill', killAll);
bind('b-spawn', respawnAll);
bind('b-slow', () => {
  state.slow = !state.slow;
  syncButtons();
});
bind('b-pause', () => {
  state.paused = !state.paused;
  syncButtons();
});
bind('b-stress', toggleStress);
bind('b-s1', () => setScale(1));
bind('b-s2', () => setScale(2));
bind('b-s3', () => setScale(3));

window.addEventListener('keydown', (ev) => {
  const k = ev.key.toLowerCase();
  if (k === 'd') {
    state.debug = !state.debug;
    syncButtons();
  } else if (k === 'l') lungeAll();
  else if (k === 'b') toggleBoss();
  else if (k === 'x') splitAll();
  else if (k === 's') {
    state.slow = !state.slow;
    syncButtons();
  } else if (k === ' ') {
    state.paused = !state.paused;
    syncButtons();
    ev.preventDefault();
  } else if (k === 'p') toggleStress();
  else if (k === 'h') hitAll();
  else if (k === 'c') toggleChaos();
  else if (k === 'v') cycleVariant();
  else if (k === 't') cycleTell();
  else if (k === 'k') killAll();
  else if (k === 'n') respawnAll();
  else if (k === '1' || k === '2' || k === '3') setScale(Number(k));
});

let resizeT = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeT);
  resizeT = window.setTimeout(layout, 150);
});

// ---------------------------------------------------------------------------
// Simulation

function updateCell(c: Cell, dt: number): void {
  const mx = state.mouseX - c.x;
  const my = state.mouseY - c.y;
  c.mouseIn = state.mouseOver && mx >= 0 && my >= 0 && mx < c.w && my < c.h;
  if (c.mouseIn) {
    c.target.x = mx;
    c.target.y = my;
  } else {
    const t = state.time;
    const slowK = c.kind === 'boss' || c.kind === 'sentinel' ? 0.5 : 1;
    c.target.x = c.w / 2 + Math.sin(t * 0.45 * slowK + c.ph) * c.w * 0.3;
    c.target.y = c.h / 2 + Math.sin(t * 0.71 * slowK + c.ph * 2) * c.h * 0.26;
    if (c.kind === 'boss') c.target.y = c.h * 0.85;
  }
  if (dt <= 0) return;
  const list = c.enemies;
  const chaos = state.chaos && c.kind === 'pursuit';
  let udt = dt;
  if (chaos) {
    chaosDrive(c, dt);
    chaosStats.spikeT -= dt;
    if (chaosStats.spikeT <= 0) {
      chaosStats.spikeT = 0.8 + Math.random() * 1.5;
      const r = Math.random();
      udt = r < 0.5 ? 0.25 + Math.random() * 0.5 : r < 0.75 ? 0 : -0.1; // spike / zero / negative
    }
  }
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    updateEnemy(e, udt, c.target, chaos ? chaosIn.get(e)?.v ?? null : null);
    if (e.kind === 'swarm' && e.spawned) {
      for (const f of e.spawned) list.push(f);
      e.spawned = null;
    }
  }
  // remove finished, keep within the cell
  const pad = 8;
  let w = 0;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.done) continue;
    if (e.kind !== 'boss') {
      if (e.x < pad) (e.x = pad), (e.vx = Math.abs(e.vx));
      if (e.x > c.w - pad) (e.x = c.w - pad), (e.vx = -Math.abs(e.vx));
      if (e.y < pad) (e.y = pad), (e.vy = Math.abs(e.vy));
      if (e.y > c.h - pad) (e.y = c.h - pad), (e.vy = -Math.abs(e.vy));
    }
    list[w++] = e;
  }
  list.length = w;
  if (c.kind === 'pursuit') separate(list);
  if (chaos) {
    legSanity(list);
    chaosStats.winT += dt;
    if (chaosStats.winT > 0.5) {
      chaosStats.stretch = chaosStats.winStretch;
      chaosStats.segErr = chaosStats.winSeg;
      chaosStats.winStretch = chaosStats.winSeg = chaosStats.winT = 0;
      let n = 0;
      for (const e of list) n += e.mo.snaps;
      chaosStats.snaps = n;
    }
  }
  // everything killed (K): re-materialise after a beat
  if (list.length === 0 && c.kind !== 'swarm') {
    c.respawnT += dt;
    if (c.respawnT > 1.2) {
      populate(c);
      for (const e of c.enemies) spawnEnemy(e);
    }
    return;
  }
  // swarm cell: re-form after the fragments have had their moment
  if (c.kind === 'swarm' && !list.some((e) => e.kind === 'swarm')) {
    c.respawnT += dt;
    if (c.respawnT > 4.5) {
      populate(c);
      for (const e of c.enemies) spawnEnemy(e);
    }
  }
  if (c.kind === 'pursuit') {
    const nodes = list.filter((e) => e.kind === 'swarm').length;
    if (nodes === 0) {
      c.respawnT += dt;
      if (c.respawnT > 5) {
        c.respawnT = 0;
        for (let i = list.length - 1; i >= 0; i--) if (list[i].kind === 'fragment') list.splice(i, 1);
        const fresh = [
          spawn('swarm', c.w * 0.2, c.h * 0.3),
          spawn('swarm', c.w * 0.8, c.h * 0.3),
          spawn('fragment', c.w * 0.5, c.h * 0.1),
          spawn('fragment', c.w * 0.5, c.h * 0.9),
          spawn('fragment', c.w * 0.1, c.h * 0.5),
        ];
        for (const f of fresh) {
          spawnEnemy(f);
          list.push(f);
        }
      }
    }
  }
}

function separate(list: Enemy[]): void {
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = (a.size + b.size) * 0.3;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const push = (min - d) * 0.25;
      const ux = dx / d;
      const uy = dy / d;
      a.x -= ux * push;
      a.y -= uy * push;
      b.x += ux * push;
      b.y += uy * push;
    }
  }
}

// ---------------------------------------------------------------------------
// Rendering

function drawCellChrome(c: Cell): void {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, c.w, c.h);
  // faint grid
  const g = 40 * state.scale;
  ctx.strokeStyle = '#131313';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = g; x < c.w; x += g) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, c.h);
  }
  for (let y = g; y < c.h; y += g) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(c.w, Math.round(y) + 0.5);
  }
  ctx.stroke();
  // corner brackets
  const k = 10;
  ctx.strokeStyle = 'rgba(240,126,65,0.35)';
  ctx.beginPath();
  ctx.moveTo(6.5, 6.5 + k);
  ctx.lineTo(6.5, 6.5);
  ctx.lineTo(6.5 + k, 6.5);
  ctx.moveTo(c.w - 6.5 - k, c.h - 6.5);
  ctx.lineTo(c.w - 6.5, c.h - 6.5);
  ctx.lineTo(c.w - 6.5, c.h - 6.5 - k);
  ctx.stroke();
}

function drawReticle(c: Cell): void {
  const t = c.target;
  const r = 6;
  ctx.strokeStyle = c.mouseIn ? 'rgba(240,126,65,0.9)' : 'rgba(244,239,232,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(t.x - r * 2, t.y);
  ctx.lineTo(t.x - r * 0.6, t.y);
  ctx.moveTo(t.x + r * 0.6, t.y);
  ctx.lineTo(t.x + r * 2, t.y);
  ctx.moveTo(t.x, t.y - r * 2);
  ctx.lineTo(t.x, t.y - r * 0.6);
  ctx.moveTo(t.x, t.y + r * 0.6);
  ctx.lineTo(t.x, t.y + r * 2);
  ctx.stroke();
  if (c.kind === 'leech') {
    // the "data node" victim
    ctx.fillStyle = '#111111';
    ctx.strokeStyle = 'rgba(244,239,232,0.6)';
    ctx.beginPath();
    ctx.moveTo(t.x, t.y - 5);
    ctx.lineTo(t.x + 5, t.y);
    ctx.lineTo(t.x, t.y + 5);
    ctx.lineTo(t.x - 5, t.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawLabels(c: Cell): void {
  ctx.letterSpacing = '2px';
  ctx.font = monoFont(10);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#f07e41';
  ctx.fillText(`${c.no}  ${c.label}`, 16, 14);
  ctx.fillStyle = '#6a6a6a';
  ctx.fillText(c.sub, 16, 29);
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#4a4a4a';
  ctx.fillText(c.hint, 16, c.h - 12);
  if (c.kind === 'pursuit') {
    ctx.textAlign = 'right';
    ctx.fillText(`${c.enemies.length} ENTITIES`, c.w - 16, c.h - 12);
    if (state.chaos) {
      ctx.textBaseline = 'top';
      ctx.fillStyle = chaosStats.stretch > 1.001 || chaosStats.segErr > 0.02 ? '#ff5a2a' : '#f07e41';
      ctx.fillText(
        `CHAOS  MAX LEG REACH ${chaosStats.stretch.toFixed(3)}  FEMUR/NEEDLE ERR ${(chaosStats.segErr * 100).toFixed(1)}%  SNAPS ${chaosStats.snaps}`,
        c.w - 16,
        14,
      );
    }
  }
  ctx.letterSpacing = '0px';
}

function draw(): void {
  const dpr = state.dpr;
  const sy = window.scrollY;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, state.viewW, state.viewH);
  for (const c of cells) {
    if (c.y + c.h < sy || c.y > sy + state.viewH) continue;
    ctx.setTransform(dpr, 0, 0, dpr, c.x * dpr, (c.y - sy) * dpr);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, c.w, c.h);
    ctx.clip();
    drawCellChrome(c);
    drawReticle(c);
    for (const e of c.enemies) drawEnemy(ctx, e, state.time);
    if (state.debug) for (const e of c.enemies) drawEnemyDebug(ctx, e);
    drawLabels(c);
    ctx.restore();
    ctx.strokeStyle = '#1c1c1c';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, c.w - 1, c.h - 1);
  }
}

// ---------------------------------------------------------------------------
// Loop

let last = performance.now();
let fpsAcc = 0;
let fpsFrames = 0;
let worst = 0;

function frame(now: number): void {
  const raw = (now - last) / 1000;
  last = now;
  const dt = Math.min(0.05, raw);
  fpsAcc += raw;
  fpsFrames++;
  worst = Math.max(worst, raw);
  const simDt = state.paused ? 0 : dt * (state.slow ? 0.25 : 1);
  state.time += simDt;
  const t0 = performance.now();
  for (const c of cells) updateCell(c, simDt);
  draw();
  const cost = performance.now() - t0;
  if (fpsAcc >= 0.5 && statsEl) {
    let n = 0;
    for (const c of cells) n += c.enemies.length;
    statsEl.textContent = `${Math.round(fpsFrames / fpsAcc)} fps  ${cost.toFixed(1)}ms  worst ${(worst * 1000).toFixed(0)}ms  ${n} ent`;
    fpsAcc = 0;
    fpsFrames = 0;
    worst = 0;
  }
  requestAnimationFrame(frame);
}

layout();
syncButtons();
requestAnimationFrame(frame);
// dev inspection hook
(window as unknown as { __bestiary: unknown }).__bestiary = { state, cells: () => cells, chaosStats };

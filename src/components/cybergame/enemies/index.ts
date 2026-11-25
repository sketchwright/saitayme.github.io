// Enemy module entry point. Each type exposes create / update / draw /
// drawDebug; the helpers below dispatch on `kind` for heterogeneous lists.
//
//   const e = createEnemy('crawler', x, y, seed, { size: 56 });
//   updateEnemy(e, dt, target, intent);   // intent = formation velocity or null
//   drawEnemy(ctx, e, time);
//
// update() is pure motion/animation state; no projectiles or damage. Signals
// the game can read: Sentinel.fired (one frame), SwarmNode.spawned (fragments
// to adopt after beginSplit), e.alive / e.done, e.charge (0..1).

import type { CreateOpts, Ctx2D, Vec } from './common';
import { Boss, bossCharge, createBoss, drawBoss, drawBossDebug, updateBoss } from './boss';
import { Crawler, crawlerLunge, createCrawler, drawCrawler, drawCrawlerDebug, updateCrawler } from './crawler';
import { Leech, createLeech, drawLeech, drawLeechDebug, leechToggleLatch, updateLeech } from './leech';
import { Sentinel, createSentinel, drawSentinel, drawSentinelDebug, sentinelCharge, updateSentinel } from './sentinel';
import {
  Fragment,
  SwarmNode,
  createFragment,
  createSwarmNode,
  drawFragment,
  drawFragmentDebug,
  drawSwarmNode,
  drawSwarmNodeDebug,
  fragmentDart,
  updateFragment,
  updateSwarmNode,
} from './swarm';
import { Wraith, createWraith, drawWraith, drawWraithDebug, updateWraith, wraithStrike } from './wraith';

export * from './common';
export * from './ik';
export * from './tendril';
export * from './crawler';
export * from './wraith';
export * from './leech';
export * from './swarm';
export * from './sentinel';
export * from './boss';

export type Enemy = Crawler | Wraith | Leech | SwarmNode | Fragment | Sentinel | Boss;
export type EnemyKind = Enemy['kind'];

export const ENEMY_KINDS: EnemyKind[] = ['crawler', 'wraith', 'leech', 'swarm', 'fragment', 'sentinel', 'boss'];

export function createEnemy(kind: EnemyKind, x: number, y: number, seed: number, opts?: CreateOpts): Enemy {
  switch (kind) {
    case 'crawler':
      return createCrawler(x, y, seed, opts);
    case 'wraith':
      return createWraith(x, y, seed, opts);
    case 'leech':
      return createLeech(x, y, seed, opts);
    case 'swarm':
      return createSwarmNode(x, y, seed, opts);
    case 'fragment':
      return createFragment(x, y, seed, opts);
    case 'sentinel':
      return createSentinel(x, y, seed, opts);
    case 'boss':
      return createBoss(x, y, seed, opts);
  }
}

export function updateEnemy(e: Enemy, dt: number, target: Vec, intent?: Vec | null): void {
  switch (e.kind) {
    case 'crawler':
      return updateCrawler(e, dt, target, intent);
    case 'wraith':
      return updateWraith(e, dt, target, intent);
    case 'leech':
      return updateLeech(e, dt, target, intent);
    case 'swarm':
      return updateSwarmNode(e, dt, target, intent);
    case 'fragment':
      return updateFragment(e, dt, target, intent);
    case 'sentinel':
      return updateSentinel(e, dt, target, intent);
    case 'boss':
      return updateBoss(e, dt, target, intent);
  }
}

export function drawEnemy(ctx: Ctx2D, e: Enemy, time: number): void {
  switch (e.kind) {
    case 'crawler':
      return drawCrawler(ctx, e, time);
    case 'wraith':
      return drawWraith(ctx, e, time);
    case 'leech':
      return drawLeech(ctx, e, time);
    case 'swarm':
      return drawSwarmNode(ctx, e, time);
    case 'fragment':
      return drawFragment(ctx, e, time);
    case 'sentinel':
      return drawSentinel(ctx, e, time);
    case 'boss':
      return drawBoss(ctx, e, time);
  }
}

export function drawEnemyDebug(ctx: Ctx2D, e: Enemy): void {
  switch (e.kind) {
    case 'crawler':
      return drawCrawlerDebug(ctx, e);
    case 'wraith':
      return drawWraithDebug(ctx, e);
    case 'leech':
      return drawLeechDebug(ctx, e);
    case 'swarm':
      return drawSwarmNodeDebug(ctx, e);
    case 'fragment':
      return drawFragmentDebug(ctx, e);
    case 'sentinel':
      return drawSentinelDebug(ctx, e);
    case 'boss':
      return drawBossDebug(ctx, e);
  }
}

/** Triggers each type's attack tell: freeze -> charge -> lunge / fire / strike. */
export function provokeEnemy(e: Enemy): void {
  switch (e.kind) {
    case 'crawler':
      return crawlerLunge(e);
    case 'wraith':
      return wraithStrike(e);
    case 'leech':
      return leechToggleLatch(e);
    case 'swarm':
      return;
    case 'fragment':
      return fragmentDart(e);
    case 'sentinel':
      return sentinelCharge(e);
    case 'boss':
      return bossCharge(e);
  }
}

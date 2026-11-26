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
//
// Optional FX (all safe to ignore):
//   hurtEnemy(e, dirX, dirY, strength?)  hit flash + knockback + limb flinch + tear
//   killEnemy(e)    death anim: limbs collapse/detach, body shatters, glyph burst;
//                   e.alive = false immediately, e.done = true when finished
//                   (swarm nodes split into fragments by default)
//   spawnEnemy(e)   glitch materialise-in (~0.3 s of assembling slices)
//   isDying(e)      true while the death animation plays

import { CreateOpts, Ctx2D, EnemyIntent, Vec, spawnBase } from './common';
import { drawAffixFx, drawRoleFx } from './roles';
import { Boss, bossCharge, createBoss, drawBoss, drawBossDebug, hurtBoss, killBoss, updateBoss } from './boss';
import { Crawler, crawlerLunge, createCrawler, drawCrawler, drawCrawlerDebug, hurtCrawler, killCrawler, updateCrawler } from './crawler';
import { Leech, createLeech, drawLeech, drawLeechDebug, hurtLeech, killLeech, leechToggleLatch, updateLeech } from './leech';
import { Sentinel, createSentinel, drawSentinel, drawSentinelDebug, hurtSentinel, killSentinel, sentinelCharge, updateSentinel } from './sentinel';
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
  hurtFragment,
  hurtSwarmNode,
  killFragment,
  killSwarmNode,
  updateFragment,
  updateSwarmNode,
} from './swarm';
import { Wraith, createWraith, drawWraith, drawWraithDebug, hurtWraith, killWraith, updateWraith, wraithStrike } from './wraith';

export * from './common';
export * from './ik';
export * from './tendril';
export * from './crawler';
export * from './wraith';
export * from './leech';
export * from './swarm';
export * from './sentinel';
export * from './boss';
export * from './roles';

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

export function updateEnemy(e: Enemy, dt: number, target: Vec, intent?: Vec | EnemyIntent | null): void {
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
  drawKind(ctx, e, time);
  // optional director decorations (no-ops when the fields are missing)
  if (e.affixes && e.affixes.length) drawAffixFx(ctx, e, time);
  if (e.role) drawRoleFx(ctx, e, time);
}

function drawKind(ctx: Ctx2D, e: Enemy, time: number): void {
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

/** Optional hit reaction. (dirX, dirY) = knockback direction (need not be normalised). */
export function hurtEnemy(e: Enemy, dirX = 0, dirY = 0, strength = 1): void {
  switch (e.kind) {
    case 'crawler':
      return hurtCrawler(e, dirX, dirY, strength);
    case 'wraith':
      return hurtWraith(e, dirX, dirY, strength);
    case 'leech':
      return hurtLeech(e, dirX, dirY, strength);
    case 'swarm':
      return hurtSwarmNode(e, dirX, dirY, strength);
    case 'fragment':
      return hurtFragment(e, dirX, dirY, strength);
    case 'sentinel':
      return hurtSentinel(e, dirX, dirY, strength);
    case 'boss':
      return hurtBoss(e, dirX, dirY, strength);
  }
}

/** Optional death animation. Keep updating + drawing until e.done. */
export function killEnemy(e: Enemy): void {
  switch (e.kind) {
    case 'crawler':
      return killCrawler(e);
    case 'wraith':
      return killWraith(e);
    case 'leech':
      return killLeech(e);
    case 'swarm':
      return killSwarmNode(e, true);
    case 'fragment':
      return killFragment(e);
    case 'sentinel':
      return killSentinel(e);
    case 'boss':
      return killBoss(e);
  }
}

/** Optional spawn-in: glitch materialise over ~0.3 s (call right after create). */
export function spawnEnemy(e: Enemy): void {
  spawnBase(e);
}

export const isDying = (e: Enemy): boolean => e.deathT >= 0 || (e.kind === 'swarm' && e.splitT >= 0);

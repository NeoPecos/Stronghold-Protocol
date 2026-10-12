import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PHASE } from '../../shared/constants.js';

const { PhaseCapsule } = await import('../../public/js/ui/hud.js');

test('only the literal rest phase uses the baked rest capsule art', () => {
  const rest = PhaseCapsule({ pub: { phase: PHASE.PREP }, hud: null });
  const draft = PhaseCapsule({ pub: { phase: PHASE.SP_DRAFT }, hud: null });

  assert.match(rest.props.class, /\bcapsule--rest-art\b/);
  assert.equal(rest.props['aria-label'], '休息一下');
  assert.doesNotMatch(draft.props.class, /\bcapsule--rest-art\b/);
  assert.equal(draft.props['aria-label'], '机变阶段');
});

test('top HUD CSS uses the supplied art at the existing manifest paths', () => {
  const css = fs.readFileSync(new URL('../../public/css/screens/game.css', import.meta.url), 'utf8');
  // both crops keep the source 2172×724 aspect: the non-uniform 100% 455% / 123% 153% resampled the art,
  // which showed up as a squashed frame and a 31%-stretched 休息一下 capsule (maintainer report 2026-10-13)
  assert.match(css, /frame_mid_normal\.png'\) center \/ 100% auto no-repeat/);
  assert.match(css, /bg_rest\.png'\) center \/ auto 153% no-repeat/);
  // the shipped enemy 🔍 art is a 1047×454 canvas → its wide box is sized from that canvas
  assert.match(css, /\.enemybtn\.has-sprite\.is-wide \{ width: calc\(\.46rem \* 1047 \/ 454\); \}/);
  const devices = fs.readFileSync(new URL('../../public/css/devices.css', import.meta.url), 'utf8');
  assert.match(devices, /\.enemybtn\.has-sprite\.is-wide \{ width: calc\(max\(\.46rem, 26px\) \* 1047 \/ 454\); \}/);
});

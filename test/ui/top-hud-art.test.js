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
  // which showed up as a squashed frame and a 31%-stretched 休息一下 capsule (maintainer report 2026-10-13).
  // The `?v=` token is a cache key only: `/assets/**` is served with a 30-day max-age, so a server-side art
  // fix never reaches a client that already cached the old bytes.
  assert.match(css, /frame_mid_normal\.png\?v=20261013'\) center \/ 100% auto no-repeat/);
  assert.match(css, /bg_rest\.png\?v=20261013'\) center \/ auto 153% no-repeat/);
  // the two 🔍 sprites the HUD actually loads are the 35×29 / 61×29 local-client entries
  // (public/assets/local/ui/battle/btn_check_*.png, resolved through localAsset()); their boxes keep those ratios
  assert.match(css, /\.gtop__iconbtn\.has-sprite\.is-wide, \.enemybtn\.has-sprite\.is-wide \{ width: \.967rem; \}/);
  const devices = fs.readFileSync(new URL('../../public/css/devices.css', import.meta.url), 'utf8');
  assert.match(devices, /\.enemybtn\.has-sprite\.is-wide \{ width: calc\(max\(\.46rem, 26px\) \* 61 \/ 29\); \}/);
});

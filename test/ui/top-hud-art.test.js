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
  assert.match(css, /frame_mid_normal\.png'\) center \/ 100% 455% no-repeat/);
  assert.match(css, /bg_rest\.png'\) center \/ 123% 153% no-repeat/);
});

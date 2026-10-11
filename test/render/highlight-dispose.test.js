// test/render/highlight-dispose.test.js — 视图销毁后迟到的高亮请求不该把那一帧打崩。
//
// 现场（Edge 控制台，用户在维护期报告）：
//   [field] engine view highlightTiles failed TypeError: Cannot read properties of null (reading 'clear')
//     at hr.clear (pixi.min.js)  ← 一个已销毁的 Graphics
//     at TileField._drawHighlights (tiles.js:538)
//     at TileField.setHighlights   (tiles.js:529)
//     at drawHighlight             (app.js:1066)
//     at highlightTiles            (app.js:1827)
//     at showRange                 (facingWheel.js:147)
// 成因：dispose 里 `hlGfx.destroy()` 之后，仍可能有请求到达（悬停显示射程、离开对局的收尾帧）。
// 这个测试钉住：销毁后再调 setHighlights / clearHighlights / _drawFlow / _buildAnim 都不抛异常。
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { installFakePixi } from './fakepixi.js';

let fake, TileField;

before(async () => {
  fake = installFakePixi();
  fake.P.BLEND_MODES = fake.P.BLEND_MODES || { ADD: 1, NORMAL: 0 };
  ({ TileField } = await import('../../public/js/render/tiles.js'));
});
after(() => fake.restore());

/** 最小可用的 TileField（与 tiles.test.js / playtest5-maps.test.js 同一套 layers 造法）。 */
function field() {
  const P = fake.P;
  const layers = { ground: new P.Container(), overlay: new P.Container(), props: new P.Container(), anim: new P.Container() };
  for (const l of Object.values(layers)) {
    l.addChild = function (...kids) { for (const k of kids) { k.parent = this; this.children.push(k); } return kids[0]; };
  }
  return new TileField(layers);
}

describe('高亮层的生命周期', () => {
  test('销毁前：setHighlights 正常', () => {
    const f = field();
    assert.ok(f.hlGfx, 'hlGfx 已建');
    f.setHighlights('range', [[1, 1], [1, 2]], { color: 0x9fd4ff, fill: 0.12, line: 0.45 });
    f.clearHighlights('range');
    assert.doesNotThrow(() => f.clearHighlights());
  });

  test('销毁后：迟到的 setHighlights / clearHighlights 不抛（这就是那次控制台报错）', () => {
    const f = field();
    f.destroy();
    assert.equal(f.hlGfx, null, 'destroy 后 hlGfx 置空');
    assert.equal(f.flowGfx, null, 'destroy 后 flowGfx 置空');
    assert.equal(f.animLayer, null, 'destroy 后 animLayer 置空');
    assert.doesNotThrow(() => f.setHighlights('range', [[1, 1]], { color: 0xffffff }), 'setHighlights 不该抛');
    assert.doesNotThrow(() => f.clearHighlights(), 'clearHighlights 不该抛');
    assert.doesNotThrow(() => f.clearHighlights('range'), 'clearHighlights(group) 不该抛');
    assert.doesNotThrow(() => f._drawHighlights(), '_drawHighlights 不该抛');
    assert.doesNotThrow(() => f._drawFlow(), '_drawFlow 不该抛');
    assert.doesNotThrow(() => f._buildAnim(), '_buildAnim 不该抛');
  });
});

// test/render/deploy-landing.test.js — 休整期落格：干员自己的 Start 登场动作是否真的播出。
//
// 用户在维护期报告：「有部署语音，但没有部署落地动作」。素材侧已确认：210/210 个模型的
// `spine.front.anims.deploy === 'Start'`（官方客户端的 clip 名），二进制骨架里也有这个 clip。
// 这个测试只回答一个问题：**把干员放到棋盘上时，UnitView 会不会切到它自己的 Start clip**。
//
// 它同时钉住三件事：
//   1. manifest 的 `deploy` 角色确实被 SpineActor 用到（而不是被 idle 顶掉）；
//   2. `onDeploy()`（app.js 在 prep 落格时调用的入口）会切到那个 clip；
//   3. 模型晚到（慢网）时也不丢这段入场：`_pendingDeployElapsed` 让它在加载完成那一刻补播。
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installFakePixi, fakeViewCtx } from './fakepixi.js';
import { presetCamera } from '../../public/js/render/projection.js';
import { spineEntry, hasBackSpine } from '../../public/js/assets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const assets = JSON.parse(readFileSync(path.join(ROOT, 'data/assets.json'), 'utf8'));

// 三个有代表性的干员：普通六星、带 Back 模型的、以及一个形态切换的
const OPS = ['char_003_kalts', 'char_010_chen', 'char_1023_ghost2'];

let fake, UnitView;
before(async () => {
  fake = installFakePixi();
  ({ UnitView } = await import('../../public/js/render/units.js'));
});
after(() => fake.restore());

const tick = () => new Promise((r) => setImmediate(r));
const cam = () => presetCamera('normal', { width: 1280, height: 720 });

/** 真实 manifest 上的 asset store（与 feedback2-doll.test.js 同一套做法）。 */
function store({ failSpineTimes = 0 } = {}) {
  let failuresLeft = failSpineTimes;
  const s = {
    acquired: false,
    picture: () => null,
    image: async () => null,
    hasBack: (id) => hasBackSpine(assets, id),
    spineEntry: (id, o) => spineEntry(assets, id, o),
    spine: {
      acquire: async (entry) => {
        if (failuresLeft > 0) { failuresLeft--; return null; }   // 模拟模型还没到
        s.acquired = true;
        return { animations: Object.keys(entry.animations || {}).map((name) => ({ name })) };
      },
      release() {},
    },
  };
  return s;
}

async function op(id, info = {}, opts = {}) {
  const assets_ = store(opts);
  const ctx = fakeViewCtx(fake.P, { assets: assets_, cam });
  const v = new UnitView(ctx, {
    id: 1, side: 'ally', kind: 'op', defId: id, spine: id, tier: 5, x: 5, y: 9, maxHp: 2657, dir: 'RIGHT', skillIndex: 1, ...info,
  }, opts.view || undefined);
  v._testAssets = assets_;   // 让测试能放开加载（慢网用例）
  for (let i = 0; i < 3; i++) await tick();
  return v;
}

const clip = (v) => v.actor?.current;
const frames = (v, n, dt = 1 / 60) => { for (let i = 0; i < n; i++) v.update(dt, cam(), i * dt); };

describe('休整期落格：干员自己的 Start 登场动作', () => {
  test('素材侧：这些干员的 manifest 把 deploy 指向 Start（不是 idle）', () => {
    for (const id of OPS) {
      const entry = spineEntry(assets, id, {});
      assert.ok(entry, `${id} 有 spine 条目`);
      assert.equal(entry.anims.deploy, 'Start', `${id} 的 deploy 角色应为 Start`);
      assert.notEqual(entry.anims.deploy, entry.anims.idle, `${id}: deploy 不能等于 idle`);
      assert.ok(Number(entry.animations.Start) > 0, `${id}: Start 有时长（${entry.animations.Start}）`);
    }
  });

  test('onDeploy() 切到 Start，并在一段帧数后回到 Idle', async () => {
    for (const id of OPS) {
      const v = await op(id);
      assert.ok(v.actor, `${id}: 模型已建`);
      assert.equal(clip(v), 'Idle', `${id}: 静止时是 Idle`);

      v.onDeploy();                       // app.js 在 prep 落格时调用的入口
      assert.equal(clip(v), 'Start', `${id}: 落格后应播自己的 Start，实际 ${clip(v)}`);

      // Start 是一次性 clip：播完回到 Idle（时长按 animations.Start 的秒数，60 fps 推进）
      const dur = Number(v.actor.entry.animations.Start) || 0;
      frames(v, Math.ceil(dur * 60) + 4);
      assert.equal(clip(v), 'Idle', `${id}: Start 播完应回到 Idle，实际 ${clip(v)}`);
    }
  });

  test('没有模型时 onDeploy 记下 pending，等模型到位再补播（慢网也不丢这段入场）', async () => {
    // acquire 一直返回 null：视图建好但模型没到
    const v = await op('char_003_kalts', {}, { view: { prep: true }, failSpineTimes: 99 });
    assert.equal(v.actor, null, '模型还没到：还没有 actor');

    v.onDeploy();                        // 玩家已经把它放下了 —— 此时没有 actor，只能记下 pending
    assert.equal(v._pendingDeployElapsed, 0, '没有 actor 时记下 pending，等模型到位补播');
  });
});

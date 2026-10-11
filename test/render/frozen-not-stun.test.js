// 冻结 ≠ 晕眩：表现层必须把「不能行动」和「视觉晕眩」分开。
//
// 用户报告：被冻结的 Boss 一直播晕眩（坐姿/Stun_1）动作。根因在表现层的基准动作判定：
//
//   units.js  _baseFromAnim()  ← 三种状态被折叠成一个 'stun'
//     if (this.anim === ANIM.STUN || (this.flags & (UF.STUNNED | UF.FROZEN | UF.SLEEP))) return 'stun';
//   spine.js  _enterStun()     ← 于是冻结也去播 roles.stun.loop
//
// 而服务端的 `s.flags.stun` 是**逻辑上的不可行动聚合位**，设计上就包含睡眠与冻结
// （server/sim/content/enemies/special.js:117 的注释写明了：「s.flags.stun also holds while asleep / frozen」）。
// 所以 sim 侧不该动 —— 它还要靠这个位冻结插值（test/render/attack-recovery-interp.test.js 断言了
// freeze/sleep/levitate 都发 ANIM.STUN 且位置不外推）。要改的是表现层如何**解读**它：
//
//   UF.STUNNED → 播 stun clip（真的被晕眩）
//   UF.FROZEN  → 保持当前姿势不动 + 冻结色（不播 stun clip）
//   UF.SLEEP   → 同样不播 stun clip（沉睡不是晕眩）
//
// 这个文件同时钉住两层：UnitView 的状态映射，以及 SpineActor 收到 'frozen' 时的行为。
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { installFakePixi, fakeViewCtx } from './fakepixi.js';
import { presetCamera } from '../../public/js/render/projection.js';
import { UF, ANIM } from '../../shared/constants.js';

let fake, UnitView, SpineActor;

before(async () => {
  fake = installFakePixi();
  ({ UnitView } = await import('../../public/js/render/units.js'));
  ({ SpineActor } = await import('../../public/js/render/spine.js'));
});
after(() => fake.restore());

const tick = () => new Promise((r) => setImmediate(r));
const cam = () => presetCamera('normal', { width: 1280, height: 720 });

/** 一个带 stun clip 的合成条目：Idle/Stun/Die 三个 clip 都有，时长表齐全。 */
const ENTRY = Object.freeze({
  skel: '/s/op.skel', atlas: '/s/op.atlas', textures: ['/s/op.png'],
  anims: { idle: 'Idle', die: 'Die', stun: { begin: null, loop: 'Stun' } },
  animations: { Idle: 4, Stun: 4, Die: 1 },
});
/** 与 manifest 一致的骨架描述（fakepixi 只关心名字）。 */
const DATA = { animations: [{ name: 'Idle' }, { name: 'Stun' }, { name: 'Die' }] };

/** 造一个用上面合成条目的 UnitView。 */
async function unit(info = {}, opts = {}) {
  const assets = {
    picture: () => null, image: async () => null, hasBack: () => false,
    spineEntry: () => ENTRY,
    spine: { acquire: async () => DATA, release() {} },
  };
  const ctx = fakeViewCtx(fake.P, { assets, cam, ...opts.ctx });
  const v = new UnitView(ctx, {
    id: 1, side: 'enemy', kind: 'enemy', defId: 'test_frozen', spine: 'test_frozen', tier: 1,
    x: 5, y: 9, maxHp: 1000, dir: 'LEFT', ...info,
  }, opts.view);
  for (let i = 0; i < 4; i++) await tick();
  return v;
}

const clip = (v) => v.actor?.current;

describe('冻结不被当成晕眩（表现层）', () => {
  test('UF.STUNNED 播 stun clip：真的被晕眩时行为不变', async () => {
    const v = await unit();
    assert.ok(v.actor, '模型已建');
    v.flags = UF.STUNNED;
    v.anim = ANIM.STUN;
    v.sync({ flags: UF.STUNNED, x: 5, y: 9 }, 1);
    v.update(1 / 60, cam(), 1);
    assert.equal(clip(v), 'Stun', `晕眩应播 stun clip，实际 ${clip(v)}`);
    assert.equal(v.actor.mode, 'stun');
  });

  test('UF.FROZEN 保持姿势、绝不播 stun clip', async () => {
    const v = await unit();
    assert.ok(v.actor);
    // 先动起来，确认冻结前是 Idle（不是 stun）
    v.sync({ flags: 0, x: 5, y: 9 }, 1);
    v.update(1 / 60, cam(), 1);
    assert.equal(clip(v), 'Idle');

    v.flags = UF.FROZEN;
    v.anim = ANIM.STUN;               // sim 仍然发 ANIM.STUN（插值要它不动），表现层不能听它的
    v.sync({ flags: UF.FROZEN, x: 5, y: 9 }, 2);
    v.update(1 / 60, cam(), 2);

    assert.notEqual(clip(v), 'Stun', `冻结绝不该播 stun clip，实际 ${clip(v)}`);
    assert.notEqual(v.actor.mode, 'stun', '冻结不该进入 stun 模式');
    assert.equal(v.actor.mode, 'frozen', '应进入 frozen 状态');
    // 姿势真的停住了：轨道被 park 在 timeScale 0，再跑几帧也不动
    const e = v.actor.spine.state.tracks[0];
    const at = e.trackTime;
    for (let i = 0; i < 10; i++) v.update(1 / 60, cam(), 2 + i / 60);
    assert.equal(e.timeScale, 0, '冻结时轨道时间尺度为 0（姿势不动）');
    assert.equal(e.trackTime, at, '冻结期间轨道时间不前进');
  });

  test('UF.SLEEP 同样不播 stun clip', async () => {
    const v = await unit();
    v.sync({ flags: 0, x: 5, y: 9 }, 1);
    v.update(1 / 60, cam(), 1);
    v.flags = UF.SLEEP;
    v.anim = ANIM.STUN;
    v.sync({ flags: UF.SLEEP, x: 5, y: 9 }, 2);
    v.update(1 / 60, cam(), 2);
    assert.notEqual(clip(v), 'Stun', `沉睡不该播晕眩动作，实际 ${clip(v)}`);
  });

  test('解除冻结后恢复：轨道时间尺度复位、能重新动起来', async () => {
    const v = await unit();
    v.flags = UF.FROZEN;
    v.anim = ANIM.STUN;
    v.sync({ flags: UF.FROZEN, x: 5, y: 9 }, 1);
    v.update(1 / 60, cam(), 1);
    const e = v.actor.spine.state.tracks[0];
    assert.equal(e.timeScale, 0, '冻结时停住');
    assert.equal(v.actor.mode, 'frozen');

    v.flags = 0;
    v.anim = ANIM.IDLE;
    v.sync({ flags: 0, x: 5, y: 9 }, 2);
    v.update(1 / 60, cam(), 2);
    assert.equal(v.actor.mode, 'base', '解冻后回到 base');
    assert.equal(e.timeScale, 1, '解冻后必须复位时间尺度，否则单位会永远僵住');
    assert.notEqual(clip(v), 'Stun', '解冻后不该是晕眩动作');
  });

  test('冻结 → 晕眩：切到晕眩时应播 stun clip（不能被 frozen 状态挡住）', async () => {
    const v = await unit();
    v.flags = UF.FROZEN;
    v.anim = ANIM.STUN;
    v.sync({ flags: UF.FROZEN, x: 5, y: 9 }, 1);
    v.update(1 / 60, cam(), 1);

    v.flags = UF.STUNNED;
    v.anim = ANIM.STUN;
    v.sync({ flags: UF.STUNNED, x: 5, y: 9 }, 2);
    v.update(1 / 60, cam(), 2);
    assert.equal(clip(v), 'Stun', `从冻结转为晕眩应播 stun clip，实际 ${clip(v)}`);
  });
});

describe('SpineActor 的 frozen 基准状态', () => {
  test("setBase('frozen') 保持姿势、不播 stun clip；setBase('stun') 仍播", () => {
    const a = new SpineActor(DATA, ENTRY);
    // 晕眩：进 stun 模式并播 Stun
    a.setBase('stun');
    assert.equal(a.mode, 'stun', '晕眩进 stun 模式');
    assert.equal(a.current, 'Stun', '晕眩播 stun clip');

    // 冻结：不该是 stun 模式，也不该播 Stun
    const b = new SpineActor(DATA, ENTRY);
    b.setBase('frozen');
    assert.notEqual(b.mode, 'stun', "冻结不该是 'stun' 模式");
    assert.notEqual(b.current, 'Stun', '冻结不该播 stun clip');

    // 从冻结回到晕眩仍然能进 stun
    b.setBase('stun');
    assert.equal(b.mode, 'stun');
    assert.equal(b.current, 'Stun');
  });

  test("setBase('frozen') 后 setBase('idle') 能恢复", () => {
    const a = new SpineActor(DATA, ENTRY);
    a.setBase('frozen');
    a.setBase('idle');
    assert.equal(a.mode, 'base');
    assert.equal(a.base, 'idle');
    assert.equal(a.current, 'Idle');
  });
});

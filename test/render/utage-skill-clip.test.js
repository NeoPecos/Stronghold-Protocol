// 宴（char_337_utage）默认 S2 的技能动画：钉住「不播 S1 的坐姿」这条链。
//
// 用户报告：宴开着默认 S2 却播了 S1「分神」的坐姿（Skill_Loop）。按交接计划 §6 逐条查证后，链路的每一段
// 都是对的，真实数据如下（都是实算，不是推断）：
//
//   素材  data/assets.json  char_337_utage.spine.front.anims:
//           attack = Attack
//           skill  = { loop:'Attack', via:'attack', index:1 }        ← 默认技能（S2 落地斩·破门）
//           skills = { 0: Skill_Start/Loop/End（S1 分神，坐下）, 1: Attack via:'attack' }
//   数据  data/chess.json   chess_char_1_18_a/b: skills[1].isDefault === true，skill.index === 1
//   协议  shared/protocol.js loadoutOptions() → defaultSkill = 1（isDefault 优先，否则 base.skill.index）
//         resolveLoadout() → 没选技能时用 opt.defaultSkill
//   服务端 match/player/basics.js loadoutFor() → 交给 views.js 的 UnitInfo.skillIndex
//   客户端 render/app/info.js → UnitInfo.skillIndex；spine.js _applyRoles() 按 anims.skills[index] 取
//
// 所以「坐姿」只会来自 skillIndex === 0（玩家真的选了 S1）。这个文件把正确行为锁住：默认/未指定 → Attack，
// 只有 0 → S1 的 Skill_Loop。素材或映射任一段退化，这里就会红。
//
// 注意 `via:'attack'` 是**故意的**：宴 S2 没有自己的技能动作，就用普通攻击 —— setSkill(true) 会落到 base
// 分支播 _baseName()（spine.js 的第三条分支），不播 Skill_Loop。所以「开技能后 clip 不是技能专属动作」
// 不是 bug。
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installFakePixi, fakeViewCtx } from './fakepixi.js';
import { presetCamera } from '../../public/js/render/projection.js';
import { spineEntry } from '../../public/js/assets.js';
import { loadoutOptions, resolveLoadout } from '../../shared/protocol.js';
import { UF } from '../../shared/constants.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const assets = JSON.parse(readFileSync(path.join(ROOT, 'data/assets.json'), 'utf8'));
const chess = JSON.parse(readFileSync(path.join(ROOT, 'data/chess.json'), 'utf8'));
const ID = 'char_337_utage';
const CHESS = 'chess_char_1_18_a';

let fake, UnitView;
before(async () => {
  fake = installFakePixi();
  ({ UnitView } = await import('../../public/js/render/units.js'));
});
after(() => fake.restore());

const tick = () => new Promise((r) => setImmediate(r));
const cam = () => presetCamera('normal', { width: 1280, height: 720 });

describe('宴 S2：默认技能不该播 S1 的坐姿', () => {
  test('数据侧：宴的默认技能是 index 1（S2 落地斩·破门）', () => {
    const rec = chess[CHESS];
    assert.ok(rec, `${CHESS} 存在`);
    const opt = loadoutOptions(rec);
    assert.deepEqual(opt.skills, [0, 1], '两个技能槽');
    assert.equal(opt.defaultSkill, 1, '默认技能是 S2（index 1）');
    const flagged = rec.skills.find((s) => s.isDefault);
    assert.equal(flagged.index, 1, 'chess.json 明确标了 S2 为默认');
    // 没选技能时 resolveLoadout 用的是默认技能，而不是 slots[0]
    assert.equal(resolveLoadout(null, rec, (id) => chess[id] || null).skillIndex, 1);
  });

  test('素材侧：宴的 skill 槽指向 Attack（via:attack），不是 Skill_Loop', () => {
    const entry = spineEntry(assets, ID, {});
    assert.equal(entry.anims.skill.via, 'attack');
    assert.equal(entry.anims.skill.index, 1);
    assert.equal(entry.anims.skill.loop, 'Attack');
    assert.equal(entry.anims.skills['0'].loop, 'Skill_Loop', 'S1 才是坐姿');
    assert.equal(entry.anims.skills['1'].loop, 'Attack', 'S2 用普通攻击');
  });

  for (const [label, skillIndex, expected] of [
    ['未指定（服务端的默认路径）', undefined, 'Attack'],
    ['S2（默认技能）', 1, 'Attack'],
    ['S1（玩家真的选了分神）', 0, 'Skill_Loop'],
  ]) {
    test(`表现侧：skillIndex=${label} → 技能槽解析为 ${expected}`, async () => {
      const entry = spineEntry(assets, ID, {});
      const store = {
        picture: () => null, image: async () => null, hasBack: () => false,
        spineEntry: () => entry,
        spine: { acquire: async (e) => ({ animations: Object.keys(e.animations || {}).map((name) => ({ name })) }), release() {} },
      };
      const info = { id: 1, side: 'ally', kind: 'op', defId: ID, spine: ID, tier: 5, x: 5, y: 9, maxHp: 2657, dir: 'RIGHT' };
      if (skillIndex !== undefined) info.skillIndex = skillIndex;
      const v = new UnitView(fakeViewCtx(fake.P, { assets: store, cam }), info);
      for (let i = 0; i < 4; i++) await tick();
      assert.ok(v.actor, '模型已建');
      assert.equal(v.actor.roles.skill.loop, expected,
        `skillIndex=${String(skillIndex)} 应解析为 ${expected}，实际 ${v.actor.roles.skill.loop}`);
      // 开技能：S2 走 via:'attack' → 播基准动作（Attack/Idle），绝不能是坐姿；
      // S1 有 Skill_Start 起手，所以追踪**所有播过的 clip**而不是只看最后一帧。
      //
      // 关键：flags 只能通过 sync() 的 sample 传进去。UnitView.sync 用 `prevFlags ^ this.flags` 做**变化检测**
      // （units.js:887），而 prevFlags 取自 this.flags —— 若先手动 `v.flags = UF.SKILL` 再 sync，两边就都是
      // 新值、异或为 0，setSkill 一次都不会被调用（本文件第一版就踩了这个坑，白白追查了一轮）。
      const sample = (flags) => ({ flags, x: 5, y: 9, hp: 2657, maxHp: 2657, sp: 0, spMax: 0, anim: 0, vx: 0 });
      const seen = new Set();
      v.sync(sample(UF.SKILL), 1);
      for (let i = 0; i < 40; i++) { v.update(1 / 60, cam(), 1 + i / 60); if (v.actor.current) seen.add(v.actor.current); }
      seen.add(v.actor.current);
      if (expected === 'Attack') {
        assert.ok(!seen.has('Skill_Loop'),
          `skillIndex=${String(skillIndex)} 开技能全程都不该播 S1 坐姿，实际播过 ${[...seen].join(', ')}`);
      } else {
        assert.ok(seen.has('Skill_Loop') || seen.has('Skill_Start'),
          `S1 应当播技能动作（Skill_Start/Skill_Loop），实际播过 ${[...seen].join(', ')}`);
      }
      v.destroy();
    });
  }
});

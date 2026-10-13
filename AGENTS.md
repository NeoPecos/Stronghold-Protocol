# AGENTS.md

Entry point for AI coding assistants (Codex, Claude Code, Cursor, Copilot …) working on this repository. It only
indexes the existing documents and their hard rules; when this file and a linked document disagree, the document wins.
Human contributors: [CONTRIBUTING.md](CONTRIBUTING.md) is the same material in full.

## What this is

A non-commercial fan remake of Arknights「卫戍协议：盟约」 that runs in the browser: a Node.js server (economy, rounds,
rooms) and a deterministic battle sim shared by the server and the browser. It aims to be faithful to the official mode.

## Read first

1. [PROJECT-STATUS.md](PROJECT-STATUS.md) — the single current-state entry point: production versions, active task,
   dirty-worktree risks and the next verified action. Read it before interpreting historical handoff notes.
2. [docs/WORKFLOW.md](docs/WORKFLOW.md) — mandatory task ownership, checkpoint, logging, review and release workflow
   for every coding agent working in this repository.
3. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — the code map: where things live, data flow, golden results,
   import boundaries, where common changes start.
4. [docs/DESIGN.md](docs/DESIGN.md) — the index of the rules: current rules in `docs/design/`, each release's
   revisions and their evidence in `docs/history/`.
5. The reference for the part you touch: [docs/SIM.md](docs/SIM.md) (battle engine API, hooks, test harness),
   [docs/META.md](docs/META.md) (match flow, shop, protocol), [docs/DATA.md](docs/DATA.md) (generated data),
   [docs/I18N.md](docs/I18N.md) (interface strings), `server/sim/content/kits/README.md` (operator kits).

## Hard rules

- **Work from a task file.** Any change beyond a trivial typo needs an active `docs/tasks/TASK-*.md` with scope,
  protected areas, acceptance checks and rollback notes. Update its checkpoint before ending a session.
- **Keep one current truth.** `PROJECT-STATUS.md` is concise and current. Append factual actions to the monthly file
  under `docs/ops/`; historical handoff documents are evidence, never the source of current production state.
- **No mixed-source releases.** Do not combine unreviewed local edits, another agent's partial work, upstream changes
  and production hotfixes in one package. Reconcile provenance first and record the frozen commit in the release file.
- **Deployment is a separate step.** Implementing or building does not authorize deployment. A release task must list
  artifacts, hashes, backups, validation and rollback. Never infer that a server or client is current from source alone.
- **Checkpoint early.** Leave the worktree understandable before a context or quota boundary: completed work, exact
  remaining work, tests run, failures and the next command belong in the active task and operations log.

- **Official first.** Rules come from the official data tables (`.cache/gamedata/excel/` after setup) and
  [PRTS](https://prts.wiki/). A detail no source settles is implemented the simplest way and marked `[ASSUMED]` in the
  code and the PR. Deliberate deviations from the official mode are the maintainer's decision only.
- **Determinism.** `server/sim/` is plain ESM that runs in Node and in browsers: no Node APIs, no `Math.random`, no
  clocks, and no engine-approximated Math functions (use `server/sim/detmath.js`; ESLint and
  `test/sim/detmath.test.js` enforce it).
- **Golden results.** A refactor must not change `test/golden/*.json`. An intended gameplay change runs
  `npm run golden:update` in the same commit, and the commit / PR names every moved scenario and why
  ([test/golden/README.md](test/golden/README.md)).
- **Generated data.** Never hand-edit `data/*.json`: change `tools/build-data.mjs` and regenerate.
- **No game art in git.** `public/assets/` is ignored; never commit extracted or downloaded game files.
- **Interface strings** go through `t('…')`, with entries in every pack under `public/i18n/`
  (`node tools/i18n.mjs check --all --strict`).
- **Docs follow the code.** A rule change updates `docs/design/`, the current `docs/history/` file and the reference
  docs; run `node --test test/docs-consistency.test.js test/docs-paths.test.js`.
- **Commits and PRs**: one topic per PR; a one-line message of what changed (Chinese or English) with the issue number;
  no attribution trailers (`Co-Authored-By:`, `Generated with …`). The PR description states what, why, the sources,
  the `[ASSUMED]` points, the tests you ran (paste the summary lines) and the golden moves. No ads, payments or other
  monetisation — the project stays non-commercial.

## Verify

Run the tests of what you touched first, then everything before opening the PR:

```bash
node --test test/<area>/<file>.test.js      # targeted
npm run ci                                  # the CI checks locally (tools/ci.mjs): node --test, smoke, lint, imports, types
npm run golden                              # golden results
```

Browser suites are off by default and need Chrome: `SP_E2E=1` (UI), `SP_REAL_E2E=1` (real match, needs assets),
`RENDER_E2E=1`, `SIM_E2E=1` — see CONTRIBUTING.md §2. Battle tests are easiest with the helpers described in
docs/SIM.md (the test harness section) and the patterns in `test/content/op_siege.test.js`.

## 与维护者协作的硬约束（AI 助手必须遵守，优先级最高）

维护者（Leiothrix）对本仓库 AI 助手的要求，按原话记录（2026-10-13）：

- **先回答，再动手。** 收到任务先回答/确认（一两句话），再开始执行 —— 「每次我的任务，都先回答我再做！！！」
- **做好决定先问我。** 方案、取舍、参数、位置对不上时先问维护者，不自己拍板 —— 「做好决定先问我！！！」「按我的要求来，有问题就找我」
- **不要自己跑测试/验证。** 除非明确要求，不要跑 `node --test`、`npm run ci`、`npm run golden`、渲染截图对比或任何“证据式”验证 —— 「我不会测试吗，要你来」「谁允许你自己跑测试」
- **不许擅自升版本号、不许擅自用内部更新器。** 补丁包 = 交给维护者自己分发的文件；不碰 `release/latest.json`、不碰服务器更新通道 —— 「谁允许你升版本号了？？？」「谁让你用内部更新器了」
- **只做交代的范围。** 不发散、不顺手改其他文件、不加没要求的诊断/日志/测试 —— 「别他妈乱发散！」
- **每完成一部分就回复。** 分步交付、不长时间沉默；长任务要说明正在做什么 —— 「每完成一部分给我回复」「告诉我你在干什么！」
- **不要覆盖维护者的 UI 设计。** UI/素材只在明确要求时改动 —— 「你千万别覆盖我的各种ui设计」

本节与上面的 `Hard rules` / `Verify` 冲突时**以本节为准**（例如“验证/跑测试”只在维护者明确要求时执行）。

# TASK-032 — 装备槽普通/金色状态显示

Status: `in_progress`

Lead: Codex

Implementer: Codex

Starting commit: `20d726f09c42e605e846f1964ef457208f938f21`

## Goal

让干员头顶装备槽按实际装备品质显示：普通装备白色、金色装备金色、未装备不显示。

## Scope

- `public/js/render/app.js` 传递装备图标地址及 `isGolden` 状态。
- `public/js/render/units.js` 按每件装备的品质绘制最多两个槽位，并隐藏空装备条。
- `test/render/unitview.test.js` 覆盖普通、金色和空装备状态。

## Protected areas

- 服务端经济、装备规则、战斗模拟、协议、账号/房间、原生客户端和 CDN 不变。
- 不安装或合并 `ui-hub-package-20261013.zip`；该包另行评估。
- 不修改版本号、客户端更新清单或签名文件。

## Acceptance checks

- 普通装备显示白色槽位，金色装备显示金色槽位。
- 新购且未装备的干员不显示装备槽。
- 同一干员最多显示两个装备槽。
- 维护者负责刷新开发预览进行视觉确认；本次按维护者既有要求不运行测试套件或 CI。

## Current checkpoint

- 已完成渲染层字段传递与槽位显示修复，并补充针对性单测。
- UI 美化包尚未安装、未改动仓库内容。
- Tests: 未运行（维护者要求由其自行测试）。
- Next: 提交本任务，按发布记录静态部署到 JING，再记录回读哈希和服务状态。
- GitHub/production: 尚未因本任务更新。

## Review notes

待部署后维护者视觉确认。

## Rollback

恢复发布记录中的 `/opt/sp2/backups/` 原文件即可；本地回退提交 `20d726f0` 之前的装备槽实现。

// 商店「免费刷新」徽标：图片自带 FREE 字样，DOM 不能再画一遍。
//
// 修的是什么（2026-10-11，用户报告"免费刷新徽标文字重影"）：`public/assets/ui/shopPanel/cost_free.png`
// 本身就印着 `FREE`，而 shopBar 以前在它上面又渲染 `FREE ×N`，于是同一个词叠了两层。
// 正确做法是保留原图、只叠 `×N`，并把 `×N` 对齐到徽标右半部分（样式在 game-shop.css 的 .toolbtn__free）。
//
// 这个测试盯住两件事：
//   1. 渲染出来的徽标里只有一个 FREE —— 而且是**图片里的那个**，不是 DOM 文本；
//   2. `×N` 仍然渲染，并且可访问名字（aria-label）保留了"免费 ×N"，不让改动把可读性弄丢。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const SRC = readFileSync(path.join(ROOT, "public/js/ui/shopBar.js"), "utf8");

test("免费刷新的徽标只叠 ×N，不再重复绘制图片自带的 FREE", () => {
  // 徽标那一行的源码
  const line = SRC.split("\n").find(
    (l) => l.includes("toolbtn__free") && l.includes("aria-label"),
  );
  assert.ok(line, "应该找得到免费徽标那一行");

  // ① 视觉文本里不能再有 FREE 这个词。
  //    注意：内容现在是 `×${free}` —— 变量名 free 出现在模板占位符里，所以不能对整行做 /FREE/i（会误判）。
  //    只检查 >...< 之间的可见文本，并按“独立的 FREE 单词”匹配（不匹配变量名）。
  const visual = line.match(/>([^<]*)<\/span>/)?.[1] ?? "";
  assert.ok(
    !/(^|[^A-Za-z$])FREE([^A-Za-z]|$)/.test(visual),
    `徽标的可见文本里不该再有 FREE（图片自带），实际是 ${JSON.stringify(visual)}`,
  );
  assert.match(visual, /\$\{free\}|\d/, "徽标仍要显示次数");

  // ② 整个 shopBar 里不允许出现 `FREE ×` 这种叠加写法（渲染成可见文本的那种）
  assert.ok(!/FREE\s*×/.test(SRC), "不能再出现 `FREE ×` 这种叠加写法");

  // ③ 可访问名字仍在（读屏用户还能听到"免费 ×N"）
  assert.match(
    line,
    /aria-label=\$\{t\('免费 ×/,
    "aria-label 要保留 免费 ×N，别把可访问性一起删掉",
  );
});
test("免费徽标的样式仍然定义在，且内容是靠右的（×N 落在图片右半）", () => {
  const css = readFileSync(
    path.join(ROOT, "public/css/screens/game-shop.css"),
    "utf8",
  );
  // 规则是多行的：取 `.toolbtn__free {` 到它自己的 `}` 之间的整段
  const m = css.match(/\.toolbtn__free\s*\{([\s\S]*?)\}/);
  assert.ok(m, "应该找得到 .toolbtn__free 的规则");
  const body = m[1];
  assert.match(
    body,
    /position:\s*absolute/,
    "徽标是叠在刷新按钮上的绝对定位元素",
  );
  // 修重影的关键：内容不再居中，而是靠右 → ×N 避开图片左侧的 FREE 字样
  assert.ok(
    /justify-content:\s*flex-end|text-align:\s*right/.test(body),
    `×N 要靠右排，避开图片自带的 FREE；实际规则：${body.replace(/\s+/g, " ").trim()}`,
  );
});

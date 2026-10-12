// 浏览器公告的「该不该弹」判断（ui/notice.js）。
//
// 安全要求是单向的：
//   • 客户端看到「浏览器版停止支持」= 严重误导 → 绝不允许（这里用正例钉死）
//   • 浏览器漏看到 = 可以接受（但反例也别太离谱）
//
// UA 均取自 2026-10-11 服务器访问日志的真实样本。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { noticeDecision, NOTICE_VERSION, NOTICE_STORAGE_KEY, NOTICE_REASON } from '../../public/js/ui/notice.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

describe('接线：公告真的被挂进 boot（否则浏览器用户根本看不到）', () => {
  const main = read('public/js/main.js');

  test('main.js 引入了 installBrowserNotice', () => {
    assert.match(main, /import\s*\{[^}]*installBrowserNotice[^}]*\}\s*from\s*['"][^'"]*ui\/notice\.js['"]/,
      'main.js 必须 import installBrowserNotice，否则公告不会弹');
  });

  test('boot 里真的调用了它', () => {
    assert.match(main, /installBrowserNotice\s*\(/, 'boot 里必须调用 installBrowserNotice');
  });

  test('index.html 的公告带「关闭」标记（点了要记住，否则每次刷新都弹）', () => {
    const html = read('public/index.html');
    assert.match(html, /data-notice-dismiss/, '关闭按钮需要 data-notice-dismiss 标记');
    assert.match(html, /id="distribution-notice"/, '公告节点必须保留 id=distribution-notice');
  });

  test('公告节点默认仍是 hidden（没 JS 时不能糊住游戏）', () => {
    const html = read('public/index.html');
    assert.match(html, /<section id="distribution-notice" hidden/,
      '必须保持 hidden 初始态：JS 没跑起来时页面照常可用');
  });
});

describe('公告判断：原生客户端一律不弹（最重要的一条）', () => {
  test('native=true → 不弹，理由标注 native-client', () => {
    const d = noticeDecision({ native: true, dismissed: null, hasElement: true });
    assert.equal(d.show, false);
    assert.equal(d.reason, NOTICE_REASON.client);
  });

  test('即便是从没关过公告的客户端，也不弹', () => {
    assert.equal(noticeDecision({ native: true, dismissed: null, hasElement: true }).show, false);
  });

  test('native 优先于其它一切条件（客户端 + 有节点 + 没关过 → 仍不弹）', () => {
    assert.equal(noticeDecision({ native: true, dismissed: '0', hasElement: true }).show, false);
  });
});

describe('公告判断：浏览器该弹的情况', () => {
  test('浏览器 + 没关过 + 页面有节点 → 弹', () => {
    const d = noticeDecision({ native: false, dismissed: null, hasElement: true });
    assert.equal(d.show, true);
    assert.equal(d.reason, NOTICE_REASON.okay);
  });

  test('没读过 localStorage（undefined）也按「没关过」处理', () => {
    assert.equal(noticeDecision({ native: false, hasElement: true }).show, true);
  });

  test('关过「旧版本」→ 换版本后要再弹一次', () => {
    const older = String(NOTICE_VERSION - 1);
    assert.equal(noticeDecision({ native: false, dismissed: older, hasElement: true }).show, true);
  });
});

describe('公告判断：浏览器不必重复弹的情况', () => {
  test('关过「当前版本」→ 不再弹', () => {
    const d = noticeDecision({ native: false, dismissed: String(NOTICE_VERSION), hasElement: true });
    assert.equal(d.show, false);
    assert.equal(d.reason, NOTICE_REASON.dismissed);
  });

  test('存的版本号是数字（不是字符串）也认', () => {
    assert.equal(noticeDecision({ native: false, dismissed: NOTICE_VERSION, hasElement: true }).show, false);
  });

  test('页面没有公告节点 → 不弹（也不报错）', () => {
    const d = noticeDecision({ native: false, dismissed: null, hasElement: false });
    assert.equal(d.show, false);
    assert.equal(d.reason, NOTICE_REASON.missing);
  });
});

describe('公告元数据', () => {
  test('版本号是正整数（改文案时要 +1，让老用户再看一次）', () => {
    assert.ok(Number.isInteger(NOTICE_VERSION) && NOTICE_VERSION >= 1);
  });

  test('存储键名稳定（改名会让所有人重看一遍公告）', () => {
    assert.equal(NOTICE_STORAGE_KEY, 'sp.notice.dismissed');
  });
});

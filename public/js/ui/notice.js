// 浏览器公告：给「浏览器用户」看的退出提示（服务器带宽不够，不再支持网页玩）。
//
// 为什么单独一个模块：这一层的安全要求是**单向的** ——
//   • 客户端绝不能看到「浏览器版停止支持」（他还得用客户端，看到会以为客户端也完了）
//   • 浏览器漏看到只是少个提示，可以接受
// 所以「该不该弹」这个判断必须能脱离浏览器被测试（见 test/ui/browser-notice.test.js）。
import { isNativeClient } from './device.js';

/**
 * 公告版本。改了公告内容就把它 +1 —— 已关闭过旧版本的用户会再看到一次。
 * 刻意写死在代码里（而不是读 HTML 的 data 属性）：判断逻辑不依赖 DOM，才能单测。
 */
export const NOTICE_VERSION = 2;

/** 记录「用户已关闭哪个版本的公告」的 localStorage 键。 */
export const NOTICE_STORAGE_KEY = 'sp.notice.dismissed';

/** 诊断标签：说明为什么显示/不显示（日志与测试都看它）。 */
export const NOTICE_REASON = Object.freeze({
  okay: 'show',
  client: 'native-client',
  dismissed: 'dismissed',
  missing: 'no-notice-element',
});

/**
 * 是否要给这个用户弹公告。
 * @param {object} [opts]
 * @param {boolean} [opts.native] 是否原生客户端（默认现算 isNativeClient()）
 * @param {string|null} [opts.dismissed] 已关闭的公告版本（默认读 localStorage）
 * @param {boolean} [opts.hasElement] 页面上有没有公告节点（默认查 DOM）
 * @returns {{ show: boolean, reason: string }}
 */
export function noticeDecision(opts = {}) {
  const native = opts.native !== undefined ? opts.native : isNativeClient();
  if (native) return { show: false, reason: NOTICE_REASON.client };

  let dismissed = opts.dismissed;
  if (dismissed === undefined) {
    try {
      dismissed = globalThis.localStorage?.getItem(NOTICE_STORAGE_KEY) ?? null;
    } catch {
      dismissed = null; // 隐私模式等：读不到就当没关过
    }
  }
  // 字符串比较：存的就是版本号。旧版本关过 → 新版本再弹一次。
  if (dismissed !== null && String(dismissed) === String(NOTICE_VERSION)) {
    return { show: false, reason: NOTICE_REASON.dismissed };
  }

  const hasElement = opts.hasElement !== undefined
    ? opts.hasElement
    : !!globalThis.document?.getElementById?.('distribution-notice');
  if (!hasElement) return { show: false, reason: NOTICE_REASON.missing };

  return { show: true, reason: NOTICE_REASON.okay };
}

/**
 * 在 boot 阶段决定弹不弹公告；弹了就把「关闭」按钮接上，记住用户关的是哪个版本。
 * 任何异常都吞掉：公告绝不能让游戏起不来。
 * @returns {{ show: boolean, reason: string }}
 */
export function installBrowserNotice() {
  let decision = { show: false, reason: NOTICE_REASON.missing };
  try {
    decision = noticeDecision();
    if (!decision.show) return decision;

    const panel = globalThis.document?.getElementById?.('distribution-notice');
    if (!panel) return { show: false, reason: NOTICE_REASON.missing };
    panel.hidden = false;

    // 「关闭」按钮：记住版本，下次不再弹（换了版本会再弹一次）
    const dismiss = () => {
      panel.hidden = true;
      try {
        globalThis.localStorage?.setItem(NOTICE_STORAGE_KEY, String(NOTICE_VERSION));
      } catch {
        /* 存不了就算了，顶多下次再弹一次 */
      }
    };
    for (const button of panel.querySelectorAll?.('[data-notice-dismiss]') ?? []) {
      button.addEventListener('click', dismiss);
    }
  } catch (error) {
    // 公告永远不能让 boot 失败
    globalThis.console?.warn?.('[notice] browser notice not shown:', error);
  }
  return decision;
}

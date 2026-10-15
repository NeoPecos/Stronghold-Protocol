// server/http/announcementAdmin.js — 机器人发布公告的受控桥接（TASK-049）。
//
// 设计边界（与 TASK-048 的「不暴露写接口」一致，只开这一条窄缝）：
//   * 唯一能力 = 把一份已经过校验的标题 + Markdown 正文**新增**为一条公告；没有置顶、删除、通知、读取以外的动作。
//   * 令牌是独立的 `SP_ANNOUNCE_TOKEN`（≥16 字符），与 `SP_ADMIN_TOKEN`（改密码、踢人）完全分开：
//     机器人若被攻破，拿到的只是「能发公告」，不能踢人或改密码。
//   * 请求体只接受 `title` 与 `markdown` 两个字段；出现 `id`/`pin`/`notify` 等字段一律拒绝，
//     避免调用方绕过 TASK-048 的「已发布公告不可覆盖」规则（改错只能再发一条新公告）。
//   * 双提交保护：同一进程内 2 秒内第二次发布直接拒绝，防止网络重试写出两条一模一样的公告。
//
// 校验与限额直接复用 shared/announcements.js 与 store.publish()：桥接自己不复制一份规则。

import {
  ANNOUNCEMENT_MAX_BODY_BYTES, ANNOUNCEMENT_MAX_BODY_CHARS, ANNOUNCEMENT_MAX_TITLE_LENGTH,
} from '../../shared/announcements.js';

export const ANNOUNCE_TOKEN_HEADER = 'x-sp-announce-token';
export const ANNOUNCE_PUBLISH_PATH = '/api/admin/announcements/publish';
const MIN_REPUBLISH_INTERVAL_MS = 2000;
const ALLOWED_FIELDS = new Set(['title', 'markdown']);

/**
 * 只发布、不解释 HTTP 细节的函数体：路由层负责方法/令牌/JSON 解析，这里只做字段校验与写入。
 * @param {{ announcements: import('../announcementStore.js').AnnouncementStore,
 *           now?: () => number }} deps
 */
export function createAnnouncementPublisher({ announcements, now = () => Date.now() }) {
  let lastPublishAt = 0;
  let lastPublishId = null;

  /**
   * @param {any} body 已解析的 JSON 请求体
   * @returns {{ status: number, payload: object }}
   */
  function publish(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { status: 400, payload: { error: 'BAD_REQUEST' } };
    const extra = Object.keys(body).filter((key) => !ALLOWED_FIELDS.has(key));
    if (extra.length) {
      // 明确告知被拒字段：调用方不会以为「pin 生效了」。
      return { status: 400, payload: { error: 'UNSUPPORTED_FIELD', fields: extra.sort() } };
    }
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const markdown = typeof body.markdown === 'string' ? body.markdown : '';
    if (!title) return { status: 400, payload: { error: 'TITLE_REQUIRED', message: `标题不能为空（最多 ${ANNOUNCEMENT_MAX_TITLE_LENGTH} 字）` } };
    if ([...title].length > ANNOUNCEMENT_MAX_TITLE_LENGTH) {
      return { status: 400, payload: { error: 'TITLE_TOO_LONG', message: `标题最多 ${ANNOUNCEMENT_MAX_TITLE_LENGTH} 字` } };
    }
    if (!markdown.trim()) return { status: 400, payload: { error: 'BODY_REQUIRED', message: '正文不能为空' } };
    if (markdown.length > ANNOUNCEMENT_MAX_BODY_CHARS) {
      return { status: 400, payload: { error: 'BODY_TOO_LONG', message: `正文最多 ${ANNOUNCEMENT_MAX_BODY_CHARS} 字符` } };
    }
    if (Buffer.byteLength(markdown, 'utf8') > ANNOUNCEMENT_MAX_BODY_BYTES) {
      return { status: 400, payload: { error: 'BODY_TOO_LARGE', message: `正文最多 ${ANNOUNCEMENT_MAX_BODY_BYTES} 字节` } };
    }
    const at = now();
    if (at - lastPublishAt < MIN_REPUBLISH_INTERVAL_MS) {
      return { status: 429, payload: { error: 'TOO_SOON', message: '刚刚已经发布过一条，请确认后再试', previousId: lastPublishId } };
    }
    let item;
    try {
      // 不传 id / pin：ID 由 store 生成，置顶留给维护者用命令行显式操作。
      item = announcements.publish({ title, markdown });
    } catch (error) {
      // 校验失败、目录锁、条数上限等都从这里出来；文案里没有密钥，可以原样回给机器人翻译。
      return { status: 400, payload: { error: 'PUBLISH_FAILED', message: String(error?.message || error) } };
    }
    lastPublishAt = at;
    lastPublishId = item.id;
    return {
      status: 200,
      payload: {
        ok: true, id: item.id, title: item.title, publishedAt: item.publishedAt,
        readBackPath: `/api/announcements/${item.id}`,
      },
    };
  }

  return { publish };
}

import type { Bot } from "grammy";
import { GrammyError } from "grammy";
import type { Store } from "./db/index.js";
import { t, type Lang } from "./i18n.js";
import type { Outage } from "./parser/types.js";

/** Окно «свежести»: столько после публикации отключение считается актуальным (статус ещё осмыслен). */
export const RECENT_WINDOW_MS = 3 * 24 * 60 * 60_000;

export const escapeHtml =(s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function matchesKeyword(o: Outage, keyword: string): boolean {
  return `${o.title} ${o.body}`.toLowerCase().includes(keyword);
}

export function formatOutage(lang: Lang, o: Outage): string {
  const m = t(lang);
  const body = o.body.length > 300 ? `${o.body.slice(0, 300)}…` : o.body;
  const label = o.status === "restored" ? m.restored : m.active;
  return (
    `${label}\n<b>${escapeHtml(o.title)}</b>\n\n${escapeHtml(body)}\n\n` +
    `<a href="${escapeHtml(o.url)}">${m.more}</a>`
  );
}

/** Рассылает событие подписчикам, чьё ключевое слово встречается в тексте. Один раз на чат. */
export async function notifyOutage(bot: Bot, store: Store, o: Outage): Promise<void> {
  const chats = new Map<number, Lang>();
  for (const s of store.allSubscribers()) {
    if (matchesKeyword(o, s.keyword)) chats.set(s.chatId, s.lang);
  }

  for (const [chatId, lang] of chats) {
    try {
      await bot.api.sendMessage(chatId, formatOutage(lang, o), {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
    } catch (err) {
      // 403 — пользователь заблокировал бота: чистим его подписки.
      if (err instanceof GrammyError && err.error_code === 403) store.deleteUser(chatId);
      else console.error(`send to ${chatId} failed:`, err);
    }
  }
}

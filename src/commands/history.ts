import { InlineKeyboard, type Bot } from "grammy";
import type { Store } from "../db/index.js";
import { t } from "../i18n.js";
import { RECENT_WINDOW_MS, escapeHtml, matchesKeyword } from "../notify.js";
import type { Outage } from "../parser/types.js";
import { HISTORY_PERIODS, fetchOutagesSince, isHistoryPeriod } from "../parser/voda-uz.js";

// Лимит Telegram — 4096 символов; считаем по сырому тексту с HTML-тегами, то есть с запасом.
export const MESSAGE_LIMIT = 4000;

const STATUS_ICON = { active: "🚰", restored: "✅" } as const;

const kyivDay = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit" });

/** «дд.мм» по Киеву; год не нужен — период истории не больше 90 дней. */
export function formatKyivDay(date: Date): string {
  const parts = Object.fromEntries(kyivDay.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.day}.${parts.month}`;
}

/** Строка истории: дата, значок статуса (только у свежих записей), заголовок-ссылка. */
export function formatHistoryEntry(o: Outage, now = Date.now()): string {
  const icon = now - o.publishedAt.getTime() < RECENT_WINDOW_MS ? `${STATUS_ICON[o.status]} ` : "";
  return `${formatKyivDay(o.publishedAt)} ${icon}<a href="${escapeHtml(o.url)}">${escapeHtml(o.title)}</a>`;
}

/** Склеивает заголовок и записи в сообщения не длиннее `limit`; запись не режется и не теряется. */
export function splitMessages(header: string, entries: string[], limit = MESSAGE_LIMIT): string[] {
  const messages: string[] = [];
  let current = header;
  for (const entry of entries) {
    if (current.length + 1 + entry.length > limit) {
      messages.push(current);
      current = entry;
    } else {
      current += `\n${entry}`;
    }
  }
  messages.push(current);
  return messages;
}

/** История отключений по подпискам за период, выбранный кнопкой (7 / 30 / 90 дней). */
export function registerHistory(bot: Bot, store: Store): void {
  bot.command("history", (ctx) => {
    const m = t(store.getLang(ctx.chat.id));
    if (store.listSubscriptions(ctx.chat.id).length === 0) return ctx.reply(m.historyNoSubs);

    const keyboard = new InlineKeyboard();
    for (const days of HISTORY_PERIODS) keyboard.text(m.periodButton(days), `history:${days}`);
    return ctx.reply(m.historyPick, { reply_markup: keyboard });
  });

  bot.callbackQuery(/^history:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery(); // иначе у кнопки в клиенте остаётся индикатор ожидания

    // Данные кнопки приходят от клиента и могут быть подделаны: период проверяем по белому списку.
    const days = Number(ctx.match[1]);
    const chatId = ctx.chat?.id;
    if (!isHistoryPeriod(days) || chatId === undefined) return;

    const m = t(store.getLang(chatId));
    const subs = store.listSubscriptions(chatId); // подписки могли пропасть после показа кнопок
    if (subs.length === 0) return ctx.reply(m.historyNoSubs);

    let outages: Outage[];
    try {
      outages = await fetchOutagesSince(days);
    } catch (err) {
      console.error("history fetch failed:", err);
      return ctx.reply(m.loadError);
    }

    const items = outages.filter((o) => subs.some((k) => matchesKeyword(o, k)));
    if (items.length === 0) return ctx.reply(m.historyEmpty(days));

    const messages = splitMessages(m.historyHeader(days, items.length), items.map((o) => formatHistoryEntry(o)));
    for (const text of messages) {
      await ctx.reply(text, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
    }
  });
}

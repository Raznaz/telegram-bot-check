import type { Bot, Context } from "grammy";
import type { Store } from "../db/index.js";
import { t } from "../i18n.js";

export const normalizeKeyword = (raw: string) => raw.trim().toLowerCase().replace(/\s+/g, " ");

// Чаты, от которых после «/subscribe» без аргумента ждём название улицы: chatId -> срок ожидания.
// Только в памяти: после рестарта пользователь просто повторит /subscribe.
const AWAIT_TTL_MS = 10 * 60_000;
const awaiting = new Map<number, number>();

/** Любая команда отменяет ожидание названия (вызывается из bot.ts до обработчиков команд). */
export const cancelAwaitingSubscribe = (chatId: number): void => {
  awaiting.delete(chatId);
};

export function registerSubscribe(bot: Bot, store: Store): void {
  const subscribe = (ctx: Context, chatId: number, raw: string) => {
    const m = t(store.getLang(chatId));
    const keyword = normalizeKeyword(raw);
    // Некорректное название: отвечаем, но продолжаем ждать, если ожидание уже было включено.
    if (keyword.length < 3 || keyword.length > 50) return ctx.reply(m.badKeyword);
    awaiting.delete(chatId);
    if (!store.addSubscription(chatId, keyword)) return ctx.reply(m.tooMany);
    return ctx.reply(m.subscribed(keyword));
  };

  bot.command("subscribe", (ctx) => {
    if (normalizeKeyword(ctx.match)) return subscribe(ctx, ctx.chat.id, ctx.match);
    awaiting.set(ctx.chat.id, Date.now() + AWAIT_TTL_MS);
    return ctx.reply(t(store.getLang(ctx.chat.id)).askSubscribe);
  });

  // Ответ на «/subscribe» без аргумента; иначе сообщение идёт дальше по цепочке.
  bot.on("message:text", (ctx, next) => {
    const expiresAt = awaiting.get(ctx.chat.id);
    if (expiresAt === undefined) return next();
    if (expiresAt < Date.now()) {
      awaiting.delete(ctx.chat.id);
      return next();
    }
    return subscribe(ctx, ctx.chat.id, ctx.message.text);
  });
}

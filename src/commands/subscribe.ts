import type { Bot } from "grammy";
import type { Store } from "../db/index.js";
import { t } from "../i18n.js";

export const normalizeKeyword = (raw: string) => raw.trim().toLowerCase().replace(/\s+/g, " ");

export function registerSubscribe(bot: Bot, store: Store): void {
  bot.command("subscribe", async (ctx) => {
    const m = t(store.getLang(ctx.chat.id));
    const keyword = normalizeKeyword(ctx.match);
    if (!keyword) return ctx.reply(m.usageSubscribe);
    if (keyword.length < 3 || keyword.length > 50) return ctx.reply(m.badKeyword);
    if (!store.addSubscription(ctx.chat.id, keyword)) return ctx.reply(m.tooMany);
    return ctx.reply(m.subscribed(keyword));
  });
}

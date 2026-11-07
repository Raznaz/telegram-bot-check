import type { Bot } from "grammy";
import type { Store } from "../db/index.js";
import { t } from "../i18n.js";
import { normalizeKeyword } from "./subscribe.js";

export function registerUnsubscribe(bot: Bot, store: Store): void {
  bot.command("unsubscribe", (ctx) => {
    const m = t(store.getLang(ctx.chat.id));
    const keyword = normalizeKeyword(ctx.match);
    if (!keyword) return ctx.reply(m.usageUnsubscribe);
    const removed = store.removeSubscription(ctx.chat.id, keyword);
    return ctx.reply(removed ? m.unsubscribed(keyword) : m.notFound(keyword));
  });
}

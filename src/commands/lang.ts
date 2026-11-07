import type { Bot } from "grammy";
import type { Store } from "../db/index.js";
import { isLang, t } from "../i18n.js";

export function registerLang(bot: Bot, store: Store): void {
  bot.command("lang", (ctx) => {
    const arg = ctx.match.trim().toLowerCase();
    if (!isLang(arg)) return ctx.reply(t(store.getLang(ctx.chat.id)).langUsage);
    store.setLang(ctx.chat.id, arg);
    return ctx.reply(t(arg).langSet);
  });
}

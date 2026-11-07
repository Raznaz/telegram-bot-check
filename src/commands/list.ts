import type { Bot } from "grammy";
import type { Store } from "../db/index.js";
import { t } from "../i18n.js";

export function registerList(bot: Bot, store: Store): void {
  bot.command("list", (ctx) => {
    const m = t(store.getLang(ctx.chat.id));
    const subs = store.listSubscriptions(ctx.chat.id);
    if (subs.length === 0) return ctx.reply(m.listEmpty);
    return ctx.reply(`${m.listHeader}\n${subs.map((s) => `• ${s}`).join("\n")}`);
  });
}

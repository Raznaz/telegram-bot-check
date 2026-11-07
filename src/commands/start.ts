import type { Bot } from "grammy";
import type { Store } from "../db/index.js";
import { t } from "../i18n.js";

export function registerStart(bot: Bot, store: Store): void {
  bot.command("start", (ctx) => ctx.reply(t(store.getLang(ctx.chat.id)).start));
}

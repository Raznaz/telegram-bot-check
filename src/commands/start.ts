import type { Bot } from "grammy";
import type { Store } from "../db/index.js";
import { t } from "../i18n.js";
import { mainKeyboard } from "../menu.js";

export function registerStart(bot: Bot, store: Store): void {
  bot.command("start", (ctx) => {
    const lang = store.getLang(ctx.chat.id);
    return ctx.reply(t(lang).start, { reply_markup: mainKeyboard(lang) });
  });
}

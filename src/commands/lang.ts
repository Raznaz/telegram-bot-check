import { InlineKeyboard, type Bot } from "grammy";
import type { Store } from "../db/index.js";
import { LANGS, isLang, t, type Lang } from "../i18n.js";
import { mainKeyboard, menuLabels } from "../menu.js";
import { showScreen, type ChatContext } from "../screen.js";

/** Экран настроек: выбор языка, у текущего отметка ✅. */
export function buildSettingsScreen(lang: Lang): { text: string; keyboard: InlineKeyboard } {
  const m = t(lang);
  const keyboard = new InlineKeyboard();
  for (const l of LANGS) keyboard.text(`${l === lang ? "✅ " : ""}${m.langButton[l]}`, `lang:set:${l}`);
  return { text: m.settingsHeader, keyboard };
}

export function registerLang(bot: Bot, store: Store): void {
  const showSettings = (ctx: ChatContext) => {
    const { text, keyboard } = buildSettingsScreen(store.getLang(ctx.chat.id));
    return showScreen(ctx, text, keyboard);
  };

  // Подтверждение смены языка приходит с главной клавиатурой: заменить её можно только новым сообщением.
  const setLang = (ctx: ChatContext, lang: Lang) => {
    store.setLang(ctx.chat.id, lang);
    return ctx.reply(t(lang).langSet, { reply_markup: mainKeyboard(lang) });
  };

  bot.command("lang", (ctx) => {
    const arg = ctx.match.trim().toLowerCase();
    if (arg === "") return showSettings(ctx);
    if (!isLang(arg)) return ctx.reply(t(store.getLang(ctx.chat.id)).langUsage);
    return setLang(ctx, arg);
  });

  bot.hears(menuLabels("settings"), showSettings);

  bot.callbackQuery(/^lang:set:(\w+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const lang = ctx.match[1]!;
    if (!ctx.chat || !isLang(lang) || store.getLang(ctx.chat.id) === lang) return;
    const chat = ctx as ChatContext;
    store.setLang(chat.chat.id, lang);
    await showSettings(chat);
    await ctx.reply(t(lang).langSet, { reply_markup: mainKeyboard(lang) });
  });
}

import { createHash } from "node:crypto";
import { InlineKeyboard, type Bot } from "grammy";
import type { Store } from "../db/index.js";
import { t, type Lang } from "../i18n.js";
import { menuLabels } from "../menu.js";
import { showScreen, type ChatContext } from "../screen.js";
import { askForKeyword } from "./subscribe.js";

const DELETE_PREFIX = "sub:del:";

// В данные кнопки (до 64 байт) название не влезает (до 100 байт), а номер строки устаревает.
// Поэтому хэш названия: поиск идёт только среди подписок своего чата.
export const keywordHash = (keyword: string): string =>
  createHash("sha1").update(keyword).digest("hex").slice(0, 8);

export const findByHash = (subs: string[], hash: string): string | undefined =>
  subs.find((k) => keywordHash(k) === hash);

/** Экран подписок: по кнопке удаления на подписку и «Додати». Названия только на кнопках, не в тексте. */
export function buildSubscriptionsScreen(lang: Lang, subs: string[]): { text: string; keyboard: InlineKeyboard } {
  const m = t(lang);
  const keyboard = new InlineKeyboard();
  for (const k of subs) keyboard.text(m.deleteButton(k), `${DELETE_PREFIX}${keywordHash(k)}`).row();
  keyboard.text(m.addButton, "sub:add");
  return { text: subs.length === 0 ? m.subsEmpty : m.subsHeader, keyboard };
}

export function showSubscriptions(ctx: ChatContext, store: Store): Promise<void> {
  const { text, keyboard } = buildSubscriptionsScreen(store.getLang(ctx.chat.id), store.listSubscriptions(ctx.chat.id));
  return showScreen(ctx, text, keyboard);
}

export function registerSubscriptions(bot: Bot, store: Store): void {
  bot.hears(menuLabels("subscriptions"), (ctx) => showSubscriptions(ctx, store));

  bot.callbackQuery(/^sub:del:([0-9a-f]{8})$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const chatId = ctx.chat?.id;
    if (chatId === undefined) return;
    // Нет такой подписки у этого чата (уже удалена или данные чужие): просто перерисовываем экран.
    const keyword = findByHash(store.listSubscriptions(chatId), ctx.match[1]!);
    if (keyword !== undefined) store.removeSubscription(chatId, keyword);
    await showSubscriptions(ctx as ChatContext, store);
  });

  bot.callbackQuery("sub:add", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (ctx.chat) await askForKeyword(ctx as ChatContext, store);
  });
}

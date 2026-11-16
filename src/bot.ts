import { Bot } from "grammy";
import type { Store } from "./db/index.js";
import { registerHistory } from "./commands/history.js";
import { registerLang } from "./commands/lang.js";
import { registerList } from "./commands/list.js";
import { registerSchedule } from "./commands/schedule.js";
import { registerSubscriptions } from "./commands/subscriptions.js";
import { registerStart } from "./commands/start.js";
import { cancelAwaitingSubscribe, registerSubscribe } from "./commands/subscribe.js";
import { registerUnsubscribe } from "./commands/unsubscribe.js";
import { t } from "./i18n.js";
import { isMenuLabel } from "./menu.js";

export function createBot(token: string, store: Store): Bot {
  const bot = new Bot(token);

  // Бот работает только в личных чатах; пользователь создаётся при первом сообщении.
  bot.use(async (ctx, next) => {
    if (ctx.chat?.type !== "private") return;
    store.ensureUser(ctx.chat.id);
    // Команда или кнопка меню отменяет ожидание названия улицы.
    const text = ctx.message?.text;
    if (text && (text.startsWith("/") || isMenuLabel(text))) cancelAwaitingSubscribe(ctx.chat.id);
    await next();
  });

  registerStart(bot, store);
  registerSubscribe(bot, store);
  registerSubscriptions(bot, store);
  registerUnsubscribe(bot, store);
  registerList(bot, store);
  registerSchedule(bot, store);
  registerHistory(bot, store);
  registerLang(bot, store);

  // Последним: любой текст, который не приняли ни команды, ни кнопки, ни ожидание названия.
  bot.on("message:text", (ctx) => ctx.reply(t(store.getLang(ctx.chat.id)).hint));

  bot.catch((err) => console.error("bot error:", err.error));
  return bot;
}

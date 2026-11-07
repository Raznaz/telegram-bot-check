import type { Bot } from "grammy";
import type { Store } from "../db/index.js";
import { t } from "../i18n.js";
import { formatOutage, matchesKeyword } from "../notify.js";
import { fetchOutages } from "../parser/voda-uz.js";

const ACTIVE_WINDOW_MS = 3 * 24 * 60 * 60_000;
const MAX_ITEMS = 5;

/** Актуальные (не восстановленные, свежие) отключения; по подпискам, если они есть, иначе все. */
export function registerSchedule(bot: Bot, store: Store): void {
  bot.command("schedule", async (ctx) => {
    const m = t(store.getLang(ctx.chat.id));
    let outages;
    try {
      outages = await fetchOutages();
    } catch (err) {
      console.error("schedule fetch failed:", err);
      return ctx.reply(m.loadError);
    }

    const subs = store.listSubscriptions(ctx.chat.id);
    const items = outages
      .filter((o) => o.status === "active" && Date.now() - o.publishedAt.getTime() < ACTIVE_WINDOW_MS)
      .filter((o) => subs.length === 0 || subs.some((k) => matchesKeyword(o, k)))
      .slice(0, MAX_ITEMS);

    if (items.length === 0) return ctx.reply(m.scheduleNone);
    await ctx.reply(m.scheduleHeader);
    for (const o of items) {
      await ctx.reply(formatOutage(store.getLang(ctx.chat.id), o), {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
    }
  });
}

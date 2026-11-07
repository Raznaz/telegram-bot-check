import type { Bot } from "grammy";
import type { Store } from "./db/index.js";
import { notifyOutage } from "./notify.js";
import { fetchOutages } from "./parser/voda-uz.js";

const MAX_DELAY_MS = 4 * 60 * 60_000;

async function pollOnce(bot: Bot, store: Store): Promise<void> {
  const outages = await fetchOutages(true);

  // Первый запуск: запоминаем текущую ленту без рассылки, чтобы не заспамить старыми новостями.
  const seeding = store.seenCount() === 0;

  // От старых к новым.
  for (const o of [...outages].sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime())) {
    if (store.getSeenStatus(o.id) === o.status) continue;
    // Сначала отметка, потом рассылка: лучше потерять уведомление, чем слать дубли при перезапусках.
    const wasSeen = store.getSeenStatus(o.id) !== undefined;
    store.markSeen(o.id, o.status);
    if (!seeding || wasSeen) await notifyOutage(bot, store, o);
  }
}

/** Периодический опрос; при ошибках сайта интервал растёт экспоненциально (до 4 ч). */
export function startScheduler(bot: Bot, store: Store, intervalMin: number): () => void {
  const base = intervalMin * 60_000;
  let failures = 0;
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;

  const tick = async () => {
    try {
      await pollOnce(bot, store);
      failures = 0;
    } catch (err) {
      failures++;
      console.error("poll failed:", err);
    }
    if (!stopped) timer = setTimeout(tick, Math.min(base * 2 ** failures, MAX_DELAY_MS));
  };
  void tick();

  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

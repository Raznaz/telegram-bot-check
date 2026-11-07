import * as cheerio from "cheerio";
import type { Outage } from "./types.js";

// voda.uz.ua — WordPress, поэтому берём новости через штатный REST API, а не скрейпим HTML.
const API_BASE = "https://voda.uz.ua/index.php?rest_route=/wp/v2/posts";
const API_FIELDS = "id,link,date_gmt,title,content";
const API_URL = `${API_BASE}&per_page=20&_fields=${API_FIELDS}`;
const USER_AGENT = "VodaUzBot/0.1 (Telegram notifier; polling every >=15 min)";
const CACHE_TTL_MS = 5 * 60_000;

// Заголовок новости говорит об отключении/ограничении воды.
const OUTAGE_TITLE = /водопостачан|водопровід|без води|призупинен|відключ|обмеження|тиск/i;
const NOT_OUTAGE_TITLE = /боржник/i; // «Відключення боржників» — не аварія
const RESTORED_TITLE = /\((відновлено|виконано|завершено)\)/i;

interface WpPost {
  id: number;
  link: string;
  date_gmt: string; // UTC без суффикса «Z»
  title: { rendered: string };
  content: { rendered: string };
}

const toText = (html: string) => cheerio.load(html, null, false).text().replace(/\s+/g, " ").trim();

/** Посты сайта → отключения воды (общий разбор для ленты и для истории). */
function toOutages(posts: WpPost[]): Outage[] {
  return posts
    .map((p): Outage => {
      const title = toText(p.title.rendered);
      return {
        id: String(p.id),
        url: p.link,
        title,
        publishedAt: new Date(`${p.date_gmt}Z`),
        status: RESTORED_TITLE.test(title) ? "restored" : "active",
        body: toText(p.content.rendered),
      };
    })
    .filter((o) => OUTAGE_TITLE.test(o.title) && !NOT_OUTAGE_TITLE.test(o.title));
}

async function fetchPage(url: string): Promise<{ posts: WpPost[]; totalPages: number }> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`voda.uz.ua responded ${res.status}`);
  return {
    posts: (await res.json()) as WpPost[],
    totalPages: Number(res.headers.get("x-wp-totalpages")) || 1,
  };
}

let cache: { at: number; data: Outage[] } | undefined;

/** Свежие отключения воды. Результат кэшируется на 5 мин, чтобы команды пользователей не долбили сайт. */
export async function fetchOutages(force = false): Promise<Outage[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

  const data = toOutages((await fetchPage(API_URL)).posts);
  cache = { at: Date.now(), data };
  return data;
}

// --- История: окно 90 дней одним запросом, периоды 7 и 30 дней вырезаются из него. ---

export const HISTORY_PERIODS = [7, 30, 90] as const;
export type HistoryPeriod = (typeof HISTORY_PERIODS)[number];
export const isHistoryPeriod = (n: number): n is HistoryPeriod =>
  (HISTORY_PERIODS as readonly number[]).includes(n);

const DAY_MS = 24 * 60 * 60_000;
const HISTORY_WINDOW_DAYS = Math.max(...HISTORY_PERIODS);
const HISTORY_MAX_PAGES = 5;

async function loadHistoryWindow(): Promise<Outage[]> {
  // `after` сайт сравнивает с локальным временем поста (оно сдвинуто относительно UTC), поэтому
  // берём с запасом в сутки, а точную границу ставим ниже по date_gmt.
  const after = new Date(Date.now() - (HISTORY_WINDOW_DAYS + 1) * DAY_MS).toISOString().slice(0, 19);
  const posts: WpPost[] = [];
  let totalPages = 1;
  for (let page = 1; page <= Math.min(totalPages, HISTORY_MAX_PAGES); page++) {
    const url = `${API_BASE}&per_page=100&page=${page}&after=${after}&_fields=${API_FIELDS}`;
    const res = await fetchPage(url);
    posts.push(...res.posts);
    totalPages = res.totalPages;
  }
  if (totalPages > HISTORY_MAX_PAGES) {
    console.warn(`history: loaded ${HISTORY_MAX_PAGES} of ${totalPages} pages, older posts skipped`);
  }
  return toOutages(posts).sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

let historyCache: { at: number; window: Promise<Outage[]> } | undefined;

/**
 * Отключения за последние `days` дней (7, 30 или 90), от новых к старым. Окно в 90 дней кэшируется
 * на 5 мин вместе с идущим запросом: одновременные вызовы делят один запрос, а ошибка не кэшируется.
 */
export async function fetchOutagesSince(days: number): Promise<Outage[]> {
  if (!isHistoryPeriod(days)) throw new Error(`unsupported history period: ${days}`);

  let entry = historyCache;
  if (!entry || Date.now() - entry.at >= CACHE_TTL_MS) {
    const created = { at: Date.now(), window: loadHistoryWindow() };
    created.window.catch(() => {
      if (historyCache === created) historyCache = undefined;
    });
    historyCache = entry = created;
  }

  const cutoff = Date.now() - days * DAY_MS;
  return (await entry.window).filter((o) => o.publishedAt.getTime() >= cutoff);
}

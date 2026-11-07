import * as cheerio from "cheerio";
import type { Outage } from "./types.js";

// voda.uz.ua — WordPress, поэтому берём новости через штатный REST API, а не скрейпим HTML.
const API_URL =
  "https://voda.uz.ua/index.php?rest_route=/wp/v2/posts&per_page=20&_fields=id,link,date,title,content";
const USER_AGENT = "VodaUzBot/0.1 (Telegram notifier; polling every >=15 min)";
const CACHE_TTL_MS = 5 * 60_000;

// Заголовок новости говорит об отключении/ограничении воды.
const OUTAGE_TITLE = /водопостачан|водопровід|без води|призупинен|відключ|обмеження|тиск/i;
const NOT_OUTAGE_TITLE = /боржник/i; // «Відключення боржників» — не аварія
const RESTORED_TITLE = /\((відновлено|виконано)\)/i;

interface WpPost {
  id: number;
  link: string;
  date: string; // локальное время сайта без таймзони
  title: { rendered: string };
  content: { rendered: string };
}

const toText = (html: string) => cheerio.load(html, null, false).text().replace(/\s+/g, " ").trim();

let cache: { at: number; data: Outage[] } | undefined;

/** Свежие отключения воды. Результат кэшируется на 5 мин, чтобы команды пользователей не долбили сайт. */
export async function fetchOutages(force = false): Promise<Outage[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

  const res = await fetch(API_URL, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`voda.uz.ua responded ${res.status}`);
  const posts = (await res.json()) as WpPost[];

  const data = posts
    .map((p): Outage => {
      const title = toText(p.title.rendered);
      return {
        id: String(p.id),
        url: p.link,
        title,
        publishedAt: new Date(p.date),
        status: RESTORED_TITLE.test(title) ? "restored" : "active",
        body: toText(p.content.rendered),
      };
    })
    .filter((o) => OUTAGE_TITLE.test(o.title) && !NOT_OUTAGE_TITLE.test(o.title));

  cache = { at: Date.now(), data };
  return data;
}

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DEFAULT_LANG, type Lang } from "../i18n.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  chat_id INTEGER PRIMARY KEY,
  lang TEXT NOT NULL DEFAULT 'uk' CHECK (lang IN ('uk', 'ru'))
);
CREATE TABLE IF NOT EXISTS subscriptions (
  chat_id INTEGER NOT NULL REFERENCES users(chat_id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  PRIMARY KEY (chat_id, keyword)
);
CREATE TABLE IF NOT EXISTS seen_outages (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export const MAX_SUBSCRIPTIONS = 10;

export interface Subscriber {
  chatId: number;
  lang: Lang;
  keyword: string;
}

export class Store {
  private constructor(private db: DatabaseSync) {}

  static open(path: string): Store {
    mkdirSync(dirname(path), { recursive: true });
    const db = new DatabaseSync(path);
    db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    db.exec(SCHEMA);
    const store = new Store(db);
    // Миграция: базы, созданные до появления флага, но уже с историей, считаются засеянными.
    if (!store.isSeeded() && store.seenCount() > 0) store.markSeeded();
    return store;
  }

  /** Был ли завершён первый опрос (засев ленты без рассылки). */
  isSeeded(): boolean {
    return this.db.prepare("SELECT 1 FROM meta WHERE key = 'seeded'").get() !== undefined;
  }

  markSeeded(): void {
    this.db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('seeded', '1')").run();
  }

  ensureUser(chatId: number): void {
    this.db.prepare("INSERT OR IGNORE INTO users (chat_id, lang) VALUES (?, ?)").run(chatId, DEFAULT_LANG);
  }

  deleteUser(chatId: number): void {
    this.db.prepare("DELETE FROM users WHERE chat_id = ?").run(chatId);
  }

  getLang(chatId: number): Lang {
    const row = this.db.prepare("SELECT lang FROM users WHERE chat_id = ?").get(chatId) as
      | { lang: Lang }
      | undefined;
    return row?.lang ?? DEFAULT_LANG;
  }

  setLang(chatId: number, lang: Lang): void {
    this.db.prepare("UPDATE users SET lang = ? WHERE chat_id = ?").run(lang, chatId);
  }

  /** false — лимит подписок исчерпан. Повторная подписка идемпотентна. */
  addSubscription(chatId: number, keyword: string): boolean {
    const has = this.db
      .prepare("SELECT 1 FROM subscriptions WHERE chat_id = ? AND keyword = ?")
      .get(chatId, keyword);
    if (has) return true;
    if (this.listSubscriptions(chatId).length >= MAX_SUBSCRIPTIONS) return false;
    this.db.prepare("INSERT INTO subscriptions (chat_id, keyword) VALUES (?, ?)").run(chatId, keyword);
    return true;
  }

  removeSubscription(chatId: number, keyword: string): boolean {
    const r = this.db
      .prepare("DELETE FROM subscriptions WHERE chat_id = ? AND keyword = ?")
      .run(chatId, keyword);
    return Number(r.changes) > 0;
  }

  listSubscriptions(chatId: number): string[] {
    const rows = this.db
      .prepare("SELECT keyword FROM subscriptions WHERE chat_id = ? ORDER BY keyword")
      .all(chatId) as { keyword: string }[];
    return rows.map((r) => r.keyword);
  }

  allSubscribers(): Subscriber[] {
    const rows = this.db
      .prepare(
        "SELECT s.chat_id AS chatId, u.lang AS lang, s.keyword AS keyword FROM subscriptions s JOIN users u USING (chat_id)",
      )
      .all() as unknown as Subscriber[];
    return rows;
  }

  seenCount(): number {
    return (this.db.prepare("SELECT COUNT(*) AS n FROM seen_outages").get() as { n: number }).n;
  }

  getSeenStatus(id: string): string | undefined {
    const row = this.db.prepare("SELECT status FROM seen_outages WHERE id = ?").get(id) as
      | { status: string }
      | undefined;
    return row?.status;
  }

  markSeen(id: string, status: string): void {
    this.db
      .prepare("INSERT INTO seen_outages (id, status) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET status = excluded.status")
      .run(id, status);
  }
}

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm run dev      # tsx watch, reads .env (needs BOT_TOKEN)
npm run build    # tsc -> dist/ (only src/ is compiled)
npm start        # node dist/index.js
npm run check    # no-Telegram smoke test: scripts/check.ts
```

- There is no linter and no test framework. `npm run check` is the only automated proof: it hits the **live** voda.uz.ua API, so its result depends on the current feed (it needs at least one outage), and it runs the `Store` against a temp SQLite file. It is a single script — no way to run one case in isolation; edit `scripts/check.ts` instead.
- Typecheck only: `npx tsc --noEmit`. `scripts/` is outside `tsconfig` `include`, so tsc does not check it.
- Requires Node >= 24: the DB uses built-in `node:sqlite` (prints an `ExperimentalWarning`, expected). Config comes from `.env` (see `.env.example`): `BOT_TOKEN`, `DB_PATH`, `POLL_INTERVAL_MIN` (validated in `src/config.ts`, must be >= 15).
- Run only one bot instance per token (long polling + one SQLite file).

## Architecture

Telegram bot (grammY, ESM, strict TS) that notifies users about water outages in Uzhhorod from https://voda.uz.ua/. User-facing text is Ukrainian by default, Russian via `/lang ru` (`src/i18n.ts`; every new message needs both `uk` and `ru` entries).

Data flow, which spans several files:

1. `src/parser/voda-uz.ts` — the site is WordPress, so it uses the REST API (`/wp/v2/posts`), **not HTML scraping**. Posts are treated as outages by a regex on the *title*; a `(відновлено|виконано|завершено)` suffix in the title means `status: "restored"`. `fetchOutages()` has a 5-minute in-memory cache (`force=true` bypasses it; only the scheduler does that) so user commands don't hit the site. Dates are taken from `date_gmt`.
2. `src/scheduler.ts` — polls every `POLL_INTERVAL_MIN`, with exponential backoff on failure (cap 4h). It diffs against `seen_outages` (id -> status); a new id or a status change is an event. First run only seeds (flag in DB via `isSeeded`/`markSeeded`) and sends nothing. `markSeen` is done *before* sending on purpose (prefer a lost notification over duplicates after restarts).
3. `src/notify.ts` — matches an event to subscribers by case-insensitive **substring** of the keyword in title+body (users subscribe by street/district stem, e.g. "мартин", because the site text inflects names). A 403 from Telegram deletes that user (cascades to subscriptions).
4. `src/db/index.ts` — `Store` wraps `node:sqlite`; schema is an inline SQL string (no migrations — changing it needs an explicit migration for existing DB files). Tables: `users(lang)`, `subscriptions(chat_id, keyword)`, `seen_outages`, plus the seeded flag.
5. `src/bot.ts` + `src/commands/*` — one `registerX(bot, store)` per command. A middleware in `bot.ts` ignores non-private chats and auto-creates the user, so handlers can rely on `store.getLang(ctx.chat.id)`. `/schedule` reuses `fetchOutages`/`formatOutage`/`matchesKeyword`.

`src/index.ts` wires config -> Store -> bot -> scheduler and handles SIGINT/SIGTERM.

## Notes

- Messages are sent with `parse_mode: "HTML"`; anything from the site must go through `escapeHtml` (`src/notify.ts`).
- The sidebar block "Заплановані на сьогодні технічні роботи" on the site is intentionally not parsed (fragile markup; outages are also published as news).
- Imports use `.js` extensions (NodeNext).

# TelegramBot — відключення води (voda.uz.ua)

Бот на TypeScript + grammY. Парсить новини КП «Водоканал м. Ужгород» (https://voda.uz.ua/)
і сповіщає підписників, коли з'являється відключення по їхній вулиці/району.

> Стан: реалізовано (v1). Дані беруться через WordPress REST API сайту (`/wp/v2/posts`), а не скрейпінгом HTML.
> Потрібен Node >= 24 (використовується вбудований `node:sqlite`, він друкує ExperimentalWarning).

## Запуск (після узгодження)
```
cp .env.example .env   # вписати BOT_TOKEN
npm install
npm run dev
```

## Команди бота
`/start`, `/subscribe <вулиця>`, `/unsubscribe <вулиця>`, `/list`, `/schedule`, `/lang uk|ru`

Мова за замовчуванням — українська; російську можна обрати командою `/lang ru`.
Опит сайту — раз на 30 хв (`POLL_INTERVAL_MIN`).

## Структура
- `src/parser/` — парсинг voda.uz.ua → `Outage[]`
- `src/db/` — SQLite (`node:sqlite`)
- `src/scheduler.ts` — періодичний опит і diff
- `src/notify.ts` — матч підписок і відправка
- `src/commands/` — команди grammY

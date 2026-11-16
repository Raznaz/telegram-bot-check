// Проверка без Telegram: парсер на живом сайте + база + сопоставление подписок + форматирование.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store, MAX_SUBSCRIPTIONS } from "../src/db/index.js";
import { formatOutage, matchesKeyword } from "../src/notify.js";
import { formatHistoryEntry, formatKyivDay, splitMessages } from "../src/commands/history.js";
import { buildSettingsScreen } from "../src/commands/lang.js";
import { buildSubscriptionsScreen, findByHash, keywordHash } from "../src/commands/subscriptions.js";
import { LANGS } from "../src/i18n.js";
import { commandList, isMenuLabel, menuAction, menuLabels, type MenuAction } from "../src/menu.js";
import type { Outage } from "../src/parser/types.js";
import { fetchOutages, fetchOutagesSince } from "../src/parser/voda-uz.js";

const outages = await fetchOutages(true);
console.log(`Знайдено відключень: ${outages.length}`);
for (const o of outages) console.log(` [${o.status}] ${o.publishedAt.toISOString().slice(0, 10)} ${o.title.slice(0, 80)}`);
assert.ok(outages.length > 0, "парсер не нашёл ни одного отключения");
assert.ok(outages.every((o) => o.id && o.url.startsWith("http") && o.title && o.body), "неполные поля Outage");
assert.ok(outages.every((o) => !/боржник/i.test(o.title)), "боржники не должны попадать в ленту");

assert.ok(
  outages.every((o) => !/\((відновлено|виконано|завершено)\)/i.test(o.title) || o.status === "restored"),
  "завершённое отключение не должно иметь статус active",
);

assert.ok(
  outages.every((o) => Number.isFinite(o.publishedAt.getTime()) && o.publishedAt.getTime() <= Date.now() + 60_000),
  "дата публикации некорректна или в будущем",
);

// История: периоды вложены друг в друга, записи в окне и идут от новых к старым.
const DAY = 24 * 60 * 60_000;
const [h7, h30, h90] = await Promise.all([7, 30, 90].map((d) => fetchOutagesSince(d)));
const ids = (list: { id: string }[]) => new Set(list.map((o) => o.id));
for (const [days, list] of [[7, h7!], [30, h30!], [90, h90!]] as const) {
  const cutoff = Date.now() - days * DAY;
  assert.ok(list.every((o) => o.publishedAt.getTime() >= cutoff), `история ${days} дн.: запись старше окна`);
  assert.ok(
    list.every((o, i) => i === 0 || list[i - 1]!.publishedAt >= o.publishedAt),
    `история ${days} дн.: не от новых к старым`,
  );
}
assert.ok([...ids(h7!)].every((id) => ids(h30!).has(id)), "7 дней должны входить в 30");
assert.ok([...ids(h30!)].every((id) => ids(h90!).has(id)), "30 дней должны входить в 90");
assert.ok(
  outages.filter((o) => o.publishedAt.getTime() >= Date.now() - 90 * DAY).every((o) => ids(h90!).has(o.id)),
  "свежая лента содержит отключение, которого нет в истории за 90 дней",
);
await assert.rejects(() => fetchOutagesSince(45), /unsupported history period/, "период вне 7/30/90 должен отвергаться");
console.log(`История: 7д=${h7!.length}, 30д=${h30!.length}, 90д=${h90!.length}`);

// Форматирование истории на синтетических данных (без сети).
const now = Date.parse("2026-11-07T12:00:00Z");
const mk = (id: string, iso: string, status: Outage["status"]): Outage => ({
  id,
  url: `https://voda.uz.ua/?p=${id}`,
  title: "Тимчасове <призупинення> & тест",
  publishedAt: new Date(iso),
  status,
  body: "",
});
assert.ok(formatHistoryEntry(mk("1", "2026-11-06T10:00:00Z", "restored"), now).includes("✅"), "значок у свежей restored");
assert.ok(formatHistoryEntry(mk("2", "2026-11-06T10:00:00Z", "active"), now).includes("🚰"), "значок у свежей active");
assert.ok(!/[🚰✅]/u.test(formatHistoryEntry(mk("3", "2026-10-20T10:00:00Z", "active"), now)), "у старой записи значка нет");
assert.ok(formatHistoryEntry(mk("4", "2026-11-06T10:00:00Z", "active"), now).includes("&lt;призупинення&gt; &amp; тест"), "заголовок экранируется");
assert.equal(formatKyivDay(new Date("2026-11-06T21:30:00Z")), "06.11", "23:30 по Киеву — ещё 06.11");
assert.equal(formatKyivDay(new Date("2026-11-06T22:30:00Z")), "07.11", "00:30 по Киеву — уже 07.11");

const entries = Array.from({ length: 50 }, (_, i) => `entry ${i} ${"x".repeat(200)}`);
const parts = splitMessages("HEADER", entries, 1000);
assert.ok(parts.length > 1, "длинный список делится на несколько сообщений");
assert.ok(parts.every((p) => p.length <= 1000), "сообщение не длиннее лимита");
assert.deepEqual(parts.join("\n").split("\n"), ["HEADER", ...entries], "записи не теряются, не дублируются, порядок сохранён");
assert.deepEqual(splitMessages("H", [], 1000), ["H"], "без записей остаётся один заголовок");

// Меню: подписи уникальны, распознаются на обоих языках, список команд содержит history.
const actions: MenuAction[] = ["history", "schedule", "subscriptions", "settings"];
const labels = actions.flatMap((a) => menuLabels(a));
assert.equal(new Set(labels).size, labels.length, "подписи кнопок не уникальны между действиями и языками");
for (const a of actions) for (const l of menuLabels(a)) assert.equal(menuAction(l), a, `подпись «${l}» не распознана`);
assert.equal(menuAction("Мартина"), undefined, "обычный текст не должен быть кнопкой");
assert.ok(!isMenuLabel("/history") && isMenuLabel(menuLabels("history")[0]!));
for (const lang of LANGS) assert.ok(commandList(lang).some((c) => c.command === "history"), `нет history в меню (${lang})`);

// Экран подписок: данные кнопки <= 64 байт, поиск по хэшу только среди своих подписок.
const longKw = "я".repeat(50);
const subsScreen = buildSubscriptionsScreen("uk", ["мартина", longKw]);
const buttons = subsScreen.keyboard.inline_keyboard.flat();
assert.equal(buttons.length, 3, "две подписки и «Додати»");
for (const b of buttons) {
  assert.ok("callback_data" in b && Buffer.byteLength(b.callback_data) <= 64, "данные кнопки длиннее 64 байт");
}
const hash = keywordHash(longKw);
assert.equal(findByHash(["мартина", longKw], hash), longKw, "поиск по хэшу находит подписку");
assert.equal(findByHash(["мартина"], hash), undefined, "удалённая или чужая подписка не находится");
assert.equal(findByHash([], hash), undefined);
const emptyScreen = buildSubscriptionsScreen("ru", []);
assert.equal(emptyScreen.keyboard.inline_keyboard.flat().length, 1, "пустой экран: только «Добавить»");
assert.notEqual(emptyScreen.text, buildSubscriptionsScreen("ru", ["мартина"]).text, "у пустого экрана свой текст");

// Экран настроек: отметка только у текущего языка.
for (const cur of LANGS) {
  const row = buildSettingsScreen(cur).keyboard.inline_keyboard.flat();
  assert.deepEqual(
    row.filter((b) => b.text.startsWith("✅")).map((b) => ("callback_data" in b ? b.callback_data : "")),
    [`lang:set:${cur}`],
    `отметка языка ${cur}`,
  );
}

const sample = outages[0]!;
const word = sample.title.split(" ").find((w) => w.length > 6)!.toLowerCase();
assert.ok(matchesKeyword(sample, word), "ключевое слово из заголовка должно совпадать");
assert.ok(!matchesKeyword(sample, "zzzнеіснуюче"), "левое слово не должно совпадать");

const html = formatOutage("uk", sample);
assert.ok(html.includes("<b>") && html.includes(sample.url), "форматирование без заголовка/ссылки");

const dir = mkdtempSync(join(tmpdir(), "voda-check-"));
try {
  const s = Store.open(join(dir, "t.db"));
  s.ensureUser(1);
  assert.equal(s.getLang(1), "uk");
  s.setLang(1, "ru");
  assert.equal(s.getLang(1), "ru");
  assert.ok(s.addSubscription(1, "мартина") && s.addSubscription(1, "мартина"), "подписка идемпотентна");
  assert.deepEqual(s.listSubscriptions(1), ["мартина"]);
  for (let i = 1; i < MAX_SUBSCRIPTIONS; i++) s.addSubscription(1, `ключ${i}`);
  assert.equal(s.addSubscription(1, "лишнее"), false, "лимит подписок");
  assert.ok(s.allSubscribers().some((x) => x.chatId === 1 && x.lang === "ru"));
  assert.ok(s.removeSubscription(1, "мартина") && !s.removeSubscription(1, "мартина"));
  assert.equal(s.seenCount(), 0);
  s.markSeen("1", "active");
  s.markSeen("1", "restored");
  assert.equal(s.getSeenStatus("1"), "restored");
  s.deleteUser(1);
  assert.equal(s.listSubscriptions(1).length, 0, "каскадное удаление подписок");

  // Флаг засева: пустая лента его не ставит, а база с историей считается засеянной.
  const fresh = Store.open(join(dir, "fresh.db"));
  assert.equal(fresh.isSeeded(), false, "новая база не засеяна");
  fresh.markSeeded();
  fresh.markSeeded();
  assert.equal(fresh.isSeeded(), true, "markSeeded идемпотентен");
  const legacy = Store.open(join(dir, "legacy.db"));
  legacy.markSeen("1", "active");
  assert.equal(Store.open(join(dir, "legacy.db")).isSeeded(), true, "миграция: база с историей засеяна");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log("OK");

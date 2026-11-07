// Проверка без Telegram: парсер на живом сайте + база + сопоставление подписок + форматирование.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store, MAX_SUBSCRIPTIONS } from "../src/db/index.js";
import { formatOutage, matchesKeyword } from "../src/notify.js";
import { fetchOutages } from "../src/parser/voda-uz.js";

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
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log("OK");

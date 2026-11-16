import { createBot } from "./bot.js";
import { loadConfig } from "./config.js";
import { Store } from "./db/index.js";
import { commandList } from "./menu.js";
import { startScheduler } from "./scheduler.js";

const config = loadConfig();
const store = Store.open(config.dbPath);
const bot = createBot(config.botToken, store);
const stopScheduler = startScheduler(bot, store, config.pollIntervalMin);

const shutdown = () => {
  stopScheduler();
  void bot.stop();
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

// Меню команд Telegram: украинский по умолчанию, русский для клиентов с русским интерфейсом.
try {
  await bot.api.setMyCommands(commandList("uk"));
  await bot.api.setMyCommands(commandList("ru"), { language_code: "ru" });
} catch (err) {
  console.error("setMyCommands failed:", err);
}

await bot.start({ onStart: (me) => console.log(`Bot @${me.username} started`) });

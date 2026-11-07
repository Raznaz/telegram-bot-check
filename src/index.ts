import { createBot } from "./bot.js";
import { loadConfig } from "./config.js";
import { Store } from "./db/index.js";
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

await bot.start({ onStart: (me) => console.log(`Bot @${me.username} started`) });

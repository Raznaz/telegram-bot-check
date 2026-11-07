export interface Config {
  botToken: string;
  dbPath: string;
  pollIntervalMin: number;
}

export function loadConfig(env = process.env): Config {
  const botToken = env.BOT_TOKEN?.trim();
  if (!botToken) throw new Error("BOT_TOKEN не задан (см. .env.example)");

  const pollIntervalMin = Number(env.POLL_INTERVAL_MIN ?? 30);
  if (!Number.isFinite(pollIntervalMin) || pollIntervalMin < 15) {
    throw new Error("POLL_INTERVAL_MIN должен быть числом >= 15");
  }

  return { botToken, dbPath: env.DB_PATH?.trim() || "./data/bot.db", pollIntervalMin };
}

export type Lang = "uk" | "ru";
export const DEFAULT_LANG: Lang = "uk";
export const isLang = (v: string): v is Lang => v === "uk" || v === "ru";

const dict = {
  uk: {
    start:
      "💧 Привіт! Я повідомляю про відключення води в Ужгороді (за даними voda.uz.ua).\n\n" +
      "/subscribe <вулиця> — стежити за вулицею чи районом (достатньо кореня слова, напр. «Мартин»)\n" +
      "/unsubscribe <вулиця> — відписатись\n/list — мої підписки\n/schedule — актуальні відключення\n/lang uk|ru — мова",
    askSubscribe: "Напишіть назву вулиці чи району (достатньо кореня слова, напр. «Мартин»).",
    usageUnsubscribe: "Вкажіть, від чого відписатись: /unsubscribe Мартина",
    badKeyword: "Назва має бути від 3 до 50 символів.",
    tooMany: "Забагато підписок (максимум 10). Видаліть зайві через /unsubscribe.",
    subscribed: (k: string) => `✅ Стежу за «${k}».`,
    unsubscribed: (k: string) => `🗑 Підписку «${k}» видалено.`,
    notFound: (k: string) => `Підписки «${k}» немає.`,
    listEmpty: "Підписок немає. Додайте: /subscribe Мартина",
    listHeader: "Ваші підписки:",
    scheduleNone: "Актуальних відключень немає 👍",
    scheduleHeader: "Актуальні відключення:",
    loadError: "Не вдалося отримати дані з voda.uz.ua, спробуйте пізніше.",
    langSet: "Мову змінено на українську.",
    langUsage: "Використання: /lang uk або /lang ru",
    restored: "✅ Відновлено",
    active: "🚰 Відключення",
    more: "Детальніше",
  },
  ru: {
    start:
      "💧 Привет! Я сообщаю об отключениях воды в Ужгороде (по данным voda.uz.ua).\n\n" +
      "/subscribe <улица> — следить за улицей или районом (достаточно корня слова, напр. «Мартин»)\n" +
      "/unsubscribe <улица> — отписаться\n/list — мои подписки\n/schedule — актуальные отключения\n/lang uk|ru — язык",
    askSubscribe: "Напишите название улицы или района (достаточно корня слова, напр. «Мартин»).",
    usageUnsubscribe: "Укажите, от чего отписаться: /unsubscribe Мартина",
    badKeyword: "Название должно быть от 3 до 50 символов.",
    tooMany: "Слишком много подписок (максимум 10). Удалите лишние через /unsubscribe.",
    subscribed: (k: string) => `✅ Слежу за «${k}».`,
    unsubscribed: (k: string) => `🗑 Подписка «${k}» удалена.`,
    notFound: (k: string) => `Подписки «${k}» нет.`,
    listEmpty: "Подписок нет. Добавьте: /subscribe Мартина",
    listHeader: "Ваши подписки:",
    scheduleNone: "Актуальных отключений нет 👍",
    scheduleHeader: "Актуальные отключения:",
    loadError: "Не удалось получить данные с voda.uz.ua, попробуйте позже.",
    langSet: "Язык изменён на русский.",
    langUsage: "Использование: /lang uk или /lang ru",
    restored: "✅ Восстановлено",
    active: "🚰 Отключение",
    more: "Подробнее",
  },
} as const;

export function t(lang: Lang) {
  return dict[lang];
}

import { Keyboard } from "grammy";
import { LANGS, t, type Lang } from "./i18n.js";

const LABEL_KEY = {
  history: "menuHistory",
  schedule: "menuSchedule",
  subscriptions: "menuSubscriptions",
  settings: "menuSettings",
} as const;

export type MenuAction = keyof typeof LABEL_KEY;
const ACTIONS = Object.keys(LABEL_KEY) as MenuAction[];

/** Подписи действия на всех языках: клавиатура могла остаться от прежнего языка пользователя. */
export const menuLabels = (action: MenuAction): string[] => LANGS.map((l) => t(l)[LABEL_KEY[action]]);

const actionByLabel = new Map(ACTIONS.flatMap((a) => menuLabels(a).map((label) => [label, a] as const)));

export const menuAction = (text: string): MenuAction | undefined => actionByLabel.get(text);
export const isMenuLabel = (text: string): boolean => actionByLabel.has(text);

/** Постоянная клавиатура главного меню: два ряда по две кнопки. */
export function mainKeyboard(lang: Lang): Keyboard {
  const m = t(lang);
  return new Keyboard()
    .text(m.menuHistory)
    .text(m.menuSchedule)
    .row()
    .text(m.menuSubscriptions)
    .text(m.menuSettings)
    .resized()
    .persistent();
}

/** Список команд для меню Telegram на языке `lang`. */
export const commandList = (lang: Lang) =>
  Object.entries(t(lang).commands).map(([command, description]) => ({ command, description }));

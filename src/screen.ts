import { GrammyError, type Context, type InlineKeyboard } from "grammy";

/** Контекст чата, где `chat` точно есть: команда, нажатие кнопки меню или inline-кнопки. */
export type ChatContext = Context & { chat: { id: number } };

/**
 * Выводит экран с inline-кнопками: на нажатие inline-кнопки правит то же сообщение,
 * иначе (команда или кнопка меню) шлёт новое.
 */
export async function showScreen(ctx: ChatContext, text: string, keyboard: InlineKeyboard): Promise<void> {
  if (!ctx.callbackQuery) {
    await ctx.reply(text, { reply_markup: keyboard });
    return;
  }
  try {
    await ctx.editMessageText(text, { reply_markup: keyboard });
  } catch (err) {
    const description = err instanceof GrammyError ? err.description : "";
    if (description.includes("message is not modified")) return; // то же содержимое: править нечего
    if (description.includes("message to edit not found")) {
      await ctx.reply(text, { reply_markup: keyboard }); // сообщение удалили: показываем новым
      return;
    }
    throw err;
  }
}

import { handleTelegramRequest } from "../lib/telegram-handler.js";

export default async function telegram(request, response) {
  return handleTelegramRequest(request, response);
}

const MAX_NAME_LENGTH = 80;

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

function cleanName(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function readJsonBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") return JSON.parse(request.body);

  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > 4096) throw new Error("Request too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function handleTelegramRequest(request, response, env = process.env) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Metode tidak diizinkan." });
  }

  const origin = request.headers.origin;
  const host = request.headers.host;
  if (!origin || !host) {
    return sendJson(response, 403, { error: "Permintaan tidak diizinkan." });
  }
  try {
    if (new URL(origin).host.toLowerCase() !== host.toLowerCase()) {
      return sendJson(response, 403, { error: "Permintaan tidak diizinkan." });
    }
  } catch {
    return sendJson(response, 403, { error: "Permintaan tidak diizinkan." });
  }

  if (Number(request.headers["content-length"] || 0) > 4096) {
    return sendJson(response, 413, { error: "Data formulir terlalu besar." });
  }

  let payload;
  try {
    payload = await readJsonBody(request);
  } catch {
    return sendJson(response, 400, { error: "Data formulir tidak valid." });
  }

  const firstName = cleanName(payload?.firstName);
  const lastName = cleanName(payload?.lastName);
  if (!firstName || !lastName || firstName.length > MAX_NAME_LENGTH || lastName.length > MAX_NAME_LENGTH) {
    return sendJson(response, 400, { error: "Isi nama depan dan nama belakang dengan benar." });
  }
  if (payload?.consent !== true) {
    return sendJson(response, 400, { error: "Persetujuan diperlukan sebelum data dikirim." });
  }

  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    return sendJson(response, 503, { error: "Pengiriman belum tersedia. Silakan coba lagi nanti." });
  }

  const text = [
    "Uji coba Live Tracking",
    `Nama depan: ${firstName}`,
    `Nama belakang: ${lastName}`,
    "Persetujuan pengiriman: diberikan",
  ].join("\n");

  try {
    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(8000),
    });
    const result = await telegramResponse.json();
    if (!telegramResponse.ok || !result.ok) {
      return sendJson(response, 502, { error: "Pesan belum berhasil dikirim. Silakan coba lagi." });
    }
  } catch {
    return sendJson(response, 502, { error: "Pesan belum berhasil dikirim. Silakan coba lagi." });
  }

  return sendJson(response, 200, { ok: true });
}

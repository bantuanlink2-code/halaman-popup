import { defineConfig, loadEnv } from "vite";
import { handleTelegramRequest } from "./lib/telegram-handler.js";

function telegramApiPlugin(env) {
  return {
    name: "telegram-api-dev-route",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        let pathname;
        try {
          pathname = new URL(request.url || "/", "http://localhost").pathname;
        } catch {
          return next();
        }

        if (pathname !== "/api/telegram") return next();
        handleTelegramRequest(request, response, env).catch(() => {
          if (!response.headersSent) {
            response.statusCode = 500;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(JSON.stringify({ error: "Terjadi kesalahan. Silakan coba lagi." }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  return { plugins: [telegramApiPlugin(env)] };
});

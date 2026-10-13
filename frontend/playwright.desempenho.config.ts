import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Medição de desempenho (npm run test:desempenho), local e fora do CI. Roda contra o build de produção
// servido pelo `vite preview` (o dev server do Vite serve módulo por módulo e não representa o bundle),
// com o backend local apontando para o SQL Server LOCAL (mesma trava de playwright.config.ts).
const backend = (Array.isArray(base.webServer) ? base.webServer : [])[1]!;

export default defineConfig({
  ...base,
  testMatch: "desempenho.spec.ts",
  testIgnore: [],
  use: { ...base.use, baseURL: "http://localhost:4173" },
  webServer: [
    {
      command: "npm run build && npx vite preview --port 4173 --strictPort",
      url: "http://localhost:4173",
      reuseExistingServer: false,
      timeout: 240_000,
    },
    // Nunca reaproveita um backend já de pé na porta 3000: ele poderia estar usando o .env (Azure).
    { ...backend, reuseExistingServer: false, env: { ...backend.env, FRONTEND_URL: "http://localhost:4173" } },
  ],
});

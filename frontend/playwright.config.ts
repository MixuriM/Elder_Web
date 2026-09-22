import { defineConfig } from "@playwright/test";

// SQL Server local do docker-compose.yml (mesma MSSQL_SA_PASSWORD usada pra subir o
// container — ver README/CLAUDE.md). Nunca aponta pro Azure de produção: e2e roda só
// contra banco local descartável.
const senhaLocal = process.env.MSSQL_SA_PASSWORD;
const databaseUrlLocal = senhaLocal
  ? `sqlserver://localhost:14330;database=elder_web;user=sa;password=${senhaLocal};encrypt=true;trustServerCertificate=true`
  : undefined;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "npm run dev",
      cwd: "../backend",
      // `port`, não `url`: nenhuma rota do backend responde 2xx em GET (só POST/PATCH
      // autenticados), e o check por `url` do Playwright exige 2xx-3xx pra considerar
      // "pronto" — com 404 ele tenta subir um processo novo e colide com o que já
      // está de pé (EADDRINUSE). `port` só confirma que algo está escutando ali.
      port: 3000,
      reuseExistingServer: true,
      timeout: 60_000,
      env: {
        ...(databaseUrlLocal ? { DATABASE_URL: databaseUrlLocal } : {}),
        FRONTEND_URL: "http://localhost:5173",
      },
    },
  ],
});

import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";

// e2e do item 3.3 (RF-001, RF-030 extensão): Familiar cadastra um Idoso (sem
// firebase_uid) -> Idoso se autocadastra no Firebase com o MESMO e-mail -> primeiro
// /auth/sync não anexa (e-mail ainda não confirmado) -> confirma o e-mail (simulado via
// Firebase Admin SDK, mesma cautela dos scripts backend/scripts/verify-*.ts: nunca toca
// produção) -> segundo /auth/sync anexa o firebase_uid à linha existente -> Idoso loga
// de novo -> só existe 1 Usuario com aquele e-mail, com firebase_uid preenchido.
//
// Mesmas cautelas de frontend/e2e/fluxo-completo.spec.ts: contra frontend + backend
// locais de verdade, sem mock de rede, SQL Server LOCAL (docker-compose.yml, nunca
// Azure), e-mails de teste com prefixo "e2e-" e domínio ".test" (IANA, nunca resolve).

// import.meta.dirname (Node 20.11+/21.2+): __dirname não existe em ESM.
const BACKEND_DIR = path.resolve(import.meta.dirname, "..", "..", "backend");
const SENHA_LOCAL = process.env.MSSQL_SA_PASSWORD;
const DATABASE_URL_LOCAL = SENHA_LOCAL
  ? `sqlserver://localhost:14330;database=elder_web;user=sa;password=${SENHA_LOCAL};encrypt=true;trustServerCertificate=true`
  : undefined;
const SENHA = "SenhaE2eTeste123!";

// shell: true é necessário no Windows (spawnSync direto de "npx.cmd" falha com EINVAL —
// limitação do Node com batch files). Os únicos argumentos são o nome do script (fixo,
// nesta função) e e-mails gerados aqui mesmo (timestamp + domínio fixo, sem
// metacaractere de shell), então não há entrada externa/não confiável chegando aqui.
function rodarScriptBackend(script: string, ...args: string[]) {
  return execFileSync("npx", ["tsx", `scripts/${script}`, ...args], {
    cwd: BACKEND_DIR,
    encoding: "utf-8",
    shell: true,
    env: {
      ...process.env,
      ...(DATABASE_URL_LOCAL ? { DATABASE_URL: DATABASE_URL_LOCAL } : {}),
    },
  });
}

test("idoso cadastrado por Familiar assume a própria conta ao confirmar o e-mail", async ({ page }) => {
  test.setTimeout(90_000);

  const agora = Date.now();
  const emailFamiliar = `e2e-familiar-${agora}@e2e.elderweb.test`;
  const emailIdoso = `e2e-idoso-${agora}@e2e.elderweb.test`;

  // --- FAMILIAR: cadastro + login ---
  await page.goto("/cadastro");
  await page.getByText("Familiar", { exact: true }).click();
  await page.getByLabel("Nome completo").fill("E2E Familiar Teste");
  await page.getByLabel("E-mail", { exact: true }).fill(emailFamiliar);
  await page.getByLabel("Senha", { exact: true }).fill(SENHA);
  await page.getByRole("button", { name: /criar minha conta/i }).click();
  await page.waitForURL(/\/welcome$/, { timeout: 20_000 });

  await page.getByRole("button", { name: /já tenho uma conta/i }).click();
  await page.waitForURL(/\/login$/);
  await page.getByLabel(/e-mail/i).fill(emailFamiliar);
  await page.getByLabel(/senha/i).fill(SENHA);
  await page.getByRole("button", { name: /^entrar$/i }).click();
  await page.waitForURL(/\/Home$/, { timeout: 20_000 });

  // --- FAMILIAR: cadastra o Idoso (POST /usuario/cadastrar-idoso) ---
  await page.goto("/vinculos");
  await page.getByLabel("Nome do idoso", { exact: true }).fill("E2E Idoso Teste");
  await page.getByLabel("E-mail do idoso (opcional se informar telefone)").fill(emailIdoso);
  await page.getByLabel(/declaro que sou responsável/i).check();
  await page.getByRole("button", { name: /^cadastrar idoso$/i }).click();
  await expect(page.getByText(/cadastrado \(id/i)).toBeVisible({ timeout: 20_000 });

  // --- IDOSO: autocadastro com o MESMO e-mail — ainda não confirmado, não anexa ---
  await page.goto("/cadastro");
  await page.getByLabel("Nome completo").fill("E2E Idoso Teste");
  await page.getByLabel("E-mail", { exact: true }).fill(emailIdoso);
  await page.getByLabel("Senha", { exact: true }).fill(SENHA);
  await page.getByRole("button", { name: /criar minha conta/i }).click();
  await expect(page.getByRole("alert")).toHaveText(/cadastrado por um familiar/i, { timeout: 20_000 });

  // --- Confirma o e-mail (simulado via Admin SDK — sem caixa de e-mail real em teste) ---
  rodarScriptBackend("e2e-marcar-email-verificado.ts", emailIdoso);

  // --- IDOSO: confirma na página dedicada — aqui o firebase_uid é anexado ---
  await page.goto("/confirmar-email");
  await page.getByRole("button", { name: /^confirmar$/i }).click();
  await expect(page.getByRole("status")).toHaveText(/confirmado com sucesso/i, { timeout: 20_000 });

  // --- IDOSO: loga de novo — agora pelo fluxo normal (firebase_uid já bate) ---
  await page.goto("/login");
  await page.getByLabel(/e-mail/i).fill(emailIdoso);
  await page.getByLabel(/senha/i).fill(SENHA);
  await page.getByRole("button", { name: /^entrar$/i }).click();
  await page.waitForURL(/\/Home$/, { timeout: 20_000 });

  // --- Só 1 Usuario com esse e-mail, firebase_uid preenchido (sem duplicar) ---
  const saida = rodarScriptBackend("e2e-verificar-usuario-unico.ts", emailIdoso);
  expect(saida).toMatch(/^OK:/);
});

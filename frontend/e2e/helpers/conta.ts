import { expect, type Browser, type BrowserContext } from "@playwright/test";

export const PERFIS = [
  { tipoPerfil: "idoso", radio: "Idoso" },
  { tipoPerfil: "cuidador", radio: "Cuidador" },
  { tipoPerfil: "familiar", radio: "Familiar" },
] as const;

export type Perfil = (typeof PERFIS)[number];

const SENHA = "SenhaE2eTeste123!";

// Trava de segurança: sem MSSQL_SA_PASSWORD o playwright.config.ts não define DATABASE_URL e o
// backend de teste cai no .env, que aponta para o Azure de produção. Nunca imprime o valor.
export function exigirBancoLocal() {
  if (!process.env.MSSQL_SA_PASSWORD) {
    throw new Error(
      "MSSQL_SA_PASSWORD não definida: o backend do e2e usaria o .env (Azure). " +
        "Defina a variável e suba o SQL Server local (docker-compose.yml, porta 14330).",
    );
  }
}

// Mesmo fluxo de fluxo-completo.spec.ts (cadastro e login pela UI), num BrowserContext que o
// chamador mantém aberto: a sessão do Firebase fica no navegador. Sem storageState em disco (tem token).
export type Conta = { context: BrowserContext; email: string };

export async function criarContaELogar(browser: Browser, { tipoPerfil, radio }: Perfil): Promise<Conta> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = `e2e-${tipoPerfil}-${Date.now()}@e2e.elderweb.test`;

  await page.goto("/cadastro");
  await page.getByText(radio, { exact: true }).click();
  await page.getByLabel("Nome completo").fill(`E2E Teste ${tipoPerfil}`);
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(SENHA);
  await page.getByLabel("Confirmação da senha", { exact: true }).fill(SENHA);
  await page.getByRole("button", { name: /criar minha conta/i }).click();
  await page.waitForURL(/\/welcome$/, { timeout: 20_000 });

  await page.getByRole("button", { name: /já tenho uma conta/i }).click();
  await page.waitForURL(/\/login$/);
  await page.getByLabel(/^e-mail$/i).fill(email);
  await page.getByLabel(/^senha$/i).fill(SENHA);
  await page.getByRole("button", { name: /^entrar$/i }).click();
  await page.waitForURL(/\/Home$/, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: /abrir perfil/i })).toBeVisible();

  await page.close();
  return { context, email };
}

// Vínculo aprovado pela UI, como um usuário faria: quem é cuidador ou familiar pede em "Adicionar pessoa"
// e o idoso (modo de decisão padrão, 'idoso') aprova o pedido na mesma tela.
export async function vincular(vinculado: Conta, tipo: "cuidador" | "familiar", idoso: Conta) {
  const rota = tipo === "cuidador" ? "/cuidadores" : "/familia";

  const pede = await vinculado.context.newPage();
  await pede.goto(rota);
  await pede.getByRole("button", { name: "Adicionar pessoa" }).click();
  // Familiar tem duas ações (pedir ou cadastrar idoso); cuidador abre direto no pedido.
  if (tipo === "familiar") await pede.getByRole("button", { name: "Pedir vínculo com um idoso" }).click();
  await pede.getByLabel("E-mail do idoso").fill(idoso.email);
  await pede.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(pede.getByRole("status").filter({ hasText: /pedido enviado/i })).toBeVisible({ timeout: 20_000 });
  await pede.close();

  const aprova = await idoso.context.newPage();
  await aprova.goto(rota);
  await aprova.getByRole("button", { name: /^aprovar o pedido de/i }).click();
  await expect(aprova.getByText(/aprovado\.$/)).toBeVisible({ timeout: 20_000 });
  await aprova.close();
}

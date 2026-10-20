import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { PERFIS, SENHA, criarContaELogar, exigirBancoLocal } from "./helpers/conta";

// e2e da exclusão de conta (item 9.5, LGPD art. 18): cria uma conta e2e-* (Firebase real + SQL Server LOCAL), exclui pela
// interface (Meu Perfil > Excluir minha conta), confirma o aviso, que o login passa a falhar e, no SQL local, que a linha
// ficou anonimizada. Exclui SÓ a conta de teste criada aqui: o spec recusa qualquer e-mail fora de e2e-*@e2e.elderweb.test.
// Nunca rodar contra conta real. Rodar: npx playwright test exclusao-conta

const BACKEND_DIR = path.resolve(import.meta.dirname, "..", "..", "backend");
const PADRAO_E2E = /^e2e-[a-z0-9-]+@e2e\.elderweb\.test$/;

// shell: true é necessário no Windows (ver idoso-assume-conta.spec.ts). Os argumentos são o nome do script (fixo), um id
// numérico e o e-mail gerado aqui (validado contra PADRAO_E2E), sem metacaractere de shell.
function rodarScriptBackend(...args: string[]) {
  const senha = process.env.MSSQL_SA_PASSWORD;
  return execFileSync("npx", ["tsx", "scripts/e2e-conta-excluida.ts", ...args], {
    cwd: BACKEND_DIR,
    encoding: "utf-8",
    shell: true,
    env: {
      ...process.env,
      DATABASE_URL: `sqlserver://localhost:14330;database=elder_web;user=sa;password=${senha};encrypt=true;trustServerCertificate=true`,
    },
  });
}

test("excluir a própria conta pelo Meu Perfil: aviso, login falha e a linha fica anonimizada", async ({ browser }) => {
  test.setTimeout(180_000);
  exigirBancoLocal();

  const idoso = PERFIS.find((p) => p.tipoPerfil === "idoso")!;
  const conta = await criarContaELogar(browser, idoso, "exclusao");
  try {
    // Trava de segurança: nunca excluir fora do padrão de conta de teste.
    expect(conta.email).toMatch(PADRAO_E2E);
    const id = /^ID (\d+)/.exec(rodarScriptBackend("antes", conta.email))?.[1];
    expect(id).toBeTruthy();

    const page = await conta.context.newPage();
    await page.goto("/perfil");
    await page.getByRole("button", { name: "Excluir minha conta" }).click();
    const dialogo = page.getByRole("dialog", { name: /excluir minha conta/i });
    await expect(dialogo).toBeVisible();
    const excluir = dialogo.getByRole("button", { name: "Excluir minha conta" });
    await expect(excluir).toBeDisabled();
    await dialogo.getByLabel(/digite excluir/i).fill("EXCLUIR");
    await dialogo.getByLabel(/sua senha/i).fill("senha-errada-ficticia");
    await excluir.click();
    // Senha errada: erro claro, a conta continua de pé e o diálogo aberto.
    await expect(dialogo.getByRole("alert")).toContainText(/senha incorreta/i, { timeout: 20_000 });

    await dialogo.getByLabel(/sua senha/i).fill(SENHA);
    await excluir.click();
    await page.waitForURL((u) => u.pathname === "/", { timeout: 60_000 });
    await expect(page.getByRole("status").filter({ hasText: "Conta excluída." })).toBeVisible();

    // O login com a conta excluída passa a falhar.
    await page.goto("/login");
    await page.getByLabel(/^e-mail$/i).fill(conta.email);
    await page.getByLabel(/^senha$/i).fill(SENHA);
    await page.getByRole("button", { name: /^entrar$/i }).click();
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/login$/);

    // No SQL local: linha anonimizada, e-mail original ausente.
    expect(rodarScriptBackend("depois", id!, conta.email)).toMatch(/^OK:/);
  } finally {
    await conta.context.close();
  }
});

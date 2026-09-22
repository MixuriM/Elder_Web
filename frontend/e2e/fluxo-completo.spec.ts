import { test, expect } from "@playwright/test";

// e2e do plano de desenvolvimento (Fase 1, "Fluxo completo cadastro→login→perfil→logout
// em navegador real"): contra frontend + backend locais de verdade, SEM mock de rede.
// Cria contas de teste REAIS no Firebase Auth (projeto real — não existe projeto de
// teste dedicado) e no SQL Server LOCAL (docker-compose.yml, nunca no Azure de produção
// — ver playwright.config.ts). E-mails com prefixo "e2e-" e domínio ".test" (reservado
// pela IANA, nunca resolve de verdade) pra deixar claro que são dados fake.
const PERFIS = [
  { tipoPerfil: "idoso", radio: null },
  { tipoPerfil: "cuidador", radio: "Cuidador" },
  { tipoPerfil: "familiar", radio: "Familiar" },
] as const;

const SENHA = "SenhaE2eTeste123!";

for (const { tipoPerfil, radio } of PERFIS) {
  test(`cadastro → login → perfil → logout (perfil: ${tipoPerfil})`, async ({ page }) => {
    const email = `e2e-${tipoPerfil}-${Date.now()}@e2e.elderweb.test`;
    const nome = `E2E Teste ${tipoPerfil}`;

    // --- CADASTRO ---
    await page.goto("/cadastro");

    if (radio) {
      // input é visualmente sr-only (UI custom de radio com ícone por cima) — clique
      // real do mouse esbarra no ícone; force é o padrão certo pra esse componente,
      // não workaround de bug.
      await page.getByRole("radio", { name: radio }).click({ force: true });
    }

    await page.getByLabel("Nome completo").fill(nome);
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(SENHA);
    await page.getByRole("button", { name: /criar minha conta/i }).click();

    await page.waitForURL(/\/welcome$/, { timeout: 20_000 });
    await expect(page.getByRole("alert")).toHaveText(/cadastro realizado com sucesso/i);

    // --- LOGIN (a partir do Welcome, "Já tenho uma conta") ---
    await page.getByRole("button", { name: /já tenho uma conta/i }).click();
    await page.waitForURL(/\/login$/);

    await page.getByLabel(/e-mail/i).fill(email);
    await page.getByLabel(/senha/i).fill(SENHA);
    await page.getByRole("button", { name: /^entrar$/i }).click();

    await page.waitForURL(/\/Home$/, { timeout: 20_000 });

    // --- PERFIL ---
    // O item "Meu Perfil" do menu lateral ainda só marca estado ativo, não navega
    // (Sidebar.tsx não chama navigate) — vai direto pela URL, como um usuário faria
    // digitando o endereço ou usando um favorito, até essa navegação ser ligada.
    await page.goto("/perfil");

    const campoNome = page.getByLabel(/nome/i);
    await expect(campoNome).toHaveValue(nome, { timeout: 20_000 });
    await expect(page.getByLabel(/^e-mail$/i)).toHaveValue(email);

    // --- LOGOUT ---
    await page.getByRole("button", { name: /voltar para a página inicial/i }).click();
    await page.waitForURL(/\/Home$/);
    await page.getByRole("button", { name: /sair/i }).click();

    await page.waitForURL(/\/login$/, { timeout: 20_000 });
  });
}

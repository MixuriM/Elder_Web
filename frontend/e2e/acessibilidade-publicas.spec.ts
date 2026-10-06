import { test, expect } from "@playwright/test";
import { auditarRota } from "./helpers/axe";

// Item 9.1 (RNF-007), camada Playwright: axe-core nas 7 rotas públicas. Sem login e sem conta
// nova. O estado de erro do login chama o Firebase real (credencial inexistente), sem backend.
// Rodar: npm run test:a11y
test.describe.configure({ timeout: 90_000 });

const ROTAS_PUBLICAS = ["/", "/sobre-nos", "/welcome", "/login", "/cadastro", "/esqueci-senha", "/confirmar-email"];

for (const rota of ROTAS_PUBLICAS) {
  test(`acessibilidade pública ${rota}`, async ({ context }) => {
    await auditarRota(context, rota);
  });
}

test("acessibilidade /cadastro com erro de perfil", async ({ context }) => {
  await auditarRota(context, "/cadastro", {
    rotulo: "/cadastro com erro",
    escuro: false,
    // Radios de perfil são required (o submit vazio só mostra a dica nativa do navegador, que não
    // está no DOM); o erro em role=alert vem do botão do Google sem perfil escolhido, sem rede.
    estado: async (page) => {
      await page.getByRole("button", { name: /google/i }).click();
      await expect(page.getByRole("alert").first()).toBeVisible();
    },
  });
});

// Perfil selecionado muda o estilo do card (TipoPerfil): audita cada um dos 3 radios, nas 3 variantes.
for (const radio of ["Idoso", "Cuidador", "Familiar"]) {
  test(`acessibilidade /cadastro com perfil ${radio} selecionado`, async ({ context }) => {
    await auditarRota(context, "/cadastro", {
      rotulo: `/cadastro perfil ${radio}`,
      estado: async (page) => {
        await page.getByText(radio, { exact: true }).click();
        await expect(page.getByRole("radio", { name: new RegExp(radio, "i") })).toBeChecked();
      },
    });
  });
}

test("acessibilidade /login com credencial inválida", async ({ context }) => {
  await auditarRota(context, "/login", {
    rotulo: "/login com erro",
    escuro: false,
    estado: async (page) => {
      await page.getByLabel(/^e-mail$/i).fill("e2e-a11y-inexistente@e2e.elderweb.test");
      await page.getByLabel(/^senha$/i).fill("SenhaIncorreta123!");
      await page.getByRole("button", { name: /^entrar$/i }).click();
      await expect(page.getByRole("alert").first()).toBeVisible({ timeout: 20_000 });
    },
  });
});

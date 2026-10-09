import { expect, test } from "@playwright/test";
import { auditarRota } from "./helpers/axe";
import { PERFIS, criarContaELogar, exigirBancoLocal, vincular, type Conta } from "./helpers/conta";

// Item 9.1 (RNF-007), camada Playwright: axe-core nas rotas protegidas, para os 3 perfis (as telas
// mudam conforme o perfil). Cria 3 contas reais por execução (Firebase real + SQL Server LOCAL), com
// e-mail e2e-<perfil>-<timestamp>@e2e.elderweb.test, sem limpeza automática.
// Cuidador e familiar são vinculados ao idoso pela UI antes da auditoria: sem vínculo aprovado, a guarda
// RotaComVinculo (decisão D1) leva as telas de dados para /familia ou /cuidadores.
// Contas novas não têm registro: as telas aparecem vazias (estados com dado ficam no jest-axe).
// Rodar: npm run test:a11y
const ROTAS_PROTEGIDAS = ["/Home", "/perfil", "/familia", "/cuidadores", "/saude", "/remedios", "/agenda", "/alimentacao", "/orientacoes"];

// Tabela D2: cuidador não tem Família no menu.
const rotasDo = (tipoPerfil: string) => ROTAS_PROTEGIDAS.filter((r) => !(tipoPerfil === "cuidador" && r === "/familia"));

// Um único test, com perfis e rotas em test.step: a falha de uma rota (expect.soft) não impede as demais,
// e cada conta é criada uma vez só (um test por rota reiniciaria o worker e criaria contas a mais).
test("acessibilidade autenticada (idoso, cuidador e familiar vinculados)", async ({ browser }) => {
  test.setTimeout(900_000);
  exigirBancoLocal();
  const contas: Record<string, Conta> = {};
  try {
    for (const perfil of PERFIS) contas[perfil.tipoPerfil] = await criarContaELogar(browser, perfil);
    await vincular(contas.cuidador, "cuidador", contas.idoso);
    await vincular(contas.familiar, "familiar", contas.idoso);

    for (const perfil of PERFIS) {
      for (const rota of rotasDo(perfil.tipoPerfil)) {
        await test.step(`${perfil.tipoPerfil} ${rota}`, async () => {
          await auditarRota(contas[perfil.tipoPerfil].context, rota, { rotulo: `${perfil.tipoPerfil} ${rota}` });
        });
      }
    }

    // Detalhe do vínculo (/vinculos/:id), aberto pelo cartão na lista do idoso.
    await test.step("idoso /vinculos/:id", async () => {
      const page = await contas.idoso.context.newPage();
      await page.goto("/cuidadores");
      const href = await page.locator('a[href^="/vinculos/"]').first().getAttribute("href");
      await page.close();
      expect(href).toMatch(/^\/vinculos\/\d+$/);
      await auditarRota(contas.idoso.context, href!, { rotulo: "idoso /vinculos/:id" });
    });
  } finally {
    for (const conta of Object.values(contas)) await conta.context.close();
  }
});

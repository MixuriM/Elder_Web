import { test } from "@playwright/test";
import { auditarRota } from "./helpers/axe";
import { PERFIS, criarContaELogar, exigirBancoLocal } from "./helpers/conta";

// Item 9.1 (RNF-007), camada Playwright: axe-core nas 9 rotas protegidas, para os 3 perfis (as telas
// mudam conforme o perfil). Cria no máximo 3 contas reais por execução (Firebase real + SQL Server
// LOCAL), com e-mail e2e-<perfil>-<timestamp>@e2e.elderweb.test, sem limpeza automática.
// Contas novas não têm dado: as telas aparecem vazias (estados com dado ficam no jest-axe).
// Rodar: npm run test:a11y
const ROTAS_PROTEGIDAS = ["/Home", "/perfil", "/familia", "/cuidadores", "/saude", "/remedios", "/agenda", "/alimentacao", "/orientacoes"];

// Um único test por perfil, com as rotas em test.step: a falha de uma rota (expect.soft) não impede
// as demais, e a conta do perfil é criada uma vez só (um test por rota reiniciaria o worker na primeira
// falha e criaria contas a mais no Firebase).
for (const perfil of PERFIS) {
  test(`acessibilidade autenticada (${perfil.tipoPerfil})`, async ({ browser }) => {
    test.setTimeout(600_000);
    exigirBancoLocal();
    const context = await criarContaELogar(browser, perfil);
    try {
      for (const rota of ROTAS_PROTEGIDAS) {
        await test.step(rota, async () => {
          await auditarRota(context, rota, { rotulo: `${perfil.tipoPerfil} ${rota}` });
        });
      }
    } finally {
      await context.close();
    }
  });
}

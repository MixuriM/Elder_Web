import AxeBuilder from "@axe-core/playwright";
import { expect, type BrowserContext, type Page } from "@playwright/test";

// Camada Playwright do item 9.1 (RNF-007): axe-core nas rotas completas, com contraste LIGADO
// (o jest-axe não calcula cor no jsdom). Falha só em `critical` e `serious`; `moderate`, `minor`
// e `incomplete` são impressos para o relatório. Nenhuma regra do axe é desligada aqui.
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };

type Violacao = Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"][number];

// Privacidade (RNF-001): só id da regra, impacto, seletor (`target`), contagem e helpUrl.
// Nunca `node.html` nem `failureSummary`, que podem carregar texto da página.
function resumir(v: Violacao) {
  const alvos = v.nodes.slice(0, 20).map((n) => {
    const alvo = n.target.flat().join(" ");
    // color-contrast: cores e razão calculadas pelo axe (não carregam texto da página).
    const d = v.id === "color-contrast" ? (n.any[0]?.data as Record<string, unknown> | undefined) : undefined;
    return d ? `${alvo} {${d.fgColor} em ${d.bgColor} = ${d.contrastRatio}, ${d.fontSize}}` : alvo;
  });
  return `${v.impact} ${v.id} x${v.nodes.length} alvos=[${alvos.join(" | ")}] ${v.helpUrl}`;
}

export async function aguardarTelaPronta(page: Page) {
  await expect(page.locator("h1").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText(/carregando/i)).toHaveCount(0);
  // Sem transições: o axe lê a cor calculada, e a meio de um `transition-colors` ela é intermediária
  // (falso positivo de contraste). Não desliga nenhuma regra, só congela o estado final.
  await page.addStyleTag({
    content: "*,*::before,*::after{transition:none!important;animation:none!important}",
  });
}

async function abrirPagina(
  context: BrowserContext,
  rota: string,
  viewport: { width: number; height: number },
  escuro: boolean,
) {
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  // O localStorage do contexto é compartilhado entre páginas: a variante clara precisa
  // limpar o tema, senão herda o `escuro` de uma variante anterior.
  await page.addInitScript((tema) => {
    try {
      if (tema) localStorage.setItem("tema", "escuro");
      else localStorage.removeItem("tema");
    } catch {
      // sem localStorage: segue sem tema salvo
    }
  }, escuro);
  await page.goto(rota);
  await aguardarTelaPronta(page);
  // Guarda contra redirecionamento silencioso (rota protegida sem sessão cai em /login).
  expect(new URL(page.url()).pathname.toLowerCase()).toBe(rota.toLowerCase());
  if (escuro) await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  return page;
}

async function auditar(page: Page, rotulo: string) {
  const { violations, incomplete } = await new AxeBuilder({ page }).withTags(TAGS).analyze();

  const graves = violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  for (const v of violations) {
    if (!graves.includes(v)) console.log(`[a11y] ${rotulo} (nao falha) ${resumir(v)}`);
  }
  for (const i of incomplete) {
    // id, seletor e o motivo do axe (messageKey: bgGradient, bgImage, bgOverlap...). Nunca html.
    const alvos = i.nodes.map((n) => {
      const motivo = (n.any[0]?.data as { messageKey?: string } | undefined)?.messageKey;
      return `${n.target.flat().join(" ")}${motivo ? ` {${motivo}}` : ""}`;
    });
    console.log(`[a11y] ${rotulo} incomplete ${i.id} x${i.nodes.length} alvos=[${alvos.join(" | ")}]`);
  }
  expect.soft(graves.map(resumir), `${rotulo}: violações critical/serious`).toEqual([]);
}

type Opcoes = {
  // Leva a tela a um estado extra (ex.: mensagem de erro) antes de auditar.
  estado?: (page: Page) => Promise<void>;
  rotulo?: string;
  // Falso desliga a variante escura.
  escuro?: boolean;
};

export async function auditarRota(context: BrowserContext, rota: string, opcoes: Opcoes = {}) {
  const nome = opcoes.rotulo ?? rota;

  for (const [variante, viewport] of [["desktop", DESKTOP], ["mobile", MOBILE]] as const) {
    const page = await abrirPagina(context, rota, viewport, false);
    try {
      await opcoes.estado?.(page);
      await auditar(page, `${nome} [${variante} claro]`);
      // Só a página desktop decide se a rota tem o BotaoTema (no mobile ele pode estar oculto).
      if (variante === "desktop" && opcoes.escuro !== false) {
        const temTema = (await page.getByRole("button", { name: /modo (claro|escuro)/i }).count()) > 0;
        if (!temTema) console.log(`[a11y] ${nome} sem tema escuro (sem BotaoTema)`);
        else {
          const escura = await abrirPagina(context, rota, DESKTOP, true);
          try {
            await opcoes.estado?.(escura);
            await auditar(escura, `${nome} [desktop escuro]`);
          } finally {
            await escura.close();
          }
        }
      }
    } finally {
      await page.close();
    }
  }
}

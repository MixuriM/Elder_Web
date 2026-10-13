import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { PERFIS, criarContaELogar, exigirBancoLocal, vincular, type Conta } from "./helpers/conta";

// Medição de desempenho (tarefa de 2026-10-13), local e fora do CI: npm run test:desempenho.
// Mesmas exigências do test:a11y (SQL Server local, MSSQL_SA_PASSWORD, Firebase real). Cria 3 contas
// e2e-<perfil>-perf-<timestamp>@e2e.elderweb.test pela UI, vincula cuidador e familiar ao idoso e popula o
// idoso com o volume D2 (backend/scripts/medir-desempenho.ts --popular-email), limpo no fim.
//
// Cada carga: aba nova, cache HTTP desligado, rede "Fast 3G" do DevTools e CPU 4x mais lenta (CDP), em
// Chromium. Mede LCP, CLS, tempo até o conteúdo útil (h1 visível e nenhum "Carregando" visível), bytes
// transferidos e requisições. 5 rodadas por tela, mediana. A cascata de chamadas à API da entrada
// autenticada (/Home) vai para o JSON. Só números e caminhos de rota: nenhum corpo, e-mail ou token.
// Saída: test-results/desempenho/<rótulo>.json (DESEMPENHO_ROTULO, padrão "medicao").

const RODADAS = 5;
// DevTools "Fast 3G": 1,6 Mbps e 750 kbps vezes 0,9, latência 150 ms vezes 3,75.
const REDE = { offline: false, latency: 562.5, downloadThroughput: 180_000, uploadThroughput: 84_375 };
const API = "http://localhost:3000";

type Req = { url: string; metodo: string; inicio: number; fim: number; bytes: number };
type Carga = { lcp: number; cls: number; util: number; bytes: number; requisicoes: number; api: number; cascata: { metodo: string; rota: string; inicio: number; duracao: number; bytes: number }[] };

const mediana = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const semIds = (u: string) => new URL(u).pathname.replace(/\/\d+(?=\/|$)/g, "/:id") + (new URL(u).search ? "?" + new URL(u).searchParams.toString() : "");

async function carregar(context: BrowserContext, rota: string, depois?: (p: Page) => Promise<void>): Promise<Carga> {
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", REDE);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const reqs = new Map<string, Req>();
  cdp.on("Network.requestWillBeSent", (e) => {
    if (!e.request.url.startsWith("data:")) reqs.set(e.requestId, { url: e.request.url, metodo: e.request.method, inicio: e.timestamp, fim: 0, bytes: 0 });
  });
  cdp.on("Network.loadingFinished", (e) => {
    const r = reqs.get(e.requestId);
    if (r) Object.assign(r, { fim: e.timestamp, bytes: e.encodedDataLength });
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __lcp: number; __cls: number };
    w.__lcp = 0;
    w.__cls = 0;
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__lcp = e.startTime))).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) =>
      l.getEntries().forEach((e) => {
        const s = e as PerformanceEntry & { hadRecentInput: boolean; value: number };
        if (!s.hadRecentInput) w.__cls += s.value;
      }),
    ).observe({ type: "layout-shift", buffered: true });
  });

  await page.goto(rota, { waitUntil: "commit" });
  await expect(page.locator("h1").first()).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/carregando/i).filter({ visible: true })).toHaveCount(0, { timeout: 120_000 });
  const util = await page.evaluate(() => performance.now());
  // Espera as chamadas à API em voo terminarem (a cascata completa), sem contar no tempo útil.
  await expect.poll(() => [...reqs.values()].filter((r) => r.url.startsWith(API) && r.fim === 0).length, { timeout: 120_000 }).toBe(0);
  const { lcp, cls } = await page.evaluate(() => ({ lcp: (window as unknown as { __lcp: number }).__lcp, cls: (window as unknown as { __cls: number }).__cls }));
  if (depois) await depois(page);
  await page.close();

  const lista = [...reqs.values()];
  const t0 = Math.min(...lista.map((r) => r.inicio));
  const api = lista.filter((r) => r.url.startsWith(API)).sort((a, b) => a.inicio - b.inicio);
  return {
    lcp: Math.round(lcp),
    cls: Math.round(cls * 1000) / 1000,
    util: Math.round(util),
    bytes: lista.reduce((s, r) => s + r.bytes, 0),
    requisicoes: lista.length,
    api: api.length,
    cascata: api.map((r) => ({ metodo: r.metodo, rota: semIds(r.url), inicio: Math.round((r.inicio - t0) * 1000), duracao: Math.round((r.fim - r.inicio) * 1000), bytes: r.bytes })),
  };
}

const resultados: Record<string, { lcp: number; cls: number; util: number; bytes: number; requisicoes: number; api: number; cascatas?: Carga["cascata"][]; extra?: Record<string, number> }> = {};

// DESEMPENHO_SO: expressão regular; mede só as telas cujo rótulo casa com ela (contas e dados são criados igual).
const SO = process.env.DESEMPENHO_SO;

async function medirTela(rotulo: string, context: BrowserContext, rota: string, interacoes?: Record<string, (p: Page) => Promise<number>>) {
  if (SO && !new RegExp(SO).test(rotulo)) return;
  const cargas: Carga[] = [];
  const extras: Record<string, number[]> = {};
  for (let i = 0; i < RODADAS; i++) {
    cargas.push(
      await carregar(context, rota, interacoes ? async (p) => {
        for (const [nome, f] of Object.entries(interacoes)) (extras[nome] ??= []).push(await f(p));
      } : undefined),
    );
  }
  const m = (k: "lcp" | "cls" | "util" | "bytes" | "requisicoes" | "api") => mediana(cargas.map((c) => c[k]));
  resultados[rotulo] = {
    lcp: m("lcp"), cls: m("cls"), util: m("util"), bytes: m("bytes"), requisicoes: m("requisicoes"), api: m("api"),
    ...(rota === "/Home" ? { cascatas: cargas.map((c) => c.cascata) } : {}),
    ...(interacoes ? { extra: Object.fromEntries(Object.entries(extras).map(([k, v]) => [k, mediana(v)])) } : {}),
  };
  const r = resultados[rotulo];
  console.log(`${rotulo.padEnd(26)} LCP ${String(r.lcp).padStart(6)} ms  útil ${String(r.util).padStart(6)} ms  CLS ${r.cls}  ${Math.round(r.bytes / 1024)} kB  req ${r.requisicoes} (API ${r.api})${r.extra ? "  " + JSON.stringify(r.extra) : ""}`);
}

// Interação com CPU 4x: do clique até o novo estado aparecer (inclui a latência do próprio Playwright).
async function cronometrar(p: Page, acao: () => Promise<void>, pronto: () => Promise<void>) {
  const t = Date.now();
  await acao();
  await pronto();
  return Date.now() - t;
}

const ESPERA = 120_000;

// Históricos só carregam no clique (Saúde, Alimentação, Agenda): do clique até o botão deixar de dizer "Carregando", ou
// seja, download do JSON inteiro (rede 3G) mais a renderização da lista (CPU 4x).
async function carregarHistorico(p: Page, rotulo: string) {
  const botao = p.getByRole("button", { name: rotulo, exact: true });
  return cronometrar(
    p,
    () => botao.click({ timeout: ESPERA }),
    async () => {
      const ocupado = p.getByRole("button", { name: /carregando/i });
      await expect(ocupado).toHaveCount(1, { timeout: ESPERA });
      await expect(ocupado).toHaveCount(0, { timeout: ESPERA });
    },
  );
}

const backend = (args: string[]) =>
  execFileSync("npx", ["tsx", "scripts/medir-desempenho.ts", ...args], {
    cwd: "../backend",
    shell: true,
    stdio: "pipe",
    env: {
      ...process.env,
      DATABASE_URL: `sqlserver://localhost:14330;database=elder_web;user=sa;password=${process.env.MSSQL_SA_PASSWORD};encrypt=true;trustServerCertificate=true`,
    },
  });

test("desempenho das telas (Fast 3G, CPU 4x, 5 rodadas)", async ({ browser }) => {
  test.setTimeout(3_600_000);
  exigirBancoLocal();
  const contas: Record<string, Conta> = {};
  try {
    const publico = await browser.newContext();
    await medirTela("Landing", publico, "/");
    await medirTela("Login", publico, "/login");
    await publico.close();

    for (const perfil of PERFIS) contas[perfil.tipoPerfil] = await criarContaELogar(browser, perfil, "perf");
    await vincular(contas.cuidador, "cuidador", contas.idoso);
    await vincular(contas.familiar, "familiar", contas.idoso);
    backend([`--popular-email=${contas.idoso.email}`]);

    for (const { tipoPerfil } of PERFIS) {
      const ctx = contas[tipoPerfil].context;
      await medirTela(`${tipoPerfil} Home`, ctx, "/Home");
      // Navegação dentro do site (sem recarregar): do clique no menu até a Saúde pronta, seletor incluído.
      // Entrada própria: os números de carga dela são os da Home e não entram na comparação, só o tempo.
      await medirTela(`${tipoPerfil} Home→Saúde (navegação)`, ctx, "/Home", {
        navegar_para_saude_ms: (p) =>
          cronometrar(
            p,
            () => p.getByRole("navigation").getByRole("link", { name: "Saúde", exact: true }).first().click({ timeout: ESPERA }),
            async () => {
              await expect(p.getByRole("heading", { level: 1, name: /saúde/i })).toBeVisible({ timeout: ESPERA });
              await expect(p.getByText(/carregando/i).filter({ visible: true })).toHaveCount(0, { timeout: ESPERA });
            },
          ),
      });
      await medirTela(
        `${tipoPerfil} Agenda`,
        ctx,
        "/agenda",
        tipoPerfil === "idoso"
          ? {
              ver_agenda_ms: (p) => carregarHistorico(p, "Ver agenda"),
              proximo_mes_ms: async (p) => {
                const titulo = p.locator("#titulo_mes_calendario");
                const antes = await titulo.textContent({ timeout: ESPERA });
                return cronometrar(p, () => p.getByRole("button", { name: "Próximo mês" }).click({ timeout: ESPERA }), () => expect(titulo).not.toHaveText(antes ?? "", { timeout: ESPERA }));
              },
              trocar_para_lista_ms: async (p) => {
                const ms = await cronometrar(p, () => p.getByRole("radio", { name: "Lista" }).check({ timeout: ESPERA }), () => expect(p.getByRole("grid")).toHaveCount(0, { timeout: ESPERA }));
                // A visão fica salva no navegador: volta ao calendário (fora do cronômetro) para a próxima rodada.
                await p.getByRole("radio", { name: "Calendário" }).check({ timeout: ESPERA });
                await expect(p.getByRole("grid")).toBeVisible({ timeout: ESPERA });
                return ms;
              },
            }
          : undefined,
      );
      await medirTela(`${tipoPerfil} Saúde`, ctx, "/saude", tipoPerfil === "idoso" ? { ver_historico_ms: (p) => carregarHistorico(p, "Ver histórico") } : undefined);
      await medirTela(`${tipoPerfil} Remédios`, ctx, "/remedios");
      await medirTela(`${tipoPerfil} Alimentação`, ctx, "/alimentacao", tipoPerfil === "idoso" ? { ver_historico_ms: (p) => carregarHistorico(p, "Ver histórico alimentar") } : undefined);
      await medirTela(`${tipoPerfil} Vínculos`, ctx, tipoPerfil === "cuidador" ? "/cuidadores" : "/familia");
      await medirTela(`${tipoPerfil} Perfil`, ctx, "/perfil");
    }
  } finally {
    if (contas.idoso) backend([`--limpar-email=${contas.idoso.email}`]);
    for (const conta of Object.values(contas)) await conta.context.close();
    mkdirSync("test-results/desempenho", { recursive: true });
    writeFileSync(`test-results/desempenho/${process.env.DESEMPENHO_ROTULO ?? "medicao"}.json`, JSON.stringify(resultados, null, 2));
  }
});

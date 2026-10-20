import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { aguardarTelaPronta } from "./helpers/axe";
import { PERFIS, criarContaELogar, exigirBancoLocal, vincular, type Conta } from "./helpers/conta";
import { MATRIZ, aplicarVariante, congelarAnimacoes, contextoCelular, falhasMetaViewport, medirMatriz } from "./helpers/mobile";

// Layout no celular (D1 a D11): estouro horizontal, alvo de toque, tamanho de fonte, corte, alvo coberto e alcance
// com o teclado aberto, em todas as telas e nos 3 perfis, na matriz de helpers/mobile.ts. Local, fora do CI (como o
// test:a11y): Firebase real e SQL Server LOCAL. Cria 4 contas e2e-*@e2e.elderweb.test por execução, sem limpeza, e
// os dados de pior caso (nomes e textos longos, todos com "E2E Teste") pelas rotas do backend local.
// Rodar: npm run test:responsivo   (RESPONSIVO_SO=<regex> mede só as telas cujo rótulo casar;
// RESPONSIVO_FOTOS=<pasta> também salva capturas para conferir a olho, inclusive do desktop 1440;
// RESPONSIVO_VARIANTES=<regex> mede só as variantes cujo nome casar. Outro navegador: --browser=webkit)
const SO = process.env.RESPONSIVO_SO ? new RegExp(process.env.RESPONSIVO_SO, "i") : null;
const VARIANTES = process.env.RESPONSIVO_VARIANTES ? new RegExp(process.env.RESPONSIVO_VARIANTES) : null;
const MATRIZ_USADA = VARIANTES ? MATRIZ.filter((v) => VARIANTES.test(v.nome)) : MATRIZ;
// Clique bloqueado por elemento sobreposto falha logo, em vez de esperar o tempo do teste inteiro.
test.use({ actionTimeout: 15_000 });
const FOTOS = process.env.RESPONSIVO_FOTOS;
const VARIANTES_FOTO = ["360x740 claro padrao", "320x640 claro muito-grande", "360x740 escuro padrao", "768x1024 claro padrao", "844x390 claro padrao", "390x400 claro padrao"];
const arquivo = (rotulo: string, variante: string) => `${FOTOS}/${`${rotulo} ${variante}`.replace(/[^\w-]+/g, "_")}.png`;

async function auditar(page: Page, rotulo: string, escopo?: string) {
  if (SO && !SO.test(rotulo)) return;
  await test.step(rotulo, async () => {
    const linhas = await medirMatriz(page, MATRIZ_USADA, escopo);
    for (const l of linhas) console.log(`[responsivo] ${rotulo} | ${l}`);
    expect.soft(linhas, rotulo).toEqual([]);
    if (FOTOS) {
      for (const v of MATRIZ_USADA.filter((m) => VARIANTES_FOTO.includes(m.nome))) {
        await aplicarVariante(page, v);
        // Uma captura por altura de tela, rolando de verdade (o fullPage desenha errado o que é fixo ou sticky).
        const total = escopo ? 1 : Math.min(8, Math.ceil((await page.evaluate(() => document.documentElement.scrollHeight)) / v.viewport.height));
        for (let i = 0; i < total; i++) {
          await page.evaluate((y) => window.scrollTo(0, y), i * v.viewport.height);
          await page.screenshot({ path: arquivo(rotulo, `${v.nome} ${i}`) });
        }
      }
    }
  });
}

// Desktop (contexto sem isMobile): só capturas, para provar que 1440 não mudou.
async function fotosDesktop(context: BrowserContext, rota: string, rotulo: string, estado?: (p: Page) => Promise<unknown>) {
  if (!FOTOS || (SO && !SO.test(rotulo))) return;
  const page = await abrir(context, rota);
  await page.setViewportSize({ width: 1440, height: 900 });
  await estado?.(page);
  for (const escuro of [false, true]) {
    await aplicarVariante(page, { nome: "", viewport: { width: 1440, height: 900 }, escuro, texto: "padrao" });
    await page.screenshot({ path: arquivo(rotulo, `1440 ${escuro ? "escuro" : "claro"}`), fullPage: true });
  }
  await page.close();
}

async function abrir(context: BrowserContext, rota: string) {
  const page = await context.newPage();
  await page.goto(rota);
  await aguardarTelaPronta(page);
  expect(new URL(page.url()).pathname.toLowerCase()).toBe(rota.toLowerCase());
  return page;
}

async function emTela(context: BrowserContext, rota: string, rotulo: string, estado?: (p: Page) => Promise<string | void>) {
  if (SO && !SO.test(rotulo)) return;
  const page = await abrir(context, rota);
  try {
    // Leva ao estado em 412 px: em 320 um botão coberto bloquearia o clique, e isso já aparece na medição da tela.
    await page.setViewportSize({ width: 412, height: 915 });
    const escopo = (await estado?.(page)) ?? undefined;
    await auditar(page, rotulo, escopo);
  } finally {
    await page.close();
  }
}

const DIALOGO = '[role="dialog"]';
async function abrirDialogo(page: Page, botao: string | RegExp) {
  await page.getByRole("button", { name: botao }).first().click();
  await expect(page.locator(DIALOGO)).toBeVisible();
  return DIALOGO;
}

// Chamada ao backend local com o token da sessão desta página (mesmo módulo que as telas usam).
async function api(page: Page, caminho: string, method: string, corpo?: unknown) {
  return page.evaluate(
    async ({ caminho, method, corpo }) => {
      const modulo = "/src/lib/chamarApi.ts";
      const { chamarApi } = await import(/* @vite-ignore */ modulo);
      return chamarApi(caminho, { method, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    },
    { caminho, method, corpo },
  );
}

const DIA_MS = 86_400_000;
const diaSP = (deslocamento: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + deslocamento * DIA_MS));
const instante = (deslocamento: number, hora: string) => `${diaSP(deslocamento)}T${hora}:00-03:00`;
const LONGO =
  "E2E Teste, texto longo de pior caso para conferir quebra de linha no celular: arroz integral, feijão carioca, " +
  "abobrinha refogada com cebola e alho, salada de folhas verdes com tomate, peito de frango grelhado sem pele, " +
  "suco de laranja natural sem açúcar e uma porção pequena de mamão papaia de sobremesa, tudo bem amassado.";

const NOMES: Record<string, string> = {
  idoso: "E2E Teste Maria Aparecida de Albuquerque Cavalcanti Figueiredo dos Santos Oliveira",
  cuidador: "E2E Teste Josefina Conceição Bittencourt Vasconcelos de Andrade Siqueira",
  familiar: "E2E Teste Roberto Carlos Nascimento Guimarães Pereira de Alcântara Filho",
};

// ETAPA 1: dados de pior caso, todos marcados "E2E Teste", criados pelas rotas do backend local.
async function povoar(contas: Record<string, Conta>, pendente: Conta) {
  const paginas: Record<string, Page> = {};
  for (const [tipo, conta] of Object.entries(contas)) {
    paginas[tipo] = await abrir(conta.context, "/Home");
    await api(paginas[tipo], "/usuario/me", "PATCH", { nome: NOMES[tipo] });
  }
  const idoso = paginas.idoso;

  const remedios = [
    {
      nome: "E2E Teste Hidroclorotiazida associada a Cloridrato de Amilorida comprimido revestido de liberação prolongada",
      dosagem: "25 mg + 2,5 mg, meio comprimido em jejum",
      frequencia: "A cada 12 horas, depois do café da manhã e depois do jantar, sempre com bastante água",
      data_inicio: diaSP(-30),
      observacoes: LONGO.slice(0, 480),
    },
    { nome: "E2E Teste Losartana Potássica", dosagem: "50 mg", frequencia: "1 vez ao dia", data_inicio: diaSP(-90) },
    { nome: "E2E Teste Sinvastatina", dosagem: "20 mg", frequencia: "À noite", data_inicio: diaSP(-10), data_fim: diaSP(20) },
  ];
  const ids: number[] = [];
  for (const r of remedios) ids.push((await api(idoso, "/remedios", "POST", r)).id);
  await api(idoso, `/remedios/${ids[0]}/doses`, "POST", { status_administracao: "administrado" });
  await api(idoso, `/remedios/${ids[1]}/doses`, "POST", { status_administracao: "pulado", observacoes: LONGO.slice(0, 280) });
  await api(idoso, `/remedios/${ids[0]}/doses`, "POST", { status_administracao: "atrasado", data_hora_administracao: instante(-1, "08:00") });

  const leituras = [
    ["Pressão arterial sistólica e diastólica em repouso", 138.5, 88, "mmHg"],
    ["Glicemia capilar em jejum", 112, null, "mg/dL"],
    ["Frequência cardíaca", 76, null, "bpm"],
    ["Temperatura corporal", 36.7, null, "°C"],
    ["Saturação de oxigênio", 97, null, "%"],
    ["Peso", 68.45, null, "kg"],
    ["Pressão arterial", 9999.99, 9999.99, "mmHg"],
    ["Glicemia pós-prandial duas horas depois do almoço", 145, null, "mg/dL"],
    ["Frequência respiratória", 18, null, "irpm"],
  ] as const;
  for (const [i, [tipo_medicao, valor_1, valor_2, unidade]] of leituras.entries()) {
    await api(idoso, "/saude", "POST", { tipo_medicao, valor_1, valor_2, unidade, data_hora: instante(-1 - i, "09:30"), observacoes: LONGO.slice(0, 290) });
  }

  for (const [i, refeicao] of ["cafe_manha", "lanche_manha", "almoco", "lanche_tarde", "jantar", "ceia"].entries()) {
    await api(idoso, "/alimentacao", "POST", { refeicao, descricao: LONGO, data_hora: instante(-1, `${String(7 + i * 3).padStart(2, "0")}:15`) });
  }

  const titulo = "E2E Teste Consulta de retorno com a cardiologista no ambulatório de especialidades do hospital regional";
  for (const [i, hora] of ["07:00", "08:30", "10:00", "13:30", "15:00", "17:45", "20:00"].entries()) {
    await api(idoso, "/agenda", "POST", { tipo_evento: i % 2 ? "medico" : "pessoal", titulo, descricao: LONGO.slice(0, 480), data_hora_inicio: instante(0, hora), data_hora_fim: instante(0, `${hora.slice(0, 2)}:59`) });
  }
  await api(idoso, "/agenda", "POST", { tipo_evento: "pessoal", titulo: "E2E Teste Dia inteiro de visita da família", data_hora_inicio: instante(0, "00:00"), data_hora_fim: instante(0, "23:59") });
  await api(idoso, "/agenda", "POST", { tipo_evento: "medico", titulo, data_hora_inicio: instante(1, "09:00") });
  await api(idoso, "/agenda", "POST", { tipo_evento: "pessoal", titulo: "E2E Teste Viagem de três dias", data_hora_inicio: instante(-1, "08:00"), data_hora_fim: instante(1, "18:00") });

  // Cuidador com as 3 permissões: as telas mostram os formulários de terceiros.
  const { vinculos } = await api(idoso, "/vinculo", "GET");
  const doCuidador = vinculos.find((v: { tipo_vinculo: string; status: string }) => v.tipo_vinculo === "cuidador" && v.status === "aprovado");
  await api(idoso, `/vinculo/${doCuidador.id}/definir-permissoes`, "PATCH", { permite_registrar_saude: true, permite_marcar_dose: true, permite_criar_evento_cuidado: true });
  await api(paginas.cuidador, `/agenda/idoso/${doCuidador.idoso.id}`, "POST", { tipo_evento: "cuidado", titulo: "E2E Teste Banho assistido e troca de curativo", descricao: LONGO.slice(0, 200), data_hora_inicio: instante(0, "11:00") });

  // Pedido pendente (outro cuidador) e vínculo à espera de confirmação de e-mail (idoso cadastrado pelo familiar).
  const pede = await abrir(pendente.context, "/Home");
  await api(pede, "/vinculo/solicitar-cuidador", "POST", { email: contas.idoso.email });
  await pede.close();
  await api(paginas.familiar, "/usuario/cadastrar-idoso", "POST", {
    nome: "E2E Teste Benedita Aparecida Rodrigues da Cunha",
    email: `e2e-idoso-cadastrado-pelo-familiar-${Date.now()}@e2e.elderweb.test`,
    aceita_termo_responsabilidade: true,
  });

  // Foto de perfil do idoso pela tela (WebP do próprio projeto).
  const perfil = await abrir(contas.idoso.context, "/perfil");
  await perfil.locator('input[type="file"]').setInputFiles("src/Img/Elder_logo.webp");
  await expect(perfil.locator("header img")).toBeVisible({ timeout: 30_000 });
  await perfil.close();

  for (const p of Object.values(paginas)) await p.close();
}

test("meta viewport não bloqueia o zoom (D5)", async ({ page }) => {
  await page.goto("/");
  expect(await falhasMetaViewport(page)).toEqual([]);
});

// Navbar da landing em desktop (opção D, 2026-10-19): o grupo central é absolute e o bloco da direita (tema, Entrar)
// cresce com o texto grande; sem folga os links se sobrepõem. Mede só o que está visível. Cria 0 contas.
const FOLGA_NAVBAR_MIN = 16;
const LARGURAS_NAVBAR = [1024, 1100, 1280, 1440];
test("landing: folga da Navbar entre o grupo central e o bloco da direita", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto("/");
  await aguardarTelaPronta(page);
  const folgas: string[] = [];
  for (const texto of ["padrao", "muito-grande"] as const) {
    for (const width of LARGURAS_NAVBAR) {
      await aplicarVariante(page, { nome: "", viewport: { width, height: 900 }, escuro: false, texto });
      const m = await page.evaluate(() => {
        const botao = (nome: string) => [...document.querySelectorAll("nav button")].find((b) => b.textContent?.trim() === nome);
        const central = botao("Funcionalidades")?.parentElement;
        const direita = botao("Entrar")?.parentElement;
        if (!central || !direita) return null;
        const visiveis = [...direita.children].map((c) => c.getBoundingClientRect()).filter((r) => r.width > 0);
        return {
          folga: Math.min(...visiveis.map((r) => r.left)) - central.getBoundingClientRect().right,
          rolagem: document.documentElement.scrollWidth - window.innerWidth,
        };
      });
      if (!m) folgas.push(`${width} ${texto}: Navbar sem os botões esperados`);
      else if (m.folga < FOLGA_NAVBAR_MIN) folgas.push(`${width} ${texto}: folga ${Math.round(m.folga)}px (mínimo ${FOLGA_NAVBAR_MIN})`);
      else if (m.rolagem > 0) folgas.push(`${width} ${texto}: rolagem horizontal de ${m.rolagem}px`);
    }
  }
  await context.close();
  expect(folgas).toEqual([]);
});

// D10: com mouse o hover aparece; no toque (sem hover) o estilo de hover não fica preso depois do toque.
test("hover só com mouse (D10)", async ({ browser }) => {
  const fundoDoEntrar = async (context: BrowserContext) => {
    const page = await context.newPage();
    await page.goto("/login");
    await congelarAnimacoes(page);
    const botao = page.getByRole("button", { name: /^entrar$/i });
    const antes = await botao.evaluate((b) => getComputedStyle(b).backgroundColor);
    await botao.hover();
    const depois = await botao.evaluate((b) => getComputedStyle(b).backgroundColor);
    await page.close();
    return { antes, depois };
  };
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const celular = await contextoCelular(browser);
  try {
    const mouse = await fundoDoEntrar(desktop);
    expect(mouse.depois, "desktop: hover com mouse").not.toBe(mouse.antes);
    const toque = await fundoDoEntrar(celular);
    expect(toque.depois, "celular: hover não aplicado no toque").toBe(toque.antes);
  } finally {
    await desktop.close();
    await celular.close();
  }
});

// D8: quantas palavras de um elemento ficam partidas entre duas linhas (nome nunca; e-mail só quando não cabe).
async function palavrasPartidas(page: Page, seletor: string) {
  return page.locator(seletor).evaluateAll((els) => {
    let partidas = 0;
    for (const el of els) {
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let t = w.nextNode(); t; t = w.nextNode()) {
        for (const m of (t.textContent ?? "").matchAll(/\S+/g)) {
          const r = document.createRange();
          r.setStart(t, m.index ?? 0);
          r.setEnd(t, (m.index ?? 0) + m[0].length);
          const linhas = new Set([...r.getClientRects()].filter((q) => q.width > 0).map((q) => Math.round(q.top)));
          if (linhas.size > 1) partidas++;
        }
      }
    }
    return partidas;
  });
}

// D11: teclado e preenchimento certos em cada campo (atributos lidos da tela, sem enviar nada).
async function atributos(page: Page, seletor: string) {
  return page.locator(seletor).first().evaluate((e) => ({
    type: e.getAttribute("type"),
    autoComplete: e.getAttribute("autocomplete"),
    autoCapitalize: e.getAttribute("autocapitalize"),
  }));
}

test("teclado certo nos campos públicos (D11)", async ({ page }) => {
  await page.goto("/esqueci-senha");
  expect(await atributos(page, 'input[type="email"]')).toMatchObject({ type: "email", autoComplete: "email" });
  await page.goto("/cadastro");
  await page.getByText("Idoso", { exact: true }).click();
  expect(await atributos(page, "#nome")).toMatchObject({ autoComplete: "name", autoCapitalize: "words" });
});

test("responsivo: telas públicas", async ({ browser }) => {
  test.setTimeout(1_800_000);
  const ctx = await contextoCelular(browser);
  try {
    for (const rota of [
      "/",
      "/sobre-nos",
      "/orientacoes",
      "/welcome",
      "/login",
      "/esqueci-senha",
      "/confirmar-email",
      "/privacidade",
      "/termos",
      "/cookies",
    ]) {
      await emTela(ctx, rota, `publica ${rota}`);
    }
    await emTela(ctx, "/login", "publica /login com erro", async (p) => {
      await p.getByLabel(/^e-mail$/i).fill("e2e-nao-existe@e2e.elderweb.test");
      await p.getByLabel(/^senha$/i).fill("SenhaErradaE2e123!");
      await p.getByRole("button", { name: /^entrar$/i }).click();
      await expect(p.getByRole("alert").first()).toBeVisible({ timeout: 20_000 });
    });
    for (const { radio } of PERFIS) {
      await emTela(ctx, "/cadastro", `publica /cadastro ${radio}`, async (p) => {
        await p.getByText(radio, { exact: true }).click();
      });
    }
    await emTela(ctx, "/cadastro", "publica /cadastro com erro", async (p) => {
      await p.getByText("Idoso", { exact: true }).click();
      await p.getByLabel("Nome completo").fill(NOMES.idoso);
      await p.getByLabel("E-mail", { exact: true }).fill("e2e-endereco-de-erro-bem-comprido@e2e.elderweb.test");
      // Senhas diferentes: a validação da própria tela, sem chegar ao Firebase.
      await p.getByLabel("Senha", { exact: true }).fill("SenhaE2e123");
      await p.getByLabel("Confirmação da senha", { exact: true }).fill("OutraSenhaE2e456");
      await p.getByRole("button", { name: /criar minha conta/i }).click();
      await expect(p.getByRole("alert").first()).toBeVisible();
    });
    const desktop = await browser.newContext();
    await fotosDesktop(desktop, "/", "desktop /");
    await fotosDesktop(desktop, "/login", "desktop /login");
    await fotosDesktop(desktop, "/cadastro", "desktop /cadastro");
    await fotosDesktop(desktop, "/esqueci-senha", "desktop /esqueci-senha");
    await fotosDesktop(desktop, "/sobre-nos", "desktop /sobre-nos");
    await fotosDesktop(desktop, "/privacidade", "desktop /privacidade");
    await fotosDesktop(desktop, "/cookies", "desktop /cookies");
    await desktop.close();
  } finally {
    await ctx.close();
  }
});

const ROTAS = ["/Home", "/perfil", "/familia", "/cuidadores", "/saude", "/remedios", "/agenda", "/alimentacao", "/orientacoes", "/avisos", "/configuracoes"];

test("responsivo: telas autenticadas (idoso, cuidador e familiar com dados de pior caso)", async ({ browser }) => {
  test.setTimeout(3_600_000);
  exigirBancoLocal();
  const contas: Record<string, Conta> = {};
  const celulares: BrowserContext[] = [];
  let pendente: Conta | undefined;
  try {
    contas.idoso = await criarContaELogar(browser, PERFIS[0], "maria-aparecida-albuquerque-cavalcanti-figueiredo");
    contas.cuidador = await criarContaELogar(browser, PERFIS[1], "josefina-conceicao-bittencourt-vasconcelos");
    contas.familiar = await criarContaELogar(browser, PERFIS[2], "roberto-carlos-nascimento-guimaraes-pereira");
    pendente = await criarContaELogar(browser, PERFIS[1], "pedido-pendente-com-endereco-bem-comprido");
    await vincular(contas.cuidador, "cuidador", contas.idoso);
    await vincular(contas.familiar, "familiar", contas.idoso);
    await povoar(contas, pendente);

    for (const { tipoPerfil } of PERFIS) {
      const ctx = await contextoCelular(browser, contas[tipoPerfil].context);
      celulares.push(ctx);
      for (const rota of ROTAS.filter((r) => !(tipoPerfil === "cuidador" && r === "/familia"))) {
        await emTela(ctx, rota, `${tipoPerfil} ${rota}`);
      }
      await emTela(ctx, "/Home", `${tipoPerfil} menu aberto`, async (p) => {
        await p.getByRole("button", { name: "Abrir menu" }).click();
        return "aside";
      });
      const lista = tipoPerfil === "cuidador" ? "/cuidadores" : "/familia";
      await emTela(ctx, lista, `${tipoPerfil} /vinculos/:id`, async (p) => {
        const href = await p.locator('a[href^="/vinculos/"]').first().getAttribute("href");
        await p.goto(href!);
        await aguardarTelaPronta(p);
      });
      for (const visao of ["Lista", "Calendário Mês", "Calendário Dia"]) {
        await emTela(ctx, "/agenda", `${tipoPerfil} /agenda ${visao}`, async (p) => {
          await p.getByRole("button", { name: "Ver agenda" }).click();
          const [ver, modo] = visao.split(" ");
          await p.getByRole("radio", { name: ver }).check();
          if (modo) await p.getByRole("radio", { name: modo }).check();
        });
      }
    }
    const [idoso, cuidador, familiar] = celulares;
    await test.step("nome quebra entre palavras, e-mail só quando não cabe (D8)", async () => {
      const lista = await abrir(idoso, "/cuidadores");
      await aplicarVariante(lista, { nome: "", viewport: { width: 320, height: 640 }, escuro: false, texto: "muito-grande" });
      expect(await lista.locator("article h2").count()).toBeGreaterThan(0);
      expect(await palavrasPartidas(lista, "article h2"), "nomes nos cartões de vínculo").toBe(0);
      await lista.close();
      const orientacoes = await abrir(idoso, "/orientacoes");
      const email = 'a[href^="mailto:"]';
      await aplicarVariante(orientacoes, { nome: "", viewport: { width: 320, height: 640 }, escuro: false, texto: "muito-grande" });
      expect(await palavrasPartidas(orientacoes, email), "e-mail longo em 320 precisa partir").toBe(1);
      await aplicarVariante(orientacoes, { nome: "", viewport: { width: 1440, height: 900 }, escuro: false, texto: "padrao" });
      expect(await palavrasPartidas(orientacoes, email), "e-mail que cabe não parte").toBe(0);
      await orientacoes.close();
    });
    await test.step("hover com mouse no desktop e sem hover no toque: botão, cartão e menu (D10)", async () => {
      // Estilo computado antes e depois de passar o ponteiro, sem transição (o valor é o final).
      const alvos = (p: Page) => [
        { nome: "botão", el: p.getByRole("button", { name: "Abrir perfil" }), prop: "background-color" },
        { nome: "cartão", el: p.locator("main button.group").first(), prop: "box-shadow" },
        { nome: "menu", el: p.locator("aside nav a:not([aria-current])").first(), prop: "background-color" },
      ];
      const medirHover = async (context: BrowserContext, largura: number) => {
        const page = await abrir(context, "/Home");
        await page.setViewportSize({ width: largura, height: 900 });
        await congelarAnimacoes(page);
        const mudou: Record<string, boolean> = {};
        for (const { nome, el, prop } of alvos(page)) {
          // No celular o menu é a gaveta: abre só agora, porque o fundo dela cobre o botão e o cartão.
          if (nome === "menu" && largura < 1024) await page.getByRole("button", { name: "Abrir menu" }).click();
          const antes = await el.evaluate((e, pr) => getComputedStyle(e).getPropertyValue(pr), prop);
          await el.hover();
          const depois = await el.evaluate((e, pr) => getComputedStyle(e).getPropertyValue(pr), prop);
          mudou[nome] = antes !== depois;
          await page.mouse.move(0, 0);
        }
        await page.close();
        return mudou;
      };
      expect(await medirHover(contas.idoso.context, 1440), "desktop com mouse").toEqual({ botão: true, cartão: true, menu: true });
      expect(await medirHover(idoso, 412), "celular com toque").toEqual({ botão: false, cartão: false, menu: false });
    });
    await test.step("teclado certo nos campos autenticados (D11)", async () => {
      const perfil = await abrir(idoso, "/perfil");
      expect(await atributos(perfil, "#nome")).toMatchObject({ autoComplete: "name", autoCapitalize: "words" });
      expect(await atributos(perfil, "#email")).toMatchObject({ type: "email", autoComplete: "email" });
      expect(await atributos(perfil, "#telefone")).toMatchObject({ type: "tel", autoComplete: "tel" });
      await perfil.close();
      const saude = await abrir(idoso, "/saude");
      expect(await atributos(saude, "#unidade_saude")).toMatchObject({ autoCapitalize: "none" });
      expect(await atributos(saude, "#valor_1_saude")).toMatchObject({ type: "number" });
      await saude.close();
      const remedios = await abrir(idoso, "/remedios");
      await abrirDialogo(remedios, "Adicionar medicamento");
      expect(await atributos(remedios, "#medicamento-dosagem")).toMatchObject({ autoCapitalize: "none" });
      await remedios.close();
    });
    await fotosDesktop(contas.idoso.context, "/Home", "desktop idoso /Home");
    await fotosDesktop(contas.idoso.context, "/agenda", "desktop idoso /agenda");
    await fotosDesktop(contas.idoso.context, "/agenda", "desktop idoso /agenda Lista", async (p) => {
      await p.getByRole("button", { name: "Ver agenda" }).click();
      await p.getByRole("radio", { name: "Lista" }).check();
    });
    await fotosDesktop(contas.idoso.context, "/alimentacao", "desktop idoso /alimentacao");
    await fotosDesktop(contas.idoso.context, "/perfil", "desktop idoso /perfil");

    await emTela(idoso, "/Home", "idoso BotaoAjuda", (p) => abrirDialogo(p, /preciso de ajuda/i));
    await emTela(idoso, "/remedios", "idoso ModalMedicamento", (p) => abrirDialogo(p, "Adicionar medicamento"));
    await emTela(idoso, "/remedios", "idoso ModalMarcarDose", (p) => abrirDialogo(p, /marcar dose/i));
    await emTela(cuidador, "/remedios", "cuidador ModalMarcarDose", (p) => abrirDialogo(p, /marcar dose/i));
    await emTela(idoso, "/familia", "idoso ConvidarFamiliar", (p) => abrirDialogo(p, "Adicionar pessoa"));
    await emTela(cuidador, "/cuidadores", "cuidador SolicitarVinculo", (p) => abrirDialogo(p, "Adicionar pessoa"));
    await emTela(familiar, "/familia", "familiar AdicionarPessoa", (p) => abrirDialogo(p, "Adicionar pessoa"));
    await emTela(familiar, "/familia", "familiar SolicitarVinculo", async (p) => {
      await abrirDialogo(p, "Adicionar pessoa");
      await p.getByRole("button", { name: "Pedir vínculo com um idoso" }).click();
      return DIALOGO;
    });
    await emTela(familiar, "/familia", "familiar CadastrarIdoso", async (p) => {
      await abrirDialogo(p, "Adicionar pessoa");
      await p.getByRole("button", { name: "Cadastrar um idoso" }).click();
      return DIALOGO;
    });
  } finally {
    for (const c of celulares) await c.close();
    for (const conta of [...Object.values(contas), ...(pendente ? [pendente] : [])]) await conta.context.close();
  }
});

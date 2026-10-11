import type { Browser, BrowserContext, Page } from "@playwright/test";

// Medição de layout no celular (estouro, alvo de toque, fonte, corte, alvo coberto). O jest-axe e o axe do
// test:a11y não veem nada disso. Privacidade (RNF-001): o relatório só leva regra, seletor (tag, id e classes)
// e números, nunca texto de tela nem html.

export type Viewport = { width: number; height: number };
export type Texto = "padrao" | "grande" | "muito-grande";
export type Variante = { nome: string; viewport: Viewport; escuro: boolean; texto: Texto };
export type Falha = { regra: string; seletor: string; numeros: string };

const EM_PE = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
];
const TABLET = { width: 768, height: 1024 };
const DEITADO = { width: 844, height: 390 };
// Teclado virtual aberto: sobra mais ou menos metade da altura.
export const TECLADO = { width: 390, height: 400 };

function variante(viewport: Viewport, escuro: boolean, texto: Texto): Variante {
  return { nome: `${viewport.width}x${viewport.height} ${escuro ? "escuro" : "claro"} ${texto}`, viewport, escuro, texto };
}

// Matriz D2: 6 tamanhos de tela nos 2 temas com texto padrão, texto grande e muito grande em 320 e 360, e a
// altura do teclado aberto (D9, item g).
export const MATRIZ: Variante[] = [
  ...[...EM_PE, TABLET, DEITADO].flatMap((v) => [variante(v, false, "padrao"), variante(v, true, "padrao")]),
  ...EM_PE.slice(0, 2).flatMap((v) =>
    (["grande", "muito-grande"] as const).flatMap((t) => [variante(v, false, t), variante(v, true, t)]),
  ),
  variante(TECLADO, false, "padrao"),
  variante(TECLADO, false, "muito-grande"),
];

// Contexto de celular com a mesma sessão do Firebase (IndexedDB) do contexto de origem, só em memória.
export async function contextoCelular(browser: Browser, origem?: BrowserContext): Promise<BrowserContext> {
  const storageState = origem ? await origem.storageState({ indexedDB: true }) : undefined;
  return browser.newContext({ storageState, isMobile: true, hasTouch: true, deviceScaleFactor: 2, viewport: EM_PE[0] });
}

// Sem transição nem animação: a medida é do estado final (gaveta, modal), não de um quadro intermediário.
export async function congelarAnimacoes(page: Page) {
  await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important}" });
}

// Mesmas classes que lib/preferencias.ts aplica no <html> (tema e tamanho do texto).
export async function aplicarVariante(page: Page, v: Variante) {
  await page.setViewportSize(v.viewport);
  await page.evaluate(({ escuro, texto }) => {
    const html = document.documentElement;
    html.classList.toggle("dark", escuro);
    html.classList.toggle("texto-grande", texto === "grande");
    html.classList.toggle("texto-muito-grande", texto === "muito-grande");
    // Cada variante começa do topo, inclusive nas áreas com rolagem própria (modal, menu).
    for (const e of document.querySelectorAll("*")) if (e.scrollTop || e.scrollLeft) e.scrollTo(0, 0);
    window.scrollTo(0, 0);
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, v);
}

// D5: zoom nunca bloqueado.
export async function falhasMetaViewport(page: Page): Promise<Falha[]> {
  const conteudo = (await page.locator('meta[name="viewport"]').getAttribute("content")) ?? "";
  return /maximum-scale|user-scalable\s*=\s*(no|0)|viewport-fit/i.test(conteudo)
    ? [{ regra: "viewport-bloqueia-zoom", seletor: 'meta[name="viewport"]', numeros: "" }]
    : [];
}

// `escopo`: com modal ou gaveta aberta, só o que está dentro dela (o fundo coberto é esperado).
export async function medir(page: Page, escopo?: string): Promise<Falha[]> {
  return page.evaluate((escopoSel) => {
    // Largura e altura da tela do aparelho. Não usar innerWidth: em modo celular o navegador alarga a página
    // para caber o que estoura (innerWidth passa de 320), e o estouro some da medida.
    const W = document.documentElement.clientWidth;
    const H = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const TOL = 1;
    const ALVO = 44;
    const FOLGA = 8;
    const falhas: { regra: string; seletor: string; numeros: string }[] = [];
    const raiz: Element = (escopoSel && document.querySelector(escopoSel)) || document.body;
    const est = (el: Element) => getComputedStyle(el);
    const px = (n: number) => Math.round(n * 10) / 10;

    function nome(el: Element) {
      let s = el.tagName.toLowerCase();
      if (el.id && !/^:r/.test(el.id)) s += `#${el.id}`;
      const classes = [...el.classList].filter((c) => !c.startsWith("dark:") && !c.startsWith("hover:") && !c.startsWith("focus")).slice(0, 3);
      return s + classes.map((c) => `.${c}`).join("");
    }
    function seletor(el: Element) {
      const partes: string[] = [];
      for (let e: Element | null = el, i = 0; e && e !== document.body && i < 3; e = e.parentElement, i++) partes.unshift(nome(e));
      return partes.join(" > ");
    }

    // sr-only do Tailwind: clip rect(0 0 0 0).
    function srOnly(el: Element) {
      for (let e: Element | null = el; e; e = e.parentElement) if (est(e).clip === "rect(0px, 0px, 0px, 0px)") return true;
      return false;
    }
    // Contêiner fixo inteiro fora da tela (gaveta do menu fechada): o que está dentro não conta.
    const foraDaTela = [...document.querySelectorAll("body *")].filter((e) => {
      if (est(e).position !== "fixed") return false;
      const r = e.getBoundingClientRect();
      return r.right <= TOL || r.left >= W - TOL || r.bottom <= TOL || r.top >= H - TOL;
    });
    function visivel(el: Element) {
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      if (srOnly(el)) return false;
      return !foraDaTela.some((f) => f.contains(el));
    }
    // Ancestral com rolagem horizontal própria (auto ou scroll): o filho largo é intencional. Um ancestral com
    // overflow hidden não desculpa (D6): o que passa dele fica cortado, igual ao overflow-x do body.
    function recortadoNaHorizontal(el: Element) {
      for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) if (["auto", "scroll"].includes(est(e).overflowX)) return true;
      return false;
    }
    // Enfeite (folhas, bolhas de fundo): escondido do leitor de tela, imagem sem texto alternativo, ou bloco
    // absoluto sem texto nem alvo. Pode sair da caixa de propósito.
    function enfeite(el: Element) {
      if (el.closest('[aria-hidden="true"]')) return true;
      if (el instanceof HTMLImageElement && el.alt === "") return true;
      return est(el).position === "absolute" && !(el.textContent ?? "").trim() && !el.querySelector("a, button, input, select, textarea");
    }
    function textos(base: Element) {
      const lista: Text[] = [];
      const w = document.createTreeWalker(base, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) if (n.textContent && n.textContent.trim()) lista.push(n as Text);
      return lista;
    }
    function retangulosTexto(t: Text) {
      const range = document.createRange();
      range.selectNodeContents(t);
      return [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    }

    const todos = [raiz, ...raiz.querySelectorAll("*")].filter(visivel);
    const rola = (e: Element) => ["auto", "scroll"].includes(est(e).overflowY) || ["auto", "scroll"].includes(est(e).overflowX);

    // Tela com zoom ou deslocada (visualViewport fora da origem): o que a pessoa vê não é a página inteira.
    function conferirTela(momento: string) {
      const vv = window.visualViewport;
      if (vv && (Math.abs(vv.scale - 1) > 0.01 || vv.offsetLeft > TOL || vv.offsetTop > TOL || window.scrollX > TOL)) {
        let maior: Element | null = null;
        let maiorDir = 0;
        for (const e of document.querySelectorAll("body *")) {
          const r = e.getBoundingClientRect();
          if (r.right > maiorDir) {
            maiorDir = r.right;
            maior = e;
          }
        }
        falhas.push({ regra: "tela-deslocada", seletor: momento, numeros: `scale=${px(vv.scale)} offset=${px(vv.offsetLeft)},${px(vv.offsetTop)} vv=${px(vv.width)}x${px(vv.height)} inner=${window.innerWidth}x${window.innerHeight} doc=${document.documentElement.scrollWidth}x${document.documentElement.scrollHeight} client=${document.documentElement.clientWidth} maior=${maior ? seletor(maior) : ""}@${px(maiorDir)}` });
      }
    }
    conferirTela("antes");

    // a) Estouro horizontal: caixa do elemento ou linha de texto fora de [0, W].
    if (!escopoSel && document.documentElement.scrollWidth > W + TOL) {
      falhas.push({ regra: "estouro", seletor: "html", numeros: `scrollWidth=${document.documentElement.scrollWidth} W=${W}` });
    }
    const estourados = new Set<Element>();
    for (const el of todos) {
      if (recortadoNaHorizontal(el) || enfeite(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.left < -TOL || r.right > W + TOL) estourados.add(el);
    }
    for (const el of estourados) {
      if (el.parentElement && estourados.has(el.parentElement)) continue;
      const r = el.getBoundingClientRect();
      falhas.push({ regra: "estouro", seletor: seletor(el), numeros: `left=${px(r.left)} right=${px(r.right)} W=${W}` });
    }
    for (const t of textos(raiz)) {
      const pai = t.parentElement;
      if (!pai || !visivel(pai) || recortadoNaHorizontal(pai) || estourados.has(pai)) continue;
      // Também texto acima do topo com a página no início: não há como rolar até ele.
      const fora = retangulosTexto(t).find((r) => r.left < -TOL || r.right > W + TOL || r.top < -TOL);
      if (fora) falhas.push({ regra: "estouro-texto", seletor: seletor(pai), numeros: `top=${px(fora.top)} right=${px(fora.right)} W=${W}` });
      // Texto que passa da largura de uma caixa que o contém (palavra maior que o cartão), mesmo sem sair da tela.
      // Sobe até o primeiro ancestral absolute ou fixed: dali para cima a caixa não precisa conter o texto.
      if (!fora) {
        const linhas = retangulosTexto(t);
        for (let e: Element | null = pai; e && e !== document.body; e = e.parentElement) {
          const s = est(e);
          if (!["inline", "contents"].includes(s.display)) {
            const c = e.getBoundingClientRect();
            const vaza = linhas.find((r) => r.right > c.right + TOL || r.left < c.left - TOL);
            if (vaza) {
              falhas.push({ regra: "texto-vaza", seletor: seletor(e), numeros: `texto=${px(vaza.left)}..${px(vaza.right)} caixa=${px(c.left)}..${px(c.right)}` });
              break;
            }
          }
          // Parar também em margem negativa: o elemento sai da caixa do pai de propósito (grade do calendário).
          if (["absolute", "fixed"].includes(s.position) || rola(e) || parseFloat(s.marginLeft) < 0 || parseFloat(s.marginRight) < 0) break;
        }
      }
    }

    // c) Texto visível abaixo de 14 px; campo de formulário abaixo de 16 px (D4).
    const paisVistos = new Set<Element>();
    for (const t of textos(raiz)) {
      const pai = t.parentElement;
      if (!pai || paisVistos.has(pai) || !visivel(pai)) continue;
      paisVistos.add(pai);
      const fs = parseFloat(est(pai).fontSize);
      if (fs < 14 - 0.01) falhas.push({ regra: "texto-pequeno", seletor: seletor(pai), numeros: `${px(fs)}px` });
    }
    const NAO_CAMPO = ["radio", "checkbox", "range", "file", "hidden", "submit", "button", "reset", "image", "color"];
    for (const campo of raiz.querySelectorAll("input, select, textarea")) {
      if (campo instanceof HTMLInputElement && NAO_CAMPO.includes(campo.type)) continue;
      if (!visivel(campo)) continue;
      const fs = parseFloat(est(campo).fontSize);
      if (fs < 16 - 0.01) falhas.push({ regra: "campo-pequeno", seletor: seletor(campo), numeros: `${px(fs)}px` });
    }

    // d) Corte silencioso: texto que passa da caixa de um elemento que recorta (overflow hidden/clip,
    // reticências ou line-clamp). Contêiner com rolagem (auto/scroll) não conta: dá para rolar até o texto.
    const recorta = (s: CSSStyleDeclaration) =>
      ["hidden", "clip"].includes(s.overflowX) || ["hidden", "clip"].includes(s.overflowY) || s.textOverflow === "ellipsis" || (s.webkitLineClamp && s.webkitLineClamp !== "none");
    for (const el of todos) {
      if (el === document.body || !recorta(est(el))) continue;
      if (el.closest("[data-truncavel]")) continue;
      const caixa = el.getBoundingClientRect();
      for (const t of textos(el)) {
        if (!t.parentElement || srOnly(t.parentElement) || !t.parentElement.checkVisibility({ checkVisibilityCSS: true })) continue;
        // Texto dentro de uma área com rolagem própria (corpo do modal): alcançável rolando, não é corte.
        let rolavel = false;
        for (let e: Element | null = t.parentElement; e && e !== el; e = e.parentElement) if (rola(e)) rolavel = true;
        if (rolavel) continue;
        const fora = retangulosTexto(t).find(
          (r) => r.right > caixa.right + TOL || r.left < caixa.left - TOL || r.bottom > caixa.bottom + TOL || r.top < caixa.top - TOL,
        );
        if (fora) {
          falhas.push({ regra: "corte", seletor: seletor(el), numeros: `caixa=${px(caixa.width)}x${px(caixa.height)} texto=${px(fora.right - caixa.left)}x${px(fora.bottom - caixa.top)}` });
          break;
        }
      }
    }

    // b) Alvos de toque (D3): 44x44 e 8 px livres entre vizinhos. Rádio e caixa de seleção escondidos medem pelo rótulo.
    const SEL_ALVO =
      'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="radio"], [role="checkbox"], [role="switch"], [role="menuitem"]';
    type Alvo = { el: Element; area: Element; r: DOMRect };
    const alvos: Alvo[] = [];
    for (const el of raiz.querySelectorAll(SEL_ALVO)) {
      let area: Element = el;
      if (el instanceof HTMLInputElement && ["radio", "checkbox"].includes(el.type) && el.labels && el.labels[0]) {
        const rotulo = el.labels[0];
        if (rotulo.contains(el) || !visivel(el)) area = rotulo;
      }
      if (!visivel(area)) continue;
      if (el instanceof HTMLInputElement && el.type === "file") continue;
      // Exceção do D3: link dentro de parágrafo de texto corrido.
      if (el.tagName === "A" && est(el).display === "inline") {
        const bloco = el.parentElement;
        if (bloco && (bloco.textContent ?? "").trim().length > (el.textContent ?? "").trim().length + 1) continue;
      }
      if (alvos.some((a) => a.area === area)) continue;
      alvos.push({ el, area, r: area.getBoundingClientRect() });
    }
    function preso(el: Element): Element | null {
      for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) if (["sticky", "fixed"].includes(est(e).position)) return e;
      return null;
    }
    // Parte do alvo que aparece agora: recortada pelos ancestrais que recortam ou rolam (o resto está fora da área).
    function parteVisivel(a: Alvo) {
      let { left, top, right, bottom } = a.r;
      for (let e = a.area.parentElement; e && e !== document.body; e = e.parentElement) {
        if (est(e).overflowX === "visible" && est(e).overflowY === "visible") continue;
        const c = e.getBoundingClientRect();
        left = Math.max(left, c.left);
        top = Math.max(top, c.top);
        right = Math.min(right, c.right);
        bottom = Math.min(bottom, c.bottom);
      }
      return right - left > TOL && bottom - top > TOL ? new DOMRect(left, top, right - left, bottom - top) : null;
    }
    // Desvio do D3, registrado no histórico: dias da grade do calendário (role=grid) são contíguos e, em 320 px,
    // 7 colunas não chegam a 44 px. Só a largura e a folga ficam de fora; altura, cobertura e alcance seguem
    // medidos. O mesmo dia é alcançável com alvo cheio pela visão Dia e pela Lista.
    const naGrade = (e: Element) => e.closest('[role="grid"]') !== null;
    for (const a of alvos) {
      if (a.r.height < ALVO - 0.5 || (!naGrade(a.area) && a.r.width < ALVO - 0.5)) {
        falhas.push({ regra: "alvo-pequeno", seletor: seletor(a.area), numeros: `${px(a.r.width)}x${px(a.r.height)}` });
      }
    }
    // Alvo cortado por um ancestral que recorta sem rolar (overflow hidden ou clip): parte dele some da tela.
    for (const a of alvos) {
      for (let e = a.area.parentElement; e && e !== document.body; e = e.parentElement) {
        const s = est(e);
        if (!["hidden", "clip"].includes(s.overflowX) && !["hidden", "clip"].includes(s.overflowY)) continue;
        const c = e.getBoundingClientRect();
        if (a.r.left < c.left - TOL || a.r.right > c.right + TOL || a.r.top < c.top - TOL || a.r.bottom > c.bottom + TOL) {
          falhas.push({ regra: "corte", seletor: `${seletor(a.area)} em ${seletor(e)}`, numeros: `alvo=${px(a.r.left)}..${px(a.r.right)} caixa=${px(c.left)}..${px(c.right)}` });
          break;
        }
      }
    }
    for (let i = 0; i < alvos.length; i++) {
      for (let j = i + 1; j < alvos.length; j++) {
        const a = { ...alvos[i], r: parteVisivel(alvos[i]) };
        const b = { ...alvos[j], r: parteVisivel(alvos[j]) };
        if (!a.r || !b.r || a.area.contains(b.area) || b.area.contains(a.area)) continue;
        // Um preso à tela (sticky ou fixed) e o outro rolando por baixo dele: a sobreposição muda com a rolagem, e a
        // regra "coberto" confere se o de baixo chega a uma posição tocável.
        if (preso(a.area) !== preso(b.area)) continue;
        if (naGrade(a.area) && naGrade(b.area)) continue;
        // Botão dentro do campo (mostrar senha): o resto do campo segue tocável, e a regra "coberto" confere o centro.
        const dentro = (x: DOMRect, y: DOMRect) => x.left >= y.left - TOL && x.right <= y.right + TOL && x.top >= y.top - TOL && x.bottom <= y.bottom + TOL;
        if (dentro(a.r, b.r) || dentro(b.r, a.r)) continue;
        const dx = Math.max(0, b.r.left - a.r.right, a.r.left - b.r.right);
        const dy = Math.max(0, b.r.top - a.r.bottom, a.r.top - b.r.bottom);
        const folga = dx > 0 && dy > 0 ? Math.hypot(dx, dy) : Math.max(dx, dy);
        if (folga < FOLGA - 0.5) {
          falhas.push({ regra: "alvos-colados", seletor: `${seletor(a.area)} | ${seletor(b.area)}`, numeros: `${px(folga)}px` });
        }
      }
    }

    // D9: com modal aberto, o fundo não rola.
    if (escopoSel && raiz.matches('[role="dialog"]')) {
      const travado = [document.body, document.documentElement].some((e) => est(e).overflowY === "hidden" || est(e).overflow === "hidden");
      if (!travado) falhas.push({ regra: "fundo-solto", seletor: "body", numeros: "" });
    }

    // e) e g) Cada alvo levado ao centro por rolagem: precisa caber na tela e receber o toque no centro.
    for (const a of alvos) {
      a.area.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
      const r = a.area.getBoundingClientRect();
      if (r.height <= H && (r.top < -TOL || r.bottom > H + TOL || r.left < -TOL || r.right > W + TOL)) {
        falhas.push({ regra: "inalcancavel", seletor: seletor(a.area), numeros: `top=${px(r.top)} bottom=${px(r.bottom)} H=${H}` });
        continue;
      }
      const cx = Math.min(Math.max(r.left + r.width / 2, 0), W - 1);
      const cy = Math.min(Math.max(r.top + r.height / 2, 0), H - 1);
      const acertou = document.elementFromPoint(cx, cy);
      if (!acertou || !(a.area.contains(acertou) || a.el.contains(acertou))) {
        falhas.push({ regra: "coberto", seletor: `${seletor(a.area)} por ${acertou ? seletor(acertou) : "nada"}`, numeros: `${px(cx)},${px(cy)}` });
      }
    }
    window.scrollTo(0, 0);
    conferirTela("depois de rolar");
    return falhas;
  }, escopo ?? null);
}

// Junta as falhas de todas as variantes: uma linha por regra e seletor, com as variantes em que aparece.
export function agrupar(porVariante: { variante: string; falhas: Falha[] }[]): string[] {
  const mapa = new Map<string, { numeros: string; variantes: string[] }>();
  for (const { variante, falhas } of porVariante) {
    for (const f of falhas) {
      const chave = `${f.regra} ${f.seletor}`;
      const item = mapa.get(chave) ?? { numeros: f.numeros, variantes: [] };
      if (!item.variantes.includes(variante)) item.variantes.push(variante);
      mapa.set(chave, item);
    }
  }
  return [...mapa].map(([chave, { numeros, variantes }]) => `${chave} {${numeros}} em ${variantes.length}: ${variantes.slice(0, 4).join(", ")}${variantes.length > 4 ? ", ..." : ""}`);
}

export async function medirMatriz(page: Page, matriz: Variante[], escopo?: string) {
  const porVariante: { variante: string; falhas: Falha[] }[] = [];
  for (const v of matriz) {
    await aplicarVariante(page, v);
    porVariante.push({ variante: v.nome, falhas: await medir(page, escopo) });
  }
  return agrupar(porVariante);
}

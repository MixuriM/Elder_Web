import { readdirSync } from "node:fs";
import path from "node:path";
import { jobDe, ler, passosDe, REPO_ROOT } from "../testSupport/repoArquivos";

// Item 9.4: a suíte de autorização roda no CI a cada push, não só localmente. Teste de contrato sobre
// .github/workflows/ci.yml, backend/package.json e backend/jest.config.js: só fs e regex (mesmo padrão de
// dockerCi.test.ts). Roda no host e no CI, não dentro do container do docker-compose.yml.
const ci = ler(".github", "workflows", "ci.yml");
const pacote = JSON.parse(ler("backend", "package.json")) as { scripts: Record<string, string> };
const jestConfig = ler("backend", "jest.config.js");

// Bloco de uma chave de nível 0 do workflow, até a próxima chave de nível 0.
const bloco = (nome: string, texto: string): string => {
  const inicio = texto.search(new RegExp(`^${nome}:\\s*$`, "m"));
  if (inicio < 0) return "";
  const resto = texto.slice(texto.indexOf("\n", inicio) + 1);
  const proximo = resto.search(/^\S/m);
  return proximo < 0 ? resto : resto.slice(0, proximo);
};
const gatilhos = bloco("on", ci);
const secao = (nome: string): string => {
  const inicio = gatilhos.search(new RegExp(`^ {2}${nome}:\\s*$`, "m"));
  if (inicio < 0) return "";
  const resto = gatilhos.slice(gatilhos.indexOf("\n", inicio) + 1);
  const proximo = resto.search(/^ {2}\S/m);
  return proximo < 0 ? resto : resto.slice(0, proximo);
};

const semAspas = (b: string) => b.trim().replace(/^["']|["']$/g, "");

// Entradas de "branches:" em lista inline ([a, "b"]) ou em lista de itens ("- a").
function branchesDe(texto: string): string[] {
  const inline = /^\s*branches:\s*\[([^\]]*)\]/m.exec(texto);
  if (inline) return inline[1].split(",").map(semAspas).filter(Boolean);
  const lista = /^\s*branches:\s*\n((?:\s+-\s*\S.*\n?)+)/m.exec(texto);
  if (!lista) return [];
  return lista[1]
    .split("\n")
    .map((l) => semAspas(l.replace(/^\s*-\s*/, "")))
    .filter(Boolean);
}

const passosBackend = passosDe(jobDe(ci, "backend"));
const indicePasso = (re: RegExp) => passosBackend.findIndex((p) => re.test(p));
const RE_COBERTURA = /^\s*run:\s*npm run test:coverage\s*$/m;

describe("a suíte de autorização roda em CI a cada push (item 9.4)", () => {
  it("T1: o gatilho push cobre a branch development", () => {
    const branches = branchesDe(secao("push"));
    expect(branches.length).toBeGreaterThan(0);
    expect(branches.includes("**") || branches.includes("development")).toBe(true);
  });

  it("T2: o gatilho push não filtra por caminho, não ignora branch e não se limita a tags", () => {
    const push = secao("push");
    expect(push).not.toMatch(/^\s*paths(-ignore)?:/m);
    expect(push).not.toMatch(/^\s*branches-ignore:/m);
    expect(push).not.toMatch(/^\s*tags:/m);
  });

  it("T3: existe gatilho pull_request para main", () => {
    expect(branchesDe(secao("pull_request"))).toContain("main");
  });

  it("T4: concurrency por workflow e ref cancela a execução antiga da mesma ref", () => {
    const concorrencia = bloco("concurrency", ci);
    expect(concorrencia).toMatch(/^\s*group:\s*.*github\.workflow.*github\.ref/m);
    expect(concorrencia).toMatch(/^\s*cancel-in-progress:\s*true\s*$/m);
  });

  it("T5: o job backend executa npm run test:coverage", () => {
    expect(indicePasso(RE_COBERTURA)).toBeGreaterThanOrEqual(0);
  });

  it("T6: o passo de cobertura vem antes do npm run build", () => {
    const build = indicePasso(/^\s*run:\s*npm run build\s*$/m);
    expect(build).toBeGreaterThanOrEqual(0);
    expect(indicePasso(RE_COBERTURA)).toBeLessThan(build);
  });

  it("T7: o job backend não roda npm test além do test:coverage (a suíte roda uma vez)", () => {
    expect(indicePasso(/^\s*run:\s*npm test\s*$/m)).toBe(-1);
  });

  it("T8: nenhum passo do workflow engole falha (continue-on-error, || true ou || :)", () => {
    expect(ci).not.toMatch(/continue-on-error/);
    expect(ci).not.toMatch(/\|\|\s*true\b/);
    expect(ci).not.toMatch(/\|\|\s*:/);
  });

  it("T9: o job backend não depende de segredo", () => {
    expect(jobDe(ci, "backend")).not.toMatch(/secrets\./);
  });

  it("T10: npm test continua jest simples e test:coverage é jest --coverage", () => {
    expect(pacote.scripts.test).toBe("jest");
    expect(pacote.scripts["test:coverage"]).toBe("jest --coverage");
  });

  it("T11: coverageThreshold por diretório existe e respeita as metas mínimas (D7)", () => {
    const metas = {
      "./src/routes/": { statements: 85, branches: 75, functions: 85, lines: 85 },
      "./src/middleware/": { statements: 90, branches: 80, functions: 90, lines: 90 },
    };
    for (const [dir, minimos] of Object.entries(metas)) {
      const linha = new RegExp(`['"]${dir.replace(/[./]/g, "\\$&")}['"]\\s*:\\s*\\{([^}]*)\\}`).exec(jestConfig);
      expect(linha).not.toBeNull();
      for (const [criterio, minimo] of Object.entries(minimos)) {
        const valor = new RegExp(`${criterio}:\\s*(\\d+(?:\\.\\d+)?)`).exec(linha?.[1] ?? "");
        expect(valor).not.toBeNull();
        expect(Number(valor?.[1])).toBeGreaterThanOrEqual(minimo);
      }
    }
  });

  it("T12: a cobertura é medida em routes/ e middleware/", () => {
    expect(jestConfig).toMatch(/collectCoverageFrom:[^\]]*src\/routes\/\*\*\/\*\.ts/);
    expect(jestConfig).toMatch(/collectCoverageFrom:[^\]]*src\/middleware\/\*\*\/\*\.ts/);
  });

  it("T13: as suítes de autorização não têm .only, .skip, .todo, xit, xdescribe nem fit", () => {
    const arquivos = [
      ["backend", "src", "routes", "autorizacaoRotas.test.ts"],
      ["backend", "src", "middleware", "requireAuth.test.ts"],
      ["backend", "src", "middleware", "requireVinculoAprovado.test.ts"],
    ];
    for (const partes of arquivos) {
      expect(ler(...partes)).not.toMatch(/\b(describe|it|test)\.(only|skip|todo)\b|\b(xit|xdescribe|xtest|fit|fdescribe)\(/);
    }
  });

  it("T14: ci.yml é o único workflow (o contrato lê o workflow certo)", () => {
    const workflows = readdirSync(path.join(REPO_ROOT, ".github", "workflows")).filter((f) => /\.ya?ml$/.test(f));
    expect(workflows).toEqual(["ci.yml"]);
  });
});

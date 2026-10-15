import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// D7 (2026-10-14): cadeia de suprimentos. O CI roda npm audit só das dependências de produção em cada job, com o maior
// rigor que passa hoje sem aceitar nada novo (backend low, frontend critical: os 4 avisos altos do firebase seguem
// aceitos), sem || true nem continue-on-error, e o workflow só lê o repositório. Dependabot abre PRs semanais para
// development, sem merge automático. Teste de contrato com fs e regex, sem lib de YAML (padrão de dockerCi.test.ts).
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const ler = (...partes: string[]): string =>
  readFileSync(path.join(REPO_ROOT, ...partes), "utf8").replace(/\r\n/g, "\n");

const ci = ler(".github", "workflows", "ci.yml");
const caminhoDependabot = path.join(REPO_ROOT, ".github", "dependabot.yml");
const dependabot = existsSync(caminhoDependabot) ? ler(".github", "dependabot.yml") : "";

function job(nome: string): string {
  const inicio = ci.search(new RegExp(`^ {2}${nome}:\\s*$`, "m"));
  if (inicio < 0) return "";
  const resto = ci.slice(inicio + 1);
  const proximo = resto.search(/^ {2}[A-Za-z0-9_-]+:\s*$/m);
  return proximo < 0 ? resto : resto.slice(0, proximo);
}
const passos = (nome: string) => job(nome).split(/^ {6}- /m).slice(1);

describe("CI: npm audit e permissões mínimas (D7)", () => {
  it.each([
    ["backend", "low"],
    ["frontend", "critical"],
  ])("job %s roda npm audit --omit=dev --audit-level=%s depois do npm ci", (nome, nivel) => {
    const lista = passos(nome);
    const iCi = lista.findIndex((p) => /^\s*run:\s*npm ci\s*$/m.test(p));
    const iAudit = lista.findIndex((p) =>
      new RegExp(`^\\s*run:\\s*npm audit --omit=dev --audit-level=${nivel}\\s*$`, "m").test(p),
    );
    expect(iCi).toBeGreaterThanOrEqual(0);
    expect(iAudit).toBeGreaterThan(iCi);
  });

  it("nenhum passo engole falha: sem || true, sem continue-on-error", () => {
    expect(ci).not.toMatch(/\|\|\s*true/);
    expect(ci).not.toMatch(/continue-on-error/);
  });

  it("o workflow declara permissions: contents: read no topo, antes de jobs", () => {
    const topo = ci.slice(0, ci.search(/^jobs:\s*$/m));
    expect(topo).toMatch(/^permissions:\s*\n {2}contents: read\s*$/m);
  });
});

describe("Dependabot (D7)", () => {
  type Entrada = Record<string, string>;
  const entradas: Entrada[] = dependabot
    .split(/^ {2}- /m)
    .slice(1)
    .map((bloco) => ({
      ecossistema: /package-ecosystem:\s*"?([\w-]+)"?/.exec(bloco)?.[1] ?? "",
      diretorio: /directory:\s*"?([^"\n]+)"?/.exec(bloco)?.[1]?.trim() ?? "",
      intervalo: /interval:\s*"?(\w+)"?/.exec(bloco)?.[1] ?? "",
      alvo: /target-branch:\s*"?([\w/-]+)"?/.exec(bloco)?.[1] ?? "",
      limite: /open-pull-requests-limit:\s*(\d+)/.exec(bloco)?.[1] ?? "",
      agrupa: /update-types:\s*\[\s*"minor",\s*"patch"\s*\]/.test(bloco) ? "sim" : "nao",
    }));

  it("cobre npm do backend e do frontend, github-actions na raiz e docker do backend", () => {
    expect(entradas.map((e) => `${e.ecossistema} ${e.diretorio}`).sort()).toEqual(
      ["docker /backend", "github-actions /", "npm /backend", "npm /frontend"].sort(),
    );
  });

  it("toda entrada é semanal, para development, com no máximo 5 PRs e minor e patch agrupados", () => {
    for (const e of entradas) {
      expect(e).toMatchObject({ intervalo: "weekly", alvo: "development", limite: "5", agrupa: "sim" });
    }
  });

  // 2026-10-15: major é decidido à mão (Prisma preso na 5.22 pelo migration_lock.toml, Node na 24 pelo engines e
  // pelo Render). eslint-plugin-react-refresh 0.5 exige ESLint 9 ou 10 e o frontend usa ESLint 8 (npm ci dá ERESOLVE).
  const literal = (texto: string): string => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blocoDe = (ecossistema: string, diretorio: string): string =>
    dependabot
      .split(/^ {2}- /m)
      .find((b) =>
        new RegExp(
          `package-ecosystem:\\s*"?${literal(ecossistema)}"?\\s*\\n\\s*directory:\\s*"?${literal(diretorio)}"?\\s*$`,
          "m",
        ).test(b),
      ) ?? "";
  const ignora = (bloco: string, nome: string, chave: string, valor: string): boolean =>
    bloco
      .split(/^ {6}- /m)
      .slice(1)
      .some(
        (regra) =>
          new RegExp(`^\\s*dependency-name:\\s*"${literal(nome)}"\\s*$`, "m").test(regra) &&
          new RegExp(`^\\s*${literal(chave)}:\\s*\\[\\s*"${literal(valor)}"\\s*\\]\\s*$`, "m").test(regra),
      );

  it.each([
    ["npm", "/backend"],
    ["npm", "/frontend"],
    ["docker", "/backend"],
  ])("%s %s ignora toda atualização major", (ecossistema, diretorio) => {
    expect(ignora(blocoDe(ecossistema, diretorio), "*", "update-types", "version-update:semver-major")).toBe(true);
  });

  it("npm /frontend ignora eslint-plugin-react-refresh a partir de 0.5.0 (exige ESLint 9 ou 10)", () => {
    expect(ignora(blocoDe("npm", "/frontend"), "eslint-plugin-react-refresh", "versions", ">=0.5.0")).toBe(true);
  });

  it("não configura merge automático", () => {
    expect(dependabot).not.toMatch(/auto-?merge/i);
  });
});

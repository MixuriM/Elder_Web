import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { ler, REPO_ROOT, semComentariosYaml } from "../testSupport/repoArquivos";

// Modo demonstração (D2): a flag e a lista de admins só existem no painel do Render, nos dias de evento. Nenhum arquivo
// versionado liga o modo nem traz uid de admin. Teste de contrato com fs e regex (padrão de dockerCi.test.ts).
const render = semComentariosYaml(ler("render.yaml"));
const workflows = readdirSync(path.join(REPO_ROOT, ".github", "workflows")).map((f) => path.join(".github", "workflows", f));
const VERSIONADOS = ["render.yaml", "docker-compose.yml", path.join("backend", "Dockerfile"), path.join("backend", ".env.example"), path.join("frontend", "vercel.json"), ...workflows];

// Bloco de uma variável no envVars do render.yaml: da linha "- key: NOME" até a próxima "- key:".
function blocoDe(nome: string): string {
  const inicio = render.indexOf(`- key: ${nome}\n`);
  if (inicio < 0) return "";
  const resto = render.slice(render.indexOf("\n", inicio) + 1);
  const fim = resto.search(/^ *- key:/m);
  return fim < 0 ? resto : resto.slice(0, fim);
}

describe("modo demonstração na infraestrutura", () => {
  it.each(["DEMO_MODO_ATIVO", "DEMO_ADMIN_UIDS"])("render.yaml declara %s só com sync: false, sem valor", (nome) => {
    const bloco = blocoDe(nome);
    expect(bloco).toMatch(/^\s*sync: false\s*$/m);
    expect(bloco).not.toMatch(/^\s*value:/m);
  });

  it(".env.example traz os nomes sem valor", () => {
    const exemplo = ler("backend", ".env.example");
    expect(exemplo).toMatch(/^DEMO_MODO_ATIVO=$/m);
    expect(exemplo).toMatch(/^DEMO_ADMIN_UIDS=$/m);
  });

  it("nenhum arquivo versionado liga DEMO_MODO_ATIVO nem define DEMO_ADMIN_UIDS", () => {
    for (const arquivo of VERSIONADOS) {
      if (!existsSync(path.join(REPO_ROOT, arquivo))) continue;
      const texto = semComentariosYaml(ler(arquivo)); // comentário pode citar o nome da variável
      // [ \t] e não \s: em "DEMO_MODO_ATIVO=" vazio, \s pularia a quebra de linha e casaria a linha seguinte.
      expect([arquivo, texto]).not.toEqual([arquivo, expect.stringMatching(/DEMO_MODO_ATIVO["']?[ \t]*[:=][ \t]*["']?[^\s"'#]/)]);
      expect([arquivo, texto]).not.toEqual([arquivo, expect.stringMatching(/DEMO_ADMIN_UIDS["']?[ \t]*[:=][ \t]*["']?[^\s"'#]/)]);
      // Formato do render.yaml: key numa linha e value na seguinte.
      expect(texto).not.toMatch(/key: DEMO_(MODO_ATIVO|ADMIN_UIDS)\s*\n\s*value:/);
    }
  });
});

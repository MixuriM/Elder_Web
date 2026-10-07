import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { ler, REPO_ROOT, semComentariosYaml } from "../testSupport/repoArquivos";

// Item 9.4 (segunda linha 9.x da tabela de testes da Fase 9): nenhuma migration é aplicada automaticamente em
// produção, e toda migration nova que crie CHECK ou índice único ganha caso em backend/scripts/verify-constraints.ts
// antes do deploy. Teste de contrato: só fs e regex, sem banco, sem Azure. Lê fora de backend/ a partir da raiz do
// repo, então só roda no host e no CI, não dentro do container do docker-compose.yml.

// ---------------------------------------------------------------------------------------------------------------
// Parte 1: nada aplica migration sozinho
// ---------------------------------------------------------------------------------------------------------------
// prisma generate e prisma validate são permitidos (não tocam o banco). migrate deploy, migrate dev, migrate reset e
// db push alteram o schema do banco.
const COMANDO_PROIBIDO = /\bmigrate\s+(deploy|dev|reset)\b|\bdb\s+push\b/i;

const semComentariosDockerfile = (texto: string) => texto.replace(/^\s*#.*$/gm, "");

function workflows(): string[] {
  return readdirSync(path.join(REPO_ROOT, ".github", "workflows")).filter((f) => /\.ya?ml$/.test(f));
}

describe("nenhuma migration é aplicada automaticamente (9.x)", () => {
  it("o detector pega os comandos proibidos e deixa passar generate e validate (controle do próprio teste)", () => {
    for (const ruim of [
      "npx prisma migrate deploy",
      "prisma migrate dev --name x",
      "npx prisma migrate reset --force",
      "npx prisma db push",
      "PRISMA  MIGRATE   DEPLOY",
    ]) {
      expect(COMANDO_PROIBIDO.test(ruim)).toBe(true);
    }
    for (const bom of ["npx prisma generate", "npx prisma validate", "prisma migrate status", "npm run build"]) {
      expect(COMANDO_PROIBIDO.test(bom)).toBe(false);
    }
  });

  it("render.yaml não roda migrate deploy, migrate dev, migrate reset nem db push (comentários não contam)", () => {
    expect(semComentariosYaml(ler("render.yaml"))).not.toMatch(COMANDO_PROIBIDO);
  });

  it("render.yaml continua subindo o servidor direto, sem passo de migration antes", () => {
    expect(semComentariosYaml(ler("render.yaml"))).toMatch(/^\s*dockerCommand:\s*npm start\s*$/m);
  });

  it("backend/Dockerfile não roda comando de migration", () => {
    expect(semComentariosDockerfile(ler("backend", "Dockerfile"))).not.toMatch(COMANDO_PROIBIDO);
  });

  it("nenhum script do backend/package.json roda comando de migration", () => {
    const { scripts } = JSON.parse(ler("backend", "package.json")) as { scripts: Record<string, string> };
    const proibidos = Object.entries(scripts).filter(([, comando]) => COMANDO_PROIBIDO.test(comando));
    expect(proibidos).toEqual([]);
  });

  it("docker-compose.yml não roda comando de migration", () => {
    expect(semComentariosYaml(ler("docker-compose.yml"))).not.toMatch(COMANDO_PROIBIDO);
  });

  it("existe pelo menos um workflow e nenhum deles roda comando de migration", () => {
    const arquivos = workflows();
    expect(arquivos.length).toBeGreaterThan(0);
    for (const arquivo of arquivos) {
      expect(semComentariosYaml(ler(".github", "workflows", arquivo))).not.toMatch(COMANDO_PROIBIDO);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Parte 2: toda constraint nova tem caso em verify-constraints.ts
// ---------------------------------------------------------------------------------------------------------------
// Linha de base de 07/10/2026: todas as constraints das 7 migrations existentes têm caso em verify-constraints.ts, então
// a lista está vazia. Uma constraint de migration antiga sem caso entraria aqui, com comentário. A lista não cresce sem
// edição consciente: o teste "tamanho" abaixo falha se alguém acrescentar um nome sem trocar a linha de base.
const LEGADO_SEM_CASO: string[] = [];
const TAMANHO_LINHA_DE_BASE = 0;

const MIGRATIONS = path.join(REPO_ROOT, "backend", "prisma", "migrations");

// SQL sem comentários de linha (--) e de bloco. O EXEC('...') continua no texto, então o nome dentro dele é achado.
const semComentariosSql = (sql: string) => sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "");

const RE_CHECK_NOMEADA = /\bCONSTRAINT\s+\[?(\w+)\]?\s+CHECK\b/gi;
const RE_CHECK_QUALQUER = /\bCHECK\s*\(/gi;
const RE_INDICE_UNICO = /\bCREATE\s+UNIQUE\s+(?:(?:NON)?CLUSTERED\s+)?INDEX\s+\[?(\w+)\]?/gi;

type Constraint = { migration: string; nome: string; tipo: "CHECK" | "indice unico" };

function migrationsSql(): { migration: string; sql: string }[] {
  return readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(MIGRATIONS, d.name, "migration.sql")))
    .map((d) => ({ migration: d.name, sql: semComentariosSql(ler("backend", "prisma", "migrations", d.name, "migration.sql")) }));
}

function constraintsDasMigrations(): Constraint[] {
  const achadas: Constraint[] = [];
  for (const { migration, sql } of migrationsSql()) {
    for (const m of sql.matchAll(RE_CHECK_NOMEADA)) achadas.push({ migration, nome: m[1], tipo: "CHECK" });
    for (const m of sql.matchAll(RE_INDICE_UNICO)) achadas.push({ migration, nome: m[1], tipo: "indice unico" });
  }
  return achadas;
}

// Só código: comentário que cita o nome não prova que existe um caso.
const verifyConstraints = ler("backend", "scripts", "verify-constraints.ts")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("toda CHECK e todo índice único de migration tem caso em verify-constraints.ts (9.x)", () => {
  const constraints = constraintsDasMigrations();

  it("o detector acha as constraints (guarda contra a regex quebrar em silêncio)", () => {
    expect(constraints.length).toBeGreaterThanOrEqual(17);
    expect(constraints.map((c) => c.nome)).toEqual(
      expect.arrayContaining(["CK_Usuario_foto_perfil_conjunto", "Usuario_email_key", "CK_Vinculo_status"]),
    );
  });

  it("acha CHECK escrita dentro de EXEC('...') (a migration da foto de perfil)", () => {
    const daFoto = constraints.filter((c) => c.migration.endsWith("_add_foto_perfil"));
    expect(daFoto.map((c) => c.nome)).toContain("CK_Usuario_foto_perfil_conjunto");
  });

  it("toda CHECK tem nome (CONSTRAINT <nome> CHECK), senão não há como exigir o caso", () => {
    for (const { migration, sql } of migrationsSql()) {
      const nomeadas = [...sql.matchAll(RE_CHECK_NOMEADA)].length;
      const total = [...sql.matchAll(RE_CHECK_QUALQUER)].length;
      expect({ migration, checksSemNome: total - nomeadas }).toEqual({ migration, checksSemNome: 0 });
    }
  });

  it("todo nome de constraint de migration aparece em verify-constraints.ts ou está em LEGADO_SEM_CASO", () => {
    const semCaso = constraints
      .filter((c) => !verifyConstraints.includes(c.nome) && !LEGADO_SEM_CASO.includes(c.nome))
      .map((c) => `${c.migration}: ${c.tipo} ${c.nome}`);
    expect(semCaso).toEqual([]);
  });

  it("LEGADO_SEM_CASO não cresce sem edição consciente (linha de base de 07/10/2026)", () => {
    expect(LEGADO_SEM_CASO).toHaveLength(TAMANHO_LINHA_DE_BASE);
  });

  it("todo nome de LEGADO_SEM_CASO ainda existe numa migration e ainda não tem caso (senão sai da lista)", () => {
    const nomes = constraints.map((c) => c.nome);
    for (const nome of LEGADO_SEM_CASO) {
      expect(nomes).toContain(nome);
      expect(verifyConstraints.includes(nome)).toBe(false);
    }
  });
});

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// Trava de regressão de SQL injection: todo acesso ao banco é Prisma Client, que parametriza tudo.
// SQL montado em string só entra pelas variantes Unsafe ou por Prisma.raw, então nenhuma delas pode
// aparecer em backend/src. Em backend/scripts os $queryRaw em tagged template com texto fixo são
// permitidos (smoke e verify), mas a variante Unsafe também não.
const BACKEND = path.resolve(__dirname, "..", "..");
const ESTE_ARQUIVO = path.resolve(__filename);

const RE_UNSAFE = /(query|execute)RawUnsafe/;
const RE_PRISMA_RAW = /Prisma\s*\.\s*raw\b/;

function arquivosTs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : arquivosTs(p);
    return /\.(ts|js|mjs|cjs)$/.test(e.name) && p !== ESTE_ARQUIVO ? [p] : [];
  });
}

// "arquivo:linha: trecho" de cada linha que casa com algum padrão.
function ocorrencias(dir: string, padroes: RegExp[]): string[] {
  return arquivosTs(dir).flatMap((arquivo) =>
    readFileSync(arquivo, "utf8")
      .split(/\r?\n/)
      .flatMap((linha, i) =>
        padroes.some((re) => re.test(linha)) ? [`${path.relative(BACKEND, arquivo)}:${i + 1}: ${linha.trim()}`] : [],
      ),
  );
}

describe("sem SQL cru (D10)", () => {
  it("backend/src não usa $queryRawUnsafe, $executeRawUnsafe nem Prisma.raw", () => {
    expect(arquivosTs(path.join(BACKEND, "src")).length).toBeGreaterThan(10);
    expect(ocorrencias(path.join(BACKEND, "src"), [RE_UNSAFE, RE_PRISMA_RAW])).toEqual([]);
  });

  it("backend/scripts não usa as variantes Unsafe", () => {
    expect(arquivosTs(path.join(BACKEND, "scripts")).length).toBeGreaterThan(0);
    expect(ocorrencias(path.join(BACKEND, "scripts"), [RE_UNSAFE])).toEqual([]);
  });
});

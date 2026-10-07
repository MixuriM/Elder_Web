// Fakes de Prisma e Firebase para autorizacaoRotas.test.ts (item 9.4). Carregados por jest.requireActual
// dentro das fábricas de jest.mock (as fábricas são içadas acima dos imports). Fora do build de produção e
// não coletada como suíte (sem .test). Todos os ids, uids e valores são FICTÍCIOS, só para teste.
//
// O fake FILTRA de verdade pelo where (igualdade e { in: [...] }), como o Prisma: valor undefined é ignorado,
// o que reproduz o fail-open que requireVinculoAprovado fecha. Filtro não suportado lança erro, para o teste
// nunca passar por vacuidade. Limite: um fake em memória não prova o filtro do SQL Server real.

export type Linha = Record<string, unknown>;

export const ESCRITAS = ["create", "createMany", "update", "updateMany", "delete", "deleteMany", "upsert"] as const;

// Tabelas em memória por modelo do Prisma. O teste preenche antes de cada caso.
export const dados: Record<string, Linha[]> = {};

const mocks = new Map<string, jest.Mock>();

function casa(linha: Linha, where: Linha | undefined): boolean {
  for (const [campo, valor] of Object.entries(where ?? {})) {
    if (valor === undefined) continue; // Prisma ignora filtro com valor undefined
    if (valor !== null && typeof valor === "object") {
      const op = valor as { in?: unknown[] };
      if (Object.keys(op).length === 1 && Array.isArray(op.in)) {
        if (!op.in.includes(linha[campo])) return false;
        continue;
      }
      throw new Error(`prismaFake: filtro não suportado em ${campo}`);
    }
    if (linha[campo] !== valor) return false;
  }
  return true;
}

type Args = { where?: Linha; data?: Linha; include?: Linha } | undefined;

function implementacao(modelo: string, metodo: string): (args?: Args) => Promise<unknown> {
  const tabela = () => dados[modelo] ?? [];
  const agora = () => new Date("2026-10-07T12:00:00Z");
  switch (metodo) {
    case "findFirst":
    case "findUnique":
      return async (a) => tabela().find((l) => casa(l, a?.where)) ?? null;
    case "findMany":
      return async (a) => {
        const extras = Object.fromEntries(Object.keys(a?.include ?? {}).map((k) => [k, []]));
        return tabela()
          .filter((l) => casa(l, a?.where))
          .map((l) => ({ ...extras, ...l }));
      };
    case "count":
      return async (a) => tabela().filter((l) => casa(l, a?.where)).length;
    case "create":
      return async (a) => ({ id: 900, created_at: agora(), updated_at: agora(), ...a?.data });
    case "update":
      return async (a) => ({ ...(tabela().find((l) => casa(l, a?.where)) ?? {}), ...a?.data });
    default:
      return async () => ({ count: 1 });
  }
}

function fn(chave: string, impl: () => (args?: Args) => Promise<unknown>): jest.Mock {
  let m = mocks.get(chave);
  if (!m) {
    m = jest.fn((a?: Args) => impl()(a));
    mocks.set(chave, m);
  }
  return m;
}

function modeloFake(modelo: string) {
  return new Proxy({}, { get: (_alvo, metodo) => fn(`${modelo}.${String(metodo)}`, () => implementacao(modelo, String(metodo))) });
}

const modelos = new Map<string, unknown>();

export const prismaFake = new Proxy(
  {},
  {
    get: (_alvo, nome) => {
      const chave = String(nome);
      if (chave.startsWith("$")) {
        return fn(chave, () => async (arg: unknown) =>
          typeof arg === "function" ? (arg as (tx: unknown) => unknown)(prismaFake) : Promise.all(arg as unknown[]),
        );
      }
      if (!modelos.has(chave)) modelos.set(chave, modeloFake(chave));
      return modelos.get(chave);
    },
  },
);

// Total de chamadas a métodos de escrita (e a $transaction) desde a última limpeza.
export function escritasChamadas(): string[] {
  const feitas: string[] = [];
  for (const [chave, m] of mocks) {
    const metodo = chave.split(".").pop() ?? "";
    if ((ESCRITAS as readonly string[]).includes(metodo) || chave === "$transaction") {
      if (m.mock.calls.length > 0) feitas.push(`${chave} x${m.mock.calls.length}`);
    }
  }
  return feitas;
}

// Chamadas a um método do fake desde a última limpeza, ex.: leituras("vinculo.findFirst").
export function leituras(chave: string): number {
  return mocks.get(chave)?.mock.calls.length ?? 0;
}

export function limparChamadas(): void {
  for (const m of mocks.values()) m.mockClear();
  verifyIdToken.mockClear();
}

export function zerarDados(): void {
  for (const k of Object.keys(dados)) delete dados[k];
}

// Firebase: token "t<id>" resolve o uid "uid-<id>"; os demais são casos especiais.
export const TOKEN_REJEITADO = "token-rejeitado"; // code auth/argument-error: 401
export const TOKEN_INDISPONIVEL = "token-indisponivel"; // erro sem code auth/*: 503
export const TOKEN_SEM_USUARIO = "token-sem-usuario"; // identidade válida, sem linha em Usuario: 403

export const tokenDe = (id: number) => `t${id}`;
export const uidDe = (id: number) => `uid-${id}`;

export const verifyIdToken = jest.fn(async (token: string) => {
  if (token === TOKEN_REJEITADO) throw Object.assign(new Error("rejeitado"), { code: "auth/argument-error" });
  if (token === TOKEN_INDISPONIVEL) throw new Error("network");
  if (token === TOKEN_SEM_USUARIO) return { uid: "uid-fantasma", email_verified: true };
  const m = /^t(\d+)$/.exec(token);
  if (!m) throw Object.assign(new Error("desconhecido"), { code: "auth/invalid-id-token" });
  return { uid: uidDe(Number(m[1])), email_verified: true };
});

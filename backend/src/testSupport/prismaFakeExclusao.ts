// Fake de Prisma COM ESTADO para usuarioExcluirConta.test.ts (item 9.5, exclusão de conta). Diferente do fake de
// prismaFakeAutorizacao (que não grava), este grava update/updateMany/delete/deleteMany em `dados` e faz
// $transaction(fn) de verdade: tira um retrato de `dados` e o restaura se `fn` lançar, o que prova a atomicidade.
// Filtra pelo where (igualdade e { in }), como o fake de autorização. Limites aceitos: não prova ordem de FK nem CHECK
// do SQL Server real (isso é papel de scripts/verify-exclusao-conta.ts). Ids e valores FICTÍCIOS, só para teste.
import { casa, dados, type Linha } from "./prismaFakeAutorizacao";

// Registro cronológico das escritas ("modelo.metodo") e do Firebase, para provar a ordem.
export const ordem: string[] = [];
// Opções passadas ao último $transaction.
export const opcoesTransacao: { ultima?: unknown } = {};
// Escrita que deve falhar no próximo uso (ex.: "medicamento.deleteMany").
export const falhas = new Set<string>();

export function zerarEstadoFake(): void {
  ordem.length = 0;
  opcoesTransacao.ultima = undefined;
  falhas.clear();
}

type Args = { where?: Linha; data?: Linha } | undefined;

const tabela = (modelo: string): Linha[] => (dados[modelo] ??= []);

function escrever(modelo: string, metodo: string, fazer: () => unknown): Promise<unknown> {
  const chave = `${modelo}.${metodo}`;
  ordem.push(chave);
  if (falhas.has(chave)) return Promise.reject(Object.assign(new Error("falha-ficticia-de-banco"), { code: "P2034" }));
  return Promise.resolve(fazer());
}

function modeloComEstado(modelo: string) {
  return {
    findFirst: async (a?: Args) => tabela(modelo).find((l) => casa(l, a?.where)) ?? null,
    findUnique: async (a?: Args) => tabela(modelo).find((l) => casa(l, a?.where)) ?? null,
    findMany: async (a?: Args) => tabela(modelo).filter((l) => casa(l, a?.where)),
    count: async (a?: Args) => tabela(modelo).filter((l) => casa(l, a?.where)).length,
    update: (a?: Args) =>
      escrever(modelo, "update", () => {
        const alvo = tabela(modelo).find((l) => casa(l, a?.where));
        if (!alvo) throw Object.assign(new Error("nao encontrado"), { code: "P2025" });
        Object.assign(alvo, a?.data);
        return alvo;
      }),
    updateMany: (a?: Args) =>
      escrever(modelo, "updateMany", () => {
        const alvos = tabela(modelo).filter((l) => casa(l, a?.where));
        for (const l of alvos) Object.assign(l, a?.data);
        return { count: alvos.length };
      }),
    deleteMany: (a?: Args) =>
      escrever(modelo, "deleteMany", () => {
        const fica = tabela(modelo).filter((l) => !casa(l, a?.where));
        const apagadas = tabela(modelo).length - fica.length;
        dados[modelo] = fica;
        return { count: apagadas };
      }),
  };
}

const modelos = new Map<string, ReturnType<typeof modeloComEstado>>();

export const prismaComEstado: unknown = new Proxy(
  {},
  {
    get: (_alvo, nome) => {
      const chave = String(nome);
      if (chave === "$transaction") {
        return async (fn: (tx: unknown) => Promise<unknown>, opcoes?: unknown) => {
          opcoesTransacao.ultima = opcoes;
          const retrato = structuredClone(dados);
          try {
            return await fn(prismaComEstado);
          } catch (e) {
            for (const k of Object.keys(dados)) delete dados[k];
            Object.assign(dados, retrato);
            throw e;
          }
        };
      }
      if (!modelos.has(chave)) modelos.set(chave, modeloComEstado(chave));
      return modelos.get(chave);
    },
  },
);

// Limpeza das contas e2e do Firebase (fechamento do 9.5, F6). Lógica pura, com o Admin SDK injetado: os testes usam um
// duplo, e só scripts/limpar-contas-e2e.ts liga ao Firebase real, à mão e com --confirmo-firebase.
// Nunca devolve nem lança e-mail, uid ou erro bruto do Firebase: só contagens e texto fixo.

export const TETO_POR_EXECUCAO = 500;
const TAMANHO_LOTE = 100; // deleteUsers aceita até 1000; lotes menores limitam o estrago de um erro no meio
const SUFIXO = "@e2e.elderweb.test";
const PREFIXO = "e2e-";

export const MSG_FALHA_FIREBASE =
  "Falha ao falar com o Firebase. Nada foi apagado ou a limpeza ficou pela metade; rode de novo em modo simulação.";

// Padrão exato dos e-mails que os e2e criam (helpers/conta.ts): começa com e2e- e termina no domínio de teste. O Firebase
// guarda e-mail em minúsculas, então maiúscula não é conta dos e2e. Qualquer outro e-mail NUNCA é selecionado.
export function ehContaE2e(email: unknown): boolean {
  return typeof email === "string" && email.length > PREFIXO.length + SUFIXO.length && email.startsWith(PREFIXO) && email.endsWith(SUFIXO);
}

// Só o que o script usa do Admin SDK (auth.listUsers e auth.deleteUsers), para o teste poder trocá-lo.
export type AdminLimpeza = {
  listUsers(maxResults?: number, pageToken?: string): Promise<{ users: { uid: string; email?: string }[]; pageToken?: string }>;
  deleteUsers(uids: string[]): Promise<{ successCount: number; failureCount: number }>;
};

export type ResultadoLimpeza = {
  simulacao: boolean;
  encontradas: number; // todas as contas e2e achadas, mesmo acima do teto
  apagadas: number;
  falhas: number;
  limitadoPeloTeto: boolean;
};

export async function limparContasE2e(admin: AdminLimpeza, { apagar }: { apagar: boolean }): Promise<ResultadoLimpeza> {
  const uids: string[] = [];
  try {
    let token: string | undefined;
    do {
      const pagina = await admin.listUsers(1000, token);
      for (const u of pagina.users) if (ehContaE2e(u.email)) uids.push(u.uid);
      token = pagina.pageToken;
    } while (token);
  } catch {
    throw new Error(MSG_FALHA_FIREBASE);
  }

  const alvo = uids.slice(0, TETO_POR_EXECUCAO);
  const resultado: ResultadoLimpeza = {
    simulacao: !apagar,
    encontradas: uids.length,
    apagadas: 0,
    falhas: 0,
    limitadoPeloTeto: uids.length > TETO_POR_EXECUCAO,
  };
  if (!apagar) return resultado;

  try {
    for (let i = 0; i < alvo.length; i += TAMANHO_LOTE) {
      const r = await admin.deleteUsers(alvo.slice(i, i + TAMANHO_LOTE));
      resultado.apagadas += r.successCount;
      resultado.falhas += r.failureCount;
    }
  } catch {
    throw new Error(MSG_FALHA_FIREBASE);
  }
  return resultado;
}

import { createContext, useContext } from "react";

import type { Aviso } from "../lib/avisos";

// Avisos calculados pelo AvisosProvider (dentro do layout): o sino do cabeçalho e a página /avisos leem a mesma conta.
// compromissos: estado da busca das agendas; os pedidos vêm do AcessoProvider, sem chamada nova.
export type ContextoAvisos = {
  avisos: Aviso[];
  compromissos: "carregando" | "ok" | "erro";
};

// Sem Provider (telas e testes isolados): nenhum aviso.
export const AvisosContext = createContext<ContextoAvisos>({ avisos: [], compromissos: "ok" });

export function useAvisos(): ContextoAvisos {
  return useContext(AvisosContext);
}

import { createContext, useContext } from "react";

// Perfil e vínculos do usuário logado, buscados uma única vez pelo AcessoProvider (dentro do layout).
// estado 'erro' = falhou ao carregar: menu e guardas falham abertos (a barreira real é o 403 do backend).
export type Acesso = {
  tipoPerfil: string | null;
  temVinculoAprovado: boolean;
  temVinculoPendente: boolean;
  estado: "carregando" | "ok" | "erro";
};

export type ContextoAcesso = Acesso & {
  // Nome do perfil, da mesma busca: o cabeçalho não busca o perfil de novo.
  nome?: string | null;
  // Busca perfil e vínculos de novo depois de uma ação que muda o acesso (pedir, aprovar, recusar vínculo).
  // Opcional: sem Provider não há o que recarregar.
  recarregar?: () => void;
};

// Sem Provider (telas e testes isolados): estado 'erro', ou seja, nada é escondido.
export const AcessoContext = createContext<ContextoAcesso>({
  tipoPerfil: null,
  temVinculoAprovado: false,
  temVinculoPendente: false,
  estado: "erro",
});

export function useAcesso(): ContextoAcesso {
  return useContext(AcessoContext);
}

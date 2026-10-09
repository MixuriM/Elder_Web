import { createContext, useContext } from "react";

// Perfil e vínculos do usuário logado, buscados uma única vez pelo AcessoProvider (dentro do layout).
// estado 'erro' = falhou ao carregar: menu e guardas falham abertos (a barreira real é o 403 do backend).
export type Acesso = {
  tipoPerfil: string | null;
  temVinculoAprovado: boolean;
  temVinculoPendente: boolean;
  estado: "carregando" | "ok" | "erro";
};

// Sem Provider (telas e testes isolados): estado 'erro', ou seja, nada é escondido.
export const AcessoContext = createContext<Acesso>({
  tipoPerfil: null,
  temVinculoAprovado: false,
  temVinculoPendente: false,
  estado: "erro",
});

export function useAcesso() {
  return useContext(AcessoContext);
}

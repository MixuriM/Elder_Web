import { createContext, useContext } from "react";

// Só a fatia de estado da foto (não é um AuthContext): mantém /home e /perfil em sincronia
// sem reload. O valor padrão (sem Provider) é "sem foto", pra telas isoladas e testes.
type FotoPerfilContextValue = {
  fotoPerfilUrl: string | null;
  definirFotoPerfil: (url: string | null) => void;
};

export const FotoPerfilContext = createContext<FotoPerfilContextValue>({
  fotoPerfilUrl: null,
  definirFotoPerfil: () => {},
});

export function useFotoPerfil() {
  return useContext(FotoPerfilContext);
}

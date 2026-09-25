import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { useAuthUser } from "../hooks/useAuthUser";
import { buscarFotoPerfil } from "../services/perfilService";

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

export function FotoPerfilProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuthUser();
  const [fotoPerfilUrl, definirFotoPerfil] = useState<string | null>(null);

  // Carrega o valor inicial (GET /usuario/me/foto) quando há alguém logado; zera no logout.
  useEffect(() => {
    let ativo = true;

    if (!usuario) {
      definirFotoPerfil(null);
      return () => {
        ativo = false;
      };
    }

    buscarFotoPerfil()
      .then((url) => {
        if (ativo) definirFotoPerfil(url);
      })
      .catch(() => {});

    return () => {
      ativo = false;
    };
  }, [usuario]);

  return (
    <FotoPerfilContext.Provider value={{ fotoPerfilUrl, definirFotoPerfil }}>
      {children}
    </FotoPerfilContext.Provider>
  );
}

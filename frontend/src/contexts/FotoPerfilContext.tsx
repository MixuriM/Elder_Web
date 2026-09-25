import { useEffect, useState, type ReactNode } from "react";

import { useAuthUser } from "../hooks/useAuthUser";
import { buscarFotoPerfil } from "../services/perfilService";
import { FotoPerfilContext } from "./useFotoPerfil";

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

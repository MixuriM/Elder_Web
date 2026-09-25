import { useEffect, useState, type ReactNode } from "react";

import { useAuthUser } from "../hooks/useAuthUser";
import { buscarFotoPerfil } from "../services/perfilService";
import { FotoPerfilContext } from "./useFotoPerfil";

export function FotoPerfilProvider({ children }: { children: ReactNode }) {
  const { usuario, carregando } = useAuthUser();
  const [fotoPerfilUrl, definirFotoPerfil] = useState<string | null>(null);
  const [resolvida, setResolvida] = useState(false);

  // Carrega o valor inicial (GET /usuario/me/foto) quando há alguém logado; zera no logout.
  useEffect(() => {
    let ativo = true;

    if (!usuario) {
      definirFotoPerfil(null);
      setResolvida(false);
      return () => {
        ativo = false;
      };
    }

    setResolvida(false);
    buscarFotoPerfil()
      .then((url) => {
        if (ativo) definirFotoPerfil(url);
      })
      .catch(() => {})
      .finally(() => {
        if (ativo) setResolvida(true);
      });

    return () => {
      ativo = false;
    };
  }, [usuario]);

  return (
    <FotoPerfilContext.Provider
      value={{ fotoPerfilUrl, carregandoFoto: carregando || (!!usuario && !resolvida), definirFotoPerfil }}
    >
      {children}
    </FotoPerfilContext.Provider>
  );
}

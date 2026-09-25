import { useCallback, useEffect, useState, type ReactNode } from "react";

import { useAuthUser } from "../hooks/useAuthUser";
import { buscarFotoPerfil } from "../services/perfilService";
import { FotoPerfilContext } from "./useFotoPerfil";

// Cache local da última foto conhecida, pra ela aparecer no F5 sem esperar o Firebase e o
// GET /usuario/me/foto. Guarda o uid dono: outra conta nunca herda a foto. Limpo no logout.
// localStorage pode falhar (modo privado, cota): sem cache o comportamento é só o de antes.
const CHAVE_CACHE = "elderweb:fotoPerfil";
type Cache = { uid: string; url: string | null };

function lerCache(): Cache | null {
  try {
    const bruto = localStorage.getItem(CHAVE_CACHE);
    return bruto ? (JSON.parse(bruto) as Cache) : null;
  } catch {
    return null;
  }
}

function gravarCache(cache: Cache | null) {
  try {
    if (cache) localStorage.setItem(CHAVE_CACHE, JSON.stringify(cache));
    else localStorage.removeItem(CHAVE_CACHE);
  } catch {
    // sem cache, segue a vida
  }
}

export function FotoPerfilProvider({ children }: { children: ReactNode }) {
  const { usuario, carregando } = useAuthUser();
  const uid = usuario?.uid ?? null;
  const [inicial] = useState(lerCache);
  const [fotoPerfilUrl, setFotoPerfilUrl] = useState<string | null>(inicial?.url ?? null);
  // "conhecida": já se sabe se há foto (vinda do cache ou do servidor); até lá a UI não mostra iniciais.
  const [conhecida, setConhecida] = useState(inicial !== null);

  const definirFotoPerfil = useCallback(
    (url: string | null) => {
      setFotoPerfilUrl(url);
      setConhecida(true);
      if (uid) gravarCache({ uid, url });
    },
    [uid],
  );

  useEffect(() => {
    let ativo = true;

    if (!uid) {
      // Sessão ainda restaurando (carregando): mantém o cache; deslogado de fato: zera.
      if (!carregando) {
        gravarCache(null);
        setFotoPerfilUrl(null);
        setConhecida(false);
      }
      return () => {
        ativo = false;
      };
    }

    // Cache de outra conta: descarta antes de mostrar.
    const cache = lerCache();
    if (cache && cache.uid !== uid) {
      gravarCache(null);
      setFotoPerfilUrl(null);
      setConhecida(false);
    }

    buscarFotoPerfil()
      .then((url) => {
        if (!ativo) return;
        setFotoPerfilUrl(url);
        gravarCache({ uid, url });
      })
      .catch(() => {})
      .finally(() => {
        if (ativo) setConhecida(true);
      });

    return () => {
      ativo = false;
    };
  }, [uid, carregando]);

  return (
    <FotoPerfilContext.Provider
      value={{ fotoPerfilUrl, carregandoFoto: !conhecida && (carregando || !!uid), definirFotoPerfil }}
    >
      {children}
    </FotoPerfilContext.Provider>
  );
}

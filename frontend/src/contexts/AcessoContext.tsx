import { useEffect, useState, type ReactNode } from "react";

import { chamarApi } from "../lib/chamarApi";
import { buscarPerfil } from "../services/perfilService";
import { AcessoContext, type Acesso } from "./useAcesso";

// Nem buscarPerfil nem chamarApi têm timeout (mesmo limite de useIdososVinculados): 60 s cobre o cold
// start do Render free e impede o menu de ficar em "carregando" para sempre.
const TIMEOUT_MS = 60_000;

type VinculoApi = { status: string; papel_do_chamador: string };

async function buscar(): Promise<Acesso> {
  const perfil = await buscarPerfil();
  const tipoPerfil = perfil.tipo_perfil;
  const base = { tipoPerfil, temVinculoAprovado: false, temVinculoPendente: false };

  // Idoso nunca é bloqueado: não precisa dos vínculos para decidir nada.
  if (tipoPerfil === "idoso") return { ...base, estado: "ok" };

  try {
    const corpo = await chamarApi("/vinculo");
    // Só os vínculos em que a própria pessoa é o cuidador ou familiar contam como acesso dela.
    const proprios = (corpo.vinculos as VinculoApi[]).filter((v) => v.papel_do_chamador === "vinculado");
    return {
      ...base,
      temVinculoAprovado: proprios.some((v) => v.status === "aprovado"),
      temVinculoPendente: proprios.some((v) => v.status === "pendente"),
      estado: "ok",
    };
  } catch {
    // Perfil conhecido, vínculos não: o menu mostra o completo do perfil (D3).
    return { ...base, estado: "erro" };
  }
}

export function AcessoProvider({ children }: { children: ReactNode }) {
  const [acesso, setAcesso] = useState<Acesso>({
    tipoPerfil: null,
    temVinculoAprovado: false,
    temVinculoPendente: false,
    estado: "carregando",
  });

  useEffect(() => {
    let ativo = true;
    let timer: ReturnType<typeof setTimeout>;
    const limite = new Promise<never>((_, rejeitar) => {
      timer = setTimeout(() => rejeitar(new Error("timeout")), TIMEOUT_MS);
    });

    Promise.race([buscar(), limite])
      // Nunca loga o erro: a mensagem do backend pode trazer dado do vínculo.
      .catch((): Acesso => ({ tipoPerfil: null, temVinculoAprovado: false, temVinculoPendente: false, estado: "erro" }))
      .then((resultado) => {
        clearTimeout(timer);
        if (ativo) setAcesso(resultado);
      });

    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, []);

  return <AcessoContext.Provider value={acesso}>{children}</AcessoContext.Provider>;
}

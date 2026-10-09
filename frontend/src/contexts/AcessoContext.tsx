import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { chamarApi } from "../lib/chamarApi";
import { buscarPerfil } from "../services/perfilService";
import type { Vinculo } from "../components/Vinculos/CardVinculo";
import { AcessoContext, type Acesso, type ContextoAcesso } from "./useAcesso";

// Nem buscarPerfil nem chamarApi têm timeout (mesmo limite de useIdososVinculados): 60 s cobre o cold
// start do Render free e impede o menu de ficar em "carregando" para sempre.
const TIMEOUT_MS = 60_000;

type Resultado = Acesso & Pick<ContextoAcesso, "vinculos" | "modoDecisao"> & { nome: string | null };

async function buscar(): Promise<Resultado> {
  const perfil = await buscarPerfil();
  const tipoPerfil = perfil.tipo_perfil;
  const base = {
    tipoPerfil,
    nome: perfil.nome ?? null,
    modoDecisao: perfil.modo_decisao === "familiar" ? ("familiar" as const) : ("idoso" as const),
    temVinculoAprovado: false,
    temVinculoPendente: false,
    vinculos: null,
  };

  let vinculos: Vinculo[];
  try {
    vinculos = (await chamarApi("/vinculo")).vinculos;
  } catch {
    // Idoso nunca é bloqueado: sem os vínculos só os avisos de pedido ficam desconhecidos.
    // Perfil conhecido, vínculos não: o menu mostra o completo do perfil (D3).
    return { ...base, estado: tipoPerfil === "idoso" ? "ok" : "erro" };
  }

  // Só os vínculos em que a própria pessoa é o cuidador ou familiar contam como acesso dela.
  const proprios = vinculos.filter((v) => v.papel_do_chamador === "vinculado");
  return {
    ...base,
    vinculos,
    temVinculoAprovado: proprios.some((v) => v.status === "aprovado"),
    temVinculoPendente: proprios.some((v) => v.status === "pendente"),
    estado: "ok",
  };
}

export function AcessoProvider({ children }: { children: ReactNode }) {
  const [acesso, setAcesso] = useState<Resultado>({
    tipoPerfil: null,
    nome: null,
    temVinculoAprovado: false,
    temVinculoPendente: false,
    vinculos: null,
    estado: "carregando",
  });
  const [versao, setVersao] = useState(0);
  // Recarga silenciosa: o acesso anterior fica na tela até a nova resposta (o menu não pisca).
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  useEffect(() => {
    let ativo = true;
    let timer: ReturnType<typeof setTimeout>;
    const limite = new Promise<never>((_, rejeitar) => {
      timer = setTimeout(() => rejeitar(new Error("timeout")), TIMEOUT_MS);
    });

    Promise.race([buscar(), limite])
      // Nunca loga o erro: a mensagem do backend pode trazer dado do vínculo.
      .catch((): Resultado => ({
        tipoPerfil: null,
        nome: null,
        temVinculoAprovado: false,
        temVinculoPendente: false,
        vinculos: null,
        estado: "erro",
      }))
      .then((resultado) => {
        clearTimeout(timer);
        if (ativo) setAcesso(resultado);
      });

    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [versao]);

  const valor = useMemo((): ContextoAcesso => ({ ...acesso, recarregar }), [acesso, recarregar]);
  return <AcessoContext.Provider value={valor}>{children}</AcessoContext.Provider>;
}

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { chamarApi } from "../lib/chamarApi";
import { calcularAvisos, type AgendaDoIdoso } from "../lib/avisos";
import { idososDoAcesso } from "../lib/resumoDia";
import { useAcesso } from "./useAcesso";
import { AvisosContext, type ContextoAvisos } from "./useAvisos";

type Busca = { estado: ContextoAvisos["compromissos"]; agendas: AgendaDoIdoso[] };

// Uma busca de agenda por idoso (o idoso, a própria). Pedidos de vínculo vêm do AcessoProvider, sem chamada nova.
// ponytail: busca de novo só quando o acesso muda (login, ação de vínculo); compromisso criado na sessão aparece
// no sino ao recarregar a página.
export function AvisosProvider({ children }: { children: ReactNode }) {
  const acesso = useAcesso();
  const lista = idososDoAcesso(acesso);
  const alvos = lista.ehIdoso
    ? [{ idosoNome: null, caminho: "/agenda" }]
    : lista.idosos.map((i) => ({ idosoNome: i.nome, caminho: `/agenda/idoso/${i.id}` }));
  // String como dependência: a lista é recriada a cada render, o conteúdo não.
  const chave = lista.estado === "ok" ? JSON.stringify(alvos) : lista.estado;
  const [busca, setBusca] = useState<Busca>({ estado: "carregando", agendas: [] });

  useEffect(() => {
    if (chave === "carregando" || chave === "erro") {
      setBusca({ estado: chave, agendas: [] });
      return;
    }
    let ativo = true;
    const pedidos: { idosoNome: string | null; caminho: string }[] = JSON.parse(chave);
    // Nunca loga o erro nem o corpo: título de compromisso médico pode ser dado de saúde (RNF-001).
    Promise.all(
      pedidos.map(async ({ idosoNome, caminho }) => ({
        idosoNome,
        eventos: (await chamarApi(caminho, { method: "GET" })).eventos,
      })),
    )
      .then((agendas) => ativo && setBusca({ estado: "ok", agendas }))
      .catch(() => ativo && setBusca({ estado: "erro", agendas: [] }));
    return () => {
      ativo = false;
    };
  }, [chave]);

  const { tipoPerfil, modoDecisao, vinculos } = acesso;
  const valor = useMemo((): ContextoAvisos => {
    let avisos;
    try {
      avisos = calcularAvisos({ tipoPerfil, modoDecisao, vinculos, agendas: busca.agendas });
    } catch {
      // Data inválida vinda da agenda: só os pedidos.
      return { avisos: calcularAvisos({ tipoPerfil, modoDecisao, vinculos, agendas: [] }), compromissos: "erro" };
    }
    return { avisos, compromissos: busca.estado };
  }, [tipoPerfil, modoDecisao, vinculos, busca]);

  return <AvisosContext.Provider value={valor}>{children}</AvisosContext.Provider>;
}

import { useCallback, useEffect, useState } from "react";

import { chamarApi } from "../../lib/chamarApi";
import type { ModoDecisao } from "./regrasVinculo";

// Campos de quem decide por esta conta, como GET /usuario/me e PATCH /usuario/me/modo-decisao devolvem.
export type EstadoDecisao = {
  modo_decisao: string | null;
  modo_decisao_solicitado: string | null;
  modo_decisao_solicitado_por_id: number | null;
  modo_decisao_expira_em: string | null;
  modo_decisao_segunda_confirmacao_id: number | null;
  modo_decisao_alterado_em: string | null;
  modo_decisao_motivo: string | null;
};

// NULL vale "idoso", igual ao backend.
export function modoDe(estado: EstadoDecisao | null): ModoDecisao {
  return estado?.modo_decisao === "familiar" ? "familiar" : "idoso";
}

// Só o idoso lê o próprio estado (o familiar não tem rota para ler o do idoso). `ativo` falso: nada é buscado.
// Se a busca falhar, `pronto` fica verdadeiro com estado nulo: as telas falham abertas e o 403 do backend barra.
export function useEstadoDecisao(ativo: boolean) {
  const [estado, setEstado] = useState<EstadoDecisao | null>(null);
  const [carregou, setCarregou] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      setEstado(await chamarApi("/usuario/me"));
    } catch {
      // Sem log: a resposta pode trazer dado do usuário.
    } finally {
      setCarregou(true);
    }
  }, []);

  useEffect(() => {
    if (ativo) void recarregar();
  }, [ativo, recarregar]);

  return { estado, pronto: !ativo || carregou, atualizar: setEstado, recarregar };
}

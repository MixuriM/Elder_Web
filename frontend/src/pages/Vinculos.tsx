import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { chamarApi } from "../lib/chamarApi";
import { useAcesso } from "../contexts/useAcesso";

import AdicionarPessoa from "../components/Vinculos/AdicionarPessoa";
import CabecalhoVinculos from "../components/Vinculos/CabecalhoVinculos";
import ListaVinculos from "../components/Vinculos/ListaVinculos";
import ModoDecisao from "../components/Vinculos/ModoDecisao";
import ModalVinculo from "../components/Vinculos/ModalVinculo";
import ResumoVinculos from "../components/Vinculos/ResumoVinculos";
import SolicitacoesPendentes from "../components/Vinculos/SolicitacoesPendentes";
import { acoesDoPerfil, temAutoridade, type TipoVinculo } from "../components/Vinculos/regrasVinculo";
import { modoDe, useEstadoDecisao } from "../components/Vinculos/useEstadoDecisao";
import type { Vinculo } from "../components/Vinculos/CardVinculo";
import { useTitulo } from "../hooks/useTitulo";
import { AVISO_SEM_VINCULO } from "../lib/avisoSemVinculo";

const TEXTOS: Record<
  TipoVinculo,
  { titulo: string; descricao: string; vazio: { titulo: string; texto: string }; comoEntra: string }
> = {
  familiar: {
    titulo: "Família",
    descricao: "Familiares ligados aos cuidados do idoso.",
    vazio: {
      titulo: "Nenhum familiar vinculado",
      texto: "Quando um familiar for vinculado, ele aparecerá aqui.",
    },
    comoEntra:
      "Para um familiar aparecer aqui, o familiar pede o vínculo usando o seu e-mail e você responde ao pedido.",
  },
  cuidador: {
    titulo: "Cuidadores",
    descricao: "Cuidadores que ajudam nos cuidados do idoso.",
    vazio: {
      titulo: "Nenhum cuidador vinculado",
      texto: "Quando um cuidador for vinculado, ele aparecerá aqui.",
    },
    comoEntra:
      "Para um cuidador aparecer aqui, o cuidador pede o vínculo usando o seu e-mail e você responde ao pedido.",
  },
};

export default function Vinculos({ tipo }: { tipo: TipoVinculo }) {
  const textos = TEXTOS[tipo];
  useTitulo(textos.titulo);
  // Vindo da guarda RotaComVinculo: só um sinal no state, o texto é fixo.
  const semVinculo = (useLocation().state as { semVinculo?: boolean } | null)?.semVinculo === true;
  const { tipoPerfil } = useAcesso();
  const acoes = acoesDoPerfil(tipoPerfil, tipo);
  const decisao = useEstadoDecisao(tipoPerfil === "idoso");
  const modoDoIdoso = modoDe(decisao.estado);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);

  // silencioso: recarga depois de uma ação, sem trocar a lista por "Carregando".
  async function carregarVinculos(silencioso = false) {
    if (!silencioso) setCarregando(true);
    setErro(null);

    try {
      const corpo = await chamarApi("/vinculo");

      setVinculos(corpo.vinculos ?? []);
    } catch (err) {
      setErro(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar seus vínculos."
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarVinculos();
  }, []);

  const doTipo = vinculos.filter((v) => v.tipo_vinculo === tipo);
  // O pedido que a pessoa pode decidir aparece só na seção de pedidos, não de novo na lista.
  const naLista = doTipo.filter(
    (v) => !(decisao.pronto && v.status === "pendente" && temAutoridade(v, tipoPerfil, modoDoIdoso))
  );

  return (
    <div
      className="
        flex-1
        bg-[#FAFAFF]
        px-4 py-8
        dark:bg-[#10101A]
        sm:px-6 lg:px-8
      "
    >
      <div className="mx-auto max-w-7xl space-y-10">
        {semVinculo && (
          <p
            role="status"
            className="rounded-xl border border-[#DDD7FF] bg-[#F3F0FF] p-4 text-lg font-semibold text-[#071A38] dark:border-[#454A63] dark:bg-[#242A4A] dark:text-white"
          >
            {AVISO_SEM_VINCULO}
          </p>
        )}

        <CabecalhoVinculos
          titulo={textos.titulo}
          descricao={textos.descricao}
          onAdicionar={acoes.length > 0 ? () => setModalAberto(true) : undefined}
        />

        {tipoPerfil === "idoso" && (
          <p className="text-lg text-gray-700 dark:text-gray-200">{textos.comoEntra}</p>
        )}

        <ResumoVinculos tipo={tipo} vinculos={doTipo} />

        {decisao.pronto && (
          <SolicitacoesPendentes
            vinculos={doTipo}
            tipoPerfil={tipoPerfil}
            modoDoIdoso={modoDoIdoso}
            onResolvido={() => carregarVinculos(true)}
          />
        )}

        {tipo === "familiar" && <ModoDecisao tipoPerfil={tipoPerfil} vinculos={vinculos} decisao={decisao} />}

        <ListaVinculos
          vinculos={naLista}
          vazio={textos.vazio}
          carregando={carregando}
          erro={erro}
        />
      </div>

      <ModalVinculo aberto={modalAberto} titulo="Adicionar pessoa" onFechar={() => setModalAberto(false)}>
        <AdicionarPessoa
          tipo={tipo}
          acoes={acoes}
          onConcluido={() => carregarVinculos(true)}
          onFechar={() => setModalAberto(false)}
        />
      </ModalVinculo>
    </div>
  );
}

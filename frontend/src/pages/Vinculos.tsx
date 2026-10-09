import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { chamarApi } from "../lib/chamarApi";

import CabecalhoVinculos from "../components/Vinculos/CabecalhoVinculos";
import ListaVinculos from "../components/Vinculos/ListaVinculos";
import type { Vinculo } from "../components/Vinculos/CardVinculo";
import { useTitulo } from "../hooks/useTitulo";
import { AVISO_SEM_VINCULO } from "../lib/avisoSemVinculo";

type TipoVinculo = "familiar" | "cuidador";

const TEXTOS: Record<
  TipoVinculo,
  { titulo: string; descricao: string; vazio: { titulo: string; texto: string } }
> = {
  familiar: {
    titulo: "Família",
    descricao: "Familiares ligados aos cuidados do idoso.",
    vazio: {
      titulo: "Nenhum familiar vinculado",
      texto: "Quando um familiar for vinculado, ele aparecerá aqui.",
    },
  },
  cuidador: {
    titulo: "Cuidadores",
    descricao: "Cuidadores que ajudam nos cuidados do idoso.",
    vazio: {
      titulo: "Nenhum cuidador vinculado",
      texto: "Quando um cuidador for vinculado, ele aparecerá aqui.",
    },
  },
};

export default function Vinculos({ tipo }: { tipo: TipoVinculo }) {
  const textos = TEXTOS[tipo];
  useTitulo(textos.titulo);
  // Vindo da guarda RotaComVinculo: só um sinal no state, o texto é fixo.
  const semVinculo = (useLocation().state as { semVinculo?: boolean } | null)?.semVinculo === true;
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function carregarVinculos() {
    setCarregando(true);
    setErro(null);

    try {
      const corpo = await chamarApi("/vinculo");

      setVinculos(corpo.vinculos ?? []);
    } catch (err) {
      console.error("Falha ao carregar vínculos:", err);

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

  function abrirAdicionarPessoa() {
    // Depois vamos abrir o modal de adicionar
    console.log("Adicionar pessoa");
  }

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
          onAdicionar={abrirAdicionarPessoa}
        />

        <ListaVinculos
          vinculos={vinculos.filter((v) => v.tipo_vinculo === tipo)}
          vazio={textos.vazio}
          carregando={carregando}
          erro={erro}
        />
      </div>
    </div>
  );
}
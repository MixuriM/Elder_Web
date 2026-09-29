import { useEffect, useState } from "react";

import { chamarApi } from "../lib/chamarApi";

import CabecalhoVinculos from "../components/Vinculos/CabecalhoVinculos";
import ListaVinculos from "../components/Vinculos/ListaVinculos";

import type { Vinculo } from "../components/Vinculos/CardVinculo";

export default function Vinculos() {
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

  function abrirDetalhes(vinculo: Vinculo) {
    // Depois vamos abrir o modal de detalhes
    console.log("Vínculo selecionado:", vinculo);
  }

  return (
    <main
      className="
        min-h-screen
        bg-[#FAFAFF]
        px-4 py-8
        dark:bg-[#10101A]
        sm:px-6 lg:px-8
      "
    >
      <div className="mx-auto max-w-7xl space-y-10">
        <CabecalhoVinculos
          onAdicionar={abrirAdicionarPessoa}
        />

        <ListaVinculos
          vinculos={vinculos}
          carregando={carregando}
          erro={erro}
          onVerDetalhes={abrirDetalhes}
        />
      </div>
    </main>
  );
}
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import DetalhesVinculo from "../components/Vinculos/DetalhesVinculo";
import CabecalhoDetalheVinculo from "../components/Vinculos/CabecalhoDetalheVinculo";
import type { Vinculo } from "../components/Vinculos/CardVinculo";
import { chamarApi } from "../lib/chamarApi";

export default function VinculoDetalhe() {
  const { id } = useParams();
  const [vinculo, setVinculo] = useState<Vinculo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    const idNumerico = Number(id);

    async function carregarVinculo() {
      if (!id || !Number.isInteger(idNumerico) || idNumerico <= 0) {
        setErro("Vínculo não encontrado ou sem acesso.");
        setCarregando(false);
        return;
      }

      try {
        const corpo = await chamarApi("/vinculo");
        const encontrado = corpo.vinculos?.find(
          (item: Vinculo) => item.id === idNumerico
        );

        if (ativo) {
          if (encontrado) {
            setVinculo(encontrado);
          } else {
            setErro("Vínculo não encontrado ou sem acesso.");
          }
        }
      } catch (err) {
        if (ativo) {
          setErro(
            err instanceof Error
              ? err.message
              : "Não foi possível carregar os detalhes do vínculo."
          );
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    carregarVinculo();
    return () => {
      ativo = false;
    };
  }, [id]);

  if (carregando) {
    return (
      <main className="min-h-screen bg-[#FAFAFF] px-4 py-8 dark:bg-[#10101A] sm:px-6 lg:px-8">
        <CabecalhoDetalheVinculo />
        <div className="flex min-h-[60vh] items-center justify-center">
          <p role="status" className="text-lg text-gray-700 dark:text-gray-200">
            Carregando detalhes do vínculo...
          </p>
        </div>
      </main>
    );
  }

  if (erro || !vinculo) {
    return (
      <main className="min-h-screen bg-[#FAFAFF] px-4 py-8 dark:bg-[#10101A] sm:px-6 lg:px-8">
        <CabecalhoDetalheVinculo />
        <section className="mx-auto max-w-2xl space-y-5 rounded-3xl bg-white p-6 shadow dark:bg-[#151B35]">
          <h1 className="text-2xl font-bold text-[#071A38] dark:text-white">
            Detalhes do vínculo
          </h1>
          <p role="alert" className="text-lg text-red-700 dark:text-red-300">
            {erro ?? "Vínculo não encontrado ou sem acesso."}
          </p>
        </section>
      </main>
    );
  }

  return <DetalhesVinculo vinculo={vinculo} />;
}

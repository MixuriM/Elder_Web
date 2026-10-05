import { useCallback, useEffect, useState } from "react";

import { ArrowLeft, Pill, Plus, RefreshCw } from "lucide-react";

import { useNavigate } from "react-router-dom";

import { chamarApi } from "../lib/chamarApi";
import { usePermissoesDose } from "../lib/permissoesDose";

import ControleTema from "../components/layout/ControleTema";
import Spinner from "../components/common/Spinner";

import AvisoPermissaoDose from "../components/Remedios/AvisoPermissaoDose";

import CardMedicamento, {
  type MedicamentoCard,
} from "../components/Remedios/CardMedicamento";

import ExportarHistorico from "../components/Remedios/ExportarHistorico";

import HistoricoDoses, {
  type DoseHistorico,
} from "../components/Remedios/HistoricoDoses";

import ModalMarcarDose from "../components/Remedios/ModalMarcarDose";
import ModalMedicamento from "../components/Remedios/ModalMedicamento";

interface Medicamento extends MedicamentoCard {
  doses: DoseHistorico[];
}

interface RespostaMedicamentos {
  medicamentos: Medicamento[];
}

export default function Remedios() {
  const navigate = useNavigate();

  const permissoes = usePermissoesDose();

  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);

  const [carregando, setCarregando] = useState(true);

  const [erro, setErro] = useState<string | null>(null);

  const [modalMedicamentoAberto, setModalMedicamentoAberto] = useState(false);

  const [modalDoseAberto, setModalDoseAberto] = useState(false);

  const [medicamentoSelecionado, setMedicamentoSelecionado] =
    useState<Medicamento | null>(null);

  const [medicamentoDetalhes, setMedicamentoDetalhes] =
    useState<Medicamento | null>(null);

  /**
   * Por enquanto vazio = usuário visualizando
   * os próprios medicamentos.
   *
   * Depois esse ID poderá vir automaticamente
   * do vínculo selecionado pelo cuidador/familiar.
   */
  const idosoId = "";

  const carregarMedicamentos = useCallback(async () => {
    setErro(null);
    setCarregando(true);

    try {
      const caminho = idosoId ? `/remedios/idoso/${idosoId}` : "/remedios";

      const resposta = (await chamarApi(caminho, {
        method: "GET",
      })) as RespostaMedicamentos;

      setMedicamentos(resposta.medicamentos ?? []);
    } catch (err) {
      setErro(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar os medicamentos.",
      );
    } finally {
      setCarregando(false);
    }
  }, [idosoId]);

  useEffect(() => {
    void carregarMedicamentos();
  }, [carregarMedicamentos]);

  function abrirDose(medicamento: MedicamentoCard) {
    const encontrado =
      medicamentos.find((item) => item.id === medicamento.id) ?? null;

    setMedicamentoSelecionado(encontrado);
    setModalDoseAberto(true);
  }

  function fecharDose() {
    setModalDoseAberto(false);
    setMedicamentoSelecionado(null);
  }

  function abrirDetalhes(medicamento: MedicamentoCard) {
    const encontrado =
      medicamentos.find((item) => item.id === medicamento.id) ?? null;

    setMedicamentoDetalhes(encontrado);
  }

  function fecharDetalhes() {
    setMedicamentoDetalhes(null);
  }

  async function atualizarDepoisDaDose() {
    await carregarMedicamentos();
  }

  return (
    <main
      className="
        min-h-screen
        bg-[#F8F9FC]
        px-4
        py-6
        transition-colors
        duration-200

        dark:bg-[#10101A]

        sm:px-6
        sm:py-8

        lg:px-8
      "
    >
      <div className="mx-auto w-full max-w-6xl">
        {/* NAVEGAÇÃO SUPERIOR */}

        <div className="mb-7 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Voltar para a página anterior"
            className="
              inline-flex
              h-11
              items-center
              justify-center
              gap-2
              rounded-xl
              border
              border-gray-300
              bg-white
              px-4
              text-sm
              font-semibold
              text-[#071A38]
              shadow-sm
              transition-all
              duration-200

              hover:border-[#A18BFF]
              hover:bg-[#F3F0FF]
              hover:text-[#6C63FF]

              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-[#6C63FF]/30

              dark:border-[#454558]
              dark:bg-[#2B2C3B]
              dark:text-[#F5F5FA]

              dark:hover:border-[#66667A]
              dark:hover:bg-[#373849]
              dark:hover:text-[#A89FFF]
            "
          >
            <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />

            <span className="hidden sm:inline">Voltar</span>
          </button>

          <ControleTema responsivo />
        </div>

        {/* CABEÇALHO */}

        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-semibold text-[#6C63FF] dark:text-[#A89FFF]">
              Cuidado e acompanhamento
            </p>

            <h1 className="mt-1 text-3xl font-bold text-[#071A38] dark:text-[#F5F5FA] sm:text-4xl">
              Medicamentos
            </h1>

            <p className="mt-2 max-w-2xl text-[#56657D] dark:text-[#C7C7D1]">
              Organize seus medicamentos, registre doses e acompanhe seu
              histórico.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setModalMedicamentoAberto(true)}
            className="
              flex
              min-h-12
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-[#6C63FF]
              px-5
              py-3
              font-semibold
              text-white
              shadow-sm
              transition

              hover:bg-[#5A52E8]

              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-[#6C63FF]/40
              focus-visible:ring-offset-2

              dark:ring-offset-[#10101A]
            "
          >
            <Plus size={20} aria-hidden="true" />
            Adicionar medicamento
          </button>
        </header>

        {/* PERMISSÕES */}

        <div className="mb-6">
          <AvisoPermissaoDose permissoes={permissoes} />
        </div>

        {/* ERRO */}

        {erro && (
          <div
            role="alert"
            className="
              mb-6
              flex
              flex-col
              gap-3
              rounded-2xl
              border
              border-red-200
              bg-red-50
              p-4
              text-red-700

              sm:flex-row
              sm:items-center
              sm:justify-between

              dark:border-red-900/50
              dark:bg-red-950/20
              dark:text-red-300
            "
          >
            <span>{erro}</span>

            <button
              type="button"
              onClick={() => void carregarMedicamentos()}
              className="
                inline-flex
                items-center
                gap-2
                font-semibold
                transition
                hover:opacity-80
              "
            >
              <RefreshCw size={17} aria-hidden="true" />
              Tentar novamente
            </button>
          </div>
        )}

        {/* CARREGANDO */}

        {carregando && (
          <div
            role="status"
            className="
              flex
              min-h-52
              items-center
              justify-center
              gap-3
              text-[#56657D]

              dark:text-[#C7C7D1]
            "
          >
            <Spinner />

            <span>Carregando medicamentos...</span>
          </div>
        )}

        {/* SEM MEDICAMENTOS */}

        {!carregando && !erro && medicamentos.length === 0 && (
          <section
            className="
                rounded-3xl
                border
                border-dashed
                border-[#D9DCE8]
                bg-white
                px-6
                py-12
                text-center
                shadow-sm
                transition-colors

                dark:border-[#393947]
                dark:bg-[#171721]
              "
          >
            <div
              className="
                  mx-auto
                  flex
                  h-16
                  w-16
                  items-center
                  justify-center
                  rounded-2xl
                  bg-[#F3F0FF]
                  text-[#6C63FF]

                  dark:bg-[#29243F]
                  dark:text-[#A89FFF]
                "
            >
              <Pill size={30} aria-hidden="true" />
            </div>

            <h2 className="mt-5 text-xl font-bold text-[#071A38] dark:text-[#F5F5FA]">
              Nenhum medicamento cadastrado
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#56657D] dark:text-[#C7C7D1]">
              Adicione seu primeiro medicamento para começar a acompanhar suas
              doses.
            </p>

            <button
              type="button"
              onClick={() => setModalMedicamentoAberto(true)}
              className="
                  mt-6
                  inline-flex
                  min-h-12
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  bg-[#6C63FF]
                  px-5
                  py-3
                  font-semibold
                  text-white
                  shadow-sm
                  transition

                  hover:bg-[#5A52E8]
                "
            >
              <Plus size={19} aria-hidden="true" />
              Adicionar medicamento
            </button>
          </section>
        )}

        {/* LISTA DE MEDICAMENTOS */}

        {!carregando && !erro && medicamentos.length > 0 && (
          <section aria-labelledby="titulo-meus-medicamentos">
            <div className="mb-5">
              <h2
                id="titulo-meus-medicamentos"
                className="text-2xl font-bold text-[#071A38] dark:text-[#F5F5FA]"
              >
                Meus medicamentos
              </h2>

              <p className="mt-1 text-sm text-[#56657D] dark:text-[#C7C7D1]">
                {medicamentos.length}{" "}
                {medicamentos.length === 1
                  ? "medicamento cadastrado"
                  : "medicamentos cadastrados"}
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {medicamentos.map((medicamento) => (
                <CardMedicamento
                  key={medicamento.id}
                  medicamento={medicamento}
                  onMarcarDose={abrirDose}
                  onVerDetalhes={abrirDetalhes}
                />
              ))}
            </div>
          </section>
        )}

        {/* HISTÓRICO DO MEDICAMENTO */}

        {medicamentoDetalhes && (
          <section
            className="
              mt-8
              rounded-3xl
              border
              border-[#E7E7EF]
              bg-white
              p-5
              shadow-sm
              transition-colors

              sm:p-6

              dark:border-[#393947]
              dark:bg-[#171721]
            "
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[#6C63FF] dark:text-[#A89FFF]">
                  Histórico de doses
                </p>

                <h2 className="mt-1 text-2xl font-bold text-[#071A38] dark:text-[#F5F5FA]">
                  {medicamentoDetalhes.nome}
                </h2>

                <p className="mt-1 text-sm text-[#56657D] dark:text-[#C7C7D1]">
                  {medicamentoDetalhes.dosagem}
                  {" • "}
                  {medicamentoDetalhes.frequencia}
                </p>
              </div>

              <button
                type="button"
                onClick={fecharDetalhes}
                className="
                  shrink-0
                  rounded-xl
                  border
                  border-[#D9DCE8]
                  bg-white
                  px-4
                  py-2
                  text-sm
                  font-semibold
                  text-[#56657D]
                  transition

                  hover:border-[#A18BFF]
                  hover:bg-[#F3F0FF]
                  hover:text-[#6C63FF]

                  dark:border-[#454558]
                  dark:bg-[#20202A]
                  dark:text-[#C7C7D1]

                  dark:hover:border-[#66667A]
                  dark:hover:bg-[#292933]
                  dark:hover:text-[#A89FFF]
                "
              >
                Fechar
              </button>
            </div>

            <HistoricoDoses doses={medicamentoDetalhes.doses} />
          </section>
        )}

        {/* EXPORTAR PDF */}

        <div className="mt-8">
          <ExportarHistorico idosoId={idosoId || undefined} />
        </div>
      </div>

      {/* MODAL DE CADASTRO */}

      <ModalMedicamento
        aberto={modalMedicamentoAberto}
        onFechar={() => {
          setModalMedicamentoAberto(false);

          void carregarMedicamentos();
        }}
        comIdoso={Boolean(idosoId)}
      />

      {/* MODAL DE DOSE */}

      <ModalMarcarDose
        aberto={modalDoseAberto}
        medicamento={medicamentoSelecionado}
        idosoId={idosoId || undefined}
        onFechar={fecharDose}
        onSucesso={() => {
          void atualizarDepoisDaDose();
        }}
      />
    </main>
  );
}

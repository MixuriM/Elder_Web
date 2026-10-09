import { useCallback, useEffect, useState } from "react";

import { Pill, Plus, RefreshCw } from "lucide-react";


import { useIdososVinculados } from "../hooks/useIdososVinculados";
import { chamarApi } from "../lib/chamarApi";
import { usePermissoesDose } from "../lib/permissoesDose";

import SeletorIdoso from "../components/common/SeletorIdoso";
import { envioBloqueado } from "../lib/regrasIdosoVinculado";
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
import { useTitulo } from "../hooks/useTitulo";
import { useAcesso } from "../contexts/useAcesso";

interface Medicamento extends MedicamentoCard {
  doses: DoseHistorico[];
}

interface RespostaMedicamentos {
  medicamentos: Medicamento[];
}

export default function Remedios() {
  useTitulo("Medicamentos");

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

  const idosos = useIdososVinculados();

  // Cuidador e familiar escolhem o idoso no seletor; perfil idoso usa os endpoints sem ID.
  const [idosoEscolhido, setIdosoEscolhido] = useState("");

  const ehIdoso = idosos.ehIdoso;
  const estadoIdosos = idosos.estado;
  const bloqueado = envioBloqueado(idosos, idosoEscolhido);
  const idosoId = ehIdoso ? "" : idosoEscolhido;
  const idosoNome = idosos.idosos.find((i) => String(i.id) === idosoId)?.nome;

  // Regras fixas de ator (o backend recusa o resto): cuidador nunca cadastra medicamento; terceiro só marca
  // dose com a permissão do vínculo. Perfil ou permissão desconhecidos: mostra (o 403 vira mensagem).
  const { tipoPerfil } = useAcesso();
  const podeCadastrar = tipoPerfil !== "cuidador";
  const podeMarcarDose = ehIdoso || permissoes.estado !== "ok" || permissoes.escrita;

  const carregarMedicamentos = useCallback(async () => {
    setErro(null);

    if (bloqueado) {
      // Sem idoso escolhido não há o que listar (o seletor mostra o motivo).
      setMedicamentos([]);
      setCarregando(estadoIdosos === "carregando");
      return;
    }

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
  }, [bloqueado, estadoIdosos, idosoId]);

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
    <div
      className="
        flex-1
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
        {/* CABEÇALHO */}

        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-semibold text-[#5F56EC] dark:text-[#A89FFF]">
              Cuidado e acompanhamento
            </p>

            <h1 className="mt-1 text-3xl font-bold text-[#071A38] dark:text-[#F5F5FA] sm:text-4xl">
              Medicamentos
            </h1>

            <p className="mt-2 max-w-2xl text-[#56657D] dark:text-[#C7C7D1]">
              {ehIdoso
                ? "Organize seus medicamentos, registre doses e acompanhe seu histórico."
                : "Acompanhe os medicamentos do idoso e o histórico de doses."}
            </p>
          </div>

          {podeCadastrar && (
          <button
            type="button"
            onClick={() => setModalMedicamentoAberto(true)}
            disabled={bloqueado}
            className="
              flex
              min-h-12
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-[#5F56EC]
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

              disabled:cursor-not-allowed
              disabled:opacity-60

              dark:ring-offset-[#10101A]
            "
          >
            <Plus size={20} aria-hidden="true" />
            Adicionar medicamento
          </button>
          )}
        </header>

        {/* PERMISSÕES */}

        <div className="mb-6">
          <AvisoPermissaoDose permissoes={permissoes} />
        </div>

        {/* IDOSO */}

        {!ehIdoso && (
          <div className="mb-6 max-w-xl">
            <SeletorIdoso
              id="idoso_remedios"
              valor={idosoEscolhido}
              aoMudar={setIdosoEscolhido}
              lista={idosos}
            />
          </div>
        )}

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

        {!carregando && !erro && !bloqueado && medicamentos.length === 0 && (
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
                  text-[#5F56EC]

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
              {ehIdoso
                ? "Adicione seu primeiro medicamento para começar a acompanhar suas doses."
                : podeCadastrar
                  ? "Adicione o primeiro medicamento do idoso para começar a acompanhar as doses."
                  : "Quando um medicamento for cadastrado, ele aparece aqui."}
            </p>

            {podeCadastrar && (
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
                  bg-[#5F56EC]
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
            )}
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
                {ehIdoso ? "Meus medicamentos" : "Medicamentos do idoso"}
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
                  onMarcarDose={podeMarcarDose ? abrirDose : undefined}
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
                <p className="text-sm font-semibold text-[#5F56EC] dark:text-[#A89FFF]">
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
                  hover:text-[#554CD8]

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

        {!bloqueado && (
          <div className="mt-8">
            <ExportarHistorico idosoId={idosoId || undefined} />
          </div>
        )}
      </div>

      {/* MODAL DE CADASTRO */}

      <ModalMedicamento
        aberto={modalMedicamentoAberto}
        onFechar={() => {
          setModalMedicamentoAberto(false);

          void carregarMedicamentos();
        }}
        idosoId={idosoId || undefined}
        idosoNome={idosoNome}
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
    </div>
  );
}

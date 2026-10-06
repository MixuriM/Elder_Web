import { ArrowLeft, CheckCircle2, CircleUserRound, Clock3, ShieldAlert, X } from "lucide-react";

import type { Vinculo } from "./CardVinculo";

type DetalhesVinculoProps = {
  vinculo: Vinculo;
  onFechar: () => void;
};

function formatarData(data: string | null | undefined) {
  if (!data) return "Não informado";

  const dataFormatada = new Date(data);

  if (Number.isNaN(dataFormatada.getTime())) return "Data inválida";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(dataFormatada);
}

function formatarTipo(tipo: string) {
  return tipo === "familiar" ? "Familiar" : tipo === "cuidador" ? "Cuidador" : tipo;
}

function formatarStatus(status: string) {
  if (status === "aprovado") return "Aprovado";
  if (status === "pendente") return "Pendente";
  if (status === "recusado") return "Recusado";
  return status;
}

function obterPapel(vinculo: Vinculo) {
  if (vinculo.tipo_vinculo === "cuidador") return "Pessoa que cuida do idoso";
  if (vinculo.tipo_vinculo === "familiar") return "Pessoa da família do idoso";
  return "Pessoa vinculada";
}

export default function DetalhesVinculo({ vinculo, onFechar }: DetalhesVinculoProps) {
  const nome = vinculo.vinculado.nome ?? vinculo.idoso.nome ?? "Pessoa vinculada";
  const papel = obterPapel(vinculo);
  const status = formatarStatus(vinculo.status);
  const data = formatarData(vinculo.data_resposta ?? vinculo.confirmado_em);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#071A38]/70 p-4 sm:items-center">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes do vínculo"
        className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-[#151B35]"
      >
        <header className="flex items-center justify-between gap-4 border-b border-gray-200 bg-[#F3F0FF] p-5 dark:border-gray-700 dark:bg-[#242A4A]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#5F56EC] dark:bg-[#151B35]">
              <CircleUserRound size={28} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#5F56EC]">Detalhes do vínculo</p>
              <h2 id="detalhes-vinculo-titulo" className="text-2xl font-bold text-[#071A38] dark:text-white">
                {nome}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onFechar}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[#071A38] transition hover:bg-white hover:text-[#5F56EC] focus:outline-none focus:ring-4 focus:ring-[#A18BFF]/40 dark:text-white dark:hover:bg-[#151B35]"
            aria-label="Fechar detalhes"
          >
            <X size={24} aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex items-center gap-3 rounded-2xl bg-[#F7F7FC] p-4 dark:bg-[#1C233F]">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8E3FF] text-[#5F56EC] dark:bg-[#2F3555]">
              {vinculo.status === "aprovado" ? <CheckCircle2 aria-hidden="true" /> : vinculo.status === "pendente" ? <Clock3 aria-hidden="true" /> : <ShieldAlert aria-hidden="true" />}
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Situação atual</p>
              <p className="text-lg font-bold text-[#071A38] dark:text-white">{status}</p>
            </div>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <dt className="text-sm font-semibold text-gray-500 dark:text-gray-400">Tipo de vínculo</dt>
              <dd className="mt-1 text-base font-bold text-[#071A38] dark:text-white">{formatarTipo(vinculo.tipo_vinculo)}</dd>
            </div>

            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <dt className="text-sm font-semibold text-gray-500 dark:text-gray-400">Função</dt>
              <dd className="mt-1 text-base font-bold text-[#071A38] dark:text-white">{papel}</dd>
            </div>

            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700 sm:col-span-2">
              <dt className="text-sm font-semibold text-gray-500 dark:text-gray-400">E-mail</dt>
              <dd className="mt-1 text-base text-[#071A38] dark:text-white">{vinculo.vinculado.email_mascarado ?? "Não informado"}</dd>
            </div>

            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <dt className="text-sm font-semibold text-gray-500 dark:text-gray-400">Data da decisão</dt>
              <dd className="mt-1 text-base text-[#071A38] dark:text-white">{data}</dd>
            </div>

            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <dt className="text-sm font-semibold text-gray-500 dark:text-gray-400">Origem do convite</dt>
              <dd className="mt-1 text-base text-[#071A38] dark:text-white">{vinculo.origem}</dd>
            </div>
          </dl>
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-gray-200 bg-[#FAFAFF] p-5 sm:flex-row sm:justify-end dark:border-gray-700 dark:bg-[#0F1428]">
          <button
            type="button"
            onClick={onFechar}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#6C63FF] px-5 font-semibold text-[#5F56EC] transition hover:bg-[#F3F0FF] focus:outline-none focus:ring-4 focus:ring-[#A18BFF]/40 dark:hover:bg-[#242A4A]"
          >
            <ArrowLeft size={20} aria-hidden="true" />
            Voltar
          </button>
        </footer>
      </section>
    </div>
  );
}

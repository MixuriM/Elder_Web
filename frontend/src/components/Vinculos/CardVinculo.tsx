

    import { ChevronRight, UserRound } from "lucide-react";
    import { Link } from "react-router-dom";

import AvisoEmailPendente from "./AvisoEmailPendente";
import { pessoaDoVinculo } from "./pessoaDoVinculo";
import { emailNaoConfirmado } from "./regrasVinculo";

export type Vinculo = {
  id: number;
  tipo_vinculo: string;
  origem: string;
  status: string;
  data_solicitacao: string;
  data_resposta: string | null;
  confirmado_em: string | null;
  papel_do_chamador: string;
  // Só em vínculo de cuidador aprovado; fora disso o backend devolve null.
  permissoes?: {
    permite_registrar_saude: boolean;
    permite_marcar_dose: boolean;
    permite_criar_evento_cuidado: boolean;
  } | null;

  idoso: {
    id: number | null;
    nome: string | null;
    email_mascarado: string | null;
  };

  vinculado: {
    id: number | null;
    nome: string | null;
    email_mascarado: string | null;
  };
};

type CardVinculoProps = {
  vinculo: Vinculo;
};

export default function CardVinculo({ vinculo }: CardVinculoProps) {
  const { nome } = pessoaDoVinculo(vinculo);
  const ehVinculado = vinculo.papel_do_chamador === "vinculado";

  const tipo = ehVinculado
    ? "Idoso"
    : vinculo.tipo_vinculo === "familiar"
      ? "Familiar"
      : vinculo.tipo_vinculo === "cuidador"
        ? "Cuidador"
        : vinculo.tipo_vinculo;

  return (
    <article
      className="
        rounded-2xl border border-gray-200
        bg-white p-5 shadow-sm
        transition hover:shadow-md
        dark:border-gray-700 dark:bg-[#151B35]
      "
    >
      <div className="flex items-center gap-4">
        <div
          className="
            flex h-14 w-14 shrink-0 items-center justify-center
            rounded-full bg-[#F3F0FF]
            text-[#5F56EC]
            dark:bg-[#242A4A]
          "
        >
          <UserRound size={28} />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-bold text-[#071A38] dark:text-white">
            {nome}
          </h2>

          <p className="text-base text-gray-600 dark:text-gray-300">
            {tipo}
            {vinculo.papel_do_chamador === "titular" && vinculo.idoso.nome
              ? ` · Idoso: ${vinculo.idoso.nome}`
              : ""}
          </p>
        </div>

        <span
          className={`
            rounded-full px-3 py-1
            text-sm font-semibold
            ${
              vinculo.status === "aprovado"
                ? "bg-green-100 text-green-700"
                : vinculo.status === "pendente"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-red-100 text-red-700"
            }
          `}
        >
          {vinculo.status === "aprovado"
            ? "Aprovado"
            : vinculo.status === "pendente"
              ? "Pendente"
              : "Recusado"}
        </span>
      </div>

      {emailNaoConfirmado(vinculo) && (
        <div className="mt-4">
          <AvisoEmailPendente />
        </div>
      )}

      <Link
        to={`/vinculos/${vinculo.id}`}
        target="_blank"
        rel="noreferrer"
        aria-label={`Ver detalhes de ${nome} (abre em nova aba)`}
        className="
          mt-5 flex min-h-11 w-full
          items-center justify-between
          rounded-xl bg-[#F3F0FF] px-4
          font-semibold text-[#5F56EC]
          transition hover:bg-[#E8E3FF]
          dark:bg-[#242A4A]
        "
      >
        Ver detalhes

        <ChevronRight size={21} aria-hidden="true" />
      </Link>
    </article>
  );
}
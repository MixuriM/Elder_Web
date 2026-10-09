import { useEffect, useId, useState, type ElementType, type ReactNode } from "react";
import { CalendarDays, HeartPulse, Pill } from "lucide-react";
import { Link } from "react-router-dom";

import SeletorIdoso from "../common/SeletorIdoso";
import Spinner from "../common/Spinner";
import { useAcesso } from "../../contexts/useAcesso";
import { chamarApi } from "../../lib/chamarApi";
import { diaSP, formatarIntervalo, type EventoAgenda } from "../../lib/agendaPorDia";
import { eventosDeHoje, idososDoAcesso, permissoesDeEscrita, resumoMedicamentos } from "../../lib/resumoDia";

type Carga<T> = { estado: "carregando" } | { estado: "erro" } | { estado: "ok"; dados: T };
type Corpo = Record<string, never>;

type RegistroSaude = {
  id: number;
  tipo_medicao: string;
  valor_1: number;
  valor_2: number | null;
  unidade: string;
  data_hora: string;
};

const MSG_ERRO = "Não foi possível carregar agora. Tente de novo mais tarde.";
const MAX_ITENS = 3;

// Fora do componente: referência estável para o efeito de useCarga.
const lerEventos = (corpo: Corpo) => eventosDeHoje(corpo.eventos as EventoAgenda[]);
const lerRegistros = (corpo: Corpo) => (corpo.registros as RegistroSaude[]).slice(0, MAX_ITENS);
const lerMedicamentos = (corpo: Corpo) => resumoMedicamentos(corpo.medicamentos);

// Nunca loga o erro nem o corpo: saúde, medicamento e compromisso médico são dados sensíveis (RNF-001).
function useCarga<T>(caminho: string | null, ler: (corpo: Corpo) => T): Carga<T> {
  const [carga, setCarga] = useState<Carga<T>>({ estado: "carregando" });

  useEffect(() => {
    if (!caminho) return;
    let ativo = true;
    setCarga({ estado: "carregando" });
    chamarApi(caminho, { method: "GET" })
      .then((corpo) => ativo && setCarga({ estado: "ok", dados: ler(corpo) }))
      .catch(() => ativo && setCarga({ estado: "erro" }));
    return () => {
      ativo = false;
    };
  }, [caminho, ler]);

  return carga;
}

const fmtDiaMes = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function quando(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dia = diaSP(d) === diaSP(new Date()) ? "hoje" : fmtDiaMes.format(d);
  return `${dia} às ${fmtHora.format(d)}`;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

const TEXTO = "text-base text-slate-700 dark:text-[#D5D5E0]";

function CardResumo<T>({
  titulo,
  Icone,
  link,
  rotuloLink,
  carga,
  children,
}: {
  titulo: string;
  Icone: ElementType;
  link: string;
  rotuloLink: string;
  carga: Carga<T>;
  children: (dados: T) => ReactNode;
}) {
  const idTitulo = useId();

  return (
    <section
      aria-labelledby={idTitulo}
      className="
        flex
        flex-col
        gap-3
        rounded-2xl
        border
        border-gray-200
        bg-white
        p-4
        shadow-[0_12px_30px_rgba(15,23,42,0.04)]
        dark:border-[#454A63]
        dark:bg-[#1F2130]
        sm:p-5
      "
    >
      <div className="flex items-center justify-between gap-2">
        <h3 id={idTitulo} className="text-lg font-bold text-[#071A38] dark:text-[#F5F5FA]">
          {titulo}
        </h3>
        <Icone size={20} aria-hidden="true" className="shrink-0 text-[#5F56EC] dark:text-[#A89FFF]" />
      </div>

      <div className="flex-1">
        {carga.estado === "carregando" && (
          <p role="status" className={`flex items-center gap-3 ${TEXTO}`}>
            <Spinner />
            Carregando...
          </p>
        )}
        {carga.estado === "erro" && (
          <p role="alert" className="text-base text-red-700 dark:text-red-300">
            {MSG_ERRO}
          </p>
        )}
        {carga.estado === "ok" && children(carga.dados)}
      </div>

      <Link
        to={link}
        className="
          inline-flex
          min-h-11
          items-center
          self-start
          text-base
          font-semibold
          text-[#554CD8]
          underline
          underline-offset-4
          hover:text-[#3F37B5]
          dark:text-[#B6B0FF]
          dark:hover:text-[#D4D0FF]
        "
      >
        {rotuloLink}
      </Link>
    </section>
  );
}

function ResumoDia() {
  const acesso = useAcesso();
  const lista = idososDoAcesso(acesso);
  const [idosoId, setIdosoId] = useState("");

  // Idoso usa as rotas sem id; cuidador e familiar, as do idoso escolhido. null = ainda sem idoso.
  const sufixo = lista.ehIdoso ? "" : lista.idosos.some((i) => String(i.id) === idosoId) ? `/idoso/${idosoId}` : null;
  const pode = permissoesDeEscrita(acesso, Number(idosoId) || null);

  const agenda = useCarga(sufixo === null ? null : `/agenda${sufixo}`, lerEventos);
  const saude = useCarga(sufixo === null ? null : `/saude${sufixo}`, lerRegistros);
  const remedios = useCarga(sufixo === null ? null : `/remedios${sufixo}`, lerMedicamentos);

  return (
    <section aria-labelledby="titulo-resumo-dia" className="mt-6 sm:mt-8">
      <h2 id="titulo-resumo-dia" className="mb-3 text-xl font-bold text-[#071A38] dark:text-[#F5F5FA]">
        Resumo do dia
      </h2>

      {!lista.ehIdoso && (
        <div className="mb-4 max-w-xl">
          <SeletorIdoso id="resumo-idoso" valor={idosoId} aoMudar={setIdosoId} lista={lista} label="Ver o resumo de" />
        </div>
      )}

      {sufixo !== null && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <CardResumo titulo="Compromissos de hoje" Icone={CalendarDays} link="/agenda" rotuloLink="Ver agenda" carga={agenda}>
            {(eventos) =>
              eventos.length === 0 ? (
                <p className={TEXTO}>
                  Nenhum compromisso hoje.{pode.agenda && " Para marcar um, abra a agenda."}
                </p>
              ) : (
                <>
                  <p className="text-2xl font-bold text-[#071A38] dark:text-[#F5F5FA]">
                    {plural(eventos.length, "compromisso", "compromissos")}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {eventos.slice(0, MAX_ITENS).map((e) => (
                      <li key={e.id} className={TEXTO}>
                        <span className="font-semibold">{formatarIntervalo(e)}</span>{" "}
                        <span className="break-words">{e.titulo}</span>
                      </li>
                    ))}
                  </ul>
                  {eventos.length > MAX_ITENS && (
                    <p className={`mt-1 ${TEXTO}`}>E mais {eventos.length - MAX_ITENS} na agenda.</p>
                  )}
                </>
              )
            }
          </CardResumo>

          <CardResumo titulo="Saúde" Icone={HeartPulse} link="/saude" rotuloLink="Ver saúde" carga={saude}>
            {(registros) =>
              registros.length === 0 ? (
                <p className={TEXTO}>
                  Nenhuma medição registrada.{pode.saude && " Registre a primeira na tela de Saúde."}
                </p>
              ) : (
                <ul className="space-y-2">
                  {registros.map((r) => (
                    <li key={r.id} className={TEXTO}>
                      <span className="block font-semibold text-[#071A38] dark:text-[#F5F5FA]">{r.tipo_medicao}</span>
                      <span>{`${r.valor_1}${r.valor_2 !== null ? ` / ${r.valor_2}` : ""} ${r.unidade}`}</span>
                      <span className="block text-sm text-slate-600 dark:text-[#C7C7D1]">{quando(r.data_hora)}</span>
                    </li>
                  ))}
                </ul>
              )
            }
          </CardResumo>

          <CardResumo titulo="Medicamentos" Icone={Pill} link="/remedios" rotuloLink="Ver medicamentos" carga={remedios}>
            {({ ativos, dosesHoje, porStatus }) =>
              ativos === 0 ? (
                <p className={TEXTO}>
                  Nenhum medicamento ativo.{pode.medicamento && " Cadastre um na tela de Medicamentos."}
                </p>
              ) : (
                <>
                  <p className="text-2xl font-bold text-[#071A38] dark:text-[#F5F5FA]">
                    {plural(ativos, "medicamento ativo", "medicamentos ativos")}
                  </p>
                  {dosesHoje === 0 ? (
                    <p className={`mt-2 ${TEXTO}`}>
                      Nenhuma dose registrada hoje.{pode.dose && " Para registrar, abra Medicamentos."}
                    </p>
                  ) : (
                    <>
                      <p className={`mt-2 ${TEXTO}`}>{plural(dosesHoje, "dose registrada hoje", "doses registradas hoje")}</p>
                      <ul className={`mt-1 ${TEXTO}`}>
                        {porStatus.administrado > 0 && <li>{plural(porStatus.administrado, "dada", "dadas")}</li>}
                        {porStatus.atrasado > 0 && <li>{plural(porStatus.atrasado, "dada com atraso", "dadas com atraso")}</li>}
                        {porStatus.pulado > 0 && <li>{plural(porStatus.pulado, "pulada", "puladas")}</li>}
                      </ul>
                    </>
                  )}
                </>
              )
            }
          </CardResumo>
        </div>
      )}
    </section>
  );
}

export default ResumoDia;

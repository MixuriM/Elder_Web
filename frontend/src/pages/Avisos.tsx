import { Bell } from "lucide-react";
import { Link } from "react-router-dom";

import Spinner from "../components/common/Spinner";
import { useAcesso } from "../contexts/useAcesso";
import { useAvisos } from "../contexts/useAvisos";
import { useTitulo } from "../hooks/useTitulo";

const CAIXA_ERRO =
  "rounded-xl border border-red-200 bg-red-50 p-4 text-base text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300";

// Avisos só dentro do site: sem e-mail, sem celular, sem push.
function Avisos() {
  useTitulo("Avisos");
  const { estado, vinculos } = useAcesso();
  const { avisos, compromissos } = useAvisos();
  const pedidosSemCarregar = estado !== "carregando" && !vinculos;
  const carregando = estado === "carregando" || compromissos === "carregando";

  return (
    <div className="flex-1 bg-[#F5F7FF] px-4 py-6 text-[#071A38] dark:bg-[#11141D] dark:text-[#F5F5FA] sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Avisos</h1>
          <p className="mt-2 text-base text-slate-700 dark:text-[#D5D5E0] sm:text-lg">
            Pedidos de vínculo que você pode responder e compromissos de hoje e de amanhã. Os avisos aparecem só aqui
            no site.
          </p>
        </div>

        {pedidosSemCarregar && (
          <p role="alert" className={CAIXA_ERRO}>
            Não foi possível verificar os pedidos de vínculo agora.
          </p>
        )}
        {compromissos === "erro" && (
          <p role="alert" className={CAIXA_ERRO}>
            Não foi possível verificar os compromissos agora.
          </p>
        )}

        {avisos.length > 0 && (
          <ul className="space-y-3">
            {avisos.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-4 dark:border-[#454A63] dark:bg-[#1F2130] sm:flex-row sm:items-center sm:justify-between sm:p-5"
              >
                <p className="flex items-start gap-3 text-base sm:text-lg">
                  <Bell size={20} aria-hidden="true" className="mt-1 shrink-0 text-[#5F56EC] dark:text-[#A89FFF]" />
                  <span className="break-words">{a.texto}</span>
                </p>
                <Link
                  to={a.link}
                  className="inline-flex min-h-11 shrink-0 items-center self-start text-base font-semibold text-[#554CD8] underline underline-offset-4 hover:text-[#3F37B5] dark:text-[#B6B0FF] dark:hover:text-[#D4D0FF] sm:self-center"
                >
                  {a.rotuloLink}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* Sempre no DOM: leitores de tela anunciam a troca de "carregando" para o resultado. */}
        <div role="status" className="text-base text-slate-700 dark:text-[#D5D5E0] sm:text-lg">
          {carregando ? (
            <span className="flex items-center gap-3">
              <Spinner />
              Carregando avisos...
            </span>
          ) : (
            avisos.length === 0 &&
            !pedidosSemCarregar &&
            compromissos !== "erro" && "Nenhum aviso agora."
          )}
        </div>
      </div>
    </div>
  );
}

export default Avisos;

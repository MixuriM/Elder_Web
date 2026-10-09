import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { CircleAlert, CircleCheck, LifeBuoy, Mail, Phone } from "lucide-react";

import ModalVinculo from "../Vinculos/ModalVinculo";
import { avisarEmergencia, type ResultadoAviso } from "../../services/emergenciaService";

type Estado = { tipo: "inicial" } | { tipo: "enviando" } | ResultadoAviso;

function semConfirmacao(n: number): string {
  return n === 1
    ? "1 pessoa não recebeu porque ainda não confirmou o e-mail. Ligue para ela."
    : `${n} pessoas não receberam porque ainda não confirmaram o e-mail. Ligue para elas.`;
}

// Textos fixos por resultado: nunca o texto que veio do servidor. Toda falha termina em "Ligue 192".
function mensagem(estado: Estado): string {
  switch (estado.tipo) {
    case "inicial":
      return "";
    case "enviando":
      return "Enviando o aviso...";
    case "enviado": {
      const base = `Avisamos ${estado.avisados} de ${estado.total} ${estado.total === 1 ? "pessoa" : "pessoas"}.`;
      return estado.naoConfirmados > 0 ? `${base} ${semConfirmacao(estado.naoConfirmados)}` : base;
    }
    case "nao_confirmados":
      return semConfirmacao(estado.naoConfirmados);
    case "sem_vinculo":
      return "Ninguém está vinculado para receber o aviso. Ligue 192. Depois, vincule alguém da família ou um cuidador.";
    case "limite":
      return "Você já pediu ajuda há pouco. Se for urgente, ligue 192.";
    case "indisponivel":
      return "Não foi possível avisar agora. Ligue 192.";
    case "falha":
      return "Não foi possível avisar. Ligue 192.";
  }
}

// Botão do cabeçalho (só o idoso o recebe, ver Header) e o diálogo de ajuda. A ligação para o 192 vem primeiro;
// o aviso por e-mail à família e aos cuidadores é secundário e nunca substitui a ligação.
export default function BotaoAjuda() {
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<Estado>({ tipo: "inicial" });
  const fechar = useCallback(() => setAberto(false), []);

  function abrir() {
    // Um envio ainda em curso continua aparecendo; qualquer resultado antigo some.
    setEstado((atual) => (atual.tipo === "enviando" ? atual : { tipo: "inicial" }));
    setAberto(true);
  }

  async function avisar() {
    setEstado({ tipo: "enviando" });
    setEstado(await avisarEmergencia());
  }

  const enviando = estado.tipo === "enviando";
  const texto = mensagem(estado);
  const deuCerto = estado.tipo === "enviado";

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="inline-flex min-h-11 max-w-[8.5rem] items-center gap-1.5 rounded-xl bg-[#B42318] px-3 py-1.5 text-left text-sm font-bold leading-tight text-white transition-colors hover:bg-[#912018] dark:bg-[#D92D20] dark:hover:bg-[#B42318] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5F56EC] focus-visible:ring-offset-2 dark:focus-visible:ring-[#A89FFF] dark:focus-visible:ring-offset-[#181824] sm:max-w-none sm:px-4 sm:text-base"
      >
        <LifeBuoy size={20} aria-hidden="true" className="shrink-0" />
        Preciso de ajuda
      </button>

      {/* Portal: dentro do header (backdrop-blur) o position: fixed do modal ficaria preso ao próprio header. */}
      {createPortal(
        <ModalVinculo aberto={aberto} titulo="Pedir ajuda" onFechar={fechar}>
          <div className="flex flex-col gap-6 text-[#071A38] dark:text-[#F5F5FA]">
            <section aria-label="Ligar para a emergência" className="flex flex-col gap-3">
              <a
                href="tel:192"
                className="flex min-h-16 items-center justify-center gap-3 rounded-2xl bg-[#B42318] px-5 py-4 text-center text-xl font-bold text-white transition-colors hover:bg-[#912018] dark:bg-[#D92D20] dark:hover:bg-[#B42318] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5F56EC] focus-visible:ring-offset-2 dark:focus-visible:ring-[#A89FFF] dark:focus-visible:ring-offset-[#171721] sm:text-2xl"
              >
                <Phone size={26} aria-hidden="true" className="shrink-0" />
                Ligar para o SAMU (192)
              </a>
              <p className="text-center text-lg text-[#3B4A63] dark:text-[#C7C7D1]">
                Pelo computador, ligue de um telefone para o{" "}
                <strong className="block text-6xl font-extrabold leading-tight text-[#B42318] dark:text-[#FDA29B]">
                  192
                </strong>
              </p>
              <p className="text-center text-base font-semibold text-[#3B4A63] dark:text-[#C7C7D1]">Bombeiros: 193</p>
            </section>

            <section aria-label="Avisar família e cuidadores" className="flex flex-col gap-3 border-t border-[#EEEAF8] pt-6 dark:border-[#393947]">
              <button
                type="button"
                onClick={avisar}
                disabled={enviando}
                className="flex min-h-14 items-center justify-center gap-3 rounded-2xl border-2 border-[#5F56EC] bg-white px-5 py-3 text-lg font-bold text-[#5F56EC] transition-colors hover:bg-[#F3F0FF] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5F56EC] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#A89FFF] dark:bg-transparent dark:text-[#A89FFF] dark:hover:bg-[#292933] dark:focus-visible:ring-[#A89FFF] dark:focus-visible:ring-offset-[#171721]"
              >
                <Mail size={22} aria-hidden="true" className="shrink-0" />
                {enviando ? "Avisando..." : "Avisar minha família e cuidadores"}
              </button>

              <p className="rounded-xl border border-[#FECDCA] bg-[#FEF3F2] px-4 py-3 text-base font-semibold text-[#7A271A] dark:border-[#7A271A] dark:bg-[#2A1215] dark:text-[#FECDCA]">
                Este aviso não substitui a ligação para a emergência. Se for urgente, ligue 192.
              </p>

              {/* Sempre no DOM: a região viva precisa existir antes do texto mudar para ser anunciada. */}
              <div role="status">
                {texto && (
                  <p
                    // Em tela pequena a mensagem fica abaixo da dobra do diálogo: rola até ela a cada mudança.
                    ref={(p) => p?.scrollIntoView?.({ block: "nearest" })}
                    className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-lg font-semibold ${
                      enviando
                        ? "border-[#E5E2F5] bg-[#F7F5FF] text-[#071A38] dark:border-[#393947] dark:bg-[#20202A] dark:text-[#F5F5FA]"
                        : deuCerto
                        ? "border-[#ABEFC6] bg-[#ECFDF3] text-[#05603A] dark:border-[#085D3A] dark:bg-[#0A2A1C] dark:text-[#ABEFC6]"
                        : "border-[#FECDCA] bg-[#FEF3F2] text-[#7A271A] dark:border-[#7A271A] dark:bg-[#2A1215] dark:text-[#FECDCA]"
                    }`}
                  >
                    {!enviando &&
                      (deuCerto ? (
                        <CircleCheck size={24} aria-hidden="true" className="mt-0.5 shrink-0" />
                      ) : (
                        <CircleAlert size={24} aria-hidden="true" className="mt-0.5 shrink-0" />
                      ))}
                    {texto}
                  </p>
                )}
              </div>
            </section>
          </div>
        </ModalVinculo>,
        document.body,
      )}
    </>
  );
}

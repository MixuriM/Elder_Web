import { useEffect, useId, useState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";

import { emailConfirmado, sendEmailVerification } from "../../lib/auth";

// Situação do e-mail no Firebase (só cuidador e familiar, ver Perfil): o aviso de emergência só vai para e-mail
// confirmado. Mensagens fixas; nunca mostra nem loga o erro do Firebase (pode trazer o e-mail).
type Mensagem = { tipo: "ok" | "erro"; texto: string };

const BOTAO =
  "min-h-11 rounded-xl px-5 py-2.5 text-base font-bold transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5F56EC] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-[#A89FFF] dark:focus-visible:ring-offset-[#191923]";

export default function SituacaoEmail() {
  const idTitulo = useId();
  const [confirmado, setConfirmado] = useState<boolean | null>(null);
  const [ocupado, setOcupado] = useState<"reenviar" | "verificar" | null>(null);
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);

  useEffect(() => {
    let ativo = true;
    emailConfirmado().then((c) => {
      if (ativo) setConfirmado(c);
    });
    return () => {
      ativo = false;
    };
  }, []);

  async function reenviar() {
    setOcupado("reenviar");
    setMensagem(null);
    try {
      // false = já estava confirmado (por exemplo, em outra aba)
      if (await sendEmailVerification()) {
        setMensagem({ tipo: "ok", texto: "Enviamos um novo e-mail de confirmação. Abra a mensagem e clique no link." });
      } else {
        setConfirmado(true);
      }
    } catch (e) {
      const excesso = (e as { code?: unknown }).code === "auth/too-many-requests";
      setMensagem({
        tipo: "erro",
        texto: excesso
          ? "Aguarde alguns minutos para pedir de novo."
          : "Não foi possível enviar agora. Tente de novo mais tarde.",
      });
    } finally {
      setOcupado(null);
    }
  }

  async function verificar() {
    setOcupado("verificar");
    setMensagem(null);
    const c = await emailConfirmado();
    setConfirmado(c);
    if (!c) {
      setMensagem({ tipo: "erro", texto: "Ainda não aparece como confirmado. Abra o link do e-mail e tente de novo." });
    }
    setOcupado(null);
  }

  if (confirmado === null) return null;

  return (
    <section aria-labelledby={idTitulo} className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-700">
      <h2 id={idTitulo} className="text-lg font-bold text-[#071A38] dark:text-[#F5F5FA]">
        Confirmação de e-mail
      </h2>

      {confirmado ? (
        <p className="mt-3 flex items-center gap-2 text-base font-semibold text-[#05603A] dark:text-[#ABEFC6]">
          <CircleCheck size={22} aria-hidden="true" className="shrink-0" />
          E-mail confirmado
        </p>
      ) : (
        <>
          <p className="mt-3 flex items-start gap-2 text-base font-semibold text-[#7A271A] dark:text-[#FECDCA]">
            <CircleAlert size={22} aria-hidden="true" className="mt-0.5 shrink-0" />
            E-mail ainda não confirmado. Sem isso você não recebe o aviso de emergência de quem você cuida.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={reenviar}
              disabled={ocupado !== null}
              className={`${BOTAO} bg-[#5F56EC] text-white hover:bg-[#554CD8]`}
            >
              {ocupado === "reenviar" ? "Enviando..." : "Reenviar e-mail de confirmação"}
            </button>
            <button
              type="button"
              onClick={verificar}
              disabled={ocupado !== null}
              className={`${BOTAO} border-2 border-[#5F56EC] bg-white text-[#5F56EC] hover:bg-[#F3F0FF] dark:border-[#A89FFF] dark:bg-transparent dark:text-[#A89FFF] dark:hover:bg-[#292933]`}
            >
              {ocupado === "verificar" ? "Verificando..." : "Já confirmei"}
            </button>
          </div>
        </>
      )}

      {/* Sempre no DOM: a região viva precisa existir antes do texto mudar para ser anunciada. */}
      <div role="status">
        {mensagem && (
          <p
            className={`mt-4 rounded-xl border px-4 py-3 text-base font-semibold ${
              mensagem.tipo === "ok"
                ? "border-[#ABEFC6] bg-[#ECFDF3] text-[#05603A] dark:border-[#085D3A] dark:bg-[#0A2A1C] dark:text-[#ABEFC6]"
                : "border-[#FECDCA] bg-[#FEF3F2] text-[#7A271A] dark:border-[#7A271A] dark:bg-[#2A1215] dark:text-[#FECDCA]"
            }`}
          >
            {mensagem.texto}
          </p>
        )}
      </div>
    </section>
  );
}

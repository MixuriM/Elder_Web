import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { chamarApi } from "../../lib/chamarApi";
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, MENSAGEM_ERRO, MENSAGEM_SUCESSO, ROTULO } from "./estilosVinculo";
import { mensagemPorStatus } from "./mensagensVinculo";

type ConvidarFamiliarProps = {
  onConcluido: () => void;
  onFechar: () => void;
};

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ERRO_EMAIL = "Digite um e-mail válido, como nome@exemplo.com.";

const ERROS_FIXOS: Partial<Record<number, string>> = {
  400: "Confira o e-mail digitado e tente de novo.",
  403: "Você não pode convidar um familiar agora.",
  409: "Já existe um pedido pendente ou vínculo com esta pessoa.",
};
const ERRO_ENVIO = "Não foi possível enviar agora. Tente de novo em instantes.";

// O idoso convida um familiar pelo e-mail. A resposta do backend é a mesma com ou sem conta, então a tela
// não promete que a pessoa já existe: explica quando o vínculo é aprovado.
export default function ConvidarFamiliar({ onConcluido, onFechar }: ConvidarFamiliarProps) {
  const idEmail = useId();
  const idErro = useId();
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [emailInvalido, setEmailInvalido] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const avisoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (concluido) avisoRef.current?.focus();
  }, [concluido]);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando) return;

    const emailLimpo = email.trim();
    if (!EMAIL_VALIDO.test(emailLimpo)) {
      setEmailInvalido(true);
      setErro(ERRO_EMAIL);
      return;
    }

    setEmailInvalido(false);
    setErro(null);
    setEnviando(true);
    try {
      await chamarApi("/vinculo/convidar-familiar", { method: "POST", body: JSON.stringify({ email: emailLimpo }) });
      setConcluido(true);
      onConcluido();
    } catch (e) {
      setErro(mensagemPorStatus(e, ERROS_FIXOS, ERRO_ENVIO));
    } finally {
      setEnviando(false);
    }
  }

  if (concluido) {
    return (
      <div className="space-y-5">
        <div ref={avisoRef} tabIndex={-1} role="status" className={`${MENSAGEM_SUCESSO} space-y-2`}>
          <p>Convite registrado.</p>
          <p>
            Quando essa pessoa entrar no Elder Web com o e-mail confirmado, o vínculo é aprovado sozinho. Um novo
            convite substitui o anterior que ainda não foi usado.
          </p>
        </div>
        <button type="button" onClick={onFechar} className={BOTAO_PRIMARIO}>
          Concluir
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-5">
      <p className="text-lg text-gray-700 dark:text-gray-200">
        Digite o e-mail do familiar que você quer que ajude nos seus cuidados.
      </p>

      <div>
        <label htmlFor={idEmail} className={ROTULO}>
          E-mail do familiar
        </label>
        <input
          id={idEmail}
          type="email"
          inputMode="email"
          maxLength={255}
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={emailInvalido}
          aria-describedby={erro ? idErro : undefined}
          className={CAMPO}
        />
      </div>

      {erro && (
        <p id={idErro} role="alert" className={MENSAGEM_ERRO}>
          {erro}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="submit" disabled={enviando} aria-busy={enviando} className={BOTAO_PRIMARIO}>
          {enviando ? "Enviando..." : "Enviar convite"}
        </button>
        <button type="button" onClick={onFechar} className={BOTAO_SECUNDARIO}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

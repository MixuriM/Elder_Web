import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { chamarApi } from "../../lib/chamarApi";
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, MENSAGEM_ERRO, MENSAGEM_SUCESSO, ROTULO } from "./estilosVinculo";
import { mensagemPorStatus, statusDoErro } from "./mensagensVinculo";

type SolicitarVinculoProps = {
  tipo: "cuidador" | "familiar";
  emailInicial?: string;
  onConcluido: () => void;
  onFechar: () => void;
};

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ERRO_EMAIL = "Digite um e-mail válido, como nome@exemplo.com.";

const ERROS_FIXOS: Partial<Record<number, string>> = {
  400: "Confira o e-mail digitado e tente de novo.",
  403: "Seu perfil não pode fazer este pedido.",
  409: "Já existe um pedido pendente ou você já está vinculado a esta pessoa.",
};
const ERRO_ENVIO = "Não foi possível enviar agora. Tente de novo em instantes.";

export default function SolicitarVinculo({ tipo, emailInicial = "", onConcluido, onFechar }: SolicitarVinculoProps) {
  const idEmail = useId();
  const idNome = useId();
  const idDicaNome = useId();
  const idErro = useId();
  const [email, setEmail] = useState(emailInicial);
  const [nomeIdoso, setNomeIdoso] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [emailInvalido, setEmailInvalido] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const avisoRef = useRef<HTMLDivElement>(null);

  // O botão de enviar some no sucesso: o foco vai para a mensagem, que permanece até a pessoa concluir.
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
    const nome = nomeIdoso.trim();

    try {
      await chamarApi(`/vinculo/solicitar-${tipo}`, {
        method: "POST",
        body: JSON.stringify({ email: emailLimpo, ...(tipo === "cuidador" && nome && { nome_idoso: nome }) }),
      });
      setConcluido(true);
      onConcluido();
    } catch (e) {
      const status = statusDoErro(e);
      if (status === 404 && e instanceof Error && e.message) {
        // Mensagem genérica do backend, de propósito: não revela se o e-mail existe. Mostrada como veio.
        setErro(e.message);
      } else {
        setErro(mensagemPorStatus(e, ERROS_FIXOS, ERRO_ENVIO));
      }
    } finally {
      setEnviando(false);
    }
  }

  if (concluido) {
    return (
      <div className="space-y-5">
        <div ref={avisoRef} tabIndex={-1} role="status" className={MENSAGEM_SUCESSO}>
          Pedido enviado. Aguarde a aprovação. O pedido aparece na lista como pendente.
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
        {tipo === "cuidador"
          ? "Digite o e-mail do idoso que você vai ajudar. Ele ou quem decide por ele vai responder ao pedido."
          : "Digite o e-mail do idoso da sua família. Ele ou quem decide por ele vai responder ao pedido."}
      </p>

      <div>
        <label htmlFor={idEmail} className={ROTULO}>
          E-mail do idoso
        </label>
        <input
          id={idEmail}
          type="email"
          inputMode="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={emailInvalido}
          aria-describedby={erro ? idErro : undefined}
          className={CAMPO}
        />
      </div>

      {/* Sempre visível para o cuidador (o backend não lista mais idosos de um e-mail): ajuda quando o e-mail é de um
          familiar que cuida de mais de um idoso. */}
      {tipo === "cuidador" && (
        <div>
          <label htmlFor={idNome} className={ROTULO}>
            Nome do idoso (opcional)
          </label>
          <p id={idDicaNome} className="mb-2 text-base text-gray-700 dark:text-gray-200">
            Preencha com o nome completo se o e-mail for de um familiar que cuida de mais de um idoso.
          </p>
          <input
            id={idNome}
            type="text"
            autoComplete="off"
            value={nomeIdoso}
            onChange={(e) => setNomeIdoso(e.target.value)}
            aria-describedby={idDicaNome}
            className={CAMPO}
          />
        </div>
      )}

      {erro && (
        <p id={idErro} role="alert" className={MENSAGEM_ERRO}>
          {erro}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="submit" disabled={enviando} aria-busy={enviando} className={BOTAO_PRIMARIO}>
          {enviando ? "Enviando..." : "Enviar pedido"}
        </button>
        <button type="button" onClick={onFechar} className={BOTAO_SECUNDARIO}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

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
  const idErro = useId();
  const [email, setEmail] = useState(emailInicial);
  const [nomeIdoso, setNomeIdoso] = useState("");
  const [pedirNome, setPedirNome] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [emailInvalido, setEmailInvalido] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const avisoRef = useRef<HTMLDivElement>(null);
  const nomeRef = useRef<HTMLInputElement>(null);

  // O botão de enviar some no sucesso: o foco vai para a mensagem, que permanece até a pessoa concluir.
  useEffect(() => {
    if (concluido) avisoRef.current?.focus();
  }, [concluido]);

  useEffect(() => {
    if (pedirNome) nomeRef.current?.focus();
  }, [pedirNome]);

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
      if (status === 422 && tipo === "cuidador") {
        setPedirNome(true);
        setErro(
          nome
            ? "O nome não confere com um único idoso. Confira o nome completo."
            : "Este e-mail está ligado a mais de um idoso. Digite o nome completo do idoso.",
        );
      } else if (status === 404 && e instanceof Error && e.message) {
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

      {pedirNome && (
        <div>
          <label htmlFor={idNome} className={ROTULO}>
            Nome do idoso
          </label>
          <input
            id={idNome}
            ref={nomeRef}
            type="text"
            autoComplete="off"
            value={nomeIdoso}
            onChange={(e) => setNomeIdoso(e.target.value)}
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

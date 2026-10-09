import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { chamarApi } from "../../lib/chamarApi";
import {
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  CAMPO,
  MENSAGEM_ERRO,
  MENSAGEM_SUCESSO,
  ROTULO,
} from "./estilosVinculo";
import { mensagemPorStatus, statusDoErro } from "./mensagensVinculo";

type CadastrarIdosoProps = {
  onConcluido: () => void;
  onFechar: () => void;
  // Conflito de e-mail: a pessoa pode seguir para pedir vínculo com o e-mail que acabou de digitar.
  onPedirVinculo: (email: string) => void;
};

type Passo = "dados" | "termo" | "conflito" | "sucesso";

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ERROS_FIXOS: Partial<Record<number, string>> = {
  400: "Confira os dados do idoso e tente de novo.",
  403: "Seu perfil não pode cadastrar um idoso.",
};
const ERRO_ENVIO = "Não foi possível cadastrar agora. Tente de novo em instantes.";

// Texto provisório do termo (RF-030): a redação final é do grupo.
const TERMO = [
  "Estou cadastrando uma pessoa idosa da minha família para ajudar nos cuidados dela.",
  "Tenho o e-mail dela e conversei com ela, ou com quem a representa, sobre este cadastro.",
  "Sei que os dados de saúde são sensíveis e vou usá-los só para cuidar dela.",
  "Sei que a pessoa idosa pode assumir esta conta com o e-mail informado e decidir quem tem acesso.",
];

export default function CadastrarIdoso({ onConcluido, onFechar, onPedirVinculo }: CadastrarIdosoProps) {
  const ids = { nome: useId(), email: useId(), telefone: useId(), termo: useId() };
  const [passo, setPasso] = useState<Passo>("dados");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [errosCampo, setErrosCampo] = useState<{ nome?: string; email?: string }>({});
  const [aceito, setAceito] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [conflito, setConflito] = useState<{ erro: string; proximoPasso?: string } | null>(null);
  const [sucesso, setSucesso] = useState<{ nome: string; vinculoAprovado: boolean } | null>(null);
  const [focarEmail, setFocarEmail] = useState(false);
  const nomeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const conflitoRef = useRef<HTMLDivElement>(null);
  const sucessoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (passo === "conflito") conflitoRef.current?.focus();
    if (passo === "sucesso") sucessoRef.current?.focus();
    if (passo === "dados" && focarEmail) {
      emailRef.current?.focus();
      setFocarEmail(false);
    }
  }, [passo, focarEmail]);

  function continuar(evento: FormEvent) {
    evento.preventDefault();
    const erros: { nome?: string; email?: string } = {};
    if (!nome.trim()) erros.nome = "Digite o nome do idoso.";
    if (!EMAIL_VALIDO.test(email.trim())) erros.email = "Digite um e-mail válido, como nome@exemplo.com.";
    setErrosCampo(erros);
    if (erros.nome) return nomeRef.current?.focus();
    if (erros.email) return emailRef.current?.focus();
    setPasso("termo");
  }

  async function cadastrar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando) return;
    if (!aceito) {
      setErroEnvio("Marque a caixa para aceitar o termo.");
      return;
    }
    setErroEnvio("");
    setEnviando(true);
    const telefoneLimpo = telefone.trim();
    try {
      const corpo = await chamarApi("/usuario/cadastrar-idoso", {
        method: "POST",
        body: JSON.stringify({
          nome: nome.trim(),
          email: email.trim(),
          ...(telefoneLimpo && { telefone: telefoneLimpo }),
          aceita_termo_responsabilidade: true,
        }),
      });
      setSucesso({ nome: nome.trim(), vinculoAprovado: corpo?.vinculo?.status === "aprovado" });
      setPasso("sucesso");
      onConcluido();
    } catch (e) {
      if (statusDoErro(e) === 409 && e instanceof Error) {
        // Mensagem e próximo passo do backend (RNF-011), mostrados como vieram.
        const proximoPasso = (e as { proximo_passo?: unknown }).proximo_passo;
        setConflito({ erro: e.message, proximoPasso: typeof proximoPasso === "string" ? proximoPasso : undefined });
        setPasso("conflito");
      } else {
        setErroEnvio(mensagemPorStatus(e, ERROS_FIXOS, ERRO_ENVIO));
      }
    } finally {
      setEnviando(false);
    }
  }

  if (passo === "sucesso" && sucesso) {
    return (
      <div className="space-y-5">
        <div ref={sucessoRef} tabIndex={-1} role="status" className={`${MENSAGEM_SUCESSO} space-y-2`}>
          <p>Idoso cadastrado: {sucesso.nome}.</p>
          <p>
            {sucesso.vinculoAprovado
              ? "O vínculo já está aprovado."
              : "O vínculo fica pendente até você confirmar o seu e-mail."}
          </p>
          <p>Quando o idoso criar a conta com o e-mail informado, ele assume este cadastro.</p>
        </div>
        <button type="button" onClick={onFechar} className={BOTAO_PRIMARIO}>
          Concluir
        </button>
      </div>
    );
  }

  if (passo === "conflito" && conflito) {
    return (
      <div className="space-y-5">
        <div ref={conflitoRef} tabIndex={-1} role="alert" className={`${MENSAGEM_ERRO} space-y-2 focus:outline-none`}>
          <p>{conflito.erro}</p>
          {conflito.proximoPasso && <p className="font-normal">{conflito.proximoPasso}</p>}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={() => onPedirVinculo(email.trim())} className={BOTAO_PRIMARIO}>
            Pedir vínculo com este e-mail
          </button>
          <button
            type="button"
            onClick={() => {
              setAceito(false);
              setPasso("dados");
              setFocarEmail(true);
            }}
            className={BOTAO_SECUNDARIO}
          >
            Corrigir o e-mail digitado
          </button>
        </div>
      </div>
    );
  }

  if (passo === "termo") {
    return (
      <form onSubmit={cadastrar} noValidate className="space-y-5">
        <h3 className="text-xl font-bold text-[#071A38] dark:text-white">Termo de responsabilidade</h3>
        <ul className="list-disc space-y-2 pl-6 text-lg text-[#071A38] dark:text-white">
          {TERMO.map((linha) => (
            <li key={linha}>{linha}</li>
          ))}
        </ul>

        <label
          htmlFor={ids.termo}
          className="flex min-h-11 cursor-pointer items-center gap-3 text-lg font-semibold text-[#071A38] dark:text-white"
        >
          <input
            id={ids.termo}
            type="checkbox"
            checked={aceito}
            onChange={(e) => setAceito(e.target.checked)}
            className="h-7 w-7 shrink-0 accent-[#5F56EC]"
          />
          Li e aceito o termo de responsabilidade
        </label>

        {erroEnvio && (
          <p role="alert" className={MENSAGEM_ERRO}>
            {erroEnvio}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" disabled={enviando} aria-busy={enviando} className={BOTAO_PRIMARIO}>
            {enviando ? "Enviando..." : "Aceitar e cadastrar"}
          </button>
          <button
            type="button"
            disabled={enviando}
            onClick={() => {
              // O aceite vale para os dados lidos: se eles mudam, a pessoa aceita de novo.
              setAceito(false);
              setErroEnvio("");
              setPasso("dados");
            }}
            className={BOTAO_SECUNDARIO}
          >
            Voltar
          </button>
        </div>
      </form>
    );
  }

  const temErro = Boolean(errosCampo.nome || errosCampo.email);

  return (
    <form onSubmit={continuar} noValidate className="space-y-5">
      <p className="text-lg text-gray-700 dark:text-gray-200">
        Preencha os dados da pessoa idosa. No próximo passo você lê e aceita o termo de responsabilidade.
      </p>

      <div>
        <label htmlFor={ids.nome} className={ROTULO}>
          Nome do idoso
        </label>
        <input
          id={ids.nome}
          ref={nomeRef}
          type="text"
          maxLength={150}
          autoComplete="off"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          aria-invalid={Boolean(errosCampo.nome)}
          aria-describedby={errosCampo.nome ? `${ids.nome}-erro` : undefined}
          className={CAMPO}
        />
        {errosCampo.nome && (
          <p id={`${ids.nome}-erro`} className="mt-2 text-lg font-semibold text-[#B42318] dark:text-[#FDA29B]">
            {errosCampo.nome}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={ids.email} className={ROTULO}>
          E-mail do idoso
        </label>
        <input
          id={ids.email}
          ref={emailRef}
          type="email"
          inputMode="email"
          maxLength={255}
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(errosCampo.email)}
          aria-describedby={errosCampo.email ? `${ids.email}-erro` : undefined}
          className={CAMPO}
        />
        {errosCampo.email && (
          <p id={`${ids.email}-erro`} className="mt-2 text-lg font-semibold text-[#B42318] dark:text-[#FDA29B]">
            {errosCampo.email}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={ids.telefone} className={ROTULO}>
          Telefone (opcional)
        </label>
        <input
          id={ids.telefone}
          type="tel"
          inputMode="tel"
          maxLength={20}
          autoComplete="off"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          className={CAMPO}
        />
      </div>

      {temErro && (
        <p role="alert" className={MENSAGEM_ERRO}>
          Confira os campos marcados.
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="submit" className={BOTAO_PRIMARIO}>
          Continuar
        </button>
        <button type="button" onClick={onFechar} className={BOTAO_SECUNDARIO}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

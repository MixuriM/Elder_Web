import { useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import ModalVinculo from "../Vinculos/ModalVinculo";
import { useModoDemo } from "../../hooks/useModoDemo";
import { contaComSenha, logoutUser, reautenticar } from "../../lib/auth";
import { excluirConta } from "../../services/perfilService";

// Exclusão da própria conta (LGPD art. 18). Seção no fim de Meu Perfil. A ordem é fixa: confirma a identidade de novo
// (o backend recusa login com mais de 5 minutos), só então chama a API, sai da sessão e volta para a landing.
const CONFIRMACAO = "EXCLUIR";

const TEXTO_IDOSO =
  "Apaga seu histórico de saúde, remédios, agenda e alimentação e remove o acesso de familiares e cuidadores. Não dá para desfazer.";
const TEXTO_VINCULADO =
  "Remove seus vínculos e seus dados de perfil. O que você registrou sobre idosos continua no histórico deles, sem o seu nome (a conta passa a se chamar Conta excluída). Idosos que você cadastrou, que ainda não acessaram a própria conta e que não tenham outro vínculo aprovado também são apagados. Não dá para desfazer.";

const MSG_FALHOU = "Não foi possível excluir a conta agora. Nada foi apagado. Tente de novo em alguns minutos.";
const MSG_MUITAS = "Muitas tentativas. Aguarde alguns minutos e tente de novo.";

// Só pelo code: a mensagem do Firebase pode citar o e-mail.
function mensagemFirebase(err: unknown): string {
  switch ((err as { code?: string })?.code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "Senha incorreta. Confira e tente de novo.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "A janela de confirmação foi fechada. Tente de novo.";
    case "auth/too-many-requests":
      return MSG_MUITAS;
    case "auth/network-request-failed":
      return "Sem conexão. Verifique a internet e tente de novo.";
    default:
      return "Não foi possível confirmar sua identidade. Tente de novo.";
  }
}

function mensagemApi(err: unknown): string {
  const { status, codigo, message } = err as { status?: number; codigo?: string; message?: string };
  if (status === undefined) return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
  if (status === 401 && codigo === "reautenticar") return message ?? MSG_FALHOU;
  if (status === 429) return MSG_MUITAS;
  if (status === 403) return "Esta ação não está disponível nesta conta.";
  return MSG_FALHOU;
}

const CAMPO =
  "min-h-[44px] w-full rounded-xl border border-[#D9D7E8] bg-white px-4 text-base text-[#071A38] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5F56EC] dark:border-[#393947] dark:bg-[#20202A] dark:text-[#F5F5FA]";
const BOTAO_PERIGO =
  "min-h-[44px] rounded-xl bg-[#B42318] px-5 text-base font-semibold text-white transition hover:bg-[#912018] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5F56EC] disabled:cursor-not-allowed disabled:opacity-50";

export default function ExcluirConta({ tipoPerfil }: { tipoPerfil: string | null }) {
  const idTitulo = useId();
  const idDescricao = useId();
  const navigate = useNavigate();
  const demo = useModoDemo();

  const [aberto, setAberto] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [senha, setSenha] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // A conta de demonstração nunca é excluída (o backend também responde 403).
  if (demo) return null;

  const comSenha = aberto && contaComSenha();
  const pronto = confirmacao === CONFIRMACAO && (!comSenha || senha !== "") && !excluindo;

  function abrir() {
    setConfirmacao("");
    setSenha("");
    setErro(null);
    setAberto(true);
  }

  function fechar() {
    if (!excluindo) setAberto(false);
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!pronto) return;
    setErro(null);
    setExcluindo(true);
    try {
      try {
        await reautenticar(comSenha ? senha : undefined);
      } catch (err) {
        setErro(mensagemFirebase(err));
        return;
      }
      try {
        await excluirConta();
      } catch (err) {
        setErro(mensagemApi(err));
        return;
      }
      // Navega ANTES de sair da sessão: com o usuário já nulo, a RotaProtegida desta tela redirecionaria para /login e
      // o aviso se perderia. A conta já foi excluída, então falha ao sair da sessão não pode segurar a pessoa aqui.
      navigate("/", { replace: true, state: { contaExcluida: true } });
      await logoutUser().catch(() => undefined);
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <section
      aria-labelledby={idTitulo}
      className="mx-auto mt-10 w-full max-w-2xl rounded-3xl border border-[#F4C7C3] bg-white p-6 dark:border-[#7A2E28] dark:bg-[#171721]"
    >
      <h2 id={idTitulo} className="text-xl font-bold text-[#071A38] dark:text-[#F5F5FA]">
        Excluir minha conta
      </h2>
      <p className="mt-2 text-base text-[#3D4A60] dark:text-[#C7C7D1]">
        Apaga a sua conta e os dados ligados a ela. Antes, você pode baixar o histórico em PDF.
      </p>
      <button type="button" onClick={abrir} className={`${BOTAO_PERIGO} mt-4`}>
        Excluir minha conta
      </button>

      <ModalVinculo aberto={aberto} titulo="Excluir minha conta?" onFechar={fechar} idDescricao={idDescricao}>
        <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
          <p id={idDescricao} className="text-base text-[#3D4A60] dark:text-[#C7C7D1]">
            {tipoPerfil === "idoso" ? TEXTO_IDOSO : TEXTO_VINCULADO}
          </p>

          <div className="flex flex-col gap-2">
            <label htmlFor={`${idTitulo}-confirmacao`} className="text-base font-semibold text-[#071A38] dark:text-[#F5F5FA]">
              Digite {CONFIRMACAO} para confirmar
            </label>
            <input
              id={`${idTitulo}-confirmacao`}
              type="text"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={excluindo}
              className={CAMPO}
            />
          </div>

          {comSenha && (
            <div className="flex flex-col gap-2">
              <label htmlFor={`${idTitulo}-senha`} className="text-base font-semibold text-[#071A38] dark:text-[#F5F5FA]">
                Sua senha
              </label>
              <input
                id={`${idTitulo}-senha`}
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="current-password"
                disabled={excluindo}
                className={CAMPO}
              />
            </div>
          )}

          {erro && (
            <p
              role="alert"
              className="rounded-xl border border-[#F4C7C3] bg-[#FEF3F2] px-4 py-3 text-base text-[#912018] dark:border-[#7A2E28] dark:bg-[#2A1514] dark:text-[#FDA29B]"
            >
              {erro}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={fechar}
              disabled={excluindo}
              className="min-h-[44px] rounded-xl border border-[#D9D7E8] bg-white px-5 text-base font-semibold text-[#071A38] hover:bg-[#F3F0FF] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5F56EC] disabled:opacity-50 dark:border-[#393947] dark:bg-[#20202A] dark:text-[#F5F5FA]"
            >
              Cancelar
            </button>
            <button type="submit" disabled={!pronto} className={BOTAO_PERIGO}>
              {excluindo ? "Excluindo..." : "Excluir minha conta"}
            </button>
          </div>
        </form>
      </ModalVinculo>
    </section>
  );
}

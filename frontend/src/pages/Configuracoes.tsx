import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAcesso } from "../contexts/useAcesso";
import { useTitulo } from "../hooks/useTitulo";
import { logoutUser } from "../lib/auth";
import { lerPreferencias, salvarPreferencia, type Preferencias } from "../lib/preferencias";

const OPCOES_TEMA = [
  { valor: "claro", rotulo: "Claro" },
  { valor: "escuro", rotulo: "Escuro" },
  { valor: "sistema", rotulo: "Igual ao do aparelho" },
] as const;

const OPCOES_TAMANHO = [
  { valor: "normal", rotulo: "Normal" },
  { valor: "grande", rotulo: "Grande" },
  { valor: "muito-grande", rotulo: "Muito grande" },
] as const;

const CARTAO =
  "rounded-2xl border border-gray-200 bg-white p-5 dark:border-[#454A63] dark:bg-[#1F2130] sm:p-6";
const TITULO_SECAO = "text-xl font-bold text-[#071A38] dark:text-[#F5F5FA]";
const AJUDA = "mt-1 text-base text-slate-700 dark:text-[#D5D5E0]";
const OPCAO =
  "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-gray-300 px-4 py-2 text-base text-[#071A38] hover:border-[#5F56EC] has-[:checked]:border-[#5F56EC] has-[:checked]:bg-[#F3F0FF] dark:border-[#555A75] dark:text-[#F5F5FA] dark:hover:border-[#A89FFF] dark:has-[:checked]:border-[#A89FFF] dark:has-[:checked]:bg-[#2B2C3B]";
const CONTROLE = "h-5 w-5 shrink-0 accent-[#5F56EC] dark:accent-[#A89FFF]";

function Grupo<K extends "tema" | "tamanhoTexto">({
  legenda,
  ajuda,
  nome,
  opcoes,
  valor,
  aoMudar,
}: {
  legenda: string;
  ajuda: string;
  nome: K;
  opcoes: readonly { valor: Preferencias[K]; rotulo: string }[];
  valor: Preferencias[K];
  aoMudar: (valor: Preferencias[K]) => void;
}): ReactNode {
  return (
    <fieldset className={CARTAO}>
      <legend className={`float-left w-full ${TITULO_SECAO}`}>{legenda}</legend>
      <p className={`clear-left ${AJUDA}`}>{ajuda}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {opcoes.map((o) => (
          <label key={o.valor} className={OPCAO}>
            <input
              type="radio"
              name={nome}
              value={o.valor}
              checked={valor === o.valor}
              onChange={() => aoMudar(o.valor)}
              className={CONTROLE}
            />
            {o.rotulo}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Configuracoes() {
  useTitulo("Configurações");
  const navigate = useNavigate();
  const { tipoPerfil } = useAcesso();
  const [prefs, setPrefs] = useState(lerPreferencias);
  const [mensagem, setMensagem] = useState("");

  function mudar<K extends keyof Preferencias>(chave: K, valor: Preferencias[K]) {
    setPrefs((p) => ({ ...p, [chave]: valor }));
    setMensagem(
      salvarPreferencia(chave, valor)
        ? "Preferência salva."
        : "Preferência aplicada, mas não foi possível guardar neste navegador. Ela vale até você fechar o site.",
    );
  }

  async function sair() {
    await logoutUser();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex-1 bg-[#F5F7FF] px-4 py-6 text-[#071A38] dark:bg-[#11141D] dark:text-[#F5F5FA] sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Configurações</h1>
          <p className="mt-2 text-base text-slate-700 dark:text-[#D5D5E0] sm:text-lg">
            Ajuste o site do seu jeito. As escolhas ficam guardadas neste navegador e valem na hora.
          </p>
        </div>

        {/* Sempre no DOM, para o leitor de tela anunciar o resultado de cada escolha. */}
        <p role="status" className="text-base font-semibold text-[#071A38] dark:text-[#F5F5FA]">
          {mensagem}
        </p>

        <Grupo
          legenda="Tema"
          ajuda="Cores claras ou escuras na tela."
          nome="tema"
          opcoes={OPCOES_TEMA}
          valor={prefs.tema}
          aoMudar={(v) => mudar("tema", v)}
        />

        <Grupo
          legenda="Tamanho do texto"
          ajuda="Aumenta as letras e os botões em todo o site."
          nome="tamanhoTexto"
          opcoes={OPCOES_TAMANHO}
          valor={prefs.tamanhoTexto}
          aoMudar={(v) => mudar("tamanhoTexto", v)}
        />

        <section aria-labelledby="titulo-animacoes" className={CARTAO}>
          <h2 id="titulo-animacoes" className={TITULO_SECAO}>
            Animações
          </h2>
          <label className={`mt-4 ${OPCAO}`}>
            <input
              type="checkbox"
              checked={prefs.reduzirMovimento}
              onChange={(e) => mudar("reduzirMovimento", e.target.checked)}
              className={CONTROLE}
            />
            Reduzir animações
          </label>
          <p className={`mt-2 ${AJUDA}`}>Deixa a tela sem efeitos de movimento.</p>
        </section>

        {tipoPerfil === "idoso" && (
          <section aria-labelledby="titulo-decisao" className={CARTAO}>
            <h2 id="titulo-decisao" className={TITULO_SECAO}>
              Quem decide por mim
            </h2>
            <p className={AJUDA}>Veja quem aprova pedidos e permissões na sua conta, você ou um familiar.</p>
            <Link
              to="/familia"
              className="mt-3 inline-flex min-h-11 items-center text-base font-semibold text-[#554CD8] underline underline-offset-4 hover:text-[#3F37B5] dark:text-[#B6B0FF] dark:hover:text-[#D4D0FF]"
            >
              Ver quem decide por mim
            </Link>
          </section>
        )}

        <section aria-labelledby="titulo-conta" className={CARTAO}>
          <h2 id="titulo-conta" className={TITULO_SECAO}>
            Conta
          </h2>
          <button
            type="button"
            onClick={sair}
            className="mt-4 inline-flex min-h-12 items-center justify-center rounded-xl border border-red-300 px-5 py-3 text-base font-semibold text-red-700 hover:bg-red-50 dark:border-red-400/60 dark:text-red-300 dark:hover:bg-red-500/10"
          >
            Sair da conta
          </button>
        </section>
      </div>
    </div>
  );
}

export default Configuracoes;

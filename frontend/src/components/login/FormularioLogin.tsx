// Importa o tipo utilizado pelo evento de envio do formulário
import type { FormEvent } from "react";

// Importa o Link para navegação entre páginas
import { Link } from "react-router-dom";

// Componentes utilizados no formulário
import CampoLogin from "./CampoLogin";
import BotaoGoogleLogin from "./BotaoGoogleLogin";
import Spinner from "../common/Spinner";

// Define as propriedades recebidas pelo formulário
type FormularioLoginProps = {
  email: string;
  senha: string;
  erro: string | null;
  sugerirCadastro: boolean; // mostra link para /cadastro dentro do erro
  carregando: boolean;

  setEmail: (valor: string) => void;
  setSenha: (valor: string) => void;

  onSubmit: (e: FormEvent) => void;
  onGoogleLogin: () => void;
};

// Componente responsável pelo formulário de login
function FormularioLogin({
  email,
  senha,
  erro,
  sugerirCadastro,
  carregando,
  setEmail,
  setSenha,
  onSubmit,
  onGoogleLogin,
}: FormularioLoginProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="
        w-full
        max-w-lg

        rounded-3xl
        border
        border-gray-200

        bg-white

        px-8
        py-9

        shadow-sm

        transition-colors
        duration-300

        sm:px-10

        dark:border-[#343445]
        dark:bg-[#181824]
        dark:shadow-[0_10px_35px_rgba(0,0,0,0.25)]
      "
    >
      {/* Título */}
      <div className="mb-8 text-center">
        <h1
          className="
            text-3xl
            font-bold
            tracking-tight
            text-[#101828]

            sm:text-4xl

            dark:text-white
          "
        >
          Bem-vindo de volta
        </h1>

        <p
          className="
            mt-3
            text-base
            leading-7
            text-gray-500

            sm:text-lg

            dark:text-gray-300
          "
        >
          Acesse sua conta para continuar.
        </p>
      </div>

      {/* Campos */}
      <div className="space-y-5">
        <CampoLogin
          id="login-email"
          label="E-mail"
          type="email"
          autoComplete="username"
          maxLength={255}
          value={email}
          onChange={setEmail}
          placeholder="Digite seu e-mail"
        />

        <CampoLogin
          id="login-senha"
          label="Senha"
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={setSenha}
          placeholder="Digite sua senha"
        />
      </div>

      {/* Recuperação de senha */}
      <div className="mt-3 text-right">
        <Link
          to="/esqueci-senha"
          className="
            text-lg
            font-semibold
            text-[#6C63FF]

            transition-colors

            hover:text-[#554CD8]
            hover:underline

            dark:text-[#A9A4FF]
            dark:hover:text-[#C3BFFF]
          "
        >
          Esqueci minha senha
        </Link>
      </div>

      {/* Mensagem de erro */}
      {erro && (
        <p
          role="alert"
          className="
            mt-5
            rounded-xl

            bg-red-50

            px-4
            py-3

            text-lg
            leading-6
            text-red-700

            dark:bg-red-950/40
            dark:text-red-300
          "
        >
          {erro}
          {sugerirCadastro && (
            <>
              {" "}
              <Link to="/cadastro" className="font-bold underline">
                Ir para o cadastro
              </Link>
            </>
          )}
        </p>
      )}

      {/* Botão Entrar */}
      <button
        type="submit"
        disabled={carregando}
        aria-busy={carregando}
        className="
          mt-6

          flex
          w-full
          items-center
          justify-center
          gap-3

          rounded-xl

          bg-[#6C63FF]

          px-6
          py-3.5

          text-base
          font-bold
          text-white

          transition
          duration-300

          hover:bg-[#5C54E8]

          focus:outline-none
          focus-visible:ring-2
          focus-visible:ring-[#6C63FF]/40

          disabled:cursor-not-allowed
          disabled:opacity-70

          dark:bg-[#7C74FF]
          dark:hover:bg-[#6C63FF]
        "
      >
        {carregando && <Spinner />}

        {carregando
          ? "Entrando..."
          : "Entrar"}
      </button>

      {/* Separador */}
      <div className="my-6 flex items-center gap-4">
        <div
          className="
            h-px
            flex-1
            bg-gray-200

            dark:bg-white/10
          "
        />

        <span
          className="
            text-lg
            text-gray-400

            dark:text-gray-500
          "
        >
          ou
        </span>

        <div
          className="
            h-px
            flex-1
            bg-gray-200

            dark:bg-white/10
          "
        />
      </div>

      {/* Login com Google */}
      <BotaoGoogleLogin
        onClick={onGoogleLogin}
        disabled={carregando}
      />

      {/* Criar conta */}
      <p
        className="
          mt-6
          text-center

          text-lg
          text-gray-500

          dark:text-gray-400
        "
      >
        Ainda não possui uma conta?{" "}

        <Link
          to="/cadastro"
          className="
            font-bold
            text-[#6C63FF]

            transition-colors

            hover:text-[#554CD8]
            hover:underline

            dark:text-[#A9A4FF]
            dark:hover:text-[#C3BFFF]
          "
        >
          Criar conta
        </Link>
      </p>
    </form>
  );
}

export default FormularioLogin;
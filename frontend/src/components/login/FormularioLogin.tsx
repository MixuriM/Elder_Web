// Importa o tipo utilizado pelo evento de envio do formulário
import type { FormEvent } from "react";

// Importa o Link para navegação entre páginas
import { Link } from "react-router-dom";

// Importa os componentes utilizados no formulário
import CampoLogin from "./CampoLogin";
import BotaoGoogleLogin from "./BotaoGoogleLogin";
import Spinner from "../common/Spinner";

// Define as propriedades recebidas pelo formulário
type FormularioLoginProps = {
  email: string;
  senha: string;
  erro: string | null;
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

        px-9
        py-8

        shadow-sm

        transition-colors
        duration-300

        dark:border-[#343445]
        dark:bg-[#181824]
        dark:shadow-[0_10px_35px_rgba(0,0,0,0.25)]
      "
    >
      {/* Título */}
      <div className="mb-8">
        <h1
          className="
            text-center
            text-4xl
            font-bold

            text-gray-900

            dark:text-white
          "
        >
          Bem-vindo de volta
        </h1>

        <p
          className="
            mt-3

            text-center
            text-xl

            text-gray-600

            dark:text-gray-300
          "
        >
          Entre na sua conta para continuar.
        </p>
      </div>

      {/* Campos */}
      <div className="space-y-5">
        <CampoLogin
          label="E-mail"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="Digite seu e-mail"
        />

        <CampoLogin
          label="Senha"
          type="password"
          value={senha}
          onChange={setSenha}
          placeholder="Digite sua senha"
        />
      </div>

      {/* Link para recuperação de senha */}
      <div className="mt-3 text-right">
        <Link
          to="/esqueci-senha"
          className="
            text-lg
            font-semibold

            text-[#6C63FF]

            hover:underline

            dark:text-[#A9A4FF]
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

            p-4

            text-lg
            text-red-700

            dark:bg-red-950/40
            dark:text-red-300
          "
        >
          {erro}
        </p>
      )}

      {/* Botão principal */}
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

          rounded-2xl

          bg-[#6C63FF]

          px-6
          py-4

          text-xl
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
        {carregando ? "Entrando" : "Entrar"}
      </button>

      {/* Separador */}
      <div className="my-6 flex items-center gap-4">
        <div
          className="
            h-px
            flex-1

            bg-gray-300

            dark:bg-gray-600
          "
        />

        <span
          className="
            text-lg
            text-gray-500

            dark:text-gray-400
          "
        >
          ou
        </span>

        <div
          className="
            h-px
            flex-1

            bg-gray-300

            dark:bg-gray-600
          "
        />
      </div>

      {/* Login com Google */}
      <BotaoGoogleLogin onClick={onGoogleLogin} disabled={carregando} />

      {/* Link para criar conta */}
      <p
        className="
          mt-7

          text-center
          text-lg

          text-gray-600

          dark:text-gray-300
        "
      >
        Ainda não possui uma conta?{" "}

        <Link
          to="/cadastro"
          className="
            font-bold

            text-[#6C63FF]

            hover:underline

            dark:text-[#A9A4FF]
          "
        >
          Criar conta
        </Link>
      </p>
    </form>
  );
}

// Exporta o componente
export default FormularioLogin;
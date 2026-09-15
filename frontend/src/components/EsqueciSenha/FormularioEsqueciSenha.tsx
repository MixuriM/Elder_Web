// Importa o tipo do evento utilizado pelo formulário
import type { FormEvent } from "react";

// Importa o Link para voltar para a página de login
import { Link } from "react-router-dom";

// Define as propriedades recebidas pelo formulário
type FormularioEsqueciSenhaProps = {
  email: string;
  erro: string | null;
  enviado: boolean;

  setEmail: (valor: string) => void;
  onSubmit: (e: FormEvent) => void;
};

// Componente responsável pelo formulário de recuperação de senha
function FormularioEsqueciSenha({
  email,
  erro,
  enviado,
  setEmail,
  onSubmit,
}: FormularioEsqueciSenhaProps) {
  return (
    <div className="w-full max-w-md">

      {/* Título da página */}
      <h1
        className="
          text-3xl
          font-bold
          text-gray-900
          dark:text-white
        "
      >
        Esqueceu sua senha?
      </h1>

      {/* Texto explicativo */}
      <p
        className="
          mt-3
          text-lg
          text-gray-600
          dark:text-gray-300
        "
      >
        Digite seu e-mail e enviaremos um link para redefinir sua senha.
      </p>

      {/* Verifica se o e-mail já foi enviado */}
      {enviado ? (

        // Mensagem exibida após o envio
        <div
          role="alert"
          className="
            mt-8
            rounded-2xl
            bg-green-50
            p-5
            text-lg
            text-green-800

            dark:bg-green-950
            dark:text-green-200
          "
        >
          Se esse e-mail estiver cadastrado, você receberá uma mensagem
          com um link para redefinir sua senha.

          <p className="mt-2 text-base">
            Verifique também sua caixa de spam.
          </p>
        </div>

      ) : (

        // Formulário de recuperação
        <form
          onSubmit={onSubmit}
          className="mt-8 space-y-5"
        >

          {/* Campo de e-mail */}
          <div>
            <label
              htmlFor="email"
              className="
                block
                text-lg
                font-medium
                text-gray-900
                dark:text-white
              "
            >
              E-mail
            </label>

            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Digite seu e-mail"
              className="
                mt-2
                w-full
                rounded-xl
                border
                border-gray-300
                bg-white
                p-4
                text-lg
                text-gray-900
                outline-none
                transition

                focus:border-[#6C63FF]
                focus:ring-2
                focus:ring-[#6C63FF]/20

                dark:border-gray-600
                dark:bg-gray-800
                dark:text-white
              "
            />
          </div>

          {/* Mensagem de erro */}
          {erro && (
            <p
              role="alert"
              className="
                text-base
                text-red-600
                dark:text-red-400
              "
            >
              {erro}
            </p>
          )}

          {/* Botão para enviar */}
          <button
            type="submit"
            className="
              w-full
              rounded-xl
              bg-[#6C63FF]
              px-6
              py-4
              text-lg
              font-semibold
              text-white
              transition

              hover:bg-[#5A52E0]

              focus:outline-none
              focus:ring-2
              focus:ring-[#6C63FF]
              focus:ring-offset-2
            "
          >
            Enviar link de redefinição
          </button>
        </form>
      )}

      {/* Voltar para login */}
      <div className="mt-6 text-center">
        <Link
          to="/login"
          className="
            text-lg
            font-medium
            text-[#6C63FF]
            hover:underline
          "
        >
          Voltar para o login
        </Link>
      </div>

    </div>
  );
}

export default FormularioEsqueciSenha;
// Importa o tipo utilizado pelo evento de envio do formulário
import type { FormEvent } from "react";

// Importa o tipo dos perfis disponíveis
import type { TipoPerfil } from "../../lib/auth";

// Componentes
import CampoTexto from "./CampoTexto";
import TipoPerfilCampo from "./TipoPerfil";
import BotaoGoogle from "./BotaoGoogle";
import Spinner from "../common/Spinner";

// =========================================================
// PROPS
// =========================================================

type FormularioCadastroProps = {
  nome: string;
  email: string;
  senha: string;
  confirmacaoSenha: string;
  emailConviteFamiliar: string;
  tipoPerfil: TipoPerfil | null;
  erro: string | null;
  carregando: boolean;

  setNome: (valor: string) => void;
  setEmail: (valor: string) => void;
  setSenha: (valor: string) => void;
  setConfirmacaoSenha: (valor: string) => void;
  setEmailConviteFamiliar: (valor: string) => void;
  setTipoPerfil: (tipo: TipoPerfil) => void;

  onSubmit: (e: FormEvent) => void;
  onGoogleCadastro: () => void;
};

// =========================================================
// COMPONENTE
// =========================================================

function FormularioCadastro({
  nome,
  email,
  senha,
  confirmacaoSenha,
  emailConviteFamiliar,
  tipoPerfil,
  erro,
  carregando,
  setNome,
  setEmail,
  setSenha,
  setConfirmacaoSenha,
  setEmailConviteFamiliar,
  setTipoPerfil,
  onSubmit,
  onGoogleCadastro,
}: FormularioCadastroProps) {
  return (
    <section
      className="
        flex
        w-full
        min-w-0
        items-center
        justify-center

        bg-white

        transition-colors
        duration-300

        dark:bg-[#101018]
      "
    >
      {/* =====================================================
          FORMULÁRIO
      ====================================================== */}

      <form
        onSubmit={onSubmit}
        className="
          w-full
          min-w-0
          max-w-xl

          rounded-[20px]

          border
          border-gray-200

          bg-white

          px-4
          py-6

          shadow-sm

          transition-colors
          duration-300

          min-[375px]:px-5
          min-[375px]:py-7

          sm:rounded-3xl
          sm:px-7
          sm:py-8

          md:px-8

          lg:px-8

          xl:px-10

          dark:border-[#343445]
          dark:bg-[#181824]
          dark:shadow-[0_10px_35px_rgba(0,0,0,0.25)]
        "
      >
        {/* ===================================================
            TÍTULO
        ==================================================== */}

        <h1
          className="
            text-center

            text-[1.75rem]
            font-bold
            leading-tight

            text-[#111827]

            transition-colors
            duration-300

            min-[375px]:text-3xl

            sm:text-[2rem]

            lg:text-4xl

            dark:text-[#F5F5FA]
          "
        >
          Criar conta
        </h1>

        {/* ===================================================
            DESCRIÇÃO
        ==================================================== */}

        <p
          className="
            mx-auto
            mt-2

            max-w-sm

            px-2

            text-center
            text-base
            leading-6

            text-[#4B5563]

            transition-colors
            duration-300

            min-[375px]:text-[1.05rem]

            sm:mt-3
            sm:text-lg
            sm:leading-7

            lg:text-xl

            dark:text-[#B9B9C5]
          "
        >
          Cadastre-se de forma rápida e simples.
        </p>

        {/* ===================================================
            TIPO DE PERFIL
        ==================================================== */}

        <div
          className="
            mt-5
            w-full
            min-w-0

            sm:mt-6
          "
        >
          <TipoPerfilCampo
            tipoPerfil={tipoPerfil}
            setTipoPerfil={setTipoPerfil}
          />
        </div>

        {/* ===================================================
            CAMPOS
        ==================================================== */}

        <div
          className="
            mt-6
            space-y-4

            sm:mt-7
            sm:space-y-5

            lg:mt-8
          "
        >
          {/* Nome completo */}

          <CampoTexto
            id="nome"
            label="Nome completo"
            type="text"
            value={nome}
            onChange={setNome}
            maxLength={150}
            autoComplete="name"
          />

          {/* E-mail */}

          <CampoTexto
            id="email"
            label="E-mail"
            type="email"
            value={email}
            onChange={setEmail}
            maxLength={255}
            autoComplete="email"
          />

          {/* Senha */}

          <CampoTexto
            id="senha"
            label="Senha"
            type="password"
            value={senha}
            onChange={setSenha}
            minLength={6}
            autoComplete="new-password"
            hint="Use pelo menos 6 caracteres."
          />

          {/* Confirmação da senha */}

          <CampoTexto
            id="confirmacao_senha"
            label="Confirmação da senha"
            type="password"
            value={confirmacaoSenha}
            onChange={setConfirmacaoSenha}
            minLength={6}
            autoComplete="new-password"
          />

          {/* E-mail do familiar */}

          {tipoPerfil === "idoso" && (
            <CampoTexto
              id="email_convite_familiar"
              label="E-mail de um familiar (opcional)"
              type="email"
              value={emailConviteFamiliar}
              onChange={setEmailConviteFamiliar}
              required={false}
              maxLength={255}
              autoComplete="off"
              hint="Se você já tem um familiar no Elder, informe o e-mail dele para ligar as contas."
            />
          )}
        </div>

        {/* ===================================================
            ERRO
        ==================================================== */}

        {erro && (
          <p
            role="alert"
            className="
              mt-4

              rounded-xl

              bg-red-50

              p-3

              text-sm
              leading-5
              text-red-700

              transition-colors
              duration-300

              sm:mt-5
              sm:p-4
              sm:text-base

              dark:bg-red-950/40
              dark:text-red-300
            "
          >
            {erro}
          </p>
        )}

        {/* ===================================================
            BOTÃO CRIAR CONTA
        ==================================================== */}

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

            gap-2

            rounded-xl

            bg-[#6C63FF]

            px-4
            py-3

            text-base
            font-bold

            text-white

            transition
            duration-300

            hover:bg-[#5B54E8]

            focus:outline-none
            focus:ring-4
            focus:ring-[#EDE7FF]

            disabled:cursor-not-allowed
            disabled:opacity-70

            sm:mt-7
            sm:rounded-2xl
            sm:px-6
            sm:py-4
            sm:text-lg

            dark:bg-[#6C63FF]
            dark:hover:bg-[#7C74FF]
            dark:focus:ring-[#3A355C]
          "
        >
          {carregando && <Spinner />}

          {carregando
            ? "Criando conta"
            : "Criar minha conta"}
        </button>

        {/* ===================================================
            DIVISOR
        ==================================================== */}

        <div
          className="
            my-5

            flex
            items-center

            gap-3

            sm:my-6
            sm:gap-4
          "
        >
          <div
            className="
              h-px
              flex-1

              bg-gray-200

              dark:bg-[#343445]
            "
          />

          <span
            className="
              text-sm

              text-gray-500

              sm:text-base

              dark:text-[#B9B9C5]
            "
          >
            ou
          </span>

          <div
            className="
              h-px
              flex-1

              bg-gray-200

              dark:bg-[#343445]
            "
          />
        </div>

        {/* ===================================================
            GOOGLE
        ==================================================== */}

        <BotaoGoogle
          onClick={onGoogleCadastro}
          disabled={carregando}
        />

        {/* ===================================================
            LOGIN
        ==================================================== */}

        <p
          className="
            mt-5

            px-1

            text-center
            text-sm
            leading-6

            text-[#4B5563]

            transition-colors
            duration-300

            sm:mt-6
            sm:text-base

            lg:text-lg

            dark:text-[#B9B9C5]
          "
        >
          Já tem uma conta?{" "}

          <a
            href="/login"
            className="
              font-bold

              text-[#6C63FF]

              hover:underline

              focus:outline-none
              focus:ring-2
              focus:ring-[#6C63FF]/40

              dark:text-[#A89FFF]
            "
          >
            Entrar
          </a>
        </p>
      </form>
    </section>
  );
}

export default FormularioCadastro;
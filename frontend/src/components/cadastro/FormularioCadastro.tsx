
// Importa o tipo utilizado pelo evento de envio do formulário
import type { FormEvent } from "react";

// Importa o tipo dos perfis disponíveis
import type { TipoPerfil } from "../../lib/auth";

// Importa os componentes utilizados no formulário
import CampoTexto from "./CampoTexto";
import TipoPerfilCampo from "./TipoPerfil";
import BotaoGoogle from "./BotaoGoogle";
import Spinner from "../common/Spinner";

// Define as propriedades recebidas pelo formulário
type FormularioCadastroProps = {
  nome: string;
  email: string;
  senha: string;
  emailConviteFamiliar: string;
  tipoPerfil: TipoPerfil;
  erro: string | null;
  carregando: boolean;

  setNome: (valor: string) => void;
  setEmail: (valor: string) => void;
  setSenha: (valor: string) => void;
  setEmailConviteFamiliar: (valor: string) => void;
  setTipoPerfil: (tipo: TipoPerfil) => void;

  onSubmit: (e: FormEvent) => void;
  onGoogleCadastro: () => void;
};

// Componente responsável pelo formulário de cadastro
function FormularioCadastro({
  nome,
  email,
  senha,
  emailConviteFamiliar,
  tipoPerfil,
  erro,
  carregando,
  setNome,
  setEmail,
  setSenha,
  setEmailConviteFamiliar,
  setTipoPerfil,
  onSubmit,
  onGoogleCadastro,
}: FormularioCadastroProps) {
  return (
    <section
      className="
        flex
        min-h-screen
        items-center
        justify-center
        bg-white
        px-6
        py-10
        transition-colors
        duration-300
        dark:bg-[#101018]
      "
    >
      {/* Formulário principal */}
      <form
        onSubmit={onSubmit}
        className="
          w-full
          max-w-xl
          rounded-3xl
          border
          border-gray-200
          bg-white
          px-10
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
        <h1
          className="
            text-center
            text-4xl
            font-bold
            text-[#111827]
            transition-colors
            duration-300
            dark:text-[#F5F5FA]
          "
        >
          Criar conta
        </h1>

        {/* Descrição */}
        <p
          className="
            mt-3
            text-center
            text-2xl
            text-[#4B5563]
            transition-colors
            duration-300
            dark:text-[#B9B9C5]
          "
        >
          Cadastre-se de forma rápida e simples.
        </p>

        {/* Tipo de perfil */}
        <TipoPerfilCampo
          tipoPerfil={tipoPerfil}
          setTipoPerfil={setTipoPerfil}
        />

        {/* Campos do formulário */}
        <div className="mt-8 space-y-5">
          {/* Nome completo */}
          <CampoTexto
            id="nome"
            label="Nome completo"
            type="text"
            value={nome}
            onChange={setNome}
          />

          {/* E-mail */}
          <CampoTexto
            id="email"
            label="E-mail"
            type="email"
            value={email}
            onChange={setEmail}
          />

          {/* Senha */}
          <CampoTexto
            id="senha"
            label="Senha"
            type="password"
            value={senha}
            onChange={setSenha}
          />

          {/* E-mail do familiar - exibido somente para o perfil idoso */}
          {tipoPerfil === "idoso" && (
            <CampoTexto
              id="email_convite_familiar"
              label="E-mail de um familiar (opcional)"
              type="email"
              value={emailConviteFamiliar}
              onChange={setEmailConviteFamiliar}
              required={false}
            />
          )}
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
              transition-colors
              duration-300
              dark:bg-red-950/40
              dark:text-red-300
            "
          >
            {erro}
          </p>
        )}

        {/* Botão para criar a conta */}
        <button
          type="submit"
          disabled={carregando}
          aria-busy={carregando}
          className="
            mt-7
            flex
            w-full
            items-center
            justify-center
            gap-3
            rounded-2xl
            bg-[#6C63FF]
            px-6
            py-4
            text-lg
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
            dark:bg-[#6C63FF]
            dark:hover:bg-[#7C74FF]
            dark:focus:ring-[#3A355C]
          "
        >
          {carregando && <Spinner />}

          {carregando ? "Criando conta" : "Criar minha conta"}
        </button>

        {/* Divisor */}
        <div className="my-6 flex items-center gap-4">
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
              text-lg
              text-gray-500
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

        {/* Cadastro utilizando Google */}
        <BotaoGoogle
          onClick={onGoogleCadastro}
          disabled={carregando}
        />

        {/* Link para a página de login */}
        <p
          className="
            mt-6
            text-center
            text-lg
            text-[#4B5563]
            transition-colors
            duration-300
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

// Exporta o componente
export default FormularioCadastro;
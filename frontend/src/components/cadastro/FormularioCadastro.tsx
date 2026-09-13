// Importa o tipo utilizado pelo evento de envio do formulário
import type { FormEvent } from "react";

// Importa o tipo dos perfis disponíveis
import type { TipoPerfil } from "../../lib/auth";

// Importa os componentes utilizados no formulário
import CampoTexto from "./CampoTexto";
import TipoPerfilCampo from "./TipoPerfil";
import BotaoGoogle from "./BotaoGoogle";
import BotaoTema from "../layout/BotaoTema";

// Define as propriedades recebidas pelo formulário
type FormularioCadastroProps = {
  // Valores dos campos
  nome: string;
  email: string;
  senha: string;

  // Perfil selecionado
  tipoPerfil: TipoPerfil;

  // Mensagem de erro
  erro: string | null;

  // Funções para atualizar os campos
  setNome: (valor: string) => void;
  setEmail: (valor: string) => void;
  setSenha: (valor: string) => void;
  setTipoPerfil: (tipo: TipoPerfil) => void;

  // Função de cadastro com e-mail e senha
  onSubmit: (e: FormEvent) => void;

  // Função de cadastro com Google
  onGoogleCadastro: () => void;
};

// Componente responsável pelo formulário de cadastro
function FormularioCadastro({
  nome,
  email,
  senha,
  tipoPerfil,
  erro,
  setNome,
  setEmail,
  setSenha,
  setTipoPerfil,
  onSubmit,
  onGoogleCadastro,
}: FormularioCadastroProps) {
  return (
    <section
      className="
        relative
        flex
        min-h-screen
        items-center
        justify-center
        bg-white
        dark:bg-[#101018]
        px-6
        py-10
        transition-colors
        duration-300
      "
    >
      {/* Botão para alternar entre modo claro e escuro */}
      <div
        className="
          absolute
          right-6
          top-6
          z-50
        "
      >
        <BotaoTema />
      </div>

      {/* Formulário principal */}
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

          dark:border-[#343445]
          dark:bg-[#181824]
          dark:shadow-[0_10px_35px_rgba(0,0,0,0.25)]

          transition-colors
          duration-300
        "
      >
        {/* Título */}
        <h1
          className="
            text-center
            text-4xl
            font-bold
            text-[#111827]
            dark:text-[#F5F5FA]
            transition-colors
            duration-300
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
            dark:text-[#B9B9C5]
            transition-colors
            duration-300
          "
        >
          Cadastre-se de forma rápida e simples.
        </p>

        {/* Campos do formulário */}
        <div className="mt-8 space-y-5">

          {/* Campo nome */}
          <CampoTexto
            id="nome"
            label="Nome completo"
            type="text"
            value={nome}
            onChange={setNome}
          />

          {/* Seleção do tipo de perfil */}
          <TipoPerfilCampo
            tipoPerfil={tipoPerfil}
            setTipoPerfil={setTipoPerfil}
          />

          {/* Campo e-mail */}
          <CampoTexto
            id="email"
            label="E-mail"
            type="email"
            value={email}
            onChange={setEmail}
          />

          {/* Campo senha */}
          <CampoTexto
            id="senha"
            label="Senha"
            type="password"
            value={senha}
            onChange={setSenha}
          />

        </div>

        {/* Mensagem de erro */}
        {erro && (
          <p
            role="alert"
            className="
              mt-5
              rounded-xl
              bg-red-50
              p-3
              text-base
              text-red-700

              dark:bg-red-950/40
              dark:text-red-300

              transition-colors
              duration-300
            "
          >
            {erro}
          </p>
        )}

        {/* Botão principal */}
        <button
          type="submit"
          className="
            mt-7
            w-full
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

            dark:bg-[#8B82FF]
            dark:hover:bg-[#9E96FF]
            dark:focus:ring-[#3A355C]
          "
        >
          Criar minha conta
        </button>

        {/* Divisor */}
        <div className="my-6 flex items-center gap-4">

          {/* Linha esquerda */}
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
              text-base
              text-gray-500
              dark:text-[#B9B9C5]
            "
          >
            ou
          </span>

          {/* Linha direita */}
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
        <BotaoGoogle onClick={onGoogleCadastro} />

        {/* Link para login */}
        <p
          className="
            mt-6
            text-center
            text-base
            text-[#4B5563]
            dark:text-[#B9B9C5]
            transition-colors
            duration-300
          "
        >
          Já tem uma conta?{" "}

          <a
            href="/login"
            className="
              font-bold
              text-[#6C63FF]
              hover:underline
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
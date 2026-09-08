// Importa o tipo utilizado pelo evento de envio do formulário
import type { FormEvent } from "react";

// Importa o tipo dos perfis disponíveis
import type { TipoPerfil } from "../../lib/auth";

// Importa os componentes utilizados no formulário
import CampoTexto from "./CampoTexto";
import TipoPerfilCampo from "./TipoPerfil";
import BotaoGoogle from "./BotaoGoogle";

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
    <section className="flex items-center justify-center px-6 py-10">

      {/* Formulário principal */}
      <form
        onSubmit={onSubmit}
        className="w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-8 shadow-sm"
      >

        {/* Título */}
        <h1 className="text-center text-4xl font-bold text-[#111827]">
          Criar conta
        </h1>

        {/* Descrição */}
        <p className="mt-3 text-center text-lg text-[#4B5563]">
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

        {/* Exibe uma mensagem caso ocorra algum erro */}
        {erro && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-red-50 p-4 text-lg text-red-700"
          >
            {erro}
          </p>
        )}

        {/* Botão para cadastrar com e-mail e senha */}
        <button
          type="submit"
          className="
            mt-7
            w-full
            rounded-2xl
            bg-[#6C63FF]
            px-6
            py-4
            text-xl
            font-bold
            text-white
            transition
            hover:bg-[#5B54E8]
            focus:outline-none
            focus:ring-4
            focus:ring-[#EDE7FF]
          "
        >
          Criar minha conta
        </button>

        {/* Divisória entre o cadastro tradicional e o Google */}
        <div className="my-7 flex items-center gap-4">

          {/* Linha esquerda */}
          <div className="h-px flex-1 bg-gray-200" />

          <span className="text-lg text-gray-500">
            ou
          </span>

          {/* Linha direita */}
          <div className="h-px flex-1 bg-gray-200" />

        </div>

        {/* Botão para cadastro utilizando Google */}
        <BotaoGoogle
          onClick={onGoogleCadastro}
        />

        {/* Link para quem já possui uma conta */}
        <p className="mt-7 text-center text-lg text-[#4B5563]">
          Já tem uma conta?{" "}

          <a
            href="/login"
            className="font-bold text-[#6C63FF] underline"
          >
            Entrar
          </a>
        </p>

      </form>
    </section>
  );
}

export default FormularioCadastro;
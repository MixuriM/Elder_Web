import type { FormEvent } from "react";

import CampoTexto from "./CampoTexto";
import Spinner from "../common/Spinner";

// Formulário "Cadastrar idoso" (RF-030, só familiar). Mesmo visual do FormularioCadastro.
type FormularioCadastroIdosoProps = {
  nome: string;
  email: string;
  telefone: string;
  aceitaTermo: boolean;
  erro: string | null;
  proximoPasso: string | null;
  resultado: { nome: string; id: number; vinculoId: number; vinculoStatus: string } | null;
  carregando: boolean;

  setNome: (valor: string) => void;
  setEmail: (valor: string) => void;
  setTelefone: (valor: string) => void;
  setAceitaTermo: (valor: boolean) => void;

  onSubmit: (e: FormEvent) => void;
};

const MENSAGEM_ERRO =
  "mt-5 rounded-xl bg-red-50 p-4 text-lg text-red-700 transition-colors duration-300 dark:bg-red-950/40 dark:text-red-300";

function FormularioCadastroIdoso({
  nome,
  email,
  telefone,
  aceitaTermo,
  erro,
  proximoPasso,
  resultado,
  carregando,
  setNome,
  setEmail,
  setTelefone,
  setAceitaTermo,
  onSubmit,
}: FormularioCadastroIdosoProps) {
  return (
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
      <h1 className="text-center text-4xl font-bold text-[#111827] transition-colors duration-300 dark:text-[#F5F5FA]">
        Cadastrar idoso
      </h1>

      <p className="mt-3 text-center text-2xl text-[#4B5563] transition-colors duration-300 dark:text-[#B9B9C5]">
        Crie a conta de um idoso em seu nome. O e-mail dele é obrigatório: é com ele que o idoso
        assume a própria conta depois. O vínculo fica pendente até você confirmar o seu e-mail.
      </p>

      <div className="mt-8 space-y-5">
        <CampoTexto
          id="nome_idoso_cadastro"
          label="Nome do idoso"
          type="text"
          value={nome}
          onChange={setNome}
          maxLength={150}
        />
        <CampoTexto
          id="email_idoso_cadastro"
          label="E-mail do idoso"
          type="email"
          value={email}
          onChange={setEmail}
          maxLength={255}
        />
        <CampoTexto
          id="telefone_idoso_cadastro"
          label="Telefone do idoso (opcional)"
          type="tel"
          value={telefone}
          onChange={setTelefone}
          required={false}
          maxLength={20}
        />

        <div className="flex items-start gap-3">
          <input
            id="aceite_termo_cadastro"
            type="checkbox"
            checked={aceitaTermo}
            onChange={(e) => setAceitaTermo(e.target.checked)}
            className="mt-1 h-6 w-6 accent-[#6C63FF] focus:outline-none focus:ring-4 focus:ring-[#EDE7FF]"
          />
          {/* TEXTO PROVISÓRIO do termo de responsabilidade — texto final é do grupo. */}
          <label
            htmlFor="aceite_termo_cadastro"
            className="text-lg text-[#071A38] transition-colors duration-300 dark:text-[#F5F5FA]"
          >
            Declaro que sou responsável por cadastrar esta pessoa e que informei dados
            verdadeiros. (texto provisório)
          </label>
        </div>
      </div>

      {erro && (
        <p role="alert" className={MENSAGEM_ERRO}>
          {erro}
        </p>
      )}
      {proximoPasso && (
        <p role="alert" className={MENSAGEM_ERRO}>
          {proximoPasso}
        </p>
      )}

      {resultado && (
        <p className="mt-5 rounded-xl bg-green-50 p-4 text-lg text-green-800 dark:bg-green-950/40 dark:text-green-300">
          Idoso {resultado.nome} cadastrado (id {resultado.id}). Vínculo {resultado.vinculoId}:{" "}
          {resultado.vinculoStatus === "aprovado"
            ? "aprovado."
            : "pendente, aguardando a confirmação do seu e-mail."}
        </p>
      )}

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
          dark:hover:bg-[#7C74FF]
          dark:focus:ring-[#3A355C]
        "
      >
        {carregando && <Spinner />}
        {carregando ? "Cadastrando..." : "Cadastrar idoso"}
      </button>
    </form>
  );
}

export default FormularioCadastroIdoso;

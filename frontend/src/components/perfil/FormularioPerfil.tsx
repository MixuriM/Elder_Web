import type { FormEvent } from "react";

// Define as propriedades recebidas pelo formulário
type FormularioPerfilProps = {
  nome: string;
  email: string;
  telefone: string;
  erro: string | null;
  sucesso: boolean;

  setNome: (valor: string) => void;
  setEmail: (valor: string) => void;
  setTelefone: (valor: string) => void;

  onSubmit: (e: FormEvent) => void;
};

function FormularioPerfil({
  nome,
  email,
  telefone,
  erro,
  sucesso,
  setNome,
  setEmail,
  setTelefone,
  onSubmit,
}: FormularioPerfilProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="w-full space-y-6"
    >
      {/* Cabeçalho */}
      <div>
        <h1
          className="
            text-3xl
            font-bold
            text-gray-900
            dark:text-white
          "
        >
          Meu perfil
        </h1>

        <p
          className="
            mt-2
            text-lg
            text-gray-600
            dark:text-gray-300
          "
        >
          Atualize suas informações pessoais.
        </p>
      </div>

      {/* Nome */}
      <div>
        <label
          htmlFor="nome"
          className="
            block
            text-lg
            font-medium
            text-gray-800
            dark:text-gray-200
          "
        >
          Nome completo
        </label>

        <input
          id="nome"
          type="text"
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="
            mt-2
            w-full
            rounded-xl
            border
            border-gray-300
            bg-white
            px-4
            py-3
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
            dark:focus:border-[#8B85FF]
          "
        />
      </div>

      {/* E-mail */}
      <div>
        <label
          htmlFor="email"
          className="
            block
            text-lg
            font-medium
            text-gray-800
            dark:text-gray-200
          "
        >
          E-mail
        </label>

        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="
            mt-2
            w-full
            rounded-xl
            border
            border-gray-300
            bg-white
            px-4
            py-3
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
            dark:focus:border-[#8B85FF]
          "
        />
      </div>

      {/* Telefone */}
      <div>
        <label
          htmlFor="telefone"
          className="
            block
            text-lg
            font-medium
            text-gray-800
            dark:text-gray-200
          "
        >
          Telefone
        </label>

        <input
          id="telefone"
          type="tel"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          className="
            mt-2
            w-full
            rounded-xl
            border
            border-gray-300
            bg-white
            px-4
            py-3
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
            dark:focus:border-[#8B85FF]
          "
        />
      </div>

      {/* Mensagem de erro */}
      {erro && (
        <p
          role="alert"
          className="
            rounded-xl
            bg-red-50
            p-3
            text-base
            text-red-700

            dark:bg-red-950/40
            dark:text-red-300
          "
        >
          {erro}
        </p>
      )}

      {/* Mensagem de sucesso */}
      {sucesso && (
        <p
          role="alert"
          className="
            rounded-xl
            bg-green-50
            p-3
            text-base
            text-green-700

            dark:bg-green-950/40
            dark:text-green-300
          "
        >
          Perfil atualizado com sucesso.
        </p>
      )}

      {/* Botão */}
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

          dark:focus:ring-offset-gray-900
        "
      >
        Salvar alterações
      </button>
    </form>
  );
}

export default FormularioPerfil;
import {
  useRef,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  ArrowLeft,
  Camera,
  User,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

type FormularioPerfilProps = {
  nome: string;
  email: string;
  telefone: string;
  erro: string | null;
  sucesso: boolean;
  foto: string | null;
  enviandoFoto: boolean;
  erroFoto: string | null;
  sucessoFoto: string | null;

  setNome: (valor: string) => void;
  setEmail: (valor: string) => void;
  setTelefone: (valor: string) => void;
  onEnviarFoto: (arquivo: File) => void;
  onRemoverFoto: () => void;

  onSubmit: (e: FormEvent) => void;
};

function FormularioPerfil({
  nome,
  email,
  telefone,
  erro,
  sucesso,
  foto,
  enviandoFoto,
  erroFoto,
  sucessoFoto,
  setNome,
  setEmail,
  setTelefone,
  onEnviarFoto,
  onRemoverFoto,
  onSubmit,
}: FormularioPerfilProps) {

  // Permite navegar entre as páginas
  const navigate = useNavigate();

  // Referência para abrir o seletor de arquivos
  const inputFotoRef =
    useRef<HTMLInputElement>(null);

  // Seleciona a foto e envia pro servidor (o contexto atualiza a imagem)
  function handleFoto(
    e: ChangeEvent<HTMLInputElement>
  ) {
    const arquivo = e.target.files?.[0];

    // Permite escolher o mesmo arquivo de novo depois
    e.target.value = "";

    if (!arquivo) return;

    onEnviarFoto(arquivo);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full"
    >

      {/* Cabeçalho */}
      <div className="relative">

        {/* Botão voltar */}
        <button
          type="button"
          onClick={() => navigate("/Home")}
          aria-label="Voltar para a página inicial"
          title="Voltar"
          className="
            absolute
            left-0
            top-0

            flex
            h-10
            w-10
            items-center
            justify-center

            rounded-full

            border
            border-gray-200

            bg-white
            text-gray-700

            transition

            hover:border-[#6C63FF]
            hover:bg-[#F3F0FF]
            hover:text-[#6C63FF]

            focus:outline-none
            focus:ring-2
            focus:ring-[#6C63FF]/30

            dark:border-[#414152]
            dark:bg-[#191923]
            dark:text-gray-200

            dark:hover:border-[#6C63FF]
            dark:hover:bg-[#29263F]
            dark:hover:text-[#9B96FF]
          "
        >
          <ArrowLeft size={21} />
        </button>


        {/* Título */}
        <div className="px-12 text-center">

          <h1
            className="
              text-3xl
              font-bold
              text-gray-950
              dark:text-white
            "
          >
            Meu perfil
          </h1>

          <p
            className="
              mt-2
              text-base
              text-gray-600
              dark:text-gray-300
            "
          >
            Gerencie suas informações pessoais.
          </p>

        </div>

      </div>


      {/* Foto de perfil */}
      <div
        className="
          mt-7
          flex
          flex-col
          items-center
        "
      >

        <div className="relative">

          {/* Avatar */}
          <div
            className="
              flex
              h-36
              w-36
              items-center
              justify-center

              overflow-hidden
              rounded-full

              border-2
              border-[#DCD9FF]

              bg-[#F3F0FF]

              dark:border-[#49446E]
              dark:bg-[#29263F]
            "
          >

            {foto ? (
              <img
                src={foto}
                alt="Foto de perfil"
                className="
                  h-full
                  w-full
                  object-cover
                "
              />
            ) : (
              <User
                size={62}
                strokeWidth={1.7}
                className="
                  text-[#6C63FF]
                  dark:text-[#9B96FF]
                "
              />
            )}

          </div>


          {/* Botão da câmera */}
          <button
            type="button"
            onClick={() =>
              inputFotoRef.current?.click()
            }
            aria-label="Alterar foto de perfil"
            disabled={enviandoFoto}
            className="
              absolute
              bottom-1
              right-1

              flex
              h-11
              w-11
              items-center
              justify-center

              rounded-full

              border-2
              border-white

              bg-[#6C63FF]
              text-white

              shadow-sm
              transition

              hover:bg-[#5A52E0]

              focus:outline-none
              focus:ring-2
              focus:ring-[#6C63FF]/30

              dark:border-[#191923]
            "
          >
            <Camera size={20} />
          </button>

        </div>


        {/* Input escondido */}
        <input
          ref={inputFotoRef}
          id="foto-perfil"
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          aria-label="Escolher foto de perfil (JPEG ou PNG, até 2 MB)"
          onChange={handleFoto}
          className="hidden"
        />


        {/* Adicionar ou alterar foto */}
        <button
          type="button"
          onClick={() =>
            inputFotoRef.current?.click()
          }
          disabled={enviandoFoto}
          className="
            mt-3

            text-sm
            font-semibold
            text-[#6C63FF]

            transition

            hover:text-[#5A52E0]

            dark:text-[#9B96FF]
            dark:hover:text-[#B8B4FF]
          "
        >
          {foto
            ? "Alterar foto"
            : "Adicionar foto"}
        </button>

        {/* Remover foto: só aparece quando há foto */}
        {foto && (
          <button
            type="button"
            onClick={onRemoverFoto}
            disabled={enviandoFoto}
            className="
              mt-2

              text-sm
              font-semibold
              text-red-600

              transition

              hover:text-red-700

              dark:text-red-400
              dark:hover:text-red-300
            "
          >
            Remover foto de perfil
          </button>
        )}

        <p
          className="
            mt-2
            text-sm
            text-gray-600
            dark:text-gray-300
          "
        >
          JPEG ou PNG, até 2 MB.
        </p>

        {/* Feedback da foto */}
        {erroFoto && (
          <div
            role="alert"
            className="
              mt-3

              rounded-xl

              border
              border-red-200

              bg-red-50

              px-4
              py-3

              text-sm
              text-red-700

              dark:border-red-900/60
              dark:bg-red-950/30
              dark:text-red-300
            "
          >
            {erroFoto}
          </div>
        )}

        {sucessoFoto && (
          <div
            role="status"
            className="
              mt-3

              rounded-xl

              border
              border-green-200

              bg-green-50

              px-4
              py-3

              text-sm
              text-green-700

              dark:border-green-900/60
              dark:bg-green-950/30
              dark:text-green-300
            "
          >
            {sucessoFoto}
          </div>
        )}

      </div>


      {/* Campos do formulário */}
      <div className="mt-7 space-y-5">

        {/* Nome */}
        <div>

          <label
            htmlFor="nome"
            className="
              block
              text-base
              font-semibold
              text-gray-900
              dark:text-gray-100
            "
          >
            Nome completo
          </label>

          <input
            id="nome"
            type="text"
            required
            value={nome}
            onChange={(e) =>
              setNome(e.target.value)
            }
            placeholder="Digite seu nome"
            className="
              mt-2
              w-full

              rounded-xl
              border
              border-gray-300

              bg-white

              px-4
              py-3

              text-base
              text-gray-900

              outline-none
              transition

              placeholder:text-gray-400

              focus:border-[#6C63FF]
              focus:ring-2
              focus:ring-[#6C63FF]/15

              dark:border-[#414152]
              dark:bg-[#191923]
              dark:text-white
              dark:placeholder:text-gray-500
            "
          />

        </div>


        {/* E-mail */}
        <div>

          <label
            htmlFor="email"
            className="
              block
              text-base
              font-semibold
              text-gray-900
              dark:text-gray-100
            "
          >
            E-mail
          </label>

          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            placeholder="Digite seu e-mail"
            className="
              mt-2
              w-full

              rounded-xl
              border
              border-gray-300

              bg-white

              px-4
              py-3

              text-base
              text-gray-900

              outline-none
              transition

              placeholder:text-gray-400

              focus:border-[#6C63FF]
              focus:ring-2
              focus:ring-[#6C63FF]/15

              dark:border-[#414152]
              dark:bg-[#191923]
              dark:text-white
              dark:placeholder:text-gray-500
            "
          />

        </div>


        {/* Telefone */}
        <div>

          <label
            htmlFor="telefone"
            className="
              block
              text-base
              font-semibold
              text-gray-900
              dark:text-gray-100
            "
          >
            Telefone
          </label>

          <input
            id="telefone"
            type="tel"
            value={telefone}
            onChange={(e) =>
              setTelefone(e.target.value)
            }
            placeholder="(00) 00000-0000"
            className="
              mt-2
              w-full

              rounded-xl
              border
              border-gray-300

              bg-white

              px-4
              py-3

              text-base
              text-gray-900

              outline-none
              transition

              placeholder:text-gray-400

              focus:border-[#6C63FF]
              focus:ring-2
              focus:ring-[#6C63FF]/15

              dark:border-[#414152]
              dark:bg-[#191923]
              dark:text-white
              dark:placeholder:text-gray-500
            "
          />

        </div>

      </div>


      {/* Mensagem de erro */}
      {erro && (
        <div
          role="alert"
          className="
            mt-5

            rounded-xl

            border
            border-red-200

            bg-red-50

            px-4
            py-3

            text-sm
            text-red-700

            dark:border-red-900/60
            dark:bg-red-950/30
            dark:text-red-300
          "
        >
          {erro}
        </div>
      )}


      {/* Mensagem de sucesso */}
      {sucesso && (
        <div
          role="status"
          className="
            mt-5

            rounded-xl

            border
            border-green-200

            bg-green-50

            px-4
            py-3

            text-sm
            text-green-700

            dark:border-green-900/60
            dark:bg-green-950/30
            dark:text-green-300
          "
        >
          Perfil atualizado com sucesso.
        </div>
      )}


      {/* Botão salvar */}
      <button
        type="submit"
        className="
          mt-7
          w-full

          rounded-xl

          bg-[#6C63FF]

          px-6
          py-3.5

          text-base
          font-bold
          text-white

          shadow-sm
          transition

          hover:bg-[#5A52E0]

          focus:outline-none
          focus:ring-2
          focus:ring-[#6C63FF]
          focus:ring-offset-2

          dark:focus:ring-offset-[#191923]
        "
      >
        Salvar alterações
      </button>

    </form>
  );
}

export default FormularioPerfil;
import folhasDecorativas from "../../Img/folhas_superior.png";
import florCadastro from "../../Img/flor_cadastro.svg";
import logoElder from "../../Img/Elder_logo.svg";

import type { TipoPerfil } from "../../lib/auth";

// Define as propriedades recebidas pelo componente
type LadoInformativoProps = {
  tipo: "landing" | "cadastro" | "login";

  // Perfil é opcional porque só será utilizado no cadastro
  tipoPerfil?: TipoPerfil;
};

function LadoInformativo({
  tipo,
  tipoPerfil,
}: LadoInformativoProps) {
  // Conteúdos gerais utilizados na Landing e no Login
  const conteudos = {
    landing: {
      destaque: "Saúde e cuidado",
      titulo: "para uma vida com mais",
      complemento: "autonomia e segurança.",
      descricao:
        "O Elder ajuda idosos, familiares e cuidadores a acompanharem informações importantes de saúde, medicamentos e cuidados do dia a dia em um só lugar.",
    },

    cadastro: {
      destaque: "Comece com o Elder",
      titulo: "mais organização",
      complemento: "para cuidar de quem importa.",
      descricao:
        "Crie sua conta e organize informações de saúde, medicamentos e cuidados da pessoa idosa de forma simples e acessível.",
    },

    login: {
      destaque: "Que bom ter você de volta!",
      titulo: "Continue acompanhando",
      complemento: "os cuidados de quem importa.",
      descricao:
        "Acesse sua conta e continue acompanhando informações importantes de saúde, medicamentos e cuidados.",
    },
  };

  // Conteúdo específico para cada tipo de usuário no cadastro
  const conteudoCadastro = {
    idoso: {
      destaque: "Mais autonomia para você",
      titulo: "organize sua rotina",
      complemento: "com segurança e tranquilidade.",
      descricao:
        "Acompanhe medicamentos, informações de saúde e cuidados do dia a dia de forma simples e acessível.",
    },

    cuidador: {
      destaque: "Cuidar pode ser mais simples",
      titulo: "tenha mais organização",
      complemento: "na rotina de cuidados.",
      descricao:
        "Organize informações importantes, medicamentos e cuidados da pessoa idosa em um só lugar.",
    },

    familiar: {
      destaque: "Esteja mais perto",
      titulo: "acompanhe os cuidados",
      complemento: "de quem importa.",
      descricao:
        "Acompanhe informações de saúde, medicamentos e cuidados da pessoa idosa de forma organizada.",
    },
  };

  // Seleciona o conteúdo correto
  const conteudo =
    tipo === "cadastro" && tipoPerfil
      ? conteudoCadastro[tipoPerfil]
      : conteudos[tipo];

  return (
    <section
      className="
        relative
        hidden

        h-full
        min-h-screen

        overflow-hidden

        bg-[#F3F0FF]

        px-12

        transition-colors
        duration-300

        dark:bg-[#151522]

        lg:flex
        lg:items-center

        xl:px-16
      "
    >
      {/* Folhas decorativas superiores */}
      <img
        src={folhasDecorativas}
        alt=""
        aria-hidden="true"
        className="
          pointer-events-none

          absolute
          left-0
          top-0

          w-[270px]

          opacity-35

          dark:opacity-15
        "
      />

      {/* Folhas decorativas inferiores */}
      <img
        src={florCadastro}
        alt=""
        aria-hidden="true"
        className="
          pointer-events-none

          absolute
          -bottom-6
          -right-4

          w-72

          opacity-20

          dark:opacity-10
        "
      />

      {/* Conteúdo principal */}
      <div
        className={`
          relative
          z-10

          mx-auto

          w-full
          max-w-2xl

          ${tipo !== "landing" ? "-translate-y-6" : ""}
        `}
      >
        {/* Logo */}
        <div className="flex w-full justify-center">
          <img
            src={logoElder}
            alt="Elder"
            className="
              h-auto
              w-56

              xl:w-60
            "
          />
        </div>

        {/* Título */}
        <h1
          className="
            mx-auto
            mt-3
            max-w-xl

            text-center
            text-3xl
            font-bold
            leading-[1.15]

            text-[#071A38]

            transition-colors
            duration-300

            dark:text-[#F5F5FA]

            xl:text-4xl
          "
        >
          <span
            className="
              text-[#6C63FF]
              dark:text-[#A89FFF]
            "
          >
            {conteudo.destaque}
          </span>

          <br />

          {conteudo.titulo}

          <br />

          {conteudo.complemento}
        </h1>

        {/* Descrição */}
        <p
          className="
            mx-auto
            mt-5
            max-w-lg

            text-center
            text-lg
            leading-8

            text-[#56657D]

            transition-colors
            duration-300

            dark:text-[#C7C7D1]
          "
        >
          {conteudo.descricao}
        </p>

        {/* Benefícios aparecem somente na Landing */}
        {tipo === "landing" && (
          <div
            className="
              mx-auto
              mt-8
              max-w-xl
              space-y-4
            "
          >
            {/* Benefício 1 */}
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="
                  flex
                  h-9
                  w-9
                  shrink-0
                  items-center
                  justify-center

                  rounded-full

                  bg-[#E2DEFF]

                  font-bold
                  text-[#6C63FF]

                  dark:bg-[#2A2840]
                  dark:text-[#A89FFF]
                "
              >
                ✓
              </span>

              <p
                className="
                  text-lg
                  text-[#40506A]

                  dark:text-[#D6D6DF]
                "
              >
                Mais autonomia para a pessoa idosa
              </p>
            </div>

            {/* Benefício 2 */}
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="
                  flex
                  h-9
                  w-9
                  shrink-0
                  items-center
                  justify-center

                  rounded-full

                  bg-[#E2DEFF]

                  font-bold
                  text-[#6C63FF]

                  dark:bg-[#2A2840]
                  dark:text-[#A89FFF]
                "
              >
                ✓
              </span>

              <p
                className="
                  text-lg
                  text-[#40506A]

                  dark:text-[#D6D6DF]
                "
              >
                Mais organização para a rotina de cuidados
              </p>
            </div>

            {/* Benefício 3 */}
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="
                  flex
                  h-9
                  w-9
                  shrink-0
                  items-center
                  justify-center

                  rounded-full

                  bg-[#E2DEFF]

                  font-bold
                  text-[#6C63FF]

                  dark:bg-[#2A2840]
                  dark:text-[#A89FFF]
                "
              >
                ✓
              </span>

              <p
                className="
                  text-lg
                  text-[#40506A]

                  dark:text-[#D6D6DF]
                "
              >
                Mais proximidade entre idosos, familiares e cuidadores
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default LadoInformativo;
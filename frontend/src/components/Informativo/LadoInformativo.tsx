import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

import folhasDecorativas from "../../Img/folhaInformativo.png";
import florCadastro from "../../Img/flor_cadastro.svg";
import logoElder from "../../Img/Elder_logo.svg";

import type { TipoPerfil } from "../../lib/auth";

type LadoInformativoProps = {
  tipo: "landing" | "cadastro" | "login";
  tipoPerfil?: TipoPerfil;
};

function LadoInformativo({
  tipo,
  tipoPerfil,
}: LadoInformativoProps) {
  const navigate = useNavigate();

  // =========================================================
  // NAVEGAÇÃO
  // =========================================================

  const handleVoltar = () => {
    if (tipo === "landing") {
      navigate("/");
      return;
    }

    navigate("/welcome");
  };

  // =========================================================
  // CONTEÚDOS GERAIS
  // =========================================================

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

  // =========================================================
  // CONTEÚDOS ESPECÍFICOS DO CADASTRO
  // =========================================================

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

  // =========================================================
  // SELECIONA O CONTEÚDO
  // =========================================================

  const conteudo =
    tipo === "cadastro" && tipoPerfil
      ? conteudoCadastro[tipoPerfil]
      : conteudos[tipo];

  return (
    <section
      className="
        relative
        flex
        w-full
        overflow-hidden

        bg-[#F3F0FF]

        px-4
        pb-10
        pt-20

        transition-colors
        duration-300

        min-[375px]:px-5
        min-[375px]:pb-12

        sm:px-6
        sm:pb-12
        sm:pt-24

        md:px-8
        md:py-12

        lg:h-full
        lg:items-center
        lg:px-10
        lg:py-12

        xl:px-16

        dark:bg-[#151522]
      "
    >
      {/* =====================================================
          BOTÃO VOLTAR
      ====================================================== */}

      <button
        type="button"
        onClick={handleVoltar}
        aria-label={
          tipo === "landing"
            ? "Voltar para a página inicial"
            : "Voltar para a tela de boas-vindas"
        }
        className="
          absolute
          left-4
          top-4
          z-50

          flex
          h-10
          items-center
          justify-center
          gap-2

          rounded-xl

          border
          border-[#D8D4F0]

          bg-white/70

          px-3

          text-sm
          font-semibold
          text-[#071A38]

          shadow-sm
          backdrop-blur-sm

          transition-all
          duration-200

          hover:border-[#6C63FF]
          hover:bg-white
          hover:text-[#6C63FF]

          sm:left-5
          sm:top-5
          sm:h-11
          sm:px-4

          lg:left-6
          lg:top-6

          dark:border-[#343447]
          dark:bg-[#1D1D2B]/80
          dark:text-[#F5F5FA]

          dark:hover:border-[#A89FFF]
          dark:hover:bg-[#252536]
          dark:hover:text-[#A89FFF]
        "
      >
        <ArrowLeft
          size={18}
          strokeWidth={2.2}
        />

        <span className="hidden sm:inline">
          {tipo === "landing"
            ? "Página inicial"
            : "Voltar"}
        </span>
      </button>

      {/* =====================================================
          FOLHAS DECORATIVAS SUPERIORES
      ====================================================== */}

      <img
        src={folhasDecorativas}
        alt=""
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          left-0
          top-0
          z-0

          w-36
          opacity-15

          min-[375px]:w-40

          sm:w-52
          sm:opacity-20

          md:w-60

          lg:w-72
          lg:opacity-25

          xl:w-[330px]
          xl:opacity-35

          dark:opacity-10

          xl:dark:opacity-15
        "
      />

      {/* =====================================================
          FLOR / FOLHAS INFERIORES

          Agora existe UMA ÚNICA decoração.

          MOBILE:
          aparece no canto inferior direito.

          TABLET:
          aumenta um pouco.

          DESKTOP:
          fica maior e acompanha toda a coluna.
      ====================================================== */}

      <img
        src={florCadastro}
        alt=""
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          z-0

          bottom-0
          -right-3

          w-28
          opacity-15

          min-[375px]:w-32

          sm:-right-3
          sm:w-40
          sm:opacity-10

          md:w-48

          lg:-bottom-5
          lg:-right-4
          lg:w-60
          lg:opacity-15

          xl:w-72
          xl:opacity-20

          dark:opacity-10
        "
      />

      {/* =====================================================
          CONTEÚDO PRINCIPAL
      ====================================================== */}

      <div
        className={`
          relative
          z-10

          mx-auto
          my-auto

          w-full
          max-w-2xl

          ${
            tipo !== "landing"
              ? "lg:-translate-y-6"
              : ""
          }
        `}
      >
        {/* ===================================================
            LOGO
        ==================================================== */}

        <div
          className="
            flex
            w-full
            justify-center
          "
        >
          <img
            src={logoElder}
            alt="Elder"
            className="
              h-auto
              w-32

              min-[375px]:w-36

              sm:w-44

              md:w-48

              lg:w-52

              xl:w-60
            "
          />
        </div>

        {/* ===================================================
            TÍTULO
        ==================================================== */}

        <h1
          className="
            mx-auto
            mt-3

            max-w-xl

            px-1

            text-center
            text-[1.55rem]
            font-bold
            leading-[1.18]

            text-[#071A38]

            transition-colors
            duration-300

            min-[375px]:text-[1.7rem]

            sm:text-3xl

            md:text-[2rem]

            lg:text-[2.15rem]

            xl:text-4xl

            dark:text-[#F5F5FA]
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

        {/* ===================================================
            DESCRIÇÃO
        ==================================================== */}

        <p
          className="
            mx-auto
            mt-4

            max-w-lg

            px-1

            text-center
            text-sm
            leading-6

            text-[#56657D]

            transition-colors
            duration-300

            min-[375px]:text-[0.95rem]

            sm:mt-5
            sm:px-2
            sm:text-base
            sm:leading-7

            md:text-[1.05rem]

            lg:text-lg
            lg:leading-8

            dark:text-[#C7C7D1]
          "
        >
          {conteudo.descricao}
        </p>

        {/* ===================================================
            BENEFÍCIOS
            SOMENTE NA WELCOME
        ==================================================== */}

        {tipo === "landing" && (
          <div
            className="
              relative

              mx-auto
              mt-6

              max-w-xl

              space-y-3

              pb-8

              sm:mt-7
              sm:space-y-4
              sm:pb-4

              lg:mt-8
              lg:pb-0
            "
          >
            {/* =================================================
                BENEFÍCIO 1
            ================================================== */}

            <div
              className="
                relative
                z-10

                flex
                items-center
                gap-2.5

                sm:gap-3
              "
            >
              <span
                aria-hidden="true"
                className="
                  flex
                  h-8
                  w-8
                  shrink-0

                  items-center
                  justify-center

                  rounded-full

                  bg-[#E2DEFF]

                  text-sm
                  font-bold
                  text-[#6C63FF]

                  sm:h-9
                  sm:w-9
                  sm:text-base

                  dark:bg-[#2A2840]
                  dark:text-[#A89FFF]
                "
              >
                ✓
              </span>

              <p
                className="
                  text-sm
                  leading-5

                  text-[#40506A]

                  sm:text-base
                  sm:leading-6

                  lg:text-lg

                  dark:text-[#D6D6DF]
                "
              >
                Mais autonomia para a pessoa idosa
              </p>
            </div>

            {/* =================================================
                BENEFÍCIO 2
            ================================================== */}

            <div
              className="
                relative
                z-10

                flex
                items-center
                gap-2.5

                sm:gap-3
              "
            >
              <span
                aria-hidden="true"
                className="
                  flex
                  h-8
                  w-8
                  shrink-0

                  items-center
                  justify-center

                  rounded-full

                  bg-[#E2DEFF]

                  text-sm
                  font-bold
                  text-[#6C63FF]

                  sm:h-9
                  sm:w-9
                  sm:text-base

                  dark:bg-[#2A2840]
                  dark:text-[#A89FFF]
                "
              >
                ✓
              </span>

              <p
                className="
                  text-sm
                  leading-5

                  text-[#40506A]

                  sm:text-base
                  sm:leading-6

                  lg:text-lg

                  dark:text-[#D6D6DF]
                "
              >
                Mais organização para a rotina de cuidados
              </p>
            </div>

            {/* =================================================
                BENEFÍCIO 3
            ================================================== */}

            <div
              className="
                relative
                z-10

                flex
                items-center
                gap-2.5

                sm:gap-3
              "
            >
              <span
                aria-hidden="true"
                className="
                  flex
                  h-8
                  w-8
                  shrink-0

                  items-center
                  justify-center

                  rounded-full

                  bg-[#E2DEFF]

                  text-sm
                  font-bold
                  text-[#6C63FF]

                  sm:h-9
                  sm:w-9
                  sm:text-base

                  dark:bg-[#2A2840]
                  dark:text-[#A89FFF]
                "
              >
                ✓
              </span>

              <p
                className="
                  pr-8

                  text-sm
                  leading-5

                  text-[#40506A]

                  min-[375px]:pr-10

                  sm:pr-16
                  sm:text-base
                  sm:leading-6

                  md:pr-20

                  lg:pr-0
                  lg:text-lg

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
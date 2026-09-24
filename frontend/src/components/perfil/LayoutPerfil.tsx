// Importa o tipo utilizado para receber componentes dentro do layout
import type { ReactNode } from "react";

// Importa o controle responsável pela troca de tema
import ControleTema from "../layout/ControleTema";

// Importa as folhas decorativas
import folhasDecorativas from "../../Img/folhas_superior.png";

// Define as propriedades recebidas pelo layout
type LayoutPerfilProps = {
  children: ReactNode;
};

// Componente responsável pela estrutura visual da página de perfil
function LayoutPerfil({
  children,
}: LayoutPerfilProps) {
  return (
    <main
      className="
        relative
        flex
        min-h-screen
        items-center
        justify-center
        overflow-hidden

        bg-[#F8F7FC]

        px-6
        py-12

        dark:bg-gray-950

        sm:px-8
        lg:px-12
      "
    >

      {/* Folhas decorativas - canto superior esquerdo */}
      <img
        src={folhasDecorativas}
        alt=""
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          left-0
          top-0

          w-52
          opacity-40

          dark:opacity-15

          sm:w-64
          lg:w-72
        "
      />


      {/* Folhas decorativas - canto inferior direito */}
      <img
        src={folhasDecorativas}
        alt=""
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          bottom-0
          right-0

          w-56
          rotate-180
          opacity-30

          dark:opacity-10

          sm:w-72
          lg:w-80
        "
      />


      {/* Botão responsável pela alteração do tema */}
      <div
        className="
          absolute
          right-3
          top-3
          z-20

          lg:right-8
          lg:top-8
        "
      >
        <ControleTema responsivo />
      </div>


      {/* Área principal do perfil */}
      <section
        className="
          relative
          z-10

          w-full
          max-w-xl

          rounded-3xl

          border
          border-gray-200

          bg-white

          p-6

          shadow-sm

          dark:border-gray-700
          dark:bg-gray-900

          sm:p-8
          lg:p-10
        "
      >
        {children}
      </section>

    </main>
  );
}

export default LayoutPerfil;
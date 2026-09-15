// Importa o tipo utilizado para receber componentes dentro do layout
import type { ReactNode } from "react";

// Importa o controle responsável pela troca de tema
import ControleTema from "../layout/ControleTema";

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

        bg-[#F8F7FC]
        px-6
        py-12

        dark:bg-gray-950

        sm:px-8
        lg:px-12
      "
    >
      {/* Botão responsável pela alteração do tema */}
      <div
        className="
          absolute
          right-5
          top-5

          sm:right-8
          sm:top-8
        "
      >
        <ControleTema />
      </div>

      {/* Área principal do perfil */}
      <section
        className="
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
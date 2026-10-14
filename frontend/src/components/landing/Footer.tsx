import { Link } from "react-router-dom";

import { DOCUMENTOS_LEGAIS } from "../../lib/documentosLegais";

function Footer() {
  return (
    <footer
      className="
        border-t
        border-gray-200
        bg-white

        px-6
        py-8

        transition-colors
        duration-300

        dark:border-white/10
        dark:bg-[#0D0D16]
      "
    >
      <div
        className="
          mx-auto
          flex
          max-w-7xl
          flex-col
          items-center
          justify-between
          gap-3

          text-center

          md:flex-row
          md:text-left
        "
      >
        {/* Direitos autorais */}
        <p
          className="
            text-sm
            text-gray-500

            dark:text-gray-400
          "
        >
          © {new Date().getFullYear()} Elder Web.
          Todos os direitos reservados.
        </p>

        <nav aria-label="Documentos legais">
          <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            {DOCUMENTOS_LEGAIS.map((d) => (
              <li key={d.caminho}>
                <Link
                  to={d.caminho}
                  className="inline-flex min-h-11 items-center px-1 text-base font-semibold text-[#071A38] underline underline-offset-4 hover:text-[#5F56EC] dark:text-[#F5F5FA] dark:hover:text-[#B6B0FF]"
                >
                  {d.titulo}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Frase do Elder */}
        <p
          className="
            text-sm
            text-gray-500

            dark:text-gray-400
          "
        >
          Tecnologia para uma vida com mais significado.
        </p>
      </div>
    </footer>
  );
}

export default Footer;
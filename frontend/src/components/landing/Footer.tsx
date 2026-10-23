
import { Link } from 'react-router-dom'

import { DOCUMENTOS_LEGAIS } from '../../lib/documentosLegais'
import logoElder from '../../Img/Elder_logo.webp'

const AJUDA = [
  { caminho: '/orientacoes', titulo: 'Orientações gerais' },
  { caminho: '/sobre-nos', titulo: 'Sobre nós' },
]

const ESTILO_LINK = `
  inline-flex min-h-10 items-center
  rounded-md text-sm
  text-slate-600
  transition-colors duration-200
  hover:text-[#6258E8]
  hover:underline
  underline-offset-4
  focus-visible:outline
  focus-visible:outline-2
  focus-visible:outline-offset-4
  focus-visible:outline-[#6258E8]
  dark:text-[#D4D1E5]
  dark:hover:text-[#B9B3FF]
  dark:focus-visible:outline-[#B9B3FF]
`

function Footer() {
  return (
    <footer
      className="
        border-t border-[#E7E3F5]
        bg-[#FAF9FF]
        px-5 py-8
        text-[#071A38]
        transition-colors duration-300
        sm:px-8
        dark:border-[#35334A]
        dark:bg-[#0D0D16]
        dark:text-[#F5F5FA]
      "
    >
      <div className="mx-auto w-full max-w-5xl">

        {/* CONTEÚDO PRINCIPAL */}
        <div
          className="
            grid grid-cols-1 gap-8
            text-center
            sm:grid-cols-2 sm:text-left
            lg:grid-cols-[1.6fr_1fr_1fr]
            lg:gap-10
          "
        >
          {/* LOGO E IDENTIDADE */}
          <div
            className="
              flex flex-col items-center
              gap-3
              sm:items-start
            "
          >
            <Link
              to="/"
              aria-label="Elder Web - Página inicial"
              className="
                inline-flex items-center
                rounded-lg
                focus-visible:outline
                focus-visible:outline-2
                focus-visible:outline-offset-4
                focus-visible:outline-[#6258E8]
                dark:focus-visible:outline-[#B9B3FF]
              "
            >
              <img
                src={logoElder}
                alt=""
                width={64}
                height={64}
                className="h-16 w-16 object-contain"
              />
            </Link>

            <p
              className="
                max-w-xs text-sm leading-6
                text-slate-600
                dark:text-[#B8B5C9]
              "
            >
              Tecnologia para uma vida com mais significado.
            </p>
          </div>

          {/* EXPLORE */}
          <nav
            aria-label="Ajuda e informações"
            className="
              flex flex-col items-center
              sm:items-start
            "
          >
            <h2
              className="
                mb-2 text-sm font-bold
                text-[#071A38]
                dark:text-[#F5F5FA]
              "
            >
              Explore
            </h2>

            <ul className="flex flex-col items-center sm:items-start">
              {AJUDA.map((item) => (
                <li key={item.caminho}>
                  <Link
                    to={item.caminho}
                    className={ESTILO_LINK}
                  >
                    {item.titulo}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* INFORMAÇÕES LEGAIS */}
          <nav
            aria-label="Documentos legais"
            className="
              flex flex-col items-center
              sm:items-start
              sm:col-span-2
              lg:col-span-1
            "
          >
            <h2
              className="
                mb-2 text-sm font-bold
                text-[#071A38]
                dark:text-[#F5F5FA]
              "
            >
              Informações legais
            </h2>

            <ul className="flex flex-col items-center sm:items-start">
              {DOCUMENTOS_LEGAIS.map((documento) => (
                <li key={documento.caminho}>
                  <Link
                    to={documento.caminho}
                    className={ESTILO_LINK}
                  >
                    {documento.titulo}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* DIVISÓRIA */}
        <div
          aria-hidden="true"
          className="
            my-7 h-px w-full
            bg-[#E7E3F5]
            dark:bg-[#35334A]
          "
        />

        {/* RODAPÉ INFERIOR */}
        <div
          className="
            flex flex-col items-center
            justify-between gap-2
            text-center text-xs
            text-slate-500
            sm:flex-row sm:text-left
            dark:text-[#A9A6BC]
          "
        >
          <p>
            © {new Date().getFullYear()} Elder Web.
            Todos os direitos reservados.
          </p>

          <p>
            Projeto acadêmico — Etec Fernando Prestes.
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer

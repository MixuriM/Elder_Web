
import type { ReactNode } from 'react'
import { FileText } from 'lucide-react'
import { useLocation } from 'react-router-dom'

import CabecalhoLegal from './CabecalhoLegal'
import HeroLegal from './HeroLegal'
import NavegacaoLegal from './NavegacaoLegal'
import MenuLateralLegal from './MenuLateralLegal'
import ResumoLegal from './ResumoLegal'

import folhaInicioD from '../../img/folha_inicioD.webp'

import { useTitulo } from '../../hooks/useTitulo'

import {
  DATA_ATUALIZACAO,
  VERSAO_DOCUMENTOS,
} from '../../lib/documentosLegais'

// Mantém compatibilidade com as páginas existentes
export {
  Secao,
  Lista,
  Tabela,
  LinkInterno,
  LinkContato,
  LinkExterno,
} from './ElementosLegais'

type Props = {
  titulo: string
  resumo: ReactNode[]
  avisoAcademico?: boolean
  children: ReactNode
}

export default function PaginaLegal({
  titulo,
  resumo,
  avisoAcademico = false,
  children,
}: Props) {
  useTitulo(titulo)

  const { pathname } = useLocation()

  // Páginas com índice lateral configurado
  const temMenuLateral = [
    '/termos',
    '/privacidade',
  ].includes(pathname)

  return (
    <div
      className="
        relative isolate min-h-dvh
        overflow-x-clip
        bg-[#FAF9FF] text-[#071A38]
        transition-colors duration-200
        dark:bg-[#101018] dark:text-[#F5F5FA]
      "
    >
    
{/* FOLHAS DECORATIVAS POR TODA A PÁGINA */}
<div
  aria-hidden="true"
  className="
    pointer-events-none
    absolute inset-0 z-0
    flex flex-col
    justify-between
    overflow-hidden
  "
>
  {Array.from({ length: 12 }).map((_, index) => {
    const esquerda = index % 2 === 0

    return (
      <div
        key={index}
        className="
          relative w-full
          shrink-0
        "
      >
        <img
          src={folhaInicioD}
          alt=""
          loading="lazy"
          className={`
            absolute top-0
            w-40
            opacity-15
            sm:w-56
            lg:w-72
            dark:opacity-25
            ${
              esquerda
                ? '-left-20 -scale-x-100 sm:-left-28 lg:-left-32'
                : '-right-20 sm:-right-28 lg:-right-32'
            }
          `}
        />
      </div>
    )
  })}
</div>


      {/* CABEÇALHO */}
      <div className="relative z-10">
        <CabecalhoLegal />
      </div>

      {/* CONTEÚDO PRINCIPAL */}
      <main
        id="conteudo-principal"
        className="
          relative z-10 mx-auto w-full
          max-w-7xl px-4 pb-16
          sm:px-6 lg:px-8
        "
      >
        {/* APRESENTAÇÃO */}
        <HeroLegal />

        {/* NAVEGAÇÃO ENTRE DOCUMENTOS */}
        <NavegacaoLegal />

        {/* ÁREA DOS DOCUMENTOS */}
        <div
          className={`
            mt-8 grid grid-cols-1
            items-start gap-8
            rounded-3xl border
            border-[#DDD8F5]
            bg-white/95 p-5
            shadow-[0_10px_40px_rgba(40,30,90,0.05)]
            sm:p-7
            lg:gap-10 lg:p-9
            dark:border-[#35334A]
            dark:bg-[#191927]/95
            dark:shadow-[0_10px_40px_rgba(0,0,0,0.15)]
            ${
              temMenuLateral
                ? 'lg:grid-cols-[250px_minmax(0,1fr)]'
                : 'lg:grid-cols-1'
            }
          `}
        >
          {/* MENU LATERAL */}
          {temMenuLateral && <MenuLateralLegal />}

          {/* DOCUMENTO */}
          <article
            aria-labelledby="titulo-documento"
            className="
              min-w-0 w-full space-y-9
              text-base leading-8
              sm:text-lg
              [&_p]:[overflow-wrap:anywhere]
            "
          >
            {/* TÍTULO DO DOCUMENTO */}
            <header
              className="
                space-y-5 border-b
                border-[#E7E3F5] pb-7
                dark:border-[#35334A]
              "
            >
              <div
                className="
                  flex flex-col items-start gap-4
                  sm:flex-row sm:items-center
                "
              >
                {/* ÍCONE */}
                <div
                  aria-hidden="true"
                  className="
                    flex h-14 w-14 shrink-0
                    items-center justify-center
                    rounded-2xl bg-[#EEE9FF]
                    text-[#6258E8]
                    dark:bg-[#302A50]
                    dark:text-[#B6B0FF]
                  "
                >
                  <FileText size={27} />
                </div>

                {/* NOME DO DOCUMENTO */}
                <div className="min-w-0 flex-1 space-y-2">
                  <h2
                    id="titulo-documento"
                    className="
                      break-words text-2xl
                      font-bold tracking-tight
                      text-[#071A38]
                      sm:text-3xl
                      dark:text-[#F5F5FA]
                    "
                  >
                    {titulo}
                  </h2>

                  <p
                    className="
                      text-sm leading-6
                      text-slate-600
                      dark:text-[#C9C7DB]
                    "
                  >
                    Informações importantes sobre
                    o uso do Elder Web.
                  </p>
                </div>
              </div>

              {/* VERSÃO E ATUALIZAÇÃO */}
              <div
                className="
                  flex flex-wrap gap-x-5 gap-y-2
                  text-sm font-medium
                  text-slate-600
                  dark:text-[#C9C7DB]
                "
              >
                <span>
                  Versão {VERSAO_DOCUMENTOS}
                </span>

                <span>
                  Última atualização: {DATA_ATUALIZACAO}
                </span>
              </div>
            </header>

            {/* RESUMO E AVISO ACADÊMICO */}
            <ResumoLegal
              resumo={resumo}
              avisoAcademico={avisoAcademico}
            />

            {/* SEÇÕES DO DOCUMENTO */}
            <div
              className="
                space-y-10
                [&_section]:scroll-mt-24
                [&_section]:border-b
                [&_section]:border-[#E7E3F5]
                [&_section]:pb-8
                dark:[&_section]:border-[#35334A]
                [&_section:last-child]:border-b-0
              "
            >
              {children}
            </div>
          </article>
        </div>

        {/* RODAPÉ */}
        <footer
          className="
            mt-12 border-t
            border-[#DDD8F5] pt-7
            text-center text-sm
            text-slate-600
            dark:border-[#35334A]
            dark:text-[#B8B5C9]
          "
        >
          <p className="font-semibold">
            Elder Web — Cuidado que conecta
          </p>

          <p className="mt-2">
            Projeto acadêmico desenvolvido na
            Etec Fernando Prestes.
          </p>
        </footer>
      </main>
    </div>
  )
}

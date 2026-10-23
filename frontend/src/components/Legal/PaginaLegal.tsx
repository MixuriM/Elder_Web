
import type { ReactNode } from 'react'
import { FileText } from 'lucide-react'

import CabecalhoLegal from './CabecalhoLegal'
import HeroLegal from './HeroLegal'
import NavegacaoLegal from './NavegacaoLegal'
import ResumoLegal from './ResumoLegal'

import folhaInicioD from '../../Img/folha_inicioD.webp'

import { useTitulo } from '../../hooks/useTitulo'

import {
  DATA_ATUALIZACAO,
  VERSAO_DOCUMENTOS,
} from '../../lib/documentosLegais'

// ==========================================
// EXPORTAÇÕES PARA AS PÁGINAS EXISTENTES
// ==========================================

export {
  Secao,
  Lista,
  Tabela,
  LinkInterno,
  LinkContato,
  LinkExterno,
} from './ElementosLegais'

// ==========================================
// TIPAGEM
// ==========================================

type Props = {
  titulo: string
  resumo: ReactNode[]
  avisoAcademico?: boolean
  children: ReactNode
}

// ==========================================
// CONFIGURAÇÃO DAS FOLHAS DECORATIVAS
// ==========================================

// Distâncias fixas em pixels a partir do
// topo da página, iguais nos três documentos.

const POSICOES_FOLHAS = [
  180,
  560,
  940,
  1320,
  1700,
  2080,
  2460,
  2840,
  3220,
  3600,
  3980,
  4360,
]

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function PaginaLegal({
  titulo,
  resumo,
  avisoAcademico = false,
  children,
}: Props) {
  useTitulo(titulo)

  return (
    <div
      className="
        relative isolate min-h-dvh
        overflow-x-clip
        bg-[#FAF9FF] text-[#071A38]
        transition-colors duration-200
        dark:bg-[#101018]
        dark:text-[#F5F5FA]
      "
    >
      {/* =====================================
          FOLHAS DECORATIVAS FIXAS
      ===================================== */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute inset-0 z-0
          overflow-hidden
        "
      >
        {POSICOES_FOLHAS.map((posicao, index) => {
          const esquerda = index % 2 === 0

          return (
            <img
              key={posicao}
              src={folhaInicioD}
              alt=""
              loading="lazy"
              style={{ top: `${posicao}px` }}
              className={`
                absolute
                w-40 opacity-15
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
          )
        })}
      </div>

      {/* =====================================
          CABEÇALHO
      ===================================== */}

      <div className="relative z-10">
        <CabecalhoLegal />
      </div>

      {/* =====================================
          CONTEÚDO PRINCIPAL
      ===================================== */}

      <main
        id="conteudo-principal"
        className="
          relative z-10
          mx-auto w-full max-w-7xl
          px-4 pb-16
          sm:px-6
          lg:px-8
        "
      >
        {/* APRESENTAÇÃO */}

        <HeroLegal />

        {/* NAVEGAÇÃO ENTRE DOCUMENTOS */}

        <NavegacaoLegal />

        {/* =====================================
            ÁREA CENTRALIZADA DO DOCUMENTO
        ===================================== */}

        <div
          className="
            mx-auto mt-8 w-full max-w-5xl
            rounded-3xl border
            border-[#DDD8F5]
            bg-white/95
            p-5
            shadow-[0_10px_40px_rgba(40,30,90,0.05)]
            sm:p-7
            md:p-9
            lg:p-12
            dark:border-[#35334A]
            dark:bg-[#191927]/95
            dark:shadow-[0_10px_40px_rgba(0,0,0,0.15)]
          "
        >
          {/* =====================================
              DOCUMENTO
          ===================================== */}

          <article
            aria-labelledby="titulo-documento"
            className="
              min-w-0 w-full
              space-y-9
              text-base leading-8
              sm:text-lg
              [&_p]:[overflow-wrap:anywhere]
            "
          >
            {/* CABEÇALHO DO DOCUMENTO */}

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
                    rounded-2xl
                    bg-[#EEE9FF]
                    text-[#6258E8]
                    dark:bg-[#302A50]
                    dark:text-[#B6B0FF]
                  "
                >
                  <FileText size={27} />
                </div>

                {/* TÍTULO DO DOCUMENTO */}

                <div className="min-w-0 flex-1 space-y-2">
                  <h2
                    id="titulo-documento"
                    className="
                      break-words
                      text-2xl font-bold
                      tracking-tight
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
                    Informações importantes sobre o uso
                    do Elder Web.
                  </p>
                </div>
              </div>

              {/* VERSÃO E ATUALIZAÇÃO */}

              <div
                className="
                  flex flex-wrap
                  gap-x-5 gap-y-2
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

            {/* =====================================
                RESUMO E AVISO ACADÊMICO
            ===================================== */}

            <ResumoLegal
              resumo={resumo}
              avisoAcademico={avisoAcademico}
            />

            {/* =====================================
                SEÇÕES DO DOCUMENTO
            ===================================== */}

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

        {/* =====================================
            RODAPÉ
        ===================================== */}

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


import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
} from 'lucide-react'

type SecaoMenu = {
  id: string
  titulo: string
}

// ==========================================
// SEÇÕES DOS DOCUMENTOS LEGAIS
// ==========================================

export const secoesPorPagina: Record<string, SecaoMenu[]> = {
  // TERMOS DE USO
  '/termos': [
    { id: 'resumo', titulo: 'Resumo' },
    { id: 'sobre', titulo: 'Sobre o Elder Web' },
    { id: 'quem-pode-usar', titulo: 'Quem pode usar' },
    { id: 'conta', titulo: 'Sua conta e senha' },
    { id: 'vinculos', titulo: 'Vínculos e permissões' },
    { id: 'regras', titulo: 'Regras de uso' },
    { id: 'saude', titulo: 'Saúde' },
    { id: 'emergencia', titulo: 'Aviso de emergência' },
    { id: 'disponibilidade', titulo: 'Disponibilidade' },
    { id: 'responsabilidades', titulo: 'Responsabilidades' },
    { id: 'propriedade', titulo: 'Propriedade intelectual' },
    {
      id: 'encerramento',
      titulo: 'Encerramento e exclusão da conta',
    },
    { id: 'mudancas', titulo: 'Mudanças nos Termos' },
    { id: 'lei-e-foro', titulo: 'Lei e foro' },
    { id: 'contato', titulo: 'Contato' },
  ],

  // POLÍTICA DE PRIVACIDADE
  '/privacidade': [
    { id: 'resumo', titulo: 'Resumo' },
    { id: 'responsavel', titulo: 'Responsável pelos dados' },
    { id: 'dados', titulo: 'Dados coletados' },
    { id: 'saude', titulo: 'Dados de saúde' },
    { id: 'finalidades', titulo: 'Uso dos dados' },
    { id: 'base-legal', titulo: 'Base legal' },
    { id: 'compartilhamento', titulo: 'Compartilhamento' },
    { id: 'fora-do-brasil', titulo: 'Dados fora do Brasil' },
    { id: 'retencao', titulo: 'Armazenamento dos dados' },
    { id: 'direitos', titulo: 'Seus direitos' },
    { id: 'conta-familiar', titulo: 'Conta criada por familiar' },
    { id: 'menores', titulo: 'Menores de idade' },
    { id: 'seguranca', titulo: 'Segurança' },
    { id: 'incidente', titulo: 'Incidentes de segurança' },
    { id: 'mudancas', titulo: 'Mudanças na política' },
    { id: 'contato', titulo: 'Contato' },
  ],

  // POLÍTICA DE COOKIES
  '/cookies': [
    { id: 'resumo', titulo: 'Resumo' },
    { id: 'cookies', titulo: 'O que são cookies' },
    {
      id: 'armazenamento',
      titulo: 'Armazenamento no navegador',
    },
    { id: 'terceiros', titulo: 'Serviços de terceiros' },
    { id: 'como-apagar', titulo: 'Como apagar' },
    { id: 'mudancas', titulo: 'Mudanças na política' },
    { id: 'contato', titulo: 'Contato' },
  ],
}

// ==========================================
// COMPONENTE DO MENU LATERAL
// ==========================================

export default function MenuLateralLegal() {
  const { pathname, hash } = useLocation()

  const secoes = secoesPorPagina[pathname] ?? []

  const [secaoAtiva, setSecaoAtiva] = useState('resumo')
  const [menuAberto, setMenuAberto] = useState(false)

  // ========================================
  // IDENTIFICA A SEÇÃO ATIVA
  // ========================================

  useEffect(() => {
    const atualizarSecao = () => {
      let atual = 'resumo'

      for (const secao of secoes) {
        const elemento = document.getElementById(secao.id)

        if (
          elemento &&
          elemento.getBoundingClientRect().top <= 180
        ) {
          atual = secao.id
        }
      }

      setSecaoAtiva(atual)
    }

    atualizarSecao()

    window.addEventListener('scroll', atualizarSecao, {
      passive: true,
    })

    return () => {
      window.removeEventListener('scroll', atualizarSecao)
    }
  }, [pathname, secoes])

  useEffect(() => {
    if (hash) {
      setSecaoAtiva(decodeURIComponent(hash.slice(1)))
    }
  }, [hash])

  useEffect(() => {
    setMenuAberto(false)
  }, [pathname])

  if (secoes.length === 0) return null

  // ========================================
  // RENDERIZA OS LINKS DAS SEÇÕES
  // ========================================

  const renderizarItens = () =>
    secoes.map(({ id, titulo }) => {
      const ativo = secaoAtiva === id

      return (
        <li key={id}>
          <a
            href={`#${id}`}
            aria-current={ativo ? 'location' : undefined}
            onClick={() => {
              setSecaoAtiva(id)
              setMenuAberto(false)
            }}
            className={`
              group flex min-h-11 items-center
              gap-3 rounded-xl px-3 py-3
              text-sm leading-5
              transition-colors duration-150

              focus-visible:outline
              focus-visible:outline-2
              focus-visible:outline-offset-2
              focus-visible:outline-[#6258E8]

              ${
                ativo
                  ? `
                    bg-[#E8E2FF]
                    font-bold text-[#5145C8]
                    dark:bg-[#39305D]
                    dark:text-[#D2CBFF]
                  `
                  : `
                    font-medium text-slate-700
                    hover:bg-[#EEE9FF]
                    hover:text-[#5145C8]
                    dark:text-[#D5D2E8]
                    dark:hover:bg-[#302B4C]
                    dark:hover:text-[#D2CBFF]
                  `
              }
            `}
          >
            <FileText
              size={17}
              aria-hidden="true"
              className="shrink-0"
            />

            <span className="min-w-0 flex-1">
              {titulo}
            </span>

            {ativo && (
              <ChevronRight
                size={16}
                aria-hidden="true"
                className="shrink-0"
              />
            )}
          </a>
        </li>
      )
    })

  // ========================================
  // ESTRUTURA DO MENU
  // ========================================

  return (
    <aside
      className="
        min-w-0
        lg:sticky
        lg:top-6
        lg:self-start
      "
    >
      <nav
        aria-label="Seções deste documento"
        className="
          overflow-hidden rounded-2xl
          border border-[#DDD8F5]
          bg-[#F8F6FF]
          dark:border-[#39364F]
          dark:bg-[#202033]
        "
      >
        {/* CABEÇALHO */}
        <div
          className="
            flex items-center gap-3
            border-b border-[#DDD8F5]
            px-4 py-5
            dark:border-[#39364F]
          "
        >
          <div
            aria-hidden="true"
            className="
              flex h-10 w-10 shrink-0
              items-center justify-center
              rounded-xl bg-[#EAE5FF]
              text-[#6258E8]
              dark:bg-[#332C55]
              dark:text-[#B6B0FF]
            "
          >
            <BookOpen size={21} />
          </div>

          <div className="min-w-0">
            <p
              className="
                text-sm font-bold
                text-[#071A38]
                dark:text-[#F5F5FA]
              "
            >
              Nesta página
            </p>

            <p
              className="
                text-xs text-slate-600
                dark:text-[#B8B5CC]
              "
            >
              Navegue pelas seções
            </p>
          </div>
        </div>

        {/* BOTÃO DO MENU NO CELULAR */}
        <button
          type="button"
          aria-expanded={menuAberto}
          aria-controls="lista-secoes-mobile"
          onClick={() => setMenuAberto((aberto) => !aberto)}
          className="
            flex min-h-12 w-full
            items-center justify-between
            px-5 py-3
            text-sm font-semibold
            text-[#5F56EC]

            focus-visible:outline
            focus-visible:outline-2
            focus-visible:outline-[#5F56EC]

            dark:text-[#B6B0FF]
            lg:hidden
          "
        >
          <span>
            {menuAberto ? 'Ocultar seções' : 'Ver seções'}
          </span>

          <ChevronDown
            size={19}
            aria-hidden="true"
            className={`
              transition-transform duration-200
              ${menuAberto ? 'rotate-180' : ''}
            `}
          />
        </button>

        {/* LISTA NO CELULAR */}
        {menuAberto && (
          <div
            id="lista-secoes-mobile"
            className="
              max-h-[50vh]
              overflow-y-auto
              border-t border-[#DDD8F5]
              p-3

              [scrollbar-color:#6258E8_transparent]
              [scrollbar-width:thin]

              dark:border-[#39364F]
              lg:hidden
            "
          >
            <ul className="space-y-1">
              {renderizarItens()}
            </ul>
          </div>
        )}

        {/* LISTA NO COMPUTADOR */}
        <div
          className="
            hidden max-h-[70vh]
            overflow-y-auto
            overscroll-contain
            p-3

            [scrollbar-color:#6258E8_transparent]
            [scrollbar-width:thin]

            lg:block
          "
        >
          <ul className="space-y-1">
            {renderizarItens()}
          </ul>
        </div>
      </nav>
    </aside>
  )
}

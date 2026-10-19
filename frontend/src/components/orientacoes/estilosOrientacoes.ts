
/**
 * Elder Web — Orientações Gerais
 * RF-031 | Item 8.2
 *
 * Estilos compartilhados.
 * Responsivo, acessível e com modo claro/escuro.
 */

// Foco visível para elementos interativos
export const foco =
  'focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#6C63FF] dark:focus-visible:outline-[#A18BFF]'

// Página integrada ao layout do Elder
export const paginaOrientacoes =
  'relative min-w-0 flex-1 bg-[#FAFAFF] text-[#071A38] dark:bg-[#101018] dark:text-[#F5F5FA]'

// Container principal
export const containerOrientacoes =
  'relative mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8'

// Cabeçalho com decoração
export const cabecalhoOrientacoes =
  'relative isolate overflow-hidden rounded-[28px] border border-[#DDD9EB] bg-white p-6 sm:p-10 dark:border-[#39394A] dark:bg-[#181821]'

// Título principal
export const tituloPagina =
  'text-3xl font-extrabold tracking-tight text-[#071A38] sm:text-4xl lg:text-[42px] dark:text-white'

// Subtítulo
export const subtituloPagina =
  'text-lg leading-relaxed text-[#475569] sm:text-xl dark:text-[#D1D0E0]'

// Grade dos cartões
export const gradeOrientacoes =
  'grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2'

// Cartões estáticos, sem efeitos de hover
export const cardOrientacao =
  'h-full min-w-0 rounded-[26px] border border-[#DDD9EB] bg-white p-6 shadow-sm sm:p-8 dark:border-[#39394A] dark:bg-[#181821]'

// Ícones das orientações
export const iconeOrientacao =
  'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#EDE9FF] text-[#6C63FF] dark:bg-[#29263F] dark:text-[#A18BFF]'

// Numeração dos cartões
export const numeroOrientacao =
  'inline-flex min-h-8 items-center rounded-lg bg-[#EDE9FF] px-3 text-sm font-bold text-[#5145D9] dark:bg-[#29263F] dark:text-[#B8A9FF]'

// Títulos das seções
export const tituloSecao =
  'text-xl font-bold leading-snug text-[#071A38] sm:text-2xl dark:text-white'

// Texto das orientações
export const textoOrientacao =
  'text-base leading-relaxed text-[#475569] sm:text-lg dark:text-[#D1D0E0]'

// Cartão de ajuda com decoração interna
export const cardAjuda =
  'relative isolate min-w-0 overflow-hidden rounded-[26px] border border-[#DDD9EB] bg-white p-6 sm:p-8 dark:border-[#39394A] dark:bg-[#181821]'

// Botão de suporte
export const link =
  `inline-flex min-h-[48px] max-w-full items-center justify-center gap-3 rounded-xl bg-[#6C63FF] px-5 py-3 text-base font-bold text-white [overflow-wrap:anywhere] transition-colors hover:bg-[#5145D9] dark:bg-[#5B50DF] dark:hover:bg-[#7065F0] ${foco}`

// Avisos de atenção
export const avisoAtencao =
  'rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900 dark:border-[#681D28] dark:bg-[#27171E] dark:text-[#FF9D9D]'

// Avisos informativos
export const avisoInformativo =
  'rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-[#303D69] dark:bg-[#19223A] dark:text-[#C7D7FF]'

// Folha da tela inicial no cabeçalho
export const florCabecalho =
  'pointer-events-none absolute right-0 top-0 z-0 w-24 object-contain opacity-25 sm:w-36 lg:w-44 dark:opacity-40'

// Folha da tela inicial no cartão de ajuda
// Posicionada dentro do cartão para não ser cortada
export const florAjuda =
  'pointer-events-none absolute bottom-12 left-3 z-0 w-28 object-contain opacity-20 sm:bottom-16 sm:left-5 sm:w-36 dark:opacity-35'

// Conteúdo acima das folhas
export const conteudoDecorado =
  'relative z-10'

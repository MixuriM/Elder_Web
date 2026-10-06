// Conteúdo provisório (item 8.1). Texto final e layout: Laureane e Jennifer.
const foco =
  'focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#071A38] dark:focus-visible:outline-[#F5F5FA]'
const link = `inline-flex min-h-[44px] items-center rounded-lg border-2 border-[#6C63FF] bg-[#F3F0FF] px-4 text-lg font-semibold text-[#071A38] underline dark:bg-[#151522] dark:text-[#F5F5FA] ${foco}`

const secoes = [
  {
    id: 'o-que-e',
    titulo: 'O que é o Elder Web',
    texto:
      'O Elder Web é uma aplicação web que apoia idosos, cuidadores e familiares no gerenciamento de saúde e rotina diária. "Elder", em inglês, significa "idoso".',
  },
  {
    id: 'para-quem',
    titulo: 'Para quem é',
    texto: 'Para o idoso, o cuidador e o familiar. Cada pessoa tem uma conta com o seu perfil.',
  },
  {
    id: 'o-que-reune',
    titulo: 'O que reúne',
    texto:
      'Registro de saúde. Remédios com histórico e exportação em PDF. Agenda de compromissos. Registro de alimentação. Vínculos entre idosos e seus cuidadores e familiares.',
  },
  {
    id: 'acessibilidade',
    titulo: 'Nosso compromisso com a acessibilidade',
    texto:
      'Buscamos letras grandes, bom contraste, botões fáceis de tocar e textos simples.',
  },
  {
    id: 'quem-fez',
    titulo: 'Quem fez',
    texto:
      'Projeto de conclusão do Curso Técnico em Desenvolvimento de Sistemas, Etec Fernando Prestes, 2026. Equipe: Marcos, Laureane e Jennifer.',
  },
]

export default function SobreNos() {
  return (
    <div className="min-h-screen bg-white text-lg text-[#071A38] dark:bg-[#101018] dark:text-[#F5F5FA]">
      <header className="flex flex-wrap gap-4 border-b-2 border-[#6C63FF] p-4">
        <a href="/" className={link}>
          Voltar para a página inicial
        </a>
        <a href="/welcome" className={link}>
          Entrar ou criar conta
        </a>
      </header>
      <main className="mx-auto max-w-3xl space-y-8 p-4">
        <h1 className="text-4xl font-bold text-[#5F56EC] dark:text-[#A18BFF]">Sobre nós</h1>
        {secoes.map((s) => (
          <section key={s.id} aria-labelledby={s.id} className="space-y-2">
            <h2 id={s.id} className="text-2xl font-bold text-[#5F56EC] dark:text-[#A18BFF]">
              {s.titulo}
            </h2>
            <p>{s.texto}</p>
          </section>
        ))}
      </main>
    </div>
  )
}

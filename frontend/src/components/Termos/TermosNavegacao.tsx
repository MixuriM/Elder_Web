import { BookOpen } from 'lucide-react'

const secoes = [
  ['sobre', 'Sobre o Elder Web'],
  ['quem-pode-usar', 'Quem pode usar'],
  ['conta', 'Sua conta e sua senha'],
  ['vinculos', 'Vínculos e permissões'],
  ['regras', 'Regras de uso'],
  ['saude', 'Saúde'],
  ['emergencia', 'Aviso de emergência'],
  ['disponibilidade', 'Disponibilidade'],
  ['responsabilidades', 'Responsabilidades'],
  ['propriedade', 'Propriedade intelectual'],
  ['encerramento', 'Exclusão da conta'],
  ['mudancas', 'Mudanças nos Termos'],
  ['lei-e-foro', 'Lei e foro'],
  ['contato', 'Contato'],
]

export default function TermosNavegacao() {
  return (
    <nav
      aria-label="Índice dos Termos de Uso"
      className="rounded-2xl border border-[#E4E0F5] bg-white p-6 dark:border-[#343344] dark:bg-[#191925] lg:sticky lg:top-24"
    >
      <h2 className="mb-5 flex items-center gap-3 text-lg font-bold text-[#071A38] dark:text-white">
        <BookOpen
          size={22}
          className="text-[#8177FF]"
          aria-hidden="true"
        />
        Neste documento
      </h2>

      <ul className="space-y-1">
        {secoes.map(([id, titulo], index) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className="
                flex gap-3 rounded-lg px-3 py-2
                text-sm leading-6 text-slate-700
                focus-visible:outline focus-visible:outline-2
                focus-visible:outline-offset-2
                focus-visible:outline-[#8177FF]
                dark:text-[#D1D1DF]
              "
            >
              <span className="font-semibold text-[#6258E8] dark:text-[#B9B3FF]">
                {String(index + 1).padStart(2, '0')}
              </span>
              {titulo}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
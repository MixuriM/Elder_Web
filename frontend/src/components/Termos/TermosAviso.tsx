import { Info } from 'lucide-react'

export default function TermosAviso() {
  return (
    <aside
      aria-label="Informação sobre o projeto"
      className="
        mt-10 flex items-start gap-4
        rounded-2xl border border-[#DCD6FF]
        bg-[#F3F0FF] p-5
        dark:border-[#393457]
        dark:bg-[#222033]
      "
    >
      <Info
        className="mt-1 shrink-0 text-[#6258E8] dark:text-[#B9B3FF]"
        size={23}
        aria-hidden="true"
      />

      <div>
        <h2 className="font-bold text-[#071A38] dark:text-white">
          Projeto acadêmico
        </h2>

        <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-[#D1D1DF]">
          O Elder Web é um Trabalho de Conclusão de Curso,
          gratuito e sem fins lucrativos. Está em desenvolvimento
          e pode apresentar alterações ou indisponibilidade.
        </p>
      </div>
    </aside>
  )
}
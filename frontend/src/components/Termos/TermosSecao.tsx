import type { ReactNode } from 'react'

import {
  BookOpen,
  Users,
  LockKeyhole,
  ShieldCheck,
  ClipboardList,
  HeartPulse,
  Siren,
  Server,
  Scale,
  Copyright,
  UserRoundX,
  FilePenLine,
  Gavel,
  Mail,
} from 'lucide-react'

interface TermosSecaoProps {
  id: string
  titulo: string
  children: ReactNode
}

const icones = {
  sobre: BookOpen,
  'quem-pode-usar': Users,
  conta: LockKeyhole,
  vinculos: ShieldCheck,
  regras: ClipboardList,
  saude: HeartPulse,
  emergencia: Siren,
  disponibilidade: Server,
  responsabilidades: Scale,
  propriedade: Copyright,
  encerramento: UserRoundX,
  mudancas: FilePenLine,
  'lei-e-foro': Gavel,
  contato: Mail,
}

export default function TermosSecao({
  id,
  titulo,
  children,
}: TermosSecaoProps) {
  const Icone = icones[id as keyof typeof icones] ?? BookOpen

  return (
    <section
      id={id}
      aria-labelledby={`${id}-titulo`}
      className="
        scroll-mt-28
        rounded-2xl
        border border-[#E4E0F5]
        bg-white
        p-5
        shadow-sm
        sm:p-7
        lg:p-8

        dark:border-[#343344]
        dark:bg-[#191925]
        dark:shadow-none
      "
    >
      {/* Cabeçalho da seção */}
      <div className="mb-6 flex items-start gap-4">
        <div
          className="
            flex h-12 w-12 shrink-0
            items-center justify-center
            rounded-xl
            bg-[#EAE6FF]
            text-[#6258E8]

            dark:bg-[#292640]
            dark:text-[#B9B3FF]
          "
        >
          <Icone size={24} aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <h2
            id={`${id}-titulo`}
            className="
              text-xl font-bold
              tracking-tight
              text-[#071A38]
              dark:text-[#F5F5FA]
              sm:text-2xl
            "
          >
            {titulo}
          </h2>

          <div
            aria-hidden="true"
            className="
              mt-3 h-1 w-12
              rounded-full
              bg-[#8177FF]
            "
          />
        </div>
      </div>

      {/* Conteúdo */}
      <div
        className="
          space-y-4
          text-base
          leading-8
          text-slate-700
          dark:text-[#D1D1DF]

          [&_p]:m-0

          [&_ul]:list-disc
          [&_ul]:space-y-3
          [&_ul]:pl-6

          [&_li]:pl-1
          [&_li]:marker:text-[#8177FF]

          [&_strong]:font-bold
          [&_strong]:text-[#6258E8]
          dark:[&_strong]:text-[#B9B3FF]

          [&_a]:font-semibold
          [&_a]:text-[#6258E8]
          [&_a]:underline
          [&_a]:underline-offset-4
          dark:[&_a]:text-[#B9B3FF]

          [&_a:focus-visible]:rounded
          [&_a:focus-visible]:outline
          [&_a:focus-visible]:outline-2
          [&_a:focus-visible]:outline-offset-4
          [&_a:focus-visible]:outline-[#8177FF]
        "
      >
        {children}
      </div>
    </section>
  )
}
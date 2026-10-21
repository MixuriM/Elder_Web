
import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

type Props = {
  resumo: ReactNode[]
  avisoAcademico?: boolean
}

export default function ResumoLegal({
  resumo,
  avisoAcademico = false,
}: Props) {
  return (
    <div className="space-y-5">
      <section
        aria-labelledby="resumo"
        className="
          scroll-mt-24 rounded-2xl border
          border-[#A18BFF]/30 bg-[#F3F0FF]
          p-5 sm:p-6
          dark:bg-[#25243B]/60
        "
      >
        <h3
          id="resumo"
          className="
            mb-5 text-xl font-bold
            text-[#5F56EC]
            dark:text-[#B6B0FF]
          "
        >
          Resumo em poucas linhas
        </h3>

        <ul className="space-y-4">
          {resumo.map((item, index) => (
            <li
              key={index}
              className="flex items-start gap-3"
            >
              <CheckCircle2
                size={21}
                aria-hidden="true"
                className="
                  mt-1 shrink-0
                  text-[#5F56EC]
                  dark:text-[#B6B0FF]
                "
              />

              <span className="leading-7">
                {item}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {avisoAcademico && (
        <aside
          className="
            flex items-start gap-3 rounded-xl
            border border-[#A18BFF]/40
            bg-white p-4
            dark:bg-[#1F2130]
          "
        >
          <AlertCircle
            size={22}
            aria-hidden="true"
            className="
              mt-1 shrink-0
              text-[#5F56EC]
              dark:text-[#B6B0FF]
            "
          />

          <p className="font-medium leading-7">
            O Elder Web é um projeto acadêmico (TCC)
            e ainda não é um serviço comercial.
          </p>
        </aside>
      )}
    </div>
  )
}

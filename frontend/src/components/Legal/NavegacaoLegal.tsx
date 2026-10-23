
import { Cookie, FileText, LockKeyhole } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { DOCUMENTOS_LEGAIS } from '../../lib/documentosLegais'

const icones = {
  '/privacidade': LockKeyhole,
  '/termos': FileText,
  '/cookies': Cookie,
}

export default function NavegacaoLegal() {
  return (
    <nav
      aria-label="Documentos legais"
      className="mb-6"
    >
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {DOCUMENTOS_LEGAIS.map((documento) => {
          const Icone =
            icones[documento.caminho as keyof typeof icones] ??
            FileText

          return (
            <li key={documento.caminho}>
              <NavLink
                to={documento.caminho}
                className={({ isActive }) => `
                  flex min-h-14 items-center
                  justify-center gap-3 rounded-xl
                  border px-4 py-3 text-center
                  text-sm font-bold transition-colors
                  focus-visible:outline
                  focus-visible:outline-4
                  focus-visible:outline-offset-2
                  focus-visible:outline-[#5F56EC]
                  ${
                    isActive
                      ? `border-[#A18BFF] bg-[#A18BFF]
                         text-[#101018]`
                      : `border-[#A18BFF]/70
                         bg-white/70 text-[#071A38]
                         hover:bg-[#F3F0FF]
                         dark:bg-transparent
                         dark:text-[#F5F5FA]
                         dark:hover:bg-[#25243B]`
                  }
                `}
              >
                <Icone size={21} aria-hidden="true" />
                {documento.titulo}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

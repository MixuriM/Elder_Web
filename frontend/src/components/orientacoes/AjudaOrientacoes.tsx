
import {
  ShieldAlert,
  HeartPulse,
  PhoneCall,
  Mail,
} from 'lucide-react'

import { EMAIL_SUPORTE } from '../../lib/documentosLegais'
import SecaoOrientacao from './SecaoOrientacao'

import {
  foco,
  link,
  avisoAtencao,
  avisoInformativo,
} from './estilosOrientacoes'

const estiloIcone = `
  flex h-14 w-14 shrink-0
  items-center justify-center
  rounded-2xl
  bg-[#EEEAFE]
  text-[#6C63FF]
  dark:bg-[#29243E]
  dark:text-[#A995FF]
`

export default function AjudaOrientacoes() {
  return (
    <SecaoOrientacao
      id="ajuda"
      titulo="Ajuda e aviso importante"
    >
      <div className="min-w-0 space-y-6">
        {/* Contato com o suporte */}
        <div className="space-y-4">
          <p className="text-base leading-relaxed text-[#475569] sm:text-lg dark:text-[#D1D0E0]">
            Para dúvidas, escreva para o nosso e-mail
            de suporte, informando o seu perfil e
            descrevendo o problema, com uma captura
            de tela se puder.
          </p>

          <a
            href={`mailto:${EMAIL_SUPORTE}`}
            className={link}
          >
            <Mail
              size={24}
              strokeWidth={2}
              aria-hidden="true"
              className="shrink-0"
            />

            <span className="break-all">
              {EMAIL_SUPORTE}
            </span>
          </a>
        </div>

        {/* Avisos importantes */}
        <div className="grid grid-cols-1 gap-4 border-t border-[#DDD9EB] pt-6 dark:border-[#39394A] lg:grid-cols-3">
          {/* Proteção de dados */}
          <div className={avisoAtencao}>
            <div className="flex items-start gap-4">
              <div
                className={estiloIcone}
                aria-hidden="true"
              >
                <ShieldAlert
                  size={28}
                  strokeWidth={1.8}
                />
              </div>

              <p className="min-w-0 flex-1 text-base leading-relaxed">
                Não envie valores nem informações de
                saúde por e-mail.
              </p>
            </div>
          </div>

          {/* Orientação médica */}
          <div className={avisoInformativo}>
            <div className="flex items-start gap-4">
              <div
                className={estiloIcone}
                aria-hidden="true"
              >
                <HeartPulse
                  size={28}
                  strokeWidth={1.8}
                />
              </div>

              <p className="min-w-0 flex-1 text-base leading-relaxed">
                O Elder Web não substitui consulta nem
                orientação de profissionais de saúde.
              </p>
            </div>
          </div>

          {/* Emergência */}
          <div className={avisoAtencao}>
            <div className="flex items-start gap-4">
              <div
                className={estiloIcone}
                aria-hidden="true"
              >
                <PhoneCall
                  size={28}
                  strokeWidth={1.8}
                />
              </div>

              <p className="min-w-0 flex-1 text-base leading-relaxed">
                Em emergência, ligue para o SAMU,
                telefone{' '}
                <a
                  href="tel:192"
                  aria-label="Ligar para o SAMU no número 192"
                  className={`rounded font-bold underline ${foco}`}
                >
                  192
                </a>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </SecaoOrientacao>
  )
}

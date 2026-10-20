
import { EMAIL_SUPORTE } from '../../lib/documentosLegais'
import SecaoOrientacao from './SecaoOrientacao'

import {
  foco,
  link,
  avisoAtencao,
  avisoInformativo,
} from './estilosOrientacoes'

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
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 shrink-0"
            >
              <rect
                x="3"
                y="5"
                width="18"
                height="14"
                rx="2"
              />
              <path d="m3 7 9 6 9-6" />
            </svg>

            <span className="break-all">
              {EMAIL_SUPORTE}
            </span>
          </a>
        </div>

        {/* Avisos importantes */}
        <div className="grid grid-cols-1 gap-4 border-t border-[#DDD9EB] pt-6 dark:border-[#39394A] lg:grid-cols-3">
          {/* Proteção de dados */}
          <div className={avisoAtencao}>
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="text-2xl"
              >
                ⛔
              </span>

              <p className="text-base leading-relaxed">
                Não envie valores nem informações de
                saúde por e-mail.
              </p>
            </div>
          </div>

          {/* Orientação médica */}
          <div className={avisoInformativo}>
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="text-2xl"
              >
                🛡️
              </span>

              <p className="text-base leading-relaxed">
                O Elder Web não substitui consulta nem
                orientação de profissionais de saúde.
              </p>
            </div>
          </div>

          {/* Emergência */}
          <div className={avisoAtencao}>
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="text-2xl"
              >
                📞
              </span>

              <p className="text-base leading-relaxed">
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

import {
  AlertCircle,
  ShieldAlert,
} from 'lucide-react'

import Spinner from '../common/Spinner'
import { usePermissoesDose } from '../../lib/permissoesDose'

type PermissoesDose = ReturnType<
  typeof usePermissoesDose
>

interface AvisoPermissaoDoseProps {
  permissoes: PermissoesDose
}

function AvisoPermissaoDose({
  permissoes,
}: AvisoPermissaoDoseProps) {
  const mostrarCarregando =
    permissoes.estado === 'carregando'

  const mostrarSemPermissao =
    permissoes.avisoSemFlag

  const mostrarErro =
    permissoes.estado === 'erro'

  if (
    !mostrarCarregando &&
    !mostrarSemPermissao &&
    !mostrarErro
  ) {
    return null
  }

  return (
    <div className="w-full">
      {/* CARREGANDO */}

      {mostrarCarregando && (
        <div
          role="status"
          className="
            flex
            items-center
            gap-3
            rounded-2xl
            border
            border-[#E5E2F5]
            bg-white
            px-5
            py-4
            text-[#56657D]
            shadow-sm

            dark:border-[#393947]
            dark:bg-[#171721]
            dark:text-[#C7C7D1]
          "
        >
          <Spinner />

          <span className="font-medium">
            Verificando permissões...
          </span>
        </div>
      )}

      {/* SEM PERMISSÃO */}

      {mostrarSemPermissao && (
        <div
          role="status"
          className="
            rounded-2xl
            border
            border-[#D9D5FF]
            bg-[#F7F5FF]
            px-5
            py-4

            dark:border-[#393947]
            dark:bg-[#171721]
          "
        >
          <div className="flex items-start gap-4">
            <div
              className="
                flex
                h-11
                w-11
                shrink-0
                items-center
                justify-center
                rounded-xl
                bg-[#ECE9FF]
                text-[#5F56EC]

                dark:bg-[#29243F]
                dark:text-[#9B96FF]
              "
              aria-hidden="true"
            >
              <ShieldAlert
                size={21}
                strokeWidth={2}
              />
            </div>

            <div className="min-w-0">
              <p
                className="
                  font-semibold
                  leading-relaxed
                  text-[#071A38]

                  dark:text-[#F5F5FA]
                "
              >
                Seu vínculo não possui permissão
                para registrar doses.
              </p>

              <p
                className="
                  mt-1
                  text-sm
                  leading-relaxed
                  text-[#56657D]

                  dark:text-[#C7C7D1]
                "
              >
                Você ainda pode consultar os
                medicamentos e o histórico.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ERRO AO VERIFICAR PERMISSÕES */}

      {mostrarErro && (
        <div
          role="alert"
          className="
            rounded-2xl
            border
            border-red-200
            bg-red-50
            px-5
            py-4

            dark:border-red-900/50
            dark:bg-red-950/20
          "
        >
          <div className="flex items-start gap-4">
            <div
              className="
                flex
                h-11
                w-11
                shrink-0
                items-center
                justify-center
                rounded-xl
                bg-red-100
                text-red-700

                dark:bg-red-950/40
                dark:text-red-300
              "
              aria-hidden="true"
            >
              <AlertCircle
                size={21}
                strokeWidth={2}
              />
            </div>

            <div className="min-w-0">
              <p
                className="
                  font-semibold
                  text-red-700

                  dark:text-red-300
                "
              >
                Não foi possível verificar suas
                permissões
              </p>

              <p
                className="
                  mt-1
                  text-sm
                  leading-relaxed
                  text-red-600

                  dark:text-red-300/90
                "
              >
                Algumas ações poderão ser
                verificadas novamente pelo sistema
                ao serem realizadas.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AvisoPermissaoDose
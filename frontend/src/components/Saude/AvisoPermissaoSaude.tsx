import Spinner from '../common/Spinner'
import { usePermissoesSaude } from '../../lib/permissoesSaude'

type PermissoesSaude =
  ReturnType<typeof usePermissoesSaude>

interface AvisoPermissaoSaudeProps {
  permissoes: PermissoesSaude
}

function AvisoPermissaoSaude({
  permissoes,
}: AvisoPermissaoSaudeProps) {
  return (
    <div
      role="status"
      className="w-full"
    >
      {permissoes.estado === 'carregando' && (
        <div className="flex items-center gap-3 rounded-2xl border border-[#E5E2F5] bg-white p-4 text-[#56657D] dark:border-[#393947] dark:bg-[#171721] dark:text-[#C7C7D1]">
          <Spinner />

          <span>
            Verificando permissões...
          </span>
        </div>
      )}

      {permissoes.avisoSemFlag && (
        <div
          className="
            rounded-2xl
            border border-[#D9D5FF]
            bg-[#F7F5FF]
            p-5

            dark:border-[#393947]
            dark:bg-[#171721]
          "
        >
          <p className="font-semibold text-[#071A38] dark:text-[#F5F5FA]">
            Seu vínculo de cuidador não possui permissão para
            registrar informações de saúde.
          </p>

          <p className="mt-1 text-sm text-[#56657D] dark:text-[#C7C7D1]">
            Você ainda pode consultar o histórico.
          </p>
        </div>
      )}

      {permissoes.estado === 'erro' && (
        <div
          role="alert"
          className="
            rounded-2xl
            border border-red-200
            bg-red-50
            p-5
            text-red-700

            dark:border-red-900/50
            dark:bg-red-950/20
            dark:text-red-300
          "
        >
          <p className="font-semibold">
            Não foi possível verificar suas permissões.
          </p>

          <p className="mt-1 text-sm">
            O servidor continuará validando cada ação.
          </p>
        </div>
      )}
    </div>
  )
}

export default AvisoPermissaoSaude
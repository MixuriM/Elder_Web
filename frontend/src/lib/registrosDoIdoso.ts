import { useEffect, useState } from 'react'

import type { IdososVinculados } from '../hooks/useIdososVinculados'
import { chamarApi } from './chamarApi'

// Idoso usa /base/:id; cuidador e familiar usam /base/idoso/:idosoId/:id. O idoso alvo nunca vem do corpo.
export function caminhoRegistro(base: string, ehIdoso: boolean, idosoId: string, id: number) {
  return ehIdoso ? `${base}/${id}` : `${base}/idoso/${idosoId}/${id}`
}

type Estado<T> = { chave: string | null; registros: T[] | null; erro: string | null }

export type RegistrosDoIdoso<T> = {
  // aguardando: ainda não dá para buscar (idosos carregando ou nenhum idoso escolhido).
  fase: 'aguardando' | 'carregando' | 'ok' | 'erro'
  registros: T[] | null
  erro: string | null
}

type Opcoes<T> = {
  base: string
  // Campo do corpo que traz a lista: registros (saúde, alimentação) ou eventos (agenda).
  campo?: 'registros' | 'eventos'
  idosos: IdososVinculados
  idosoId: string
  // Contador da tela pai: mudou, recarrega (depois de registrar, editar ou remover).
  versao: number
  // Mensagem fixa escolhida pela tela; nunca repassa o corpo do servidor (RNF-001).
  mensagemErro: (erro: unknown) => string
  // Valida e formata tudo antes de exibir: se lançar, vira erro e nada é listado pela metade.
  transformar?: (registros: unknown[]) => T[]
}

// Carrega o histórico sozinho: idoso ao montar; cuidador e familiar assim que há idoso escolhido. Trocar de idoso
// descarta a resposta atrasada da escolha anterior. Recarga por `versao` mantém a lista na tela até a resposta chegar.
export function useRegistrosDoIdoso<T>({
  base,
  campo = 'registros',
  idosos,
  idosoId,
  versao,
  mensagemErro,
  transformar,
}: Opcoes<T>): RegistrosDoIdoso<T> {
  const [estado, setEstado] = useState<Estado<T>>({ chave: null, registros: null, erro: null })

  const pronto = idosos.estado === 'ok' && (idosos.ehIdoso || idosoId !== '')
  const caminho = idosos.ehIdoso ? base : `${base}/idoso/${idosoId}`

  useEffect(() => {
    if (!pronto) return

    let ativo = true

    chamarApi(caminho, { method: 'GET' })
      .then((corpo) => {
        if (!Array.isArray(corpo?.[campo])) throw new Error('corpo inesperado')

        const registros = transformar ? transformar(corpo[campo]) : (corpo[campo] as T[])

        if (ativo) setEstado({ chave: caminho, registros, erro: null })
      })
      // Nunca loga o erro: a mensagem do backend pode trazer dado de saúde.
      .catch((err) => {
        if (ativo) setEstado({ chave: caminho, registros: null, erro: mensagemErro(err) })
      })

    return () => {
      ativo = false
    }
    // mensagemErro e transformar são funções estáveis de módulo nas telas; só caminho e versão disparam a busca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, caminho, campo, versao])

  if (!pronto) return { fase: 'aguardando', registros: null, erro: null }
  if (estado.chave !== caminho) return { fase: 'carregando', registros: null, erro: null }
  if (estado.erro !== null) return { fase: 'erro', registros: null, erro: estado.erro }

  return { fase: 'ok', registros: estado.registros, erro: null }
}

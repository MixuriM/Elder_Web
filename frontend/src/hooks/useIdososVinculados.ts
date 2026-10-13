import { useEffect, useState } from 'react'

import { useAcesso } from '../contexts/useAcesso'
import { chamarApi } from '../lib/chamarApi'
import { idososAprovados } from '../lib/regrasIdosoVinculado'
import { buscarPerfil } from '../services/perfilService'

export type IdosoVinculado = {
  id: number
  nome: string
  email_mascarado: string | null
}

type Busca = { ehIdoso: boolean; idosos: IdosoVinculado[]; tipoPerfil?: string }

export type IdososVinculados = Busca & {
  estado: 'carregando' | 'erro' | 'ok'
  // true enquanto não dá para enviar em nome de um idoso (carregando, erro ou 0 idosos).
  // Perfil idoso nunca bloqueia: ele usa os endpoints sem ID.
  bloqueado: boolean
}

export type VinculoApi = {
  status: string
  idoso: { id: number | null; nome: string | null; email_mascarado: string | null }
}

// tipoPerfilConhecido: o do AcessoProvider, quando já carregou. tipo_perfil é fixo por conta, então não precisa
// buscar /usuario/me de novo; os vínculos, sim, vêm frescos a cada montagem.
async function buscar(tipoPerfilConhecido: string | null): Promise<Busca> {
  const tipoPerfil = tipoPerfilConhecido ?? (await buscarPerfil()).tipo_perfil

  if (tipoPerfil === 'idoso') return { ehIdoso: true, idosos: [] }

  const corpo = await chamarApi('/vinculo?status=aprovado', { method: 'GET' })

  return { ehIdoso: false, idosos: idososAprovados(corpo.vinculos), tipoPerfil }
}

// Só dedupa buscas simultâneas (vários seletores na mesma página). Zera ao terminar, então
// montar outra página depois sempre refaz a busca e um vínculo recém-aprovado aparece.
// Nem buscarPerfil nem chamarApi têm timeout: sem o limite abaixo, uma requisição que nunca responde
// prenderia emVoo (e o spinner) até recarregar a aba. 60 s cobre o cold start do Render free.
const TIMEOUT_MS = 60_000

let emVoo: Promise<Busca> | null = null

function buscarCompartilhado(tipoPerfilConhecido: string | null): Promise<Busca> {
  if (!emVoo) {
    let timer: ReturnType<typeof setTimeout>
    const limite = new Promise<never>((_, rejeitar) => {
      timer = setTimeout(() => rejeitar(new Error('timeout')), TIMEOUT_MS)
    })
    emVoo = Promise.race([buscar(tipoPerfilConhecido), limite]).finally(() => {
      clearTimeout(timer)
      emVoo = null
    })
  }
  return emVoo
}

// Nunca loga o erro: a mensagem do backend não é necessária e pode trazer dado do vínculo.
export function useIdososVinculados(): IdososVinculados {
  const [estado, setEstado] = useState<'carregando' | 'erro' | Busca>('carregando')
  const acesso = useAcesso()
  // Só na montagem, como antes: o perfil conhecido naquele momento (ou null, e a busca pergunta ao servidor).
  const [tipoPerfilConhecido] = useState(acesso.estado !== 'carregando' ? acesso.tipoPerfil : null)

  useEffect(() => {
    let ativo = true
    buscarCompartilhado(tipoPerfilConhecido)
      .then((busca) => ativo && setEstado(busca))
      .catch(() => ativo && setEstado('erro'))
    return () => {
      ativo = false
    }
  }, [tipoPerfilConhecido])

  if (typeof estado === 'string') {
    return { estado, ehIdoso: false, idosos: [], bloqueado: true }
  }

  return {
    estado: 'ok',
    ...estado,
    bloqueado: !estado.ehIdoso && estado.idosos.length === 0,
  }
}

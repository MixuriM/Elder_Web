import { useEffect, useState } from 'react'

import { chamarApi } from '../lib/chamarApi'
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

type VinculoApi = {
  status: string
  idoso: { id: number | null; nome: string | null; email_mascarado: string | null }
}

async function buscar(): Promise<Busca> {
  const perfil = await buscarPerfil()

  if (perfil.tipo_perfil === 'idoso') return { ehIdoso: true, idosos: [] }

  const corpo = await chamarApi('/vinculo?status=aprovado', { method: 'GET' })

  // Familiar titular recebe também vínculos de outras pessoas com o mesmo idoso: um item por idoso.
  // idoso.id null = idoso oculto pelo backend, não dá para selecionar.
  const porId = new Map<number, IdosoVinculado>()
  for (const v of corpo.vinculos as VinculoApi[]) {
    const { id, nome, email_mascarado } = v.idoso
    if (v.status === 'aprovado' && id !== null && nome !== null && !porId.has(id)) {
      porId.set(id, { id, nome, email_mascarado })
    }
  }

  return { ehIdoso: false, idosos: [...porId.values()], tipoPerfil: perfil.tipo_perfil }
}

// Só dedupa buscas simultâneas (vários seletores na mesma página). Zera ao terminar, então
// montar outra página depois sempre refaz a busca e um vínculo recém-aprovado aparece.
// Nem buscarPerfil nem chamarApi têm timeout: sem o limite abaixo, uma requisição que nunca responde
// prenderia emVoo (e o spinner) até recarregar a aba. 60 s cobre o cold start do Render free.
const TIMEOUT_MS = 60_000

let emVoo: Promise<Busca> | null = null

function buscarCompartilhado(): Promise<Busca> {
  if (!emVoo) {
    let timer: ReturnType<typeof setTimeout>
    const limite = new Promise<never>((_, rejeitar) => {
      timer = setTimeout(() => rejeitar(new Error('timeout')), TIMEOUT_MS)
    })
    emVoo = Promise.race([buscar(), limite]).finally(() => {
      clearTimeout(timer)
      emVoo = null
    })
  }
  return emVoo
}

// Nunca loga o erro: a mensagem do backend não é necessária e pode trazer dado do vínculo.
export function useIdososVinculados(): IdososVinculados {
  const [estado, setEstado] = useState<'carregando' | 'erro' | Busca>('carregando')

  useEffect(() => {
    let ativo = true
    buscarCompartilhado()
      .then((busca) => ativo && setEstado(busca))
      .catch(() => ativo && setEstado('erro'))
    return () => {
      ativo = false
    }
  }, [])

  if (typeof estado === 'string') {
    return { estado, ehIdoso: false, idosos: [], bloqueado: true }
  }

  return {
    estado: 'ok',
    ...estado,
    bloqueado: !estado.ehIdoso && estado.idosos.length === 0,
  }
}

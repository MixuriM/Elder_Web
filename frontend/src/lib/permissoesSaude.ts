import { useEffect, useState } from 'react'
import { chamarApi } from './chamarApi'

// Item 4.x: decide no cliente se as seções que escrevem em nome de outro idoso aparecem.
// É só conveniência de UX: a autoridade continua sendo o 403 do backend em cada ação.
// Tipo mínimo local, de propósito: não depende do tipo do card de vínculos (tela de Laureane e Jennifer).
export type VinculoMinimo = {
  tipo_vinculo: 'cuidador' | 'familiar'
  status: string
  papel_do_chamador: 'dono' | 'vinculado' | 'titular'
  permissoes: {
    permite_registrar_saude: boolean
    permite_marcar_dose: boolean
    permite_criar_evento_cuidado: boolean
  } | null
}

export async function buscarPermissoesSaude(): Promise<VinculoMinimo[]> {
  const corpo = await chamarApi('/vinculo?status=aprovado', { method: 'GET' })
  return corpo.vinculos
}

// Só conta vínculo aprovado em que o chamador é o vinculado (papéis dono e titular ficam de fora):
// familiar escreve (o backend ainda exige modo_decisao), cuidador só com permite_registrar_saude.
// ponytail: com vários vínculos vale "qualquer um qualifica", porque o id do idoso é digitado livremente
// no esqueleto; o backend valida o idoso de fato.
export function decidirVisibilidade(vinculos: VinculoMinimo[]) {
  const meus = vinculos.filter((v) => v.status === 'aprovado' && v.papel_do_chamador === 'vinculado')
  const escrita = meus.some(
    (v) => v.tipo_vinculo === 'familiar' || (v.tipo_vinculo === 'cuidador' && v.permissoes?.permite_registrar_saude === true),
  )
  return { escrita, avisoSemFlag: !escrita && meus.length > 0 }
}

type Estado = { estado: 'carregando' | 'erro' | 'ok'; escrita: boolean; avisoSemFlag: boolean }

// Nunca loga o erro nem o corpo: a mensagem do backend não é necessária para a decisão.
export function usePermissoesSaude(): Estado {
  const [resultado, setResultado] = useState<Estado>({ estado: 'carregando', escrita: false, avisoSemFlag: false })

  useEffect(() => {
    let ativo = true
    buscarPermissoesSaude()
      .then((vinculos) => ativo && setResultado({ estado: 'ok', ...decidirVisibilidade(vinculos) }))
      .catch(() => ativo && setResultado({ estado: 'erro', escrita: false, avisoSemFlag: false }))
    return () => {
      ativo = false
    }
  }, [])

  return resultado
}

// Item 5.2 (RF-012): mesma ideia de decidirVisibilidade, para marcar dose em nome de outro idoso.
// Familiar aprovado sempre (o backend não consulta modo_decisao nesta rota); cuidador aprovado só com
// permite_marcar_dose. Papéis dono e titular não contam. Só conveniência de UX: o 403 do backend manda.
export function decidirVisibilidadeDose(vinculos: VinculoMinimo[]) {
  const meus = vinculos.filter((v) => v.status === 'aprovado' && v.papel_do_chamador === 'vinculado')
  const escrita = meus.some(
    (v) => v.tipo_vinculo === 'familiar' || (v.tipo_vinculo === 'cuidador' && v.permissoes?.permite_marcar_dose === true),
  )
  return { escrita, avisoSemFlag: !escrita && meus.length > 0 }
}

import type { Vinculo } from '../components/Vinculos/CardVinculo'
import type { IdososVinculados } from '../hooks/useIdososVinculados'
import { podeAlterarOutroRegistro } from './permissoesEdicao'
import { ocultarSecaoDeTerceiros } from './regrasIdosoVinculado'

export type ModoCriacao = 'idoso' | 'familiar' | 'cuidador'

// Cuidador cria só compromisso de cuidado, e só com a permissão do vínculo (estrito: true). Vínculos que não
// carregaram falham ABERTOS: o 403 do servidor é a barreira real.
function cuidadorPodeCriar(vinculos: Vinculo[] | null | undefined): boolean {
  if (!vinculos) return true

  return vinculos.some(
    (v) =>
      v.papel_do_chamador === 'vinculado' &&
      v.tipo_vinculo === 'cuidador' &&
      v.status === 'aprovado' &&
      v.permissoes?.permite_criar_evento_cuidado === true,
  )
}

// Qual formulário o botão "Criar compromisso" abre, ou null quando a pessoa não cria (ou ainda não dá para saber).
// Idoso cria o próprio; familiar cria para o idoso vinculado; cuidador cria o de cuidado, com a permissão.
export function modoDeCriacao({
  tipoPerfil,
  idosos,
  vinculos,
}: {
  tipoPerfil: string | null
  idosos: IdososVinculados
  vinculos: Vinculo[] | null | undefined
}): ModoCriacao | null {
  const perfil = tipoPerfil ?? (idosos.estado === 'ok' ? (idosos.ehIdoso ? 'idoso' : idosos.tipoPerfil) : undefined)

  if (perfil === 'idoso') return 'idoso'

  if (perfil !== 'familiar' && perfil !== 'cuidador') return null

  // Criar em nome de terceiros não existe enquanto se descobre o perfil (nem para o idoso).
  if (ocultarSecaoDeTerceiros(idosos)) return null

  if (perfil === 'cuidador') return cuidadorPodeCriar(vinculos) ? 'cuidador' : null

  return 'familiar'
}

type ContextoAlteracao = {
  ehIdoso: boolean
  tipoPerfil?: string | null
  idosoId: string
  vinculos?: Vinculo[] | null
}

// Cuidador altera só 'cuidado', com a flag e no que ele mesmo criou (como na edição de saúde). Falha ABERTA quando não dá para
// saber (vínculos sem carregar, ou compromisso sem autor): o 403 do servidor é a barreira real.
function cuidadorPodeAlterar(c: ContextoAlteracao, criadoPorId: number | undefined): boolean {
  if (!c.vinculos) return true

  const vinculo = c.vinculos.find(
    (v) =>
      v.papel_do_chamador === 'vinculado' &&
      v.tipo_vinculo === 'cuidador' &&
      v.status === 'aprovado' &&
      String(v.idoso.id) === c.idosoId,
  )

  if (!vinculo || vinculo.permissoes?.permite_criar_evento_cuidado !== true) return false

  const meuId = vinculo.vinculado.id

  return criadoPorId === undefined || meuId === null || criadoPorId === meuId
}

// Quem vê Editar e Remover no cartão de um compromisso. Autoridade = a de criar: idoso e familiar (modo familiar) só em
// 'pessoal' e 'medico'; cuidador só em 'cuidado'.
export function podeAlterarCompromisso(c: ContextoAlteracao & { evento: { tipo_evento: string; criado_por_id?: number } }): boolean {
  if (c.evento.tipo_evento === 'cuidado') return !c.ehIdoso && c.tipoPerfil === 'cuidador' && cuidadorPodeAlterar(c, c.evento.criado_por_id)

  return podeAlterarOutroRegistro({ ehIdoso: c.ehIdoso, tipoPerfil: c.tipoPerfil ?? undefined, idosoId: c.idosoId, vinculos: c.vinculos })
}

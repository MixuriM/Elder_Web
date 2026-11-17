import type { Vinculo } from '../components/Vinculos/CardVinculo'
import type { IdososVinculados } from '../hooks/useIdososVinculados'
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

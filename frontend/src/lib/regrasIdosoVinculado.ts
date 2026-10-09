import type { IdosoVinculado, IdososVinculados, VinculoApi } from '../hooks/useIdososVinculados'

// Envio bloqueado enquanto não dá para enviar em nome de um idoso: carregando, erro, 0 idosos ou
// nenhum escolhido. Perfil idoso nunca bloqueia (usa os endpoints sem ID).
export function envioBloqueado(lista: IdososVinculados, valor: string) {
  return lista.bloqueado || (!lista.ehIdoso && valor === '')
}

// Seções que escrevem em nome de terceiros não existem para o perfil idoso (nem enquanto se descobre o perfil).
export function ocultarSecaoDeTerceiros(lista: IdososVinculados) {
  return lista.ehIdoso || lista.estado === 'carregando'
}

// Familiar titular recebe também vínculos de outras pessoas com o mesmo idoso: um item por idoso.
// idoso.id null = idoso oculto pelo backend, não dá para selecionar.
export function idososAprovados(vinculos: VinculoApi[]): IdosoVinculado[] {
  const porId = new Map<number, IdosoVinculado>()
  for (const v of vinculos) {
    const { id, nome, email_mascarado } = v.idoso
    if (v.status === 'aprovado' && id !== null && nome !== null && !porId.has(id)) {
      porId.set(id, { id, nome, email_mascarado })
    }
  }
  return [...porId.values()]
}

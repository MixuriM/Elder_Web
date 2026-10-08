import type { IdososVinculados } from '../hooks/useIdososVinculados'

// Envio bloqueado enquanto não dá para enviar em nome de um idoso: carregando, erro, 0 idosos ou
// nenhum escolhido. Perfil idoso nunca bloqueia (usa os endpoints sem ID).
export function envioBloqueado(lista: IdososVinculados, valor: string) {
  return lista.bloqueado || (!lista.ehIdoso && valor === '')
}

// Seções que escrevem em nome de terceiros não existem para o perfil idoso (nem enquanto se descobre o perfil).
export function ocultarSecaoDeTerceiros(lista: IdososVinculados) {
  return lista.ehIdoso || lista.estado === 'carregando'
}

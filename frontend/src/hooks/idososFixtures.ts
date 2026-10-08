// Dados só de teste (fakes explícitos) para mockar useIdososVinculados nos testes de tela.
import type { IdososVinculados } from './useIdososVinculados'

export const listaFamiliar: IdososVinculados = {
  estado: 'ok',
  ehIdoso: false,
  bloqueado: false,
  idosos: [
    { id: 5, nome: 'Idoso Teste Cinco', email_mascarado: 'c***@teste.com' },
    { id: 8, nome: 'Idoso Teste Oito', email_mascarado: null },
  ],
}

export const listaPerfilIdoso: IdososVinculados = {
  estado: 'ok',
  ehIdoso: true,
  bloqueado: false,
  idosos: [],
}

export const listaSemIdosos: IdososVinculados = {
  estado: 'ok',
  ehIdoso: false,
  bloqueado: true,
  idosos: [],
}

// Um único idoso vinculado (id 7): o seletor o pré-seleciona, inclusive nas telas de escrita.
export const listaUmIdoso: IdososVinculados = {
  estado: 'ok',
  ehIdoso: false,
  bloqueado: false,
  idosos: [{ id: 7, nome: 'Idoso Teste Sete', email_mascarado: 's***@teste.com' }],
}

// Dois idosos (ids 7 e 9): na escrita o seletor exige escolha; na leitura pré-seleciona o 7.
export const listaDoisIdosos7: IdososVinculados = {
  estado: 'ok',
  ehIdoso: false,
  bloqueado: false,
  idosos: [
    { id: 7, nome: 'Idoso Teste Sete', email_mascarado: 's***@teste.com' },
    { id: 9, nome: 'Idoso Teste Nove', email_mascarado: null },
  ],
}

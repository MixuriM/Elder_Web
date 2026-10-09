import { itensDoMenu } from './menuPorPerfil'
import type { Acesso } from '../contexts/useAcesso'

function rotulos(parcial: Partial<Acesso>) {
  const acesso: Acesso = {
    tipoPerfil: null,
    temVinculoAprovado: false,
    temVinculoPendente: false,
    estado: 'ok',
    ...parcial,
  }
  return itensDoMenu(acesso).map((i) => i.label)
}

const TODOS = [
  'Início',
  'Meu Perfil',
  'Saúde',
  'Medicamentos',
  'Agenda',
  'Alimentação e Nutrição',
  'Família',
  'Cuidadores',
  'Orientações',
]

describe('itensDoMenu (decisão D2)', () => {
  it('idoso: todos os itens, sempre', () => {
    expect(rotulos({ tipoPerfil: 'idoso' })).toEqual(TODOS)
    expect(rotulos({ tipoPerfil: 'idoso', temVinculoAprovado: false })).toEqual(TODOS)
  })

  it('familiar com vínculo aprovado: todos (titular gerencia cuidadores)', () => {
    expect(rotulos({ tipoPerfil: 'familiar', temVinculoAprovado: true })).toEqual(TODOS)
  })

  it('familiar sem vínculo aprovado: Início, Meu Perfil, Família, Orientações', () => {
    expect(rotulos({ tipoPerfil: 'familiar' })).toEqual(['Início', 'Meu Perfil', 'Família', 'Orientações'])
    expect(rotulos({ tipoPerfil: 'familiar', temVinculoPendente: true })).toEqual([
      'Início',
      'Meu Perfil',
      'Família',
      'Orientações',
    ])
  })

  it('cuidador com vínculo aprovado: todos os módulos mais Cuidadores, sem Família', () => {
    expect(rotulos({ tipoPerfil: 'cuidador', temVinculoAprovado: true })).toEqual(
      TODOS.filter((r) => r !== 'Família'),
    )
  })

  it('cuidador sem vínculo aprovado: Início, Meu Perfil, Cuidadores, Orientações', () => {
    expect(rotulos({ tipoPerfil: 'cuidador' })).toEqual(['Início', 'Meu Perfil', 'Cuidadores', 'Orientações'])
  })

  it('carregando: sem módulos de dados nem listas de vínculo', () => {
    expect(rotulos({ estado: 'carregando' })).toEqual(['Início', 'Meu Perfil', 'Orientações'])
  })

  it('erro com perfil desconhecido: falha aberto, menu completo', () => {
    expect(rotulos({ estado: 'erro', tipoPerfil: null })).toEqual(TODOS)
  })

  it('erro com perfil conhecido: menu completo daquele perfil, mesmo sem saber dos vínculos', () => {
    expect(rotulos({ estado: 'erro', tipoPerfil: 'cuidador' })).toEqual(TODOS.filter((r) => r !== 'Família'))
    expect(rotulos({ estado: 'erro', tipoPerfil: 'familiar' })).toEqual(TODOS)
    expect(rotulos({ estado: 'erro', tipoPerfil: 'idoso' })).toEqual(TODOS)
  })
})

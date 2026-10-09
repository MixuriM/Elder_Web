import { acoesDoPerfil } from './regrasVinculo'

describe('acoesDoPerfil', () => {
  it.each([
    ['cuidador', 'cuidador', ['solicitar']],
    ['familiar', 'familiar', ['solicitar', 'cadastrar']],
    ['familiar', 'cuidador', []],
    ['cuidador', 'familiar', []],
    ['idoso', 'familiar', []],
    ['idoso', 'cuidador', []],
    [null, 'familiar', []],
  ] as const)('perfil %s na tela %s: %j', (perfil, tipo, esperado) => {
    expect(acoesDoPerfil(perfil, tipo)).toEqual(esperado)
  })
})

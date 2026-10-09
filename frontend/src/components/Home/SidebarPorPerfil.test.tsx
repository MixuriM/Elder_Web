import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Sidebar from './Sidebar'
import { AcessoContext, type Acesso } from '../../contexts/useAcesso'

jest.mock('../../lib/auth', () => ({ logoutUser: jest.fn() }))

function renderizar(parcial: Partial<Acesso>) {
  const acesso: Acesso = {
    tipoPerfil: null,
    temVinculoAprovado: false,
    temVinculoPendente: false,
    estado: 'ok',
    ...parcial,
  }
  render(
    <AcessoContext.Provider value={acesso}>
      <MemoryRouter>
        <Sidebar aberto setAberto={() => {}} />
      </MemoryRouter>
    </AcessoContext.Provider>,
  )
  const nav = screen.getByRole('navigation', { name: 'Menu principal' })
  return Array.from(nav.querySelectorAll('a')).map((a) => a.textContent)
}

describe('Sidebar: menu por perfil e vínculo', () => {
  it('idoso vê tudo, inclusive Família e Cuidadores', () => {
    expect(renderizar({ tipoPerfil: 'idoso' })).toHaveLength(9)
  })

  it('familiar sem vínculo aprovado não vê módulos de dados nem Cuidadores', () => {
    expect(renderizar({ tipoPerfil: 'familiar' })).toEqual(['Início', 'Meu Perfil', 'Família', 'Orientações'])
  })

  it('cuidador sem vínculo aprovado vê só o básico e Cuidadores', () => {
    expect(renderizar({ tipoPerfil: 'cuidador' })).toEqual(['Início', 'Meu Perfil', 'Cuidadores', 'Orientações'])
  })

  it('cuidador com vínculo aprovado vê os módulos, sem Família', () => {
    const rotulos = renderizar({ tipoPerfil: 'cuidador', temVinculoAprovado: true })
    expect(rotulos).toContain('Saúde')
    expect(rotulos).toContain('Cuidadores')
    expect(rotulos).not.toContain('Família')
  })

  it('carregando: sem módulos de dados', () => {
    expect(renderizar({ estado: 'carregando' })).toEqual(['Início', 'Meu Perfil', 'Orientações'])
  })

  it('erro: falha aberto com aviso discreto em role=status', () => {
    const rotulos = renderizar({ estado: 'erro', tipoPerfil: 'familiar' })
    expect(rotulos).toContain('Saúde')
    expect(screen.getByRole('status')).toHaveTextContent(/não foi possível verificar o seu acesso/i)
  })

  it('sem erro: o status existe, mas vazio', () => {
    renderizar({ tipoPerfil: 'idoso' })
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
})

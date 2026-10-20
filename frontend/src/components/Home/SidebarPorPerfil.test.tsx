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
    expect(renderizar({ tipoPerfil: 'idoso' })).toHaveLength(10)
  })

  it('familiar sem vínculo aprovado não vê módulos de dados nem Cuidadores', () => {
    expect(renderizar({ tipoPerfil: 'familiar' })).toEqual(['Início', 'Meu Perfil', 'Família', 'Orientações', 'Sobre nós'])
  })

  it('cuidador sem vínculo aprovado vê só o básico e Cuidadores', () => {
    expect(renderizar({ tipoPerfil: 'cuidador' })).toEqual(['Início', 'Meu Perfil', 'Cuidadores', 'Orientações', 'Sobre nós'])
  })

  it('cuidador com vínculo aprovado vê os módulos, sem Família', () => {
    const rotulos = renderizar({ tipoPerfil: 'cuidador', temVinculoAprovado: true })
    expect(rotulos).toContain('Saúde')
    expect(rotulos).toContain('Cuidadores')
    expect(rotulos).not.toContain('Família')
  })

  it('carregando: sem módulos de dados', () => {
    expect(renderizar({ estado: 'carregando' })).toEqual(['Início', 'Meu Perfil', 'Orientações', 'Sobre nós'])
  })

  it('Sobre nós aponta para /sobre-nos, depois de Orientações, nos três perfis', () => {
    for (const tipoPerfil of ['idoso', 'familiar', 'cuidador'] as const) {
      const { unmount } = render(
        <AcessoContext.Provider
          value={{ tipoPerfil, temVinculoAprovado: true, temVinculoPendente: false, estado: 'ok' }}
        >
          <MemoryRouter>
            <Sidebar aberto setAberto={() => {}} />
          </MemoryRouter>
        </AcessoContext.Provider>,
      )
      const nav = screen.getByRole('navigation', { name: 'Menu principal' })
      const links = Array.from(nav.querySelectorAll('a'))
      const i = links.findIndex((a) => a.textContent === 'Orientações')
      expect(links[i + 1]).toHaveTextContent('Sobre nós')
      expect(links[i + 1]).toHaveAttribute('href', '/sobre-nos')
      unmount()
    }
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

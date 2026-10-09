import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Home from '../../pages/Home'
import { AcessoContext, type Acesso } from '../../contexts/useAcesso'

// O resumo do dia da Home busca dados; aqui só importa o cartão, então a busca nunca responde.
jest.mock('../../lib/chamarApi', () => ({ chamarApi: jest.fn(() => new Promise(() => {})) }))

function renderizarHome(parcial: Partial<Acesso>) {
  const acesso: Acesso = {
    tipoPerfil: null,
    temVinculoAprovado: false,
    temVinculoPendente: false,
    estado: 'ok',
    ...parcial,
  }
  return render(
    <AcessoContext.Provider value={acesso}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </AcessoContext.Provider>,
  )
}

describe('Home: cartão para quem está sem vínculo aprovado', () => {
  it('cuidador sem vínculo: um cartão com botão para /cuidadores, sem cards de módulos', () => {
    renderizarHome({ tipoPerfil: 'cuidador' })
    expect(screen.getByRole('heading', { name: 'Vincule-se a um idoso' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir para os vínculos' })).toHaveAttribute('href', '/cuidadores')
    expect(screen.queryByText('Minha Saúde')).not.toBeInTheDocument()
    expect(screen.queryByText('Resumo do seu dia')).not.toBeInTheDocument()
  })

  it('familiar sem vínculo: botão leva a /familia', () => {
    renderizarHome({ tipoPerfil: 'familiar' })
    expect(screen.getByRole('link', { name: 'Ir para os vínculos' })).toHaveAttribute('href', '/familia')
  })

  it('com vínculo pendente: diz que aguarda aprovação', () => {
    renderizarHome({ tipoPerfil: 'familiar', temVinculoPendente: true })
    expect(screen.getByRole('heading', { name: 'Aguardando aprovação' })).toBeInTheDocument()
    expect(screen.getByText(/ainda aguarda aprovação/i)).toBeInTheDocument()
  })

  it.each([
    ['idoso', { tipoPerfil: 'idoso' }],
    ['cuidador com vínculo', { tipoPerfil: 'cuidador', temVinculoAprovado: true }],
    ['erro de carregamento', { tipoPerfil: 'familiar', estado: 'erro' as const }],
  ])('%s: mantém os cards de sempre', (_nome, parcial) => {
    renderizarHome(parcial)
    expect(screen.getByText('Minha Saúde')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Vincule-se a um idoso' })).not.toBeInTheDocument()
  })
})

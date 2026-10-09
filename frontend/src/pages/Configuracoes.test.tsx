import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'

import Configuracoes from './Configuracoes'
import BotaoTema from '../components/layout/BotaoTema'
import { AcessoContext, type ContextoAcesso } from '../contexts/useAcesso'

expect.extend(toHaveNoViolations)

const mockLogout = jest.fn()
jest.mock('../lib/auth', () => ({ logoutUser: (...a: unknown[]) => mockLogout(...a) }))

function midia(reduzir: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('reduced-motion') ? reduzir : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

const html = document.documentElement

function renderizar(tipoPerfil = 'idoso') {
  const acesso: ContextoAcesso = { estado: 'ok', tipoPerfil, temVinculoAprovado: false, temVinculoPendente: false }
  return render(
    <MemoryRouter initialEntries={['/configuracoes']}>
      <AcessoContext.Provider value={acesso}>
        <Routes>
          <Route
            path="/configuracoes"
            element={
              <>
                <BotaoTema compacto />
                <Configuracoes />
              </>
            }
          />
          <Route path="/login" element={<p>Tela de login</p>} />
        </Routes>
      </AcessoContext.Provider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  jest.restoreAllMocks()
  localStorage.clear()
  html.className = ''
  midia(false)
  mockLogout.mockReset().mockResolvedValue(undefined)
})

describe('Configurações', () => {
  it('mostra as opções com o que está salvo e sem violações do axe', async () => {
    localStorage.setItem('tema', 'escuro')
    localStorage.setItem('tamanhoTexto', 'grande')
    const { container } = renderizar()
    expect(screen.getByRole('heading', { level: 1, name: 'Configurações' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Escuro' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Grande' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /reduzir animações/i })).not.toBeChecked()
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations()
  })

  it('reduzir animações começa marcado quando o aparelho pede menos movimento', () => {
    midia(true)
    renderizar()
    expect(screen.getByRole('checkbox', { name: /reduzir animações/i })).toBeChecked()
  })

  it('trocar o tema aplica na hora, guarda, avisa e atualiza o botão de tema do cabeçalho', async () => {
    renderizar()
    expect(screen.getByRole('button', { name: 'Ativar modo escuro' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Escuro' }))
    expect(html).toHaveClass('dark')
    expect(localStorage.getItem('tema')).toBe('escuro')
    expect(screen.getByRole('status')).toHaveTextContent('Preferência salva.')
    expect(screen.getByRole('button', { name: 'Ativar modo claro' })).toBeInTheDocument()
  })

  it('tamanho do texto e reduzir animações viram classes no <html>', async () => {
    renderizar()
    await userEvent.click(screen.getByRole('radio', { name: 'Muito grande' }))
    expect(html).toHaveClass('texto-muito-grande')
    expect(localStorage.getItem('tamanhoTexto')).toBe('muito-grande')
    await userEvent.click(screen.getByRole('checkbox', { name: /reduzir animações/i }))
    expect(html).toHaveClass('reduzir-movimento')
    expect(localStorage.getItem('reduzirMovimento')).toBe('sim')
  })

  it('storage indisponível: a página funciona, aplica e explica que não guardou', async () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    renderizar()
    await userEvent.click(screen.getByRole('radio', { name: 'Grande' }))
    expect(html).toHaveClass('texto-grande')
    expect(screen.getByRole('status')).toHaveTextContent(/não foi possível guardar/i)
  })

  it('idoso vê o link "Quem decide por mim"; cuidador não', () => {
    const { unmount } = renderizar('idoso')
    expect(screen.getByRole('link', { name: /quem decide por mim/i })).toHaveAttribute('href', '/familia')
    unmount()
    renderizar('cuidador')
    expect(screen.queryByRole('link', { name: /quem decide por mim/i })).not.toBeInTheDocument()
  })

  it('Sair da conta faz logout e leva ao login', async () => {
    renderizar()
    await userEvent.click(screen.getByRole('button', { name: 'Sair da conta' }))
    expect(mockLogout).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByText('Tela de login')).toBeInTheDocument())
  })

  it('falha ao sair: mensagem simples, continua na tela e deixa tentar de novo', async () => {
    mockLogout.mockRejectedValueOnce(new Error('detalhe-interno-falso'))
    renderizar()
    await userEvent.click(screen.getByRole('button', { name: 'Sair da conta' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível sair da conta. Tente de novo.')
    expect(screen.queryByText('detalhe-interno-falso')).not.toBeInTheDocument()
    expect(screen.queryByText('Tela de login')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sair da conta' }))
    await waitFor(() => expect(screen.getByText('Tela de login')).toBeInTheDocument())
    expect(mockLogout).toHaveBeenCalledTimes(2)
  })
})

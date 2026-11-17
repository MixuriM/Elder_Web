import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { MemoryRouter } from 'react-router-dom'

import AvisoCookies from './AvisoCookies'
import { avisoCookiesVisto } from '../lib/preferencias'

expect.extend(toHaveNoViolations)

// O jsdom não calcula contraste: o contraste é auditado por npm run test:a11y (Playwright).
const AXE = { rules: { 'color-contrast': { enabled: false } } }

function montar() {
  return render(
    <MemoryRouter>
      <AvisoCookies />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  jest.restoreAllMocks()
  localStorage.clear()
})

describe('AvisoCookies', () => {
  it('primeira visita: mostra o aviso em uma região nomeada, com texto simples, link e botão', () => {
    montar()

    const aviso = screen.getByRole('region', { name: 'Aviso de cookies' })
    expect(aviso).toHaveTextContent(/não usamos cookies de publicidade nem de estatística/i)
    expect(screen.getByRole('link', { name: /política de cookies/i })).toHaveAttribute('href', '/cookies')
    expect(screen.getByRole('button', { name: 'Entendi' })).toBeInTheDocument()
  })

  it('é um aviso, não um bloqueio: sem dialog, sem aria-modal e sem roubar o foco', () => {
    montar()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Aviso de cookies' })).not.toHaveAttribute('aria-modal')
    expect(document.body).toHaveFocus()
  })

  it('não oferece aceitar nem recusar: não há cookie opcional para escolher', () => {
    montar()

    expect(screen.queryByRole('button', { name: /aceitar|recusar|rejeitar/i })).not.toBeInTheDocument()
  })

  it('Entendi some com o aviso e guarda a escolha, para não voltar na próxima visita', async () => {
    const user = userEvent.setup()
    const { unmount } = montar()

    await user.click(screen.getByRole('button', { name: 'Entendi' }))

    expect(screen.queryByRole('region', { name: 'Aviso de cookies' })).not.toBeInTheDocument()
    expect(avisoCookiesVisto()).toBe(true)
    unmount()

    montar()
    expect(screen.queryByRole('region', { name: 'Aviso de cookies' })).not.toBeInTheDocument()
  })

  it('já visto em outra visita: não aparece', () => {
    localStorage.setItem('avisoCookies', 'sim')
    montar()

    expect(screen.queryByRole('region', { name: 'Aviso de cookies' })).not.toBeInTheDocument()
  })

  it('botão e link com alvo de toque de 44 px ou mais', () => {
    montar()

    expect(screen.getByRole('button', { name: 'Entendi' })).toHaveClass('min-h-11')
    expect(screen.getByRole('link', { name: /política de cookies/i })).toHaveClass('min-h-11')
  })

  it('sem violações de acessibilidade', async () => {
    const { container } = montar()

    expect(await axe(container, AXE)).toHaveNoViolations()
  })
})

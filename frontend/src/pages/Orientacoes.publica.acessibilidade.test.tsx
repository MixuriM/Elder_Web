import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'

import App from '../App'

expect.extend(toHaveNoViolations)

jest.mock('../lib/auth', () => ({
  onAuthChange: (cb: (u: unknown) => void) => {
    cb(null)
    return () => {}
  },
  getCurrentUserToken: jest.fn().mockResolvedValue(null),
}))

// LIMITE: jsdom não calcula cor, então contraste NÃO é verificado aqui (coberto pelo Playwright, item 9.1).
const AXE = { rules: { 'color-contrast': { enabled: false } } }

// O <header> do cabeçalho da página fica dentro do main e não é landmark banner; o jsdom (aria-query) o conta mesmo assim.
function bannersReais() {
  return screen.getAllByRole('banner').filter((el) => !el.closest('main'))
}

async function renderVisitante() {
  const resultado = render(
    <MemoryRouter initialEntries={['/orientacoes']}>
      <App />
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { level: 1, name: 'Orientações gerais' })
  return resultado
}

describe('Orientações pública (visitante): acessibilidade da casca', () => {
  it('não tem violações detectáveis pelo axe', async () => {
    const { container } = await renderVisitante()
    expect(await axe(container, AXE)).toHaveNoViolations()
  })

  it('tem um main e um h1', async () => {
    await renderVisitante()
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('ordem de leitura: banner, main, contentinfo', async () => {
    await renderVisitante()
    const banner = bannersReais()[0]
    const main = screen.getByRole('main')
    const rodape = screen.getByRole('contentinfo')
    expect(banner.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(main.compareDocumentPosition(rodape) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(main).not.toContainElement(banner)
    expect(main).not.toContainElement(rodape)
  })
})

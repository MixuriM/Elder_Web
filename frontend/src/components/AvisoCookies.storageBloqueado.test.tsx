import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import AvisoCookies from './AvisoCookies'

// Arquivo à parte: a memória de apoio da lib vive no módulo, e aqui ela começa vazia (sem o "sim" dos outros testes).
describe('AvisoCookies com o storage do navegador bloqueado', () => {
  it('o aviso aparece e Entendi o fecha na página atual, sem lançar', async () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <AvisoCookies />
      </MemoryRouter>,
    )

    expect(screen.getByRole('region', { name: 'Aviso de cookies' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Entendi' }))

    expect(screen.queryByRole('region', { name: 'Aviso de cookies' })).not.toBeInTheDocument()
  })
})

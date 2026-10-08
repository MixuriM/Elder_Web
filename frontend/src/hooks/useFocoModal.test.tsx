import { useRef, useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { useFocoModal } from './useFocoModal'

function Demo() {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useFocoModal(ref, aberto)

  return (
    <>
      <button onClick={() => setAberto(true)}>abrir</button>
      <button>fora</button>

      {aberto && (
        <div ref={ref} role="dialog" aria-label="Teste" tabIndex={-1}>
          <button>primeiro</button>
          <button>segundo</button>
          <button onClick={() => setAberto(false)}>fechar</button>
        </div>
      )}
    </>
  )
}

describe('useFocoModal', () => {
  it('leva o foco para dentro do modal ao abrir', async () => {
    const user = userEvent.setup()
    render(<Demo />)

    await user.click(screen.getByRole('button', { name: 'abrir' }))

    expect(screen.getByRole('dialog')).toHaveFocus()
  })

  it('Tab e Shift+Tab não saem do modal', async () => {
    const user = userEvent.setup()
    render(<Demo />)

    await user.click(screen.getByRole('button', { name: 'abrir' }))

    await user.tab()
    expect(screen.getByRole('button', { name: 'primeiro' })).toHaveFocus()

    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'fechar' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'primeiro' })).toHaveFocus()

    await user.tab()
    await user.tab()
    await user.tab()
    expect(screen.getByRole('button', { name: 'primeiro' })).toHaveFocus()
  })

  it('devolve o foco ao botão que abriu quando o modal fecha', async () => {
    const user = userEvent.setup()
    render(<Demo />)

    await user.click(screen.getByRole('button', { name: 'abrir' }))
    await user.click(screen.getByRole('button', { name: 'fechar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'abrir' })).toHaveFocus()
  })
})

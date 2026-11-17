import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'

import ModalBase from './ModalBase'

expect.extend(toHaveNoViolations)

function Demo({ onFechar = jest.fn() }: { onFechar?: () => void }) {
  const [aberto, setAberto] = useState(false)

  return (
    <>
      <button onClick={() => setAberto(true)}>abrir</button>
      <ModalBase
        aberto={aberto}
        onFechar={() => {
          onFechar()
          setAberto(false)
        }}
        icone={<span data-testid="icone" />}
        sobretitulo="Saúde"
        titulo="Editar registro"
        descricao="Altere os dados."
      >
        <button>dentro</button>
      </ModalBase>
    </>
  )
}

describe('ModalBase', () => {
  it('não renderiza nada fechado', () => {
    render(<Demo />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('aberto: dialog modal nomeado pelo título, com sobretítulo, descrição e ícone', async () => {
    const user = userEvent.setup()
    render(<Demo />)

    await user.click(screen.getByRole('button', { name: 'abrir' }))

    const dialogo = screen.getByRole('dialog', { name: 'Editar registro' })
    expect(dialogo).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Saúde')).toBeInTheDocument()
    expect(screen.getByText('Altere os dados.')).toBeInTheDocument()
    expect(screen.getByTestId('icone')).toBeInTheDocument()
  })

  it('leva o foco para o modal, prende o Tab e devolve o foco a quem abriu', async () => {
    const user = userEvent.setup()
    render(<Demo />)
    const abrir = screen.getByRole('button', { name: 'abrir' })

    await user.click(abrir)
    expect(screen.getByRole('dialog')).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'dentro' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(abrir).toHaveFocus()
  })

  it('Escape chama onFechar', async () => {
    const user = userEvent.setup()
    const onFechar = jest.fn()
    render(<Demo onFechar={onFechar} />)

    await user.click(screen.getByRole('button', { name: 'abrir' }))
    await user.keyboard('{Escape}')

    expect(onFechar).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('botão Fechar chama onFechar', async () => {
    const user = userEvent.setup()
    const onFechar = jest.fn()
    render(<Demo onFechar={onFechar} />)

    await user.click(screen.getByRole('button', { name: 'abrir' }))
    await user.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(onFechar).toHaveBeenCalledTimes(1)
  })

  it('clique no fundo fecha; clique dentro do painel não', async () => {
    const user = userEvent.setup()
    const onFechar = jest.fn()
    render(<Demo onFechar={onFechar} />)

    await user.click(screen.getByRole('button', { name: 'abrir' }))
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(onFechar).not.toHaveBeenCalled()

    fireEvent.mouseDown(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(onFechar).toHaveBeenCalledTimes(1)
  })

  it('trava a rolagem do fundo enquanto aberto e solta ao fechar', async () => {
    const user = userEvent.setup()
    render(<Demo />)

    await user.click(screen.getByRole('button', { name: 'abrir' }))
    expect(document.body.style.overflow).toBe('hidden')

    await user.keyboard('{Escape}')
    expect(document.body.style.overflow).toBe('')
  })

  it('aceita role alertdialog e id de título próprio', async () => {
    render(
      <ModalBase
        aberto
        onFechar={jest.fn()}
        icone={<span />}
        sobretitulo="Aviso"
        titulo="Remover"
        descricao="Texto."
        papel="alertdialog"
        idTitulo="meu-titulo"
      >
        <p>corpo</p>
      </ModalBase>,
    )

    const dialogo = screen.getByRole('alertdialog', { name: 'Remover' })
    expect(dialogo).toHaveAttribute('aria-labelledby', 'meu-titulo')
  })

  it('não tem violação de acessibilidade aberto', async () => {
    const { container } = render(
      <ModalBase
        aberto
        onFechar={jest.fn()}
        icone={<span />}
        sobretitulo="Saúde"
        titulo="Editar registro"
        descricao="Altere os dados."
      >
        <button>dentro</button>
      </ModalBase>,
    )

    expect(await axe(container)).toHaveNoViolations()
  })
})

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import ModalVinculo from './ModalVinculo'

expect.extend(toHaveNoViolations)

const AXE = { rules: { 'color-contrast': { enabled: false } } }

describe('ModalVinculo', () => {
  it('fechado não renderiza nada', () => {
    render(
      <ModalVinculo aberto={false} titulo="Adicionar pessoa" onFechar={() => {}}>
        <p>conteúdo</p>
      </ModalVinculo>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('aberto: diálogo nomeado pelo título, modal, com o conteúdo', () => {
    render(
      <ModalVinculo aberto titulo="Adicionar pessoa" onFechar={() => {}}>
        <p>conteúdo</p>
      </ModalVinculo>,
    )
    const dialogo = screen.getByRole('dialog', { name: 'Adicionar pessoa' })
    expect(dialogo).toHaveAttribute('aria-modal', 'true')
    expect(dialogo).toHaveTextContent('conteúdo')
  })

  it('o foco vai para o diálogo ao abrir', () => {
    render(
      <ModalVinculo aberto titulo="Adicionar pessoa" onFechar={() => {}}>
        <button type="button">Dentro</button>
      </ModalVinculo>,
    )
    expect(screen.getByRole('dialog')).toHaveFocus()
  })

  it('Escape e o botão Fechar chamam onFechar', async () => {
    const onFechar = jest.fn()
    render(
      <ModalVinculo aberto titulo="Adicionar pessoa" onFechar={onFechar}>
        <p>conteúdo</p>
      </ModalVinculo>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onFechar).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onFechar).toHaveBeenCalledTimes(2)
  })

  it('clicar fora do diálogo não fecha (evita perder o que foi digitado)', async () => {
    const onFechar = jest.fn()
    const { container } = render(
      <ModalVinculo aberto titulo="Adicionar pessoa" onFechar={onFechar}>
        <p>conteúdo</p>
      </ModalVinculo>,
    )
    const fundo = container.firstElementChild as HTMLElement
    await userEvent.click(fundo)
    expect(onFechar).not.toHaveBeenCalled()
  })

  it('devolve o foco ao botão que abriu', () => {
    function Teste({ aberto }: { aberto: boolean }) {
      return (
        <>
          <button type="button">Abrir</button>
          <ModalVinculo aberto={aberto} titulo="Adicionar pessoa" onFechar={() => {}}>
            <p>conteúdo</p>
          </ModalVinculo>
        </>
      )
    }
    const { rerender } = render(<Teste aberto={false} />)
    screen.getByRole('button', { name: 'Abrir' }).focus()
    rerender(<Teste aberto />)
    expect(screen.getByRole('dialog')).toHaveFocus()
    rerender(<Teste aberto={false} />)
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus()
  })

  it('não tem violações detectáveis pelo axe', async () => {
    const { container } = render(
      <ModalVinculo aberto titulo="Adicionar pessoa" onFechar={() => {}}>
        <p>conteúdo</p>
      </ModalVinculo>,
    )
    expect(await axe(container, AXE)).toHaveNoViolations()
  })
})

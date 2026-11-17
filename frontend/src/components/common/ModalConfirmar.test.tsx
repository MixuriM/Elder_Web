import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'

import ModalConfirmar from './ModalConfirmar'

expect.extend(toHaveNoViolations)

const TEXTO = 'Remover este registro? Esta ação não pode ser desfeita.'

function erroHttp(status: number, mensagem = 'texto do servidor') {
  return Object.assign(new Error(mensagem), { status })
}

function montar(onConfirmar: () => Promise<void>, onFechar = jest.fn()) {
  render(<ModalConfirmar aberto onFechar={onFechar} texto={TEXTO} onConfirmar={onConfirmar} />)
  return onFechar
}

describe('ModalConfirmar', () => {
  it('fechado não renderiza', () => {
    render(<ModalConfirmar aberto={false} onFechar={jest.fn()} texto={TEXTO} onConfirmar={jest.fn()} />)

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('aberto: alertdialog com o texto e os botões Cancelar e Remover (texto visível)', () => {
    montar(jest.fn().mockResolvedValue(undefined))

    expect(screen.getByRole('alertdialog')).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText(TEXTO)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remover' })).toBeInTheDocument()
  })

  it('Cancelar fecha sem confirmar', async () => {
    const user = userEvent.setup()
    const onConfirmar = jest.fn().mockResolvedValue(undefined)
    const onFechar = montar(onConfirmar)

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onFechar).toHaveBeenCalledTimes(1)
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it('Remover chama onConfirmar; enquanto espera, botões desabilitados e status anunciado', async () => {
    const user = userEvent.setup()
    let liberar: () => void = () => {}
    const onConfirmar = jest.fn(() => new Promise<void>((r) => (liberar = r)))
    montar(onConfirmar)

    await user.click(screen.getByRole('button', { name: 'Remover' }))

    expect(onConfirmar).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Removendo...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()

    liberar()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remover' })).toBeEnabled())
  })

  it('enquanto remove, Escape não fecha', async () => {
    const user = userEvent.setup()
    const onConfirmar = jest.fn(() => new Promise<void>(() => {}))
    const onFechar = montar(onConfirmar)

    await user.click(screen.getByRole('button', { name: 'Remover' }))
    await user.keyboard('{Escape}')

    expect(onFechar).not.toHaveBeenCalled()
  })

  it.each([
    [403, 'Você não tem permissão para remover este registro.'],
    [404, 'Este registro já foi removido. Feche e atualize a lista.'],
    [500, 'Não foi possível remover o registro.'],
  ])('erro %i: mensagem fixa em role=alert, sem ecoar o servidor, modal segue aberto', async (status, mensagem) => {
    const user = userEvent.setup()
    const onFechar = montar(jest.fn().mockRejectedValue(erroHttp(status, 'DADO SENSIVEL DO SERVIDOR')))

    await user.click(screen.getByRole('button', { name: 'Remover' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(mensagem)
    expect(screen.queryByText(/DADO SENSIVEL/)).not.toBeInTheDocument()
    expect(onFechar).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Remover' })).toBeEnabled()
  })

  it('aceita rótulo e título próprios (medicamento)', () => {
    render(
      <ModalConfirmar
        aberto
        onFechar={jest.fn()}
        texto="Remover Losartana? O histórico de doses dele também será apagado. Esta ação não pode ser desfeita."
        onConfirmar={jest.fn()}
        titulo="Remover medicamento"
      />,
    )

    expect(screen.getByRole('alertdialog', { name: 'Remover medicamento' })).toBeInTheDocument()
  })

  it('sem violação de acessibilidade', async () => {
    const { container } = render(
      <ModalConfirmar aberto onFechar={jest.fn()} texto={TEXTO} onConfirmar={jest.fn()} />,
    )

    expect(await axe(container)).toHaveNoViolations()
  })
})

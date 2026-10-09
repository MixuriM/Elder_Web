import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import ConfirmacaoInline from './ConfirmacaoInline'

expect.extend(toHaveNoViolations)

function montar(extra: Partial<React.ComponentProps<typeof ConfirmacaoInline>> = {}) {
  const onConfirmar = jest.fn()
  const onCancelar = jest.fn()
  const utils = render(
    <ConfirmacaoInline
      titulo="Recusar o pedido de João?"
      texto="Ele não terá acesso aos seus dados."
      rotuloConfirmar="Sim, recusar"
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
      {...extra}
    />,
  )
  return { ...utils, onConfirmar, onCancelar }
}

describe('ConfirmacaoInline', () => {
  it('é um alertdialog nomeado e descrito, e recebe o foco', () => {
    montar()
    const caixa = screen.getByRole('alertdialog', { name: 'Recusar o pedido de João?' })
    expect(caixa).toHaveAccessibleDescription('Ele não terá acesso aos seus dados.')
    expect(caixa).toHaveFocus()
  })

  it('confirmar e cancelar chamam cada função; Escape cancela', async () => {
    const { onConfirmar, onCancelar } = montar()
    await userEvent.click(screen.getByRole('button', { name: 'Sim, recusar' }))
    expect(onConfirmar).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Não, voltar' }))
    expect(onCancelar).toHaveBeenCalledTimes(1)
    await userEvent.keyboard('{Escape}')
    expect(onCancelar).toHaveBeenCalledTimes(2)
  })

  it('enquanto envia, os dois botões ficam desligados e o confirmar avisa', () => {
    montar({ enviando: true })
    expect(screen.getByRole('button', { name: 'Enviando...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Não, voltar' })).toBeDisabled()
  })

  it('não tem violações do axe', async () => {
    const { container } = montar()
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations()
  })
})

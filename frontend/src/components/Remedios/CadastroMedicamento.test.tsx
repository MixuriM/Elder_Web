import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

import CadastroMedicamento from './CadastroMedicamento'

const mockChamarApi = jest.fn()
jest.mock('../../lib/chamarApi', () => ({ chamarApi: (...a: unknown[]) => mockChamarApi(...a) }))

// Erro como o chamarApi lança: mensagem do backend e status junto (texto fake só para o teste).
function erroApi(status: number, mensagem: string) {
  return Object.assign(new Error(mensagem), { status })
}

describe('CadastroMedicamento: erro do backend', () => {
  it('403 vira mensagem fixa em linguagem simples, sem o texto técnico do backend', async () => {
    mockChamarApi.mockRejectedValue(erroApi(403, 'Sem permissão: modo_decisao efetivo não é familiar.'))
    const { container } = render(<CadastroMedicamento idosoId="5" idosoNome="Idoso Teste" />)

    fireEvent.submit(container.querySelector('form')!)

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent(
      'Você não tem permissão para fazer isso agora. Peça para a pessoa que decide pelo idoso.',
    )
    expect(alerta).not.toHaveTextContent(/modo_decisao/)
  })
})

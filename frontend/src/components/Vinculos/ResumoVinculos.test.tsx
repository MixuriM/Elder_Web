import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import ResumoVinculos from './ResumoVinculos'
import type { Vinculo } from './CardVinculo'

// Fixture: dados fake, só para o teste.
function v(id: number, status: string): Vinculo {
  return {
    id,
    tipo_vinculo: 'cuidador',
    origem: 'solicitacao_cuidador',
    status,
    data_solicitacao: '2026-10-01T10:00:00.000Z',
    data_resposta: null,
    confirmado_em: null,
    papel_do_chamador: 'dono',
    idoso: { id: 1, nome: 'Maria', email_mascarado: null },
    vinculado: { id: 2, nome: 'João', email_mascarado: null },
  }
}

describe('ResumoVinculos', () => {
  it('conta aprovados e pendentes em frases, ignorando recusados', () => {
    render(
      <ResumoVinculos
        tipo="cuidador"
        vinculos={[v(1, 'aprovado'), v(2, 'aprovado'), v(3, 'pendente'), v(4, 'recusado')]}
      />,
    )
    expect(screen.getByText('2 cuidadores vinculados')).toBeInTheDocument()
    expect(screen.getByText('1 pedido aguardando resposta')).toBeInTheDocument()
  })

  it('singular e plural de familiar', () => {
    render(<ResumoVinculos tipo="familiar" vinculos={[v(1, 'aprovado'), v(2, 'pendente'), v(3, 'pendente')]} />)
    expect(screen.getByText('1 familiar vinculado')).toBeInTheDocument()
    expect(screen.getByText('2 pedidos aguardando resposta')).toBeInTheDocument()
  })

  it('zero vira texto, não só número', () => {
    render(<ResumoVinculos tipo="cuidador" vinculos={[]} />)
    expect(screen.getByText('Nenhum cuidador vinculado')).toBeInTheDocument()
    expect(screen.getByText('Nenhum pedido aguardando resposta')).toBeInTheDocument()
  })
})

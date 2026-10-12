import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import ResumoVinculos from './ResumoVinculos'
import type { Vinculo } from './CardVinculo'

expect.extend(toHaveNoViolations)

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

  describe('convites de cuidador (cuidador, convite_idoso)', () => {
    // Datas relativas a agora: o convite vale 7 dias, então uma data fixa viraria "vencido" com o tempo.
    const DIA = 24 * 60 * 60 * 1000
    const convite = (id: number, papel: string, idadeDias = 1, status = 'pendente'): Vinculo => ({
      ...v(id, status),
      origem: 'convite_idoso',
      papel_do_chamador: papel,
      data_solicitacao: new Date(Date.now() - idadeDias * DIA).toISOString(),
    })
    const paragrafos = () => screen.getByLabelText('Resumo').querySelectorAll('p')

    it('idoso: convite enviado não é pedido para responder; tem frase própria no singular', () => {
      render(<ResumoVinculos tipo="cuidador" vinculos={[v(1, 'aprovado'), convite(2, 'dono')]} />)
      expect(screen.getByText('Nenhum pedido aguardando resposta')).toBeInTheDocument()
      expect(screen.getByText('1 convite esperando o cuidador aceitar')).toBeInTheDocument()
      expect(paragrafos()).toHaveLength(3)
    })

    it('idoso: plural', () => {
      render(<ResumoVinculos tipo="cuidador" vinculos={[convite(1, 'dono'), convite(2, 'dono')]} />)
      expect(screen.getByText('2 convites esperando o cuidador aceitar')).toBeInTheDocument()
    })

    it('titular conta como quem enviou', () => {
      render(<ResumoVinculos tipo="cuidador" vinculos={[convite(1, 'titular')]} />)
      expect(screen.getByText('1 convite esperando o cuidador aceitar')).toBeInTheDocument()
    })

    it('cuidador: convite recebido é "para você responder", singular e plural', () => {
      const { rerender } = render(<ResumoVinculos tipo="cuidador" vinculos={[convite(1, 'vinculado')]} />)
      expect(screen.getByText('1 convite para você responder')).toBeInTheDocument()
      expect(screen.queryByText(/esperando o cuidador/i)).not.toBeInTheDocument()
      rerender(<ResumoVinculos tipo="cuidador" vinculos={[convite(1, 'vinculado'), convite(2, 'vinculado')]} />)
      expect(screen.getByText('2 convites para você responder')).toBeInTheDocument()
    })

    it('convite vencido não entra em nenhuma contagem de "aguardando"', () => {
      render(<ResumoVinculos tipo="cuidador" vinculos={[convite(1, 'dono', 8), convite(2, 'vinculado', 30)]} />)
      expect(screen.getByText('Nenhum pedido aguardando resposta')).toBeInTheDocument()
      expect(screen.queryByText(/convite/i)).not.toBeInTheDocument()
      expect(paragrafos()).toHaveLength(2)
    })

    it('convite recusado ou aprovado não aparece como convite aguardando', () => {
      render(<ResumoVinculos tipo="cuidador" vinculos={[convite(1, 'dono', 1, 'recusado'), convite(2, 'dono', 1, 'aprovado')]} />)
      expect(screen.queryByText(/convite/i)).not.toBeInTheDocument()
      expect(screen.getByText('1 cuidador vinculado')).toBeInTheDocument()
    })

    it('pedido comum pendente e convite vigente somam em frases separadas', () => {
      render(<ResumoVinculos tipo="cuidador" vinculos={[v(1, 'pendente'), convite(2, 'dono')]} />)
      expect(screen.getByText('1 pedido aguardando resposta')).toBeInTheDocument()
      expect(screen.getByText('1 convite esperando o cuidador aceitar')).toBeInTheDocument()
    })

    it('sem convite não renderiza parágrafo vazio', () => {
      render(<ResumoVinculos tipo="cuidador" vinculos={[v(1, 'aprovado')]} />)
      expect(paragrafos()).toHaveLength(2)
      paragrafos().forEach((p) => expect(p.textContent?.trim()).not.toBe(''))
    })

    it('a frase de convite é texto, não depende de cor, e não tem violações do axe', async () => {
      const { container } = render(<ResumoVinculos tipo="cuidador" vinculos={[convite(1, 'dono')]} />)
      expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations()
    })
  })
})

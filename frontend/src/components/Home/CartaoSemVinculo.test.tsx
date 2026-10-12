import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { MemoryRouter } from 'react-router-dom'
import Home from '../../pages/Home'
import { AcessoContext, type ContextoAcesso } from '../../contexts/useAcesso'
import type { Vinculo } from '../Vinculos/CardVinculo'

expect.extend(toHaveNoViolations)

// O resumo do dia da Home busca dados; aqui só importa o cartão, então a busca nunca responde.
jest.mock('../../lib/chamarApi', () => ({ chamarApi: jest.fn(() => new Promise(() => {})) }))

function renderizarHome(parcial: Partial<ContextoAcesso>) {
  const acesso: ContextoAcesso = {
    tipoPerfil: null,
    temVinculoAprovado: false,
    temVinculoPendente: false,
    estado: 'ok',
    ...parcial,
  }
  return render(
    <AcessoContext.Provider value={acesso}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </AcessoContext.Provider>,
  )
}

describe('Home: cartão para quem está sem vínculo aprovado', () => {
  it('cuidador sem vínculo: um cartão com botão para /cuidadores, sem cards de módulos', () => {
    renderizarHome({ tipoPerfil: 'cuidador' })
    expect(screen.getByRole('heading', { name: 'Vincule-se a um idoso' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir para os vínculos' })).toHaveAttribute('href', '/cuidadores')
    expect(screen.queryByText('Minha Saúde')).not.toBeInTheDocument()
    expect(screen.queryByText('Resumo do seu dia')).not.toBeInTheDocument()
  })

  it('familiar sem vínculo: botão leva a /familia', () => {
    renderizarHome({ tipoPerfil: 'familiar' })
    expect(screen.getByRole('link', { name: 'Ir para os vínculos' })).toHaveAttribute('href', '/familia')
  })

  it('com vínculo pendente: diz que aguarda aprovação', () => {
    renderizarHome({ tipoPerfil: 'familiar', temVinculoPendente: true })
    expect(screen.getByRole('heading', { name: 'Aguardando aprovação' })).toBeInTheDocument()
    expect(screen.getByText(/ainda aguarda aprovação/i)).toBeInTheDocument()
  })

  describe('cuidador convidado pelo idoso', () => {
    const DIA = 24 * 60 * 60 * 1000
    // Fixtures: dados fake, só para o teste. Datas relativas a agora: o convite vale 7 dias.
    function vinculo(extra: Partial<Vinculo>): Vinculo {
      return {
        id: 40,
        tipo_vinculo: 'cuidador',
        origem: 'convite_idoso',
        status: 'pendente',
        data_solicitacao: new Date(Date.now() - DIA).toISOString(),
        data_resposta: null,
        confirmado_em: null,
        papel_do_chamador: 'vinculado',
        permissoes: null,
        idoso: { id: null, nome: 'Maria Idosa', email_mascarado: 'ma***@mail.test' },
        vinculado: { id: 8, nome: 'João Cuidador', email_mascarado: 'jo***@mail.test' },
        ...extra,
      }
    }

    it('com convite válido: diz que há um convite para aceitar, com link para /cuidadores', () => {
      renderizarHome({ tipoPerfil: 'cuidador', temVinculoPendente: true, vinculos: [vinculo({})] })
      expect(screen.getByRole('heading', { name: 'Convite para ser cuidador' })).toBeInTheDocument()
      expect(
        screen.getByText('Você recebeu um convite para ser cuidador. Abra Cuidadores para aceitar.'),
      ).toBeInTheDocument()
      const link = screen.getByRole('link', { name: 'Abrir Cuidadores' })
      expect(link).toHaveAttribute('href', '/cuidadores')
      // Alvo de toque de pelo menos 44 px (min-h-12 = 48 px).
      expect(link.className).toMatch(/min-h-12/)
      expect(screen.queryByText(/aguarda aprovação/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Aguardando aprovação' })).not.toBeInTheDocument()
      expect(screen.queryByText('Minha Saúde')).not.toBeInTheDocument()
    })

    it('o convite vale mais do que um pedido próprio pendente (é ele que pede uma ação)', () => {
      const proprio = vinculo({ id: 41, origem: 'solicitacao_cuidador' })
      renderizarHome({ tipoPerfil: 'cuidador', temVinculoPendente: true, vinculos: [proprio, vinculo({})] })
      expect(screen.getByRole('heading', { name: 'Convite para ser cuidador' })).toBeInTheDocument()
    })

    it.each([
      ['convite vencido (mais de 7 dias)', [vinculo({ data_solicitacao: new Date(Date.now() - 8 * DIA).toISOString() })]],
      ['só pedido próprio pendente', [vinculo({ origem: 'solicitacao_cuidador' })]],
      ['convite já recusado', [vinculo({ status: 'recusado' })]],
    ])('%s: mantém o texto de aguardando aprovação', (_nome, vinculos) => {
      renderizarHome({ tipoPerfil: 'cuidador', temVinculoPendente: true, vinculos })
      expect(screen.getByRole('heading', { name: 'Aguardando aprovação' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Ver meus vínculos' })).toHaveAttribute('href', '/cuidadores')
      expect(screen.queryByText(/você recebeu um convite/i)).not.toBeInTheDocument()
    })

    it.each([
      ['sem vínculos conhecidos', undefined],
      ['lista vazia', [] as Vinculo[]],
    ])('%s: mantém o texto de quem ainda não se vinculou', (_nome, vinculos) => {
      renderizarHome({ tipoPerfil: 'cuidador', vinculos })
      expect(screen.getByRole('heading', { name: 'Vincule-se a um idoso' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Ir para os vínculos' })).toBeInTheDocument()
    })

    it('familiar não muda, mesmo com um convite de cuidador na lista', () => {
      renderizarHome({ tipoPerfil: 'familiar', temVinculoPendente: true, vinculos: [vinculo({})] })
      expect(screen.getByRole('heading', { name: 'Aguardando aprovação' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Ver meus vínculos' })).toHaveAttribute('href', '/familia')
      expect(screen.queryByText(/você recebeu um convite/i)).not.toBeInTheDocument()
    })

    it('cuidador que já tem vínculo aprovado segue com os cards de sempre', () => {
      renderizarHome({ tipoPerfil: 'cuidador', temVinculoAprovado: true, vinculos: [vinculo({})] })
      expect(screen.getByText('Minha Saúde')).toBeInTheDocument()
      expect(screen.queryByText(/você recebeu um convite/i)).not.toBeInTheDocument()
    })

    it('não tem violações do axe', async () => {
      const { container } = renderizarHome({ tipoPerfil: 'cuidador', temVinculoPendente: true, vinculos: [vinculo({})] })
      expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations()
    })
  })

  it.each([
    ['idoso', { tipoPerfil: 'idoso' }],
    ['cuidador com vínculo', { tipoPerfil: 'cuidador', temVinculoAprovado: true }],
    ['erro de carregamento', { tipoPerfil: 'familiar', estado: 'erro' as const }],
  ])('%s: mantém os cards de sempre', (_nome, parcial) => {
    renderizarHome(parcial)
    expect(screen.getByText('Minha Saúde')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Vincule-se a um idoso' })).not.toBeInTheDocument()
  })
})

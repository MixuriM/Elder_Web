import '@testing-library/jest-dom'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import SeletorIdoso from './SeletorIdoso'
import {
  envioBloqueado,
  ocultarSecaoDeTerceiros,
} from '../../lib/regrasIdosoVinculado'
import type { IdososVinculados } from '../../hooks/useIdososVinculados'

function lista(parcial: Partial<IdososVinculados>): IdososVinculados {
  const base = {
    estado: 'ok' as const,
    ehIdoso: false,
    idosos: [],
    ...parcial,
  }
  return {
    ...base,
    bloqueado:
      !base.ehIdoso &&
      (base.estado !== 'ok' || base.idosos.length === 0),
  }
}

function renderizar(
  l: IdososVinculados,
  valor = '',
  aoMudar: (v: string) => void = () => {},
  escrita = false,
) {
  return render(
    <MemoryRouter>
      <SeletorIdoso
        id="idoso_teste"
        valor={valor}
        aoMudar={aoMudar}
        lista={l}
        escrita={escrita}
      />
    </MemoryRouter>,
  )
}

describe('SeletorIdoso', () => {
  it('perfil idoso: não renderiza nada', () => {
    const { container } = renderizar(lista({ ehIdoso: true }))

    expect(container).toBeEmptyDOMElement()
  })

  it('1 idoso: pré-seleciona o único', () => {
    const aoMudar = jest.fn()

    renderizar(
      lista({
        idosos: [{ id: 7, nome: 'Dona Ana', email_mascarado: 'a***@m.com' }],
      }),
      '',
      aoMudar,
    )

    expect(aoMudar).toHaveBeenCalledWith('7')
  })

  it('valor já válido: não sobrescreve a escolha', () => {
    const aoMudar = jest.fn()

    renderizar(
      lista({
        idosos: [
          { id: 7, nome: 'Dona Ana', email_mascarado: 'a***@m.com' },
          { id: 9, nome: 'Seu João', email_mascarado: null },
        ],
      }),
      '9',
      aoMudar,
    )

    expect(aoMudar).not.toHaveBeenCalled()
    expect(screen.getByRole('combobox')).toHaveValue('9')
  })

  it('label associado, sem opção vazia, com nome e e-mail mascarado', () => {
    renderizar(
      lista({
        idosos: [
          { id: 7, nome: 'Dona Ana', email_mascarado: 'a***@m.com' },
          { id: 9, nome: 'Seu João', email_mascarado: null },
        ],
      }),
      '7',
    )

    const select = screen.getByLabelText(/idoso/i)
    expect(select).toBe(screen.getByRole('combobox'))

    const opcoes = screen.getAllByRole('option')
    expect(opcoes).toHaveLength(2)
    expect(opcoes[0]).toHaveTextContent('Dona Ana (a***@m.com)')
    expect(opcoes[0]).toHaveValue('7')
  })

  it('email_mascarado null: mostra só o nome, sem "null" nem parênteses', () => {
    renderizar(
      lista({
        idosos: [{ id: 9, nome: 'Seu João', email_mascarado: null }],
      }),
      '9',
    )

    const opcao = screen.getByRole('option')
    expect(opcao).toHaveTextContent(/^Seu João$/)
    expect(opcao.textContent).not.toMatch(/null|undefined|\(/)
  })

  describe('tela de escrita (escrita)', () => {
    const doisIdosos = lista({
      idosos: [
        { id: 7, nome: 'Dona Ana', email_mascarado: null },
        { id: 9, nome: 'Seu João', email_mascarado: null },
      ],
    })

    it('2+ idosos: não pré-seleciona e mostra "Selecione o idoso"', () => {
      const aoMudar = jest.fn()

      renderizar(doisIdosos, '', aoMudar, true)

      expect(aoMudar).not.toHaveBeenCalled()
      expect(screen.getByRole('combobox')).toHaveValue('')
      expect(screen.getByRole('combobox')).toBeRequired()
      expect(
        screen.getByRole('option', { name: 'Selecione o idoso' }),
      ).toBeDisabled()
      expect(screen.getAllByRole('option')).toHaveLength(3)
    })

    it('1 idoso: pré-seleciona mesmo na escrita, sem opção de seleção', () => {
      const aoMudar = jest.fn()

      renderizar(
        lista({
          idosos: [{ id: 7, nome: 'Dona Ana', email_mascarado: null }],
        }),
        '',
        aoMudar,
        true,
      )

      expect(aoMudar).toHaveBeenCalledWith('7')
      expect(screen.queryByRole('option', { name: 'Selecione o idoso' })).toBeNull()
    })

    it('leitura com 2 idosos continua pré-selecionando o primeiro', () => {
      const aoMudar = jest.fn()

      renderizar(doisIdosos, '', aoMudar, false)

      expect(aoMudar).toHaveBeenCalledWith('7')
    })

    it('envioBloqueado: 2 idosos sem escolha bloqueia; escolhido libera; perfil idoso nunca bloqueia', () => {
      expect(envioBloqueado(doisIdosos, '')).toBe(true)
      expect(envioBloqueado(doisIdosos, '9')).toBe(false)
      expect(envioBloqueado(lista({ ehIdoso: true }), '')).toBe(false)
      expect(envioBloqueado(lista({ idosos: [] }), '9')).toBe(true)
    })

    it('ocultarSecaoDeTerceiros: oculta para idoso e enquanto carrega', () => {
      expect(ocultarSecaoDeTerceiros(lista({ ehIdoso: true }))).toBe(true)
      expect(ocultarSecaoDeTerceiros(lista({ estado: 'carregando' }))).toBe(true)
      expect(ocultarSecaoDeTerceiros(lista({ estado: 'erro' }))).toBe(false)
      expect(ocultarSecaoDeTerceiros(doisIdosos)).toBe(false)
    })
  })

  it('troca de idoso chama aoMudar com o id', async () => {
    const aoMudar = jest.fn()

    renderizar(
      lista({
        idosos: [
          { id: 7, nome: 'Dona Ana', email_mascarado: null },
          { id: 9, nome: 'Seu João', email_mascarado: null },
        ],
      }),
      '7',
      aoMudar,
    )

    await userEvent.selectOptions(screen.getByRole('combobox'), '9')

    expect(aoMudar).toHaveBeenCalledWith('9')
  })

  it('zero idosos: orienta a solicitar vínculo em /vinculos e não mostra select', () => {
    renderizar(lista({ idosos: [] }))

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /vínculo/i })).toHaveAttribute(
      'href',
      '/vinculos',
    )
  })

  it('carregando: mostra aviso de carregamento', () => {
    renderizar(lista({ estado: 'carregando' }))

    expect(screen.getByText(/carregando idosos/i)).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('erro: mostra alerta em português', () => {
    renderizar(lista({ estado: 'erro' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      /não foi possível carregar/i,
    )
  })
})

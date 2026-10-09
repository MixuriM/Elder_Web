import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RotaComVinculo from './RotaComVinculo'
import { AcessoContext, type Acesso } from '../contexts/useAcesso'
import { AVISO_SEM_VINCULO } from '../lib/avisoSemVinculo'

function renderizar(parcial: Partial<Acesso>, inicial = '/saude') {
  const acesso: Acesso = {
    tipoPerfil: null,
    temVinculoAprovado: false,
    temVinculoPendente: false,
    estado: 'ok',
    ...parcial,
  }
  return render(
    <AcessoContext.Provider value={acesso}>
      <MemoryRouter initialEntries={[inicial]}>
        <Routes>
          <Route element={<RotaComVinculo />}>
            <Route path="/saude" element={<p>Tela de saúde</p>} />
          </Route>
          <Route path="/familia" element={<p>Lista de família</p>} />
          <Route path="/cuidadores" element={<p>Lista de cuidadores</p>} />
        </Routes>
      </MemoryRouter>
    </AcessoContext.Provider>,
  )
}

describe('RotaComVinculo', () => {
  it('idoso nunca é bloqueado', () => {
    renderizar({ tipoPerfil: 'idoso' })
    expect(screen.getByText('Tela de saúde')).toBeInTheDocument()
  })

  it('familiar com vínculo aprovado passa', () => {
    renderizar({ tipoPerfil: 'familiar', temVinculoAprovado: true })
    expect(screen.getByText('Tela de saúde')).toBeInTheDocument()
  })

  it('cuidador com vínculo aprovado passa', () => {
    renderizar({ tipoPerfil: 'cuidador', temVinculoAprovado: true })
    expect(screen.getByText('Tela de saúde')).toBeInTheDocument()
  })

  it('familiar sem vínculo aprovado vai para /familia com a mensagem', () => {
    renderizar({ tipoPerfil: 'familiar' })
    expect(screen.getByText('Lista de família')).toBeInTheDocument()
    expect(screen.queryByText('Tela de saúde')).not.toBeInTheDocument()
  })

  it('cuidador sem vínculo aprovado (mesmo com pendente) vai para /cuidadores', () => {
    renderizar({ tipoPerfil: 'cuidador', temVinculoPendente: true })
    expect(screen.getByText('Lista de cuidadores')).toBeInTheDocument()
    expect(screen.queryByText('Tela de saúde')).not.toBeInTheDocument()
  })

  it('carregando: não mostra a tela nem redireciona', () => {
    renderizar({ estado: 'carregando', tipoPerfil: null })
    expect(screen.getByRole('status')).toHaveTextContent('Carregando')
    expect(screen.queryByText('Tela de saúde')).not.toBeInTheDocument()
    expect(screen.queryByText('Lista de família')).not.toBeInTheDocument()
  })

  it('erro: falha aberto, não bloqueia (a barreira real é o backend)', () => {
    renderizar({ estado: 'erro', tipoPerfil: 'familiar' })
    expect(screen.getByText('Tela de saúde')).toBeInTheDocument()
  })

  it('a mensagem fixa existe em português', () => {
    expect(AVISO_SEM_VINCULO).toBe('Para usar esta área, vincule-se a um idoso.')
  })
})

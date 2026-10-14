import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import Termos from './Termos'
import { DATA_ATUALIZACAO, EMAIL_SUPORTE, VERSAO_DOCUMENTOS } from '../lib/documentosLegais'

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={['/termos']}>
      <Termos />
    </MemoryRouter>,
  )
}

const H2_ESPERADOS = [
  'Resumo em poucas linhas',
  'Sobre o Elder Web',
  'Quem pode usar',
  'Sua conta e sua senha',
  'Vínculos e permissões',
  'O que você pode e não pode fazer',
  'Saúde: aviso importante',
  'Aviso de emergência',
  'Disponibilidade e mudanças no serviço',
  'Responsabilidades',
  'Propriedade intelectual',
  'Encerramento e exclusão da conta',
  'Mudanças nestes Termos',
  'Lei e foro',
  'Contato',
]

describe('Termos de Uso', () => {
  it('tem um único h1 e um único main', () => {
    renderPagina()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Termos de Uso')
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('mostra as seções na ordem, cada uma como região', () => {
    renderPagina()
    const h2 = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(h2).toEqual(H2_ESPERADOS)
    for (const titulo of H2_ESPERADOS) expect(screen.getByRole('region', { name: titulo })).toBeInTheDocument()
  })

  it('navegação entre os documentos marca a página atual', () => {
    renderPagina()
    const nav = screen.getByRole('navigation', { name: 'Documentos legais' })
    expect(within(nav).getByRole('link', { name: 'Termos de Uso' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Política de Privacidade' })).not.toHaveAttribute('aria-current')
  })

  it('mostra versão, data, aviso acadêmico e contato por mailto', () => {
    renderPagina()
    expect(screen.getByText(`Versão ${VERSAO_DOCUMENTOS}`, { exact: false })).toBeInTheDocument()
    expect(screen.getByText(DATA_ATUALIZACAO, { exact: false })).toBeInTheDocument()
    expect(
      screen.getByText('O Elder Web é um projeto acadêmico (TCC) e ainda não é um serviço comercial.'),
    ).toBeInTheDocument()
    for (const c of screen.getAllByRole('link', { name: EMAIL_SUPORTE })) {
      expect(c).toHaveAttribute('href', `mailto:${EMAIL_SUPORTE}`)
    }
  })

  it('avisa que não substitui atendimento e manda ligar 192', () => {
    const { container } = renderPagina()
    const texto = container.textContent ?? ''
    expect(texto).toMatch(/192/)
    expect(texto).toMatch(/não substitui/i)
    expect(texto).toMatch(/18 anos/)
    expect(texto).toMatch(/Sorocaba/)
  })

  it('não promete o que o sistema não faz nem diz que o aceite é registrado', () => {
    const { container } = renderPagina()
    const texto = container.textContent ?? ''
    expect(texto).not.toMatch(/(registramos|guardamos|salvamos|armazenamos) (o |seu |a data do )?aceite/i)
    expect(texto).not.toMatch(/aceite[^.]*(fica|é|será) (registrado|guardado|salvo)/i)
    expect(texto).not.toMatch(/lembrete|alarme|monitoramos|garantimos que/i)
    expect(texto).not.toMatch(/alexa|mensagens|loja|microfone|lar são vicente/i)
  })
})

import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import Cookies from './Cookies'
import {
  DATA_ATUALIZACAO,
  EMAIL_SUPORTE,
  URL_PRIVACIDADE_FIREBASE,
  URL_PRIVACIDADE_GOOGLE,
  VERSAO_DOCUMENTOS,
} from '../lib/documentosLegais'

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={['/cookies']}>
      <Cookies />
    </MemoryRouter>,
  )
}

const H2_ESPERADOS = [
  'Resumo em poucas linhas',
  'O que são cookies e armazenamento no navegador',
  'O que o Elder Web guarda no seu navegador',
  'Serviços de terceiros',
  'Como apagar',
  'Mudanças nesta política',
  'Contato',
]

// Mesmas chaves do código (ver lib/armazenamentoDocumentado.test.ts). Chave nova no código: entra aqui e na página.
const CHAVES = [
  'tema',
  'tamanhoTexto',
  'reduzirMovimento',
  'agendaVisao',
  'agendaModo',
  'elderweb:fotoPerfil',
  'elder-preload-recarregado',
  'firebaseLocalStorageDb',
  'firebase-heartbeat-database',
]

describe('Política de Cookies', () => {
  it('tem um único h1 e um único main', () => {
    renderPagina()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Política de Cookies e armazenamento no navegador',
    )
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('o h1 parte palavra longa em vez de vazar em 320 px com texto muito grande (break-words)', () => {
    renderPagina()
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('break-words')
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
    expect(within(nav).getByRole('link', { name: /Política de Cookies/ })).toHaveAttribute('aria-current', 'page')
  })

  it('mostra versão, data e contato por mailto', () => {
    renderPagina()
    expect(screen.getByText(`Versão ${VERSAO_DOCUMENTOS}`, { exact: false })).toBeInTheDocument()
    expect(screen.getByText(DATA_ATUALIZACAO, { exact: false })).toBeInTheDocument()
    for (const c of screen.getAllByRole('link', { name: EMAIL_SUPORTE })) {
      expect(c).toHaveAttribute('href', `mailto:${EMAIL_SUPORTE}`)
    }
  })

  it('a tabela lista cada chave guardada no navegador', () => {
    renderPagina()
    const tabela = screen.getByRole('table', { name: /guardado no seu navegador/i })
    for (const chave of CHAVES) expect(within(tabela).getByText(chave, { selector: 'code' })).toBeInTheDocument()
  })

  it('diz que não há cookies próprios e não oferece banner', () => {
    const { container } = renderPagina()
    expect(container.textContent).toMatch(/não cria cookies próprios/i)
    expect(screen.queryByRole('button', { name: /aceitar|recusar/i })).not.toBeInTheDocument()
  })

  it('links externos são só os dois permitidos, em nova aba e sem referrer', () => {
    renderPagina()
    const externos = screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('http'))
    expect(externos.map((l) => l.getAttribute('href')).sort()).toEqual(
      [URL_PRIVACIDADE_FIREBASE, URL_PRIVACIDADE_GOOGLE].sort(),
    )
    for (const l of externos) expect(l).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('não cita nada fora do escopo', () => {
    const { container } = renderPagina()
    expect(container.textContent).not.toMatch(/alexa|mensagens|loja|microfone|lar são vicente/i)
  })
})

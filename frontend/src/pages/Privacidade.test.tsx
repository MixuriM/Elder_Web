import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import Privacidade from './Privacidade'
import { DATA_ATUALIZACAO, EMAIL_SUPORTE, VERSAO_DOCUMENTOS } from '../lib/documentosLegais'

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={['/privacidade']}>
      <Privacidade />
    </MemoryRouter>,
  )
}

const H2_ESPERADOS = [
  'Resumo em poucas linhas',
  'Quem é responsável pelos seus dados',
  'Quais dados coletamos',
  'Dados de saúde',
  'Para que usamos e para que não usamos',
  'Base legal',
  'Com quem compartilhamos',
  'Dados fora do Brasil',
  'Por quanto tempo guardamos',
  'Seus direitos e como exercer',
  'Conta criada por um familiar',
  'Menores de idade',
  'Segurança',
  'Se acontecer um incidente',
  'Mudanças nesta política',
  'Contato',
]

describe('Política de Privacidade', () => {
  it('tem um único h1 e um único main', () => {
    renderPagina()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Política de Privacidade')
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
    expect(within(nav).getByRole('link', { name: 'Política de Privacidade' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Termos de Uso' })).toHaveAttribute('href', '/termos')
    expect(within(nav).getByRole('link', { name: /Política de Cookies/ })).toHaveAttribute('href', '/cookies')
    expect(screen.getByRole('link', { name: 'Página inicial' })).toHaveAttribute('href', '/')
  })

  it('mostra versão, data, aviso acadêmico e contato por mailto', () => {
    renderPagina()
    expect(screen.getByText(`Versão ${VERSAO_DOCUMENTOS}`, { exact: false })).toBeInTheDocument()
    expect(screen.getByText(DATA_ATUALIZACAO, { exact: false })).toBeInTheDocument()
    expect(
      screen.getByText('O Elder Web é um projeto acadêmico (TCC) e ainda não é um serviço comercial.'),
    ).toBeInTheDocument()
    const contatos = screen.getAllByRole('link', { name: EMAIL_SUPORTE })
    expect(contatos.length).toBeGreaterThan(0)
    for (const c of contatos) expect(c).toHaveAttribute('href', `mailto:${EMAIL_SUPORTE}`)
  })

  it('diz o que não fazemos', () => {
    const { container } = renderPagina()
    const texto = container.textContent ?? ''
    expect(texto).toMatch(/não vendemos/i)
    expect(texto).toMatch(/192/)
    expect(texto).not.toMatch(/lembrete|alarme|monitoramos/i)
  })

  // D9 (2026-10-14): o aceite passou a ser gravado; a lista de dados diz isso.
  it('a tabela de dados lista o registro do aceite (data e versão)', () => {
    renderPagina()
    const dados = screen.getByRole('table', { name: /dados que coletamos/i })
    expect(within(dados).getByText('Registro do aceite (data e versão)')).toBeInTheDocument()
    expect(VERSAO_DOCUMENTOS).toBe('1.2')
  })

  // 2026-10-20: a exclusão de conta passou a existir (botão em Meu Perfil); o texto diz o que apaga e o que permanece.
  it('descreve a exclusão da conta: botão, o que é apagado e o que permanece', () => {
    const { container } = renderPagina()
    const texto = (container.textContent ?? '').replace(/\s+/g, ' ')
    expect(texto).not.toMatch(/não há botão para excluir a conta/i)
    expect(texto).toMatch(/Excluir minha conta/)
    expect(texto).toMatch(/Meu Perfil/)
    expect(texto).toMatch(/Conta excluída/)
    // Fechamento do 9.5 (F5): nenhuma tela mostra o nome de quem registrou, então o texto não promete que "aparece" assim;
    // promete só o que o código faz: a conta passa a se chamar Conta excluída.
    expect(texto).not.toMatch(/aparece como Conta excluída/)
    expect(texto).toMatch(/a conta passa a se chamar Conta excluída/)
    // Quem cadastrou um idoso sem login e era o único vínculo aprovado dele apaga os dados desse idoso também.
    expect(texto).toMatch(/Idosos que você cadastrou e que não tenham outro vínculo aprovado também são apagados/)
    // O que fica na linha não é só a prova de aceite (também uid, tipo de perfil e datas): sem "só".
    expect(texto).not.toMatch(/guardamos só o registro/)
    expect(texto).toMatch(/data e versão/)
    expect(texto).toMatch(/cópias de segurança/i)
    // Sem prometer prazo que não foi verificado: nenhum "em até N dias" para apagar cópias de segurança.
    expect(texto).not.toMatch(/cópias de segurança[^.]*\d+ dias/i)
  })

  it('o idoso cadastrado por familiar e sem login segue pedindo a exclusão pelo contato', () => {
    const { container } = renderPagina()
    expect(container.textContent?.replace(/\s+/g, ' ')).toMatch(/idoso cadastrado por um familiar que ainda não entrou no site[^.]*contato/i)
  })

  it('tem as tabelas de dados e de compartilhamento', () => {
    renderPagina()
    expect(screen.getByRole('table', { name: /dados que coletamos/i })).toBeInTheDocument()
    const compartilhamento = screen.getByRole('table', { name: /quem recebe dados/i })
    for (const provedor of ['Firebase Authentication', 'Microsoft Azure', 'Render', 'Vercel', 'Brevo']) {
      expect(within(compartilhamento).getByText(provedor, { exact: false })).toBeInTheDocument()
    }
  })

  it('não cita nada fora do escopo', () => {
    const { container } = renderPagina()
    expect(container.textContent).not.toMatch(/alexa|mensagens|loja|microfone|lar são vicente/i)
  })
})

import { Component, type ReactNode } from 'react'
import { recarregarPagina } from '../lib/recarregar'

type Estado = { falhou: boolean }

// Pega falha de chunk lazy (aba antiga depois de deploy) e qualquer erro de render das rotas.
// Mensagem fixa: não mostra o texto do erro.
// resetKey (a rota atual) limpa o erro ao navegar, sem remontar os filhos enquanto não há erro.
class LimiteErro extends Component<{ children: ReactNode; resetKey: string }, Estado> {
  state: Estado = { falhou: false }

  static getDerivedStateFromError(): Estado {
    return { falhou: true }
  }

  componentDidUpdate(anterior: { resetKey: string }) {
    if (this.state.falhou && anterior.resetKey !== this.props.resetKey) {
      this.setState({ falhou: false })
    }
  }

  render() {
    if (!this.state.falhou) return this.props.children

    return (
      <main className="flex min-h-screen items-center justify-center bg-white p-8 dark:bg-[#0F0F17]">
        <div role="alert" className="max-w-md text-center text-gray-900 dark:text-[#F5F5FA]">
          <h1 className="text-2xl font-bold">Algo deu errado</h1>
          <p className="mt-3 text-lg">
            Não foi possível carregar esta página. Isso pode acontecer quando o site é atualizado
            com a aba aberta.
          </p>
          <button
            type="button"
            onClick={recarregarPagina}
            className="mt-6 min-h-12 rounded-xl bg-[#5F56EC] px-6 py-3 text-lg font-semibold text-white hover:bg-[#554CD8]"
          >
            Recarregar a página
          </button>
        </div>
      </main>
    )
  }
}

export default LimiteErro

import { chamarApi } from '../lib/chamarApi'
import { entrarComTokenDemo } from '../lib/auth'

// Modo demonstração (docs/modo-demonstracao.md): contas FICTÍCIAS de um elenco fixo do backend. Nada aqui guarda
// estado no navegador; a sessão é só a do Firebase.
export type ContaDemo = { slug: string; nome: string; tipo_perfil: 'idoso' | 'cuidador' | 'familiar'; descricao: string }
export type EstadoDemo = { contas: ContaDemo[]; atual: string | null }

export async function buscarEstadoDemo(): Promise<EstadoDemo> {
  return chamarApi('/demo/estado')
}

// Pede o custom token da conta e entra com ele (a sessão anterior é trocada pela da conta escolhida).
export async function entrarComoDemo(slug: string) {
  const { token } = await chamarApi('/demo/entrar-como', { method: 'POST', body: JSON.stringify({ conta: slug }) })
  await entrarComTokenDemo(token)
}

export async function restaurarDemo() {
  await chamarApi('/demo/restaurar', { method: 'POST' })
}

export const ROTULO_PERFIL: Record<ContaDemo['tipo_perfil'], string> = {
  idoso: 'Idoso',
  cuidador: 'Cuidador',
  familiar: 'Familiar',
}

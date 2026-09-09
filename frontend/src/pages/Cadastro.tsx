import { useState, type FormEvent } from 'react'

import {
  registerUser,
  loginWithGoogle,
  syncUser,
  type TipoPerfil
} from '../lib/auth'

import CampoTexto from '../components/cadastro/CampoTexto'
import TipoPerfilCampo from '../components/cadastro/TipoPerfil'
import BotaoGoogle from '../components/cadastro/BotaoGoogle'

function Cadastro() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [tipoPerfil, setTipoPerfil] = useState<TipoPerfil>('idoso')
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    setErro(null)

    try {
      await registerUser(email, senha)

      await syncUser({
        tipoPerfil,
        nome
      })
    } catch (err) {
      console.error('Falha no cadastro (e-mail/senha):', err)
      setErro(
        'Não foi possível criar a conta. Confira os dados e tente novamente.'
      )
    }
  }

  async function handleGoogleCadastro() {
    setErro(null)

    try {
      await loginWithGoogle()

      await syncUser({
        tipoPerfil
      })
    } catch (err) {
      console.error('Falha no cadastro (Google):', err)
      setErro(
        'Não foi possível criar a conta com o Google.'
      )
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4"
      >
        <h1 className="text-3xl font-bold text-gray-900">
          Criar conta
        </h1>

        <CampoTexto
          id="nome"
          label="Nome completo"
          type="text"
          value={nome}
          onChange={setNome}
        />

        <TipoPerfilCampo
          tipoPerfil={tipoPerfil}
          setTipoPerfil={setTipoPerfil}
        />

        <CampoTexto
          id="email"
          label="E-mail"
          type="email"
          value={email}
          onChange={setEmail}
        />

        <CampoTexto
          id="senha"
          label="Senha"
          type="password"
          value={senha}
          onChange={setSenha}
        />

        {erro && (
          <p
            role="alert"
            className="text-lg text-red-700"
          >
            {erro}
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded bg-blue-700 p-3 text-lg font-semibold text-white"
        >
          Criar conta
        </button>

        <BotaoGoogle
          onClick={handleGoogleCadastro}
        />
      </form>
    </main>
  )
}

export default Cadastro
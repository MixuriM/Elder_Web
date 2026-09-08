import { useState, type FormEvent } from 'react'
//importa as funções de autenticação e sincronização de usuário
import {
  registerUser, //função para registrar um novo usuário com e-mail e senha
  loginWithGoogle, //função para autenticar o usuário com a conta do Google
  syncUser, //função para sincronizar os dados do usuário com o banco de dados
  type TipoPerfil //tipo de perfil do usuário (idoso, cuidador ou familiar)
} from '../lib/auth' //importa os tipos de perfil do usuário

//importa os componentes que serão utilizados na página de cadastro
import CampoTexto from '../components/cadastro/CampoTexto'
import TipoPerfilCampo from '../components/cadastro/TipoPerfil'
import BotaoGoogle from '../components/cadastro/BotaoGoogle'


//define a função principal do componente de cadastro
function Cadastro() {
  const [nome, setNome] = useState('') //estado para armazenar o nome do usuário
  const [email, setEmail] = useState('') //estado para armazenar o e-mail do usuário
  const [senha, setSenha] = useState('') //estado para armazenar a senha do usuário
  const [tipoPerfil, setTipoPerfil] = useState<TipoPerfil>('idoso') //estado para armazenar o tipo de perfil do usuário
  const [erro, setErro] = useState<string | null>(null) //estado para armazenar mensagens de erro

//define a função que será chamada quando o formulário for enviado
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    setErro(null)

    try {
      await registerUser(email, senha) //chama a função para registrar o usuário com e-mail e senha

      await syncUser({ //chama a função para sincronizar os dados do usuário com o banco de dados
        tipoPerfil,
        nome
      })
    } catch {
      setErro(
        'Não foi possível criar a conta. Confira os dados e tente novamente.'
      )
    }
  }

  async function handleGoogleCadastro() { //define a função que será chamada quando o botão de cadastro com Google for clicado
    setErro(null)

    try {
      await loginWithGoogle()

      await syncUser({
        tipoPerfil
      })
    } catch {
      setErro(
        'Não foi possível criar a conta com o Google.'
      )
    }
  }

  return (
    //define a estrutura da página de cadastro
    <main className="flex min-h-screen items-center justify-center bg-white p-8"> 
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4"
      >
        <h1 className=" items-end text-3xl font-bold text-[#1f2937]">
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
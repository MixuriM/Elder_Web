import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import RotaProtegida from './components/RotaProtegida'
import LimiteErro from './components/LimiteErro'
import { FotoPerfilProvider } from './contexts/FotoPerfilContext'

// Landing e Login ficam no bundle inicial (entrada e retorno do usuário); o resto carrega por rota.
const Home = lazy(() => import('./pages/Home'))
const Cadastro = lazy(() => import('./pages/Cadastro'))
const Welcome = lazy(() => import('./pages/Welcome'))
const EsqueciSenha = lazy(() => import('./pages/EsqueciSenha'))
const ConfirmarEmail = lazy(() => import('./pages/ConfirmarEmail'))
const Perfil = lazy(() => import('./pages/Perfil'))
const Vinculos = lazy(() => import('./pages/Vinculos'))
const VinculoDetalhe = lazy(() => import('./pages/VinculoDetalhe'))
const Saude = lazy(() => import('./pages/Saude'))
const Remedios = lazy(() => import('./pages/Remedios'))
const Agenda = lazy(() => import('./pages/Agenda'))
const Alimentacao = lazy(() => import('./pages/Alimentacao'))
const SobreNos = lazy(() => import('./pages/SobreNos'))
const Orientacoes = lazy(() => import('./pages/Orientacoes'))

function CarregandoPagina() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-8 dark:bg-[#0F0F17]">
      <p role="status" className="text-lg text-gray-900 dark:text-[#F5F5FA]">
        Carregando...
      </p>
    </main>
  )
}

function App() {
  const { pathname } = useLocation()

  return (
    <FotoPerfilProvider>
    {/* key: trocar de rota limpa o erro anterior */}
    <LimiteErro key={pathname}>
    <Suspense fallback={<CarregandoPagina />}>
    <Routes>
      <Route path="/" element={<LandingPage/>} />
      <Route
        path="/Home"
        element={
          <RotaProtegida>
            <Home/>
          </RotaProtegida>
        }
      />
      <Route path="/sobre-nos" element={<SobreNos />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />
      <Route path="/esqueci-senha" element={<EsqueciSenha />} />
      <Route path="/confirmar-email" element={<ConfirmarEmail />} />
      <Route
        path="/perfil"
        element={
          <RotaProtegida>
            <Perfil />
          </RotaProtegida>
        }
      />
      <Route
        path="/vinculos"
        element={
          <RotaProtegida>
            <Vinculos />
          </RotaProtegida>
        }
      />
      <Route
        path="/vinculos/:id"
        element={
          <RotaProtegida>
            <VinculoDetalhe />
          </RotaProtegida>
        }
      />
      <Route
        path="/saude"
        element={
          <RotaProtegida>
            <Saude />
          </RotaProtegida>
        }
      />
      <Route
        path="/remedios"
        element={
          <RotaProtegida>
            <Remedios />
          </RotaProtegida>
        }
      />
      <Route
        path="/agenda"
        element={
          <RotaProtegida>
            <Agenda />
          </RotaProtegida>
        }
      />
      <Route
        path="/alimentacao"
        element={
          <RotaProtegida>
            <Alimentacao />
          </RotaProtegida>
        }
      />
      <Route
        path="/orientacoes"
        element={
          <RotaProtegida>
            <Orientacoes />
          </RotaProtegida>
        }
      />
    </Routes>
    </Suspense>
    </LimiteErro>
    </FotoPerfilProvider>
  )
}

export default App

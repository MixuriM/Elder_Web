import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import LimiteErro from './components/LimiteErro'
import RotaComVinculo from './components/RotaComVinculo'
import { FotoPerfilProvider } from './contexts/FotoPerfilContext'

// Landing e Login ficam no bundle inicial (entrada e retorno do usuário); o resto carrega por rota.
const LayoutAutenticado = lazy(() => import('./components/layout/LayoutAutenticado'))
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
    <LimiteErro resetKey={pathname}>
    <Suspense fallback={<CarregandoPagina />}>
    <Routes>
      <Route path="/" element={<LandingPage/>} />
      <Route path="/sobre-nos" element={<SobreNos />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />
      <Route path="/esqueci-senha" element={<EsqueciSenha />} />
      <Route path="/confirmar-email" element={<ConfirmarEmail />} />
      <Route path="/vinculos" element={<Navigate to="/familia" replace />} />

      {/* Telas autenticadas: menu, cabeçalho e <main> únicos vêm do layout. */}
      <Route element={<LayoutAutenticado />}>
        <Route path="/Home" element={<Home />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/familia" element={<Vinculos tipo="familiar" />} />
        <Route path="/cuidadores" element={<Vinculos tipo="cuidador" />} />
        <Route path="/vinculos/:id" element={<VinculoDetalhe />} />
        {/* Telas de dados: cuidador e familiar só com ao menos 1 vínculo aprovado. */}
        <Route element={<RotaComVinculo />}>
          <Route path="/saude" element={<Saude />} />
          <Route path="/remedios" element={<Remedios />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/alimentacao" element={<Alimentacao />} />
        </Route>
        <Route path="/orientacoes" element={<Orientacoes />} />
      </Route>
    </Routes>
    </Suspense>
    </LimiteErro>
    </FotoPerfilProvider>
  )
}

export default App

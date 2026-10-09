import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import LimiteErro from './components/LimiteErro'
import RotaComVinculo from './components/RotaComVinculo'
import { FotoPerfilProvider } from './contexts/FotoPerfilContext'
import { useAcesso } from './contexts/useAcesso'
import { carregouChunk } from './lib/recarregar'

// Landing e Login ficam no bundle inicial (entrada e retorno do usuário); o resto carrega por rota.
const LayoutAutenticado = lazy(() => import('./components/layout/LayoutAutenticado').then(carregouChunk))
const Home = lazy(() => import('./pages/Home').then(carregouChunk))
const Cadastro = lazy(() => import('./pages/Cadastro').then(carregouChunk))
const Welcome = lazy(() => import('./pages/Welcome').then(carregouChunk))
const EsqueciSenha = lazy(() => import('./pages/EsqueciSenha').then(carregouChunk))
const ConfirmarEmail = lazy(() => import('./pages/ConfirmarEmail').then(carregouChunk))
const Perfil = lazy(() => import('./pages/Perfil').then(carregouChunk))
const Vinculos = lazy(() => import('./pages/Vinculos').then(carregouChunk))
const VinculoDetalhe = lazy(() => import('./pages/VinculoDetalhe').then(carregouChunk))
const Saude = lazy(() => import('./pages/Saude').then(carregouChunk))
const Remedios = lazy(() => import('./pages/Remedios').then(carregouChunk))
const Agenda = lazy(() => import('./pages/Agenda').then(carregouChunk))
const Alimentacao = lazy(() => import('./pages/Alimentacao').then(carregouChunk))
const SobreNos = lazy(() => import('./pages/SobreNos').then(carregouChunk))
const Orientacoes = lazy(() => import('./pages/Orientacoes').then(carregouChunk))
const Avisos = lazy(() => import('./pages/Avisos').then(carregouChunk))
const Configuracoes = lazy(() => import('./pages/Configuracoes').then(carregouChunk))

function CarregandoPagina() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-8 dark:bg-[#0F0F17]">
      <p role="status" className="text-lg text-gray-900 dark:text-[#F5F5FA]">
        Carregando...
      </p>
    </main>
  )
}

// Endereço antigo /vinculos: leva à lista do próprio perfil (cuidador não tem Família no menu).
function RedirecionarVinculos() {
  const { estado, tipoPerfil } = useAcesso()
  if (estado === 'carregando') {
    return (
      <p role="status" className="p-8 text-lg text-gray-900 dark:text-[#F5F5FA]">
        Carregando...
      </p>
    )
  }
  return <Navigate to={tipoPerfil === 'cuidador' ? '/cuidadores' : '/familia'} replace />
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

      {/* Telas autenticadas: menu, cabeçalho e <main> únicos vêm do layout. */}
      <Route element={<LayoutAutenticado />}>
        <Route path="/Home" element={<Home />} />
        <Route path="/vinculos" element={<RedirecionarVinculos />} />
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
        <Route path="/avisos" element={<Avisos />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
      </Route>
    </Routes>
    </Suspense>
    </LimiteErro>
    </FotoPerfilProvider>
  )
}

export default App

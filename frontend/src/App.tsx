import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import Home from './pages/Home'
import Login from './pages/Login'
import Cadastro from './pages/Cadastro'
import Welcome from './pages/Welcome'
import EsqueciSenha from './pages/EsqueciSenha'
import ConfirmarEmail from './pages/ConfirmarEmail'
import Perfil from './pages/Perfil'
import Vinculos from './pages/Vinculos'
import Saude from './pages/Saude'
import RotaProtegida from './components/RotaProtegida'
import { FotoPerfilProvider } from './contexts/FotoPerfilContext'

function App() {
  return (
    <FotoPerfilProvider>
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
        path="/saude"
        element={
          <RotaProtegida>
            <Saude />
          </RotaProtegida>
        }
      />
    </Routes>
    </FotoPerfilProvider>
  )
}

export default App

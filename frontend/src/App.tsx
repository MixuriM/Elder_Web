import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Cadastro from './pages/Cadastro'
//import Welcome from './pages/Welcome'
import EsqueciSenha from './pages/EsqueciSenha'
import Perfil from './pages/Perfil'
import RotaProtegida from './components/RotaProtegida'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home/>} />
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />
      <Route path="/esqueci-senha" element={<EsqueciSenha />} />
      <Route
        path="/perfil"
        element={
          <RotaProtegida>
            <Perfil />
          </RotaProtegida>
        }
      />
    </Routes>
  )
}

export default App

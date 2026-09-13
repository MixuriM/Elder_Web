import { Routes, Route } from 'react-router-dom'
//import Home from './pages/Home'
import Login from './pages/Login'
import Cadastro from './pages/Cadastro'
import LandingPage from './pages/LandingPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage/>} />
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />
    </Routes>
  )
}

export default App

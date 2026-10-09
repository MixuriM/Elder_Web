import { Navigate, Outlet } from 'react-router-dom'

import { useAcesso } from '../contexts/useAcesso'

// Guarda das telas de dados (saúde, remédios, agenda, alimentação). Cuidador e familiar precisam de ao menos
// um vínculo aprovado; idoso nunca é bloqueado e, em erro de carregamento, não bloqueia ninguém (D3):
// a barreira real é o 403 do backend.
function RotaComVinculo() {
  const { estado, tipoPerfil, temVinculoAprovado } = useAcesso()

  if (estado === 'carregando') {
    return (
      <p role="status" className="p-8 text-lg text-gray-900 dark:text-[#F5F5FA]">
        Carregando...
      </p>
    )
  }

  const precisaDeVinculo = tipoPerfil === 'familiar' || tipoPerfil === 'cuidador'
  if (estado === 'ok' && precisaDeVinculo && !temVinculoAprovado) {
    return (
      <Navigate
        to={tipoPerfil === 'cuidador' ? '/cuidadores' : '/familia'}
        state={{ semVinculo: true }}
        replace
      />
    )
  }

  return <Outlet />
}

export default RotaComVinculo

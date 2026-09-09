import type { TipoPerfil } from '../../lib/auth'

type TipoPerfilProps = {
  tipoPerfil: TipoPerfil
  setTipoPerfil: (tipo: TipoPerfil) => void
}

function TipoPerfilCampo({
  tipoPerfil,
  setTipoPerfil
}: TipoPerfilProps) {

  return (
    <fieldset>
      <legend className="text-lg font-medium text-gray-900">
        Eu sou
      </legend>

      <div className="mt-1 space-y-2">

        {(['idoso', 'cuidador', 'familiar'] as const).map((opcao) => (

          <label
            key={opcao}
            className="flex items-center gap-2 text-lg text-gray-900"
          >

            <input
              type="radio"
              name="tipo_perfil"
              value={opcao}
              checked={tipoPerfil === opcao}
              onChange={() => setTipoPerfil(opcao)}
            />

            {opcao === 'idoso'
              ? 'Idoso'
              : opcao === 'cuidador'
              ? 'Cuidador'
              : 'Familiar'}

          </label>

        ))}

      </div>
    </fieldset>
  )
}

export default TipoPerfilCampo
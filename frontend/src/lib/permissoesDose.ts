import { useEffect, useState } from 'react'
import { buscarPermissoesSaude, decidirVisibilidadeDose } from './permissoesSaude'

type Estado = { estado: 'carregando' | 'erro' | 'ok'; escrita: boolean; avisoSemFlag: boolean }

// Item 5.2: mesmo padrão de usePermissoesSaude, com a decisão de dose. Arquivo à parte (e não dentro de
// permissoesSaude.ts) para não mexer no que as telas de saúde já usam. Nunca loga o erro nem o corpo.
export function usePermissoesDose(): Estado {
  const [resultado, setResultado] = useState<Estado>({ estado: 'carregando', escrita: false, avisoSemFlag: false })

  useEffect(() => {
    let ativo = true
    buscarPermissoesSaude()
      .then((vinculos) => ativo && setResultado({ estado: 'ok', ...decidirVisibilidadeDose(vinculos) }))
      .catch(() => ativo && setResultado({ estado: 'erro', escrita: false, avisoSemFlag: false }))
    return () => {
      ativo = false
    }
  }, [])

  return resultado
}

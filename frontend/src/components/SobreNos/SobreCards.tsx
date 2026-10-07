import SobreCard from './SobreCard'
import { secoes } from './sobreNosData'

function SobreCards() {
  return (
    <div
      className="
        mt-10
        grid
        grid-cols-1
        gap-6

        md:grid-cols-2
      "
    >
      {secoes.map((secao, index) => {
        const primeiroCard = index === 0
        const ultimoCard = index === secoes.length - 1

        return (
          <SobreCard
            key={secao.id}
            id={secao.id}
            titulo={secao.titulo}
            texto={secao.texto}
            icone={secao.icone}
            destaque={primeiroCard || ultimoCard}
          />
        )
      })}
    </div>
  )
}

export default SobreCards
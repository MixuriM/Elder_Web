
import SobreCard from './SobreCard'
import { secoes } from './sobreNosData'

function SobreCards() {
  return (
    <div
      className="
        mt-10
        grid grid-cols-1
        gap-6
        md:grid-cols-2
        sm:gap-7
      "
    >
      {secoes.map((secao) => {
        const destaque = [
          'o-que-e',
          'acessibilidade',
          'quem-fez',
        ].includes(secao.id)

        return (
          <SobreCard
            key={secao.id}
            id={secao.id}
            titulo={secao.titulo}
            texto={secao.texto}
            icone={secao.icone}
            destaque={destaque}
          />
        )
      })}
    </div>
  )
}

export default SobreCards


import { equipeColetiva } from './sobreNosData'
// Ajuste o caminho do import conforme seu projeto.

type SobreSecaoProps = {
  id: string
  titulo: string
  texto: string
}

function SobreSecao({
  id,
  titulo,
  texto,
}: SobreSecaoProps) {
  const mostrarFotoEquipe = id === 'quem-fez'

  return (
    <section
      aria-labelledby={id}
      className="space-y-4"
    >
      <h2
        id={id}
        className="
          text-2xl font-bold
          text-[#5F56EC]
          dark:text-[#A18BFF]
        "
      >
        {titulo}
      </h2>

      <p>{texto}</p>

      {/* FOTO COLETIVA DA EQUIPE */}
      {mostrarFotoEquipe && (
        <figure className="mx-auto max-w-3xl space-y-3">
          <div
            className="
              overflow-hidden rounded-2xl
              border border-[#E4DEFF]
              dark:border-[#353052]
            "
          >
            <img
              src={equipeColetiva.foto}
              alt="Marcos, Laureane e Jennifer, equipe de desenvolvimento do Elder Web"
              loading="lazy"
              className="block h-auto w-full"
            />
          </div>

          <figcaption
            className="
              text-center text-sm
              text-gray-600
              dark:text-gray-300
            "
          >
            Equipe de desenvolvimento do Elder Web —
            Etec Fernando Prestes, 2026.
          </figcaption>
        </figure>
      )}
    </section>
  )
}

export default SobreSecao

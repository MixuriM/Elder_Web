
import { equipe } from './sobreNosData'

export default function SobreEquipe() {
  return (
    <section
      aria-labelledby="integrantes-titulo"
      className="mx-auto w-full max-w-5xl py-8"
    >
      <h2
        id="integrantes-titulo"
        className="
          mb-8 text-center text-2xl font-bold
          text-[#5F56EC] dark:text-[#A18BFF]
        "
      >
        Conheça os desenvolvedores
      </h2>

      <div
        className="
          grid grid-cols-1 gap-6
          sm:grid-cols-2 lg:grid-cols-3
        "
      >
        {equipe.map((integrante) => (
          <article
            key={integrante.id}
            className="
              flex flex-col items-center
              rounded-2xl border
              border-[#E4DEFF] bg-white
              px-5 py-8 text-center
              dark:border-[#353052]
              dark:bg-[#151B35]
            "
          >
            <img
              src={integrante.foto}
              alt={`Foto de ${integrante.nome}`}
              loading="lazy"
              decoding="async"
              className="
                mb-5 h-32 w-32
                rounded-full object-cover
                object-center
                ring-4 ring-[#EAE6FF]
                dark:ring-[#353052]
              "
            />

            <h3
              className="
                text-xl font-bold
                text-[#071A38]
                dark:text-[#F5F5FA]
              "
            >
              {integrante.nome}
            </h3>

            <p
              className="
                mt-1 font-medium
                text-[#6258E8]
                dark:text-[#B9B3FF]
              "
            >
              {integrante.cargo}
            </p>

            <p
              className="
                mt-4 text-sm leading-relaxed
                text-gray-600
                dark:text-gray-300
              "
            >
              {integrante.descricao}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

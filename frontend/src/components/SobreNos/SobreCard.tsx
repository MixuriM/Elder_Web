
import type { LucideIcon } from 'lucide-react'
import { UserRound } from 'lucide-react'
import { equipe } from './sobreNosData'

type SobreCardProps = {
  id: string
  titulo: string
  texto: string
  icone: LucideIcon
  destaque?: boolean
}

function SobreCard({
  id,
  titulo,
  texto,
  icone: Icone,
  destaque = false,
}: SobreCardProps) {
  const mostrarEquipe = id === 'quem-fez'

  return (
    <section
      aria-labelledby={`titulo-${id}`}
      className={`
        relative min-w-0
        rounded-2xl
        border border-[#E6E2F5]
        bg-white/90
        p-6
        sm:p-8
        dark:border-[#303149]
        dark:bg-[#191B2A]/95
        ${destaque ? 'md:col-span-2' : ''}
      `}
    >
      {/* CABEÇALHO DO CARD */}
      <div className="flex items-start gap-4">
        <div
          aria-hidden="true"
          className="
            flex h-12 w-12
            shrink-0 items-center
            justify-center rounded-xl
            bg-[#EAE6FF]
            text-[#6258E8]
            dark:bg-[#292641]
            dark:text-[#B9B3FF]
          "
        >
          <Icone size={25} strokeWidth={1.8} />
        </div>

        <div className="min-w-0 flex-1">
          <h2
            id={`titulo-${id}`}
            className="
              text-xl font-bold
              leading-snug
              text-[#071A38]
              sm:text-2xl
              dark:text-[#F5F5FA]
            "
          >
            {titulo}
          </h2>

          <div
            aria-hidden="true"
            className="
              mt-3 h-1 w-12
              rounded-full bg-[#6C63FF]
              dark:bg-[#A18BFF]
            "
          />
        </div>
      </div>

      {/* DESCRIÇÃO */}
      <p
        className="
          mt-5 text-base
          leading-8 text-[#46536B]
          dark:text-[#C7C7D1]
        "
      >
        {texto}
      </p>

      {/* EQUIPE DE DESENVOLVIMENTO */}
      {mostrarEquipe && (
        <div
          className="
            mt-9 grid grid-cols-1
            gap-6 sm:grid-cols-2
            lg:grid-cols-3
          "
        >
          {equipe.map((integrante) => (
            <article
              key={integrante.id}
              className="
                flex min-w-0
                flex-col items-center
                rounded-2xl
                bg-[#F8F7FF]
                p-5 text-center
                dark:bg-[#11141D]
              "
            >
              {/* FOTOGRAFIA 4:5 */}
              <div
                className="
                  flex aspect-[4/5]
                  w-full max-w-[240px]
                  items-center justify-center
                  overflow-hidden rounded-xl
                  bg-[#EAE6FF]
                  dark:bg-[#25243B]
                "
              >
                {integrante.foto ? (
                  <img
                    src={integrante.foto}
                    alt={`Foto de ${integrante.nome}`}
                    loading="lazy"
                    decoding="async"
                    className="
                      h-full w-full
                      object-cover object-center
                    "
                  />
                ) : (
                  <div
                    role="img"
                    aria-label={`Fotografia de ${integrante.nome} indisponível`}
                    className="
                      flex h-full w-full
                      items-center justify-center
                      text-[#6258E8]
                      dark:text-[#B9B3FF]
                    "
                  >
                    <UserRound
                      size={64}
                      strokeWidth={1.4}
                      aria-hidden="true"
                    />
                  </div>
                )}
              </div>

              {/* NOME */}
              <h3
                className="
                  mt-5 text-xl font-bold
                  text-[#071A38]
                  dark:text-[#F5F5FA]
                "
              >
                {integrante.nome}
              </h3>

              {/* FUNÇÃO */}
              <p
                className="
                  mt-1 text-sm font-semibold
                  text-[#5147B5]
                  dark:text-[#B9B3FF]
                "
              >
                {integrante.cargo}
              </p>

              {/* DESCRIÇÃO */}
              <p
                className="
                  mt-3 text-sm leading-6
                  text-[#46536B]
                  dark:text-[#C7C7D1]
                "
              >
                {integrante.descricao}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default SobreCard
